"""post variations per network

The post keeps the idea (title, subject). What changes per network moves to
post_variations (network, format, content, status, expected_date), at most
one per network, with its images in order (variation_images). Each existing
post becomes one variation with its current values and images.

Revision ID: 73686293714e
Revises: 5d1b74d207ff
Create Date: 2026-11-06 15:43:40.924847

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '73686293714e'
down_revision: Union[str, Sequence[str], None] = '5d1b74d207ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The enum types already exist (created by earlier migrations): reuse them
network = postgresql.ENUM('linkedin', 'instagram', 'x', name='network', create_type=False)
post_format = postgresql.ENUM('text', 'single', 'carousel', name='post_format', create_type=False)
post_status = postgresql.ENUM(
    'draft', 'review', 'approved', 'published', name='post_status', create_type=False
)


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'post_variations',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('network', network, nullable=False),
        sa.Column('format', post_format, nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('status', post_status, nullable=False),
        sa.Column('expected_date', sa.Date(), nullable=True),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['post_id'], ['posts.id'], name='post_variations_post_id_fkey', ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id', name='post_variations_pkey'),
        sa.UniqueConstraint('post_id', 'network', name='uq_post_variations_post_id_network'),
    )
    op.create_index('ix_post_variations_post_id', 'post_variations', ['post_id'])
    op.create_index('ix_post_variations_expected_date', 'post_variations', ['expected_date'])

    op.create_table(
        'variation_images',
        sa.Column('variation_id', sa.Uuid(), nullable=False),
        sa.Column('image_id', sa.Uuid(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ['variation_id'], ['post_variations.id'],
            name='variation_images_variation_id_fkey', ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['image_id'], ['images.id'], name='variation_images_image_id_fkey'
        ),
        sa.PrimaryKeyConstraint('variation_id', 'image_id', name='variation_images_pkey'),
    )
    op.create_index('ix_variation_images_image_id', 'variation_images', ['image_id'])

    # Data: each post becomes one variation (same values and timestamps) ...
    op.execute(
        """
        INSERT INTO post_variations
            (id, post_id, network, format, content, status, expected_date,
             created_at, updated_at)
        SELECT gen_random_uuid(), id, network, format, content, status, expected_date,
               created_at, updated_at
        FROM posts
        """
    )
    # ... and its images move to that variation, in the same order
    op.execute(
        """
        INSERT INTO variation_images (variation_id, image_id, position)
        SELECT v.id, pi.image_id, pi.position
        FROM post_images AS pi
        JOIN post_variations AS v ON v.post_id = pi.post_id
        """
    )

    op.drop_index('ix_post_images_image_id', table_name='post_images')
    op.drop_table('post_images')
    op.drop_column('posts', 'network')
    op.drop_column('posts', 'format')
    op.drop_column('posts', 'content')
    op.drop_column('posts', 'status')
    op.drop_column('posts', 'expected_date')


def downgrade() -> None:
    """Downgrade schema. Each post keeps only its first variation (LinkedIn, Instagram, X)."""
    op.add_column('posts', sa.Column('network', network, nullable=True))
    op.add_column('posts', sa.Column('format', post_format, nullable=True))
    op.add_column('posts', sa.Column('content', sa.Text(), nullable=True))
    op.add_column('posts', sa.Column('status', post_status, nullable=True))
    op.add_column('posts', sa.Column('expected_date', sa.Date(), nullable=True))
    op.execute(
        """
        UPDATE posts AS p
        SET network = v.network, format = v.format, content = v.content,
            status = v.status, expected_date = v.expected_date
        FROM (
            SELECT DISTINCT ON (post_id) *
            FROM post_variations
            ORDER BY post_id, network
        ) AS v
        WHERE v.post_id = p.id
        """
    )
    # Posts without variations (should not exist) get valid defaults
    op.execute(
        """
        UPDATE posts
        SET network = 'linkedin', format = 'text', status = 'draft'
        WHERE network IS NULL
        """
    )
    op.alter_column('posts', 'network', nullable=False)
    op.alter_column('posts', 'format', nullable=False)
    op.alter_column('posts', 'status', nullable=False)

    op.create_table(
        'post_images',
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('image_id', sa.Uuid(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ['post_id'], ['posts.id'], name='post_images_post_id_fkey', ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(['image_id'], ['images.id'], name='post_images_image_id_fkey'),
        sa.PrimaryKeyConstraint('post_id', 'image_id', name='post_images_pkey'),
    )
    op.create_index('ix_post_images_image_id', 'post_images', ['image_id'], unique=False)
    op.execute(
        """
        INSERT INTO post_images (post_id, image_id, position)
        SELECT v.post_id, vi.image_id, vi.position
        FROM variation_images AS vi
        JOIN (
            SELECT DISTINCT ON (post_id) id, post_id
            FROM post_variations
            ORDER BY post_id, network
        ) AS v ON v.id = vi.variation_id
        """
    )

    op.drop_index('ix_variation_images_image_id', table_name='variation_images')
    op.drop_table('variation_images')
    op.drop_index('ix_post_variations_expected_date', table_name='post_variations')
    op.drop_index('ix_post_variations_post_id', table_name='post_variations')
    op.drop_table('post_variations')
