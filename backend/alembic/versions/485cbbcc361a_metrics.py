"""metrics

One collection of a published variation's numbers, typed in or imported from
the network's CSV export (decision 32).

Revision ID: 485cbbcc361a
Revises: b806fb1c596b
Create Date: 2026-11-06 17:25:26.860614

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '485cbbcc361a'
down_revision: Union[str, Sequence[str], None] = 'b806fb1c596b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'metrics',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('variation_id', sa.Uuid(), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('impressions', sa.Integer(), nullable=False),
        sa.Column('likes', sa.Integer(), nullable=False),
        sa.Column('comments', sa.Integer(), nullable=False),
        sa.Column('shares', sa.Integer(), nullable=False),
        sa.Column('clicks', sa.Integer(), nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['variation_id'], ['post_variations.id'],
            name='metrics_variation_id_fkey', ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='metrics_pkey'),
    )
    op.create_index('ix_metrics_user_id', 'metrics', ['user_id'])
    op.create_index('ix_metrics_variation_id', 'metrics', ['variation_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_metrics_variation_id', table_name='metrics')
    op.drop_index('ix_metrics_user_id', table_name='metrics')
    op.drop_table('metrics')
