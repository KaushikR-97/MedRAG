import pytest
import time
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import Base, get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.auth_service import clear_login_failures, _local_ip_rates

# Setup test SQLite database using shared memory StaticPool to prevent Windows file locking issues
engine = create_engine(
    "sqlite:///file:prod_auth_db?mode=memory&cache=shared",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    from app.core.security import hash_password
    doc = User(
        id="prod-auth-doctor-id",
        email="doctor-prod@medrag.in",
        hashed_password=hash_password("SuperSecretSecurePassword123"),
        full_name="Dr. Production Security",
        role="doctor",
        registration_number="SEC-12345"
    )
    db.merge(doc)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    clear_login_failures("doctor-prod@medrag.in")
    _local_ip_rates.clear()

@pytest.fixture(autouse=True)
def setup_overrides():
    orig_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides = orig_overrides

client = TestClient(app)

def test_refresh_token_rotation_and_mfa() -> None:
    # 1. Login step 1: MFA initiation
    login_res = client.post("/auth/login", json={"email": "doctor-prod@medrag.in", "password": "SuperSecretSecurePassword123"})
    assert login_res.status_code == 200
    mfa_data = login_res.json()
    assert mfa_data["mfa_required"] is True
    mfa_token = mfa_data["mfa_token"]
    
    # 2. Login step 2: MFA verification
    from app.services.auth_service import _local_login_mfa_otps
    otp = list(_local_login_mfa_otps.values())[0][0]
    verify_res = client.post("/auth/mfa-verify", json={"mfa_token": mfa_token, "otp": otp})
    assert verify_res.status_code == 200
    tokens = verify_res.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    
    # 3. Refresh token rotation
    refresh_res = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh_res.status_code == 200
    new_tokens = refresh_res.json()
    assert new_tokens["access_token"] != tokens["access_token"]
    assert new_tokens["refresh_token"] != tokens["refresh_token"]

def test_token_reuse_detection() -> None:
    # 1. Login & verify MFA to get tokens
    login_res = client.post("/auth/login", json={"email": "doctor-prod@medrag.in", "password": "SuperSecretSecurePassword123"})
    mfa_token = login_res.json()["mfa_token"]
    from app.services.auth_service import _local_login_mfa_otps
    otp = list(_local_login_mfa_otps.values())[0][0]
    verify_res = client.post("/auth/mfa-verify", json={"mfa_token": mfa_token, "otp": otp})
    tokens = verify_res.json()
    refresh_token_1 = tokens["refresh_token"]
    
    # 2. Refresh it first time (normal rotation)
    ref1_res = client.post("/auth/refresh", json={"refresh_token": refresh_token_1})
    assert ref1_res.status_code == 200
    ref1_tokens = ref1_res.json()
    refresh_token_2 = ref1_tokens["refresh_token"]
    
    # 3. Re-present the first refresh token (replay attack)
    ref2_res = client.post("/auth/refresh", json={"refresh_token": refresh_token_1})
    assert ref2_res.status_code == 401
    
    # 4. Verify that token 2 is also invalidated due to reuse detection
    ref3_res = client.post("/auth/refresh", json={"refresh_token": refresh_token_2})
    assert ref3_res.status_code == 401

def test_login_lockout() -> None:
    # 1. Attempt login with wrong password 5 times
    for _ in range(5):
        client.post("/auth/login", json={"email": "doctor-prod@medrag.in", "password": "wrong-password"})
        
    # 2. 6th login attempt should be locked out (403 Forbidden)
    lockout_res = client.post("/auth/login", json={"email": "doctor-prod@medrag.in", "password": "SuperSecretSecurePassword123"})
    assert lockout_res.status_code == 403
    assert "locked" in lockout_res.text.lower()

def test_password_reset_flow() -> None:
    # 1. Forgot password request
    forgot_res = client.post("/auth/forgot-password", json={"email": "doctor-prod@medrag.in"})
    assert forgot_res.status_code == 200
    from app.services.auth_service import _local_otps
    otp = _local_otps["doctor-prod@medrag.in"][0]
    
    # 2. Reset password
    reset_res = client.post("/auth/reset-password", json={
        "email": "doctor-prod@medrag.in",
        "otp": otp,
        "new_password": "NewSuperSecretPassword456"
    })
    assert reset_res.status_code == 200
    
    # 3. Login with new password
    login_res = client.post("/auth/login", json={"email": "doctor-prod@medrag.in", "password": "NewSuperSecretPassword456"})
    assert login_res.status_code == 200

def test_rate_limiting() -> None:
    # Trigger 60 requests within limit to a nonexistent email to avoid slow bcrypt checks
    for _ in range(60):
        client.post("/auth/login", json={"email": "nonexistent-rate-limit@medrag.in", "password": "wrong-password"})
        
    # The 61st request should be rate-limited with 429
    rate_res = client.post("/auth/login", json={"email": "nonexistent-rate-limit@medrag.in", "password": "SuperSecretSecurePassword123"})
    assert rate_res.status_code == 429
