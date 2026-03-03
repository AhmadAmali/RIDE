"""add matched_chunk and reviewed_at to system_mappings

Revision ID: a1b2c3d4e5f6
Revises: 336aed290fb2
Create Date: 2026-03-03 06:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '336aed290fb2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('system_mappings', sa.Column('matched_chunk', sa.Text(), nullable=True))
    op.add_column('system_mappings', sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('system_mappings', 'reviewed_at')
    op.drop_column('system_mappings', 'matched_chunk')
