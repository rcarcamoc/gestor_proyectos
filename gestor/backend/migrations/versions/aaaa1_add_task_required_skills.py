"""add_task_required_skills

Revision ID: aaaa1_task_skills
Revises: 9999f_telegram_bot
Create Date: 2026-04-25 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aaaa1_task_skills'
down_revision: Union[str, Sequence[str], None] = '9999f_telegram_bot'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'task_required_skills',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('min_level', sa.String(length=50), nullable=True, server_default='basic'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_task_required_skills_id'), 'task_required_skills', ['id'], unique=False)
    op.create_index(op.f('ix_task_required_skills_task_id'), 'task_required_skills', ['task_id'], unique=False)
    op.create_index(op.f('ix_task_required_skills_skill_id'), 'task_required_skills', ['skill_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_task_required_skills_skill_id'), table_name='task_required_skills')
    op.drop_index(op.f('ix_task_required_skills_task_id'), table_name='task_required_skills')
    op.drop_index(op.f('ix_task_required_skills_id'), table_name='task_required_skills')
    op.drop_table('task_required_skills')
