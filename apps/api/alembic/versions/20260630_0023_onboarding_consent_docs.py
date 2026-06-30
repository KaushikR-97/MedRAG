"""onboarding fields and selected document consent

Revision ID: 20260630_0023
Revises: 20260629_0022
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa


revision = "20260630_0023"
down_revision = "20260629_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("gender", sa.String(length=32), nullable=True, server_default=""))
    op.add_column("patient_profiles", sa.Column("height_cm", sa.Float(), nullable=True))
    op.add_column("patient_profiles", sa.Column("weight_kg", sa.Float(), nullable=True))
    op.add_column("consent_grants", sa.Column("document_ids", sa.String(length=2000), nullable=False, server_default=""))
    op.add_column("patient_access_requests", sa.Column("requested_document_ids", sa.String(length=2000), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("patient_access_requests", "requested_document_ids")
    op.drop_column("consent_grants", "document_ids")
    op.drop_column("patient_profiles", "weight_kg")
    op.drop_column("patient_profiles", "height_cm")
    op.drop_column("users", "gender")
