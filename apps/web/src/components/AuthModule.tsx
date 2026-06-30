import React, { useState } from "react";
import { KeyRound, Lock, User, UserCheck } from "lucide-react";
import { api, AuthResponse } from "../api/client";

type AuthModuleProps = {
  onLoginSuccess: (session: AuthResponse, token: string) => void;
};

export const AuthModule: React.FC<AuthModuleProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "mfa">("login");
  const [mfaToken, setMfaToken] = useState("");
  const [simulatedMfaOtp, setSimulatedMfaOtp] = useState("");
  const [email, setEmail] = useState("patient@example.com");
  const [password, setPassword] = useState("StrongPass123");
  const [fullName, setFullName] = useState("Demo Patient");
  const [role, setRole] = useState("patient");
  const [bloodGroup, setBloodGroup] = useState("B+");
  const [age, setAge] = useState("35");
  const [gender, setGender] = useState("female");
  const [location, setLocation] = useState("Bengaluru");
  const [heightCm, setHeightCm] = useState("165");
  const [weightKg, setWeightKg] = useState("68");
  const [allergies, setAllergies] = useState("No known drug allergy");
  const [chronicConditions, setChronicConditions] = useState("Diabetes follow-up");
  const [currentMedications, setCurrentMedications] = useState("Metformin as prescribed");
  const [onboardingDocs, setOnboardingDocs] = useState<File[]>([]);
  const [onboardingDocType, setOnboardingDocType] = useState("past_record");
  const [clinicName, setClinicName] = useState("My Clinic");
  const [clinicAddress, setClinicAddress] = useState("Clinic address");
  const [hospitalName, setHospitalName] = useState("City Hospital");
  const [hospitalAddress, setHospitalAddress] = useState("Hospital address");
  const [hospitalDepartments, setHospitalDepartments] = useState("General Medicine, Cardiology");
  const [phone, setPhone] = useState("+919999988888");
  const [regNo, setRegNo] = useState("");
  
  // Password Reset States
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.login({ email, password });
      if (res.mfa_required) {
        setMfaToken(res.mfa_token);
        setSimulatedMfaOtp(res.simulated_otp || "");
        setMode("mfa");
        setOtp(""); // Reset OTP input for the verification screen
        setSuccess(res.simulated_otp ? `Demo OTP: ${res.simulated_otp}` : "2-Factor Challenge: Check backend logs for the OTP.");
      } else {
        onLoginSuccess(res as any, (res as any).access_token);
      }
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.verifyMfa({ mfa_token: mfaToken, otp });
      setSuccess("Authentication verified successfully! Redirecting...");
      onLoginSuccess(res, res.access_token);
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const common = {
        email,
        password,
        full_name: fullName,
        role,
        phone,
        registration_number: role !== "patient" ? regNo : "",
        age: age ? Number(age) : undefined,
        gender,
        city: location,
      };
      const res = role === "patient"
        ? await api.registerPatientIntake({
            ...common,
            blood_group: bloodGroup,
            height_cm: heightCm ? Number(heightCm) : undefined,
            weight_kg: weightKg ? Number(weightKg) : undefined,
            allergies,
            chronic_conditions: chronicConditions,
            current_medications: currentMedications,
            documents: onboardingDocs.map((file) => ({ file, document_type: onboardingDocType })),
          })
        : await api.register({
            ...common,
            clinic_name: role === "doctor" ? clinicName : "",
            clinic_address: role === "doctor" ? clinicAddress : "",
            hospital_name: role === "hospital_admin" ? hospitalName : "",
            hospital_address: role === "hospital_admin" ? hospitalAddress : "",
            hospital_departments: role === "hospital_admin" ? hospitalDepartments : "",
          });
      onLoginSuccess(res, res.access_token);
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.requestPasswordReset({ email });
      setSuccess("If this email is registered, a password reset code has been sent.");
      if (res.simulated_otp) {
        setSuccess(`[DEMO MODE] Reset OTP generated: ${res.simulated_otp}`);
      }
      setMode("forgot"); // Stay on page to input OTP
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.resetPassword({ email, otp, new_password: newPassword });
      setSuccess("Password has been reset successfully. Please log in.");
      setMode("login");
    } catch (err: any) {
      setError(err.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
    <div className="auth-card">
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
        <div style={{ background: "rgba(26,115,232,0.15)", padding: "12px", borderRadius: "12px", color: "var(--primary)" }}>
          <KeyRound size={28} />
        </div>
      </div>
      
      <h2 style={{ textAlign: "center", fontSize: "1.5rem", marginBottom: "10px" }}>
        {mode === "login" ? "Welcome to MedRAG" : mode === "register" ? "Create Account" : "Reset Password"}
      </h2>
      <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.85rem", marginBottom: "24px" }}>
        {mode === "login" ? "Sign in to access your dashboard" : mode === "register" ? "Register as patient, doctor or admin" : "Verify with OTP and choose a new password"}
      </p>

      {error && <div className="toast toast-error" style={{ marginBottom: "16px" }}>{error}</div>}
      {success && <div className="toast toast-success" style={{ marginBottom: "16px" }}>{success}</div>}

      {mode === "login" && (
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="label">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input" required />
          </div>
          <button type="submit" className="button" disabled={loading} style={{ marginTop: "10px" }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginTop: "12px" }}>
            <span style={{ color: "var(--primary)", cursor: "pointer" }} onClick={() => setMode("register")}>Create account</span>
            <span style={{ color: "var(--muted)", cursor: "pointer" }} onClick={() => setMode("forgot")}>Forgot password?</span>
          </div>
        </form>
      )}

      {mode === "register" && (
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="label">Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input" required placeholder="Min 10 characters" />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="input" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <div>
              <label className="label">Age</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value)} className="input">
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">User Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="input">
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="hospital_admin">Hospital Admin</option>
            </select>
          </div>
          {role !== "patient" && (
            <div>
              <label className="label">Medical Council Registration Number</label>
              <input type="text" value={regNo} onChange={e => setRegNo(e.target.value)} className="input" required />
            </div>
          )}
          {role === "patient" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div>
                  <label className="label">Blood Group</label>
                  <input type="text" value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Height (cm)</label>
                  <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Weight (kg)</label>
                  <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Chronic Diseases List</label>
                <textarea value={chronicConditions} onChange={e => setChronicConditions(e.target.value)} className="input" rows={2} />
              </div>
              <div>
                <label className="label">Allergies</label>
                <input type="text" value={allergies} onChange={e => setAllergies(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Current Medications</label>
                <input type="text" value={currentMedications} onChange={e => setCurrentMedications(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Add Medical Docs to Vault</label>
                <select value={onboardingDocType} onChange={e => setOnboardingDocType(e.target.value)} className="input" style={{ marginBottom: "8px" }}>
                  <option value="past_record">Past Patient Record</option>
                  <option value="lab_report">Lab Report</option>
                  <option value="discharge_summary">Discharge Summary</option>
                  <option value="prescription">Prescription</option>
                  <option value="imaging">Imaging</option>
                </select>
                <input type="file" multiple className="input" onChange={e => setOnboardingDocs(Array.from(e.target.files || []))} />
              </div>
            </>
          )}
          {role === "doctor" && (
            <>
              <div>
                <label className="label">Clinic Name</label>
                <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Clinic Address</label>
                <textarea value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} className="input" rows={2} />
              </div>
            </>
          )}
          {role === "hospital_admin" && (
            <>
              <div>
                <label className="label">Hospital Name</label>
                <input type="text" value={hospitalName} onChange={e => setHospitalName(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Hospital Address</label>
                <textarea value={hospitalAddress} onChange={e => setHospitalAddress(e.target.value)} className="input" rows={2} />
              </div>
              <div>
                <label className="label">Departments</label>
                <input type="text" value={hospitalDepartments} onChange={e => setHospitalDepartments(e.target.value)} className="input" placeholder="General Medicine, Cardiology" />
              </div>
            </>
          )}
          <button type="submit" className="button" disabled={loading} style={{ marginTop: "10px" }}>
            {loading ? "Registering..." : "Register"}
          </button>
          <div style={{ textAlign: "center", fontSize: "0.8rem", marginTop: "12px" }}>
            <span style={{ color: "var(--primary)", cursor: "pointer" }} onClick={() => setMode("login")}>Back to login</span>
          </div>
        </form>
      )}

      {mode === "forgot" && (
        <form onSubmit={otp ? handleResetPassword : handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="label">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" disabled={!!otp} required />
          </div>
          {otp !== "" ? (
            <>
              <div>
                <label className="label">Verification OTP</label>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value)} className="input" placeholder="Enter 6-digit OTP" required />
              </div>
              <div>
                <label className="label">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input" placeholder="Min 10 characters" required />
              </div>
            </>
          ) : null}
          <button type="submit" className="button" disabled={loading} style={{ marginTop: "10px" }}>
            {loading ? "Processing..." : otp ? "Reset Password" : "Send Reset Code"}
          </button>
          <div style={{ textAlign: "center", fontSize: "0.8rem", marginTop: "12px" }}>
            <span style={{ color: "var(--primary)", cursor: "pointer" }} onClick={() => { setMode("login"); setOtp(""); }}>Back to login</span>
          </div>
        </form>
      )}

      {mode === "mfa" && (
        <form onSubmit={handleMfaVerify} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="label">6-Digit Verification Code (OTP)</label>
            {simulatedMfaOtp && (
              <div className="toast toast-success" style={{ marginBottom: "10px" }}>
                Demo OTP: <strong>{simulatedMfaOtp}</strong>
              </div>
            )}
            <input 
              type="text" 
              value={otp} 
              onChange={e => setOtp(e.target.value)} 
              className="input" 
              placeholder="e.g. 123456"
              maxLength={6}
              required 
            />
          </div>
          <button type="submit" className="button" disabled={loading} style={{ marginTop: "10px" }}>
            {loading ? "Verifying..." : "Verify & Sign In"}
          </button>
          <div style={{ textAlign: "center", fontSize: "0.8rem", marginTop: "12px" }}>
            <span style={{ color: "var(--primary)", cursor: "pointer" }} onClick={() => { setMode("login"); setOtp(""); }}>Back to login</span>
          </div>
        </form>
      )}
    </div>
    </div>
  );
};
