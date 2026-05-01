"""add_onboarding_step_to_users

Revision ID: 8253f3746935
Revises: a7aafe5f0ac3
Create Date: 2026-04-09 03:50:49.100054

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8253f3746935'
down_revision: Union[str, Sequence[str], None] = 'a7aafe5f0ac3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add onboarding_step column to users table."""
    op.add_column(
        'users',
        sa.Column('onboarding_step', sa.Integer(), nullable=True, server_default='1')
    )


def downgrade() -> None:
    """Remove onboarding_step column from users table."""
    op.drop_column('users', 'onboarding_step')
