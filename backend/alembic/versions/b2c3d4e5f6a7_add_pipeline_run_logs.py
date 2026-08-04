"""Add pipeline_run_logs table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-02 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create pipeline_run_logs table with indexes."""
    op.create_table(
        'pipeline_run_logs',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('run_id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), sa.ForeignKey('tenants.tenant_id'), nullable=False),
        sa.Column('pipeline_id', sa.String(), nullable=True),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('message', sa.String(2000), nullable=False),
        sa.Column('timestamp', sa.String(), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('extra', sa.JSON(), nullable=True),
    )
    op.create_index('ix_pipeline_run_logs_run_id', 'pipeline_run_logs', ['run_id'])
    op.create_index('ix_pipeline_run_logs_tenant_run', 'pipeline_run_logs', ['tenant_id', 'run_id'])


def downgrade() -> None:
    """Drop pipeline_run_logs table and its indexes."""
    op.drop_index('ix_pipeline_run_logs_tenant_run', table_name='pipeline_run_logs')
    op.drop_index('ix_pipeline_run_logs_run_id', table_name='pipeline_run_logs')
    op.drop_table('pipeline_run_logs')
