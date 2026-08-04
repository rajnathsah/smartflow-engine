"""Add schema_mapping to pipelines

Revision ID: a1b2c3d4e5f6
Revises: 72d2b5225170
Create Date: 2026-08-02 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '72d2b5225170'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add schema_mapping JSON column to pipelines table."""
    op.add_column(
        'pipelines',
        sa.Column('schema_mapping', sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    """Remove schema_mapping JSON column from pipelines table."""
    op.drop_column('pipelines', 'schema_mapping')
