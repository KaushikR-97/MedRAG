"""organizations and fitness integrations

Revision ID: 20260629_0022
Revises: 20260629_0021
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa


revision = "20260629_0022"
down_revision = "20260629_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "care_organizations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("organization_type", sa.String(length=40), nullable=False),
        sa.Column("owner_user_id", sa.String(length=36), nullable=False),
        sa.Column("linked_hospital_id", sa.String(length=36), nullable=True),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_care_organizations_name", "care_organizations", ["name"])
    op.create_index("ix_care_organizations_organization_type", "care_organizations", ["organization_type"])
    op.create_index("ix_care_organizations_owner_user_id", "care_organizations", ["owner_user_id"])
    op.create_index("ix_care_organizations_linked_hospital_id", "care_organizations", ["linked_hospital_id"])
    op.create_index("ix_care_organizations_city", "care_organizations", ["city"])
    op.create_index("ix_care_organizations_state", "care_organizations", ["state"])
    op.create_index("ix_care_organizations_active", "care_organizations", ["active"])

    op.create_table(
        "organization_members",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("organization_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("member_role", sa.String(length=60), nullable=False),
        sa.Column("task_scope", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["care_organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_organization_members_organization_id", "organization_members", ["organization_id"])
    op.create_index("ix_organization_members_user_id", "organization_members", ["user_id"])
    op.create_index("ix_organization_members_member_role", "organization_members", ["member_role"])
    op.create_index("ix_organization_members_status", "organization_members", ["status"])

    op.create_table(
        "fitness_connections",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("patient_id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("connection_mode", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fitness_connections_patient_id", "fitness_connections", ["patient_id"])
    op.create_index("ix_fitness_connections_provider", "fitness_connections", ["provider"])
    op.create_index("ix_fitness_connections_connection_mode", "fitness_connections", ["connection_mode"])
    op.create_index("ix_fitness_connections_status", "fitness_connections", ["status"])

    op.create_table(
        "fitness_activity_samples",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("patient_id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("activity_date", sa.String(length=32), nullable=False),
        sa.Column("steps", sa.Integer(), nullable=False),
        sa.Column("exercise_minutes", sa.Integer(), nullable=False),
        sa.Column("calories", sa.Integer(), nullable=False),
        sa.Column("distance_meters", sa.Float(), nullable=False),
        sa.Column("raw_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fitness_activity_samples_patient_id", "fitness_activity_samples", ["patient_id"])
    op.create_index("ix_fitness_activity_samples_provider", "fitness_activity_samples", ["provider"])
    op.create_index("ix_fitness_activity_samples_activity_date", "fitness_activity_samples", ["activity_date"])


def downgrade() -> None:
    op.drop_index("ix_fitness_activity_samples_activity_date", table_name="fitness_activity_samples")
    op.drop_index("ix_fitness_activity_samples_provider", table_name="fitness_activity_samples")
    op.drop_index("ix_fitness_activity_samples_patient_id", table_name="fitness_activity_samples")
    op.drop_table("fitness_activity_samples")
    op.drop_index("ix_fitness_connections_status", table_name="fitness_connections")
    op.drop_index("ix_fitness_connections_connection_mode", table_name="fitness_connections")
    op.drop_index("ix_fitness_connections_provider", table_name="fitness_connections")
    op.drop_index("ix_fitness_connections_patient_id", table_name="fitness_connections")
    op.drop_table("fitness_connections")
    op.drop_index("ix_organization_members_status", table_name="organization_members")
    op.drop_index("ix_organization_members_member_role", table_name="organization_members")
    op.drop_index("ix_organization_members_user_id", table_name="organization_members")
    op.drop_index("ix_organization_members_organization_id", table_name="organization_members")
    op.drop_table("organization_members")
    op.drop_index("ix_care_organizations_active", table_name="care_organizations")
    op.drop_index("ix_care_organizations_state", table_name="care_organizations")
    op.drop_index("ix_care_organizations_city", table_name="care_organizations")
    op.drop_index("ix_care_organizations_linked_hospital_id", table_name="care_organizations")
    op.drop_index("ix_care_organizations_owner_user_id", table_name="care_organizations")
    op.drop_index("ix_care_organizations_organization_type", table_name="care_organizations")
    op.drop_index("ix_care_organizations_name", table_name="care_organizations")
    op.drop_table("care_organizations")
