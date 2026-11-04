"""post network, format and images

A post is written for one network (posts.network) in one format
(posts.format: text, single or carousel) and can have several library
images in order (post_images), replacing posts.image_id.

Revision ID: 5d1b74d207ff
Revises: be16ff6a976f
Create Date: 2026-11-03 22:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '5d1b74d207ff'
down_revision: Union[str, Sequence[str], None] = 'be16ff6a976f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

network = postgresql.ENUM('linkedin', 'instagram', 'x', name='network', create_type=False)
post_format = postgresql.ENUM('text', 'single', 'carousel', name='post_format', create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    network.create(bind, checkfirst=True)
    post_format.create(bind, checkfirst=True)

    # Existing posts: LinkedIn accepts text-only posts; format follows the image
    op.add_column('posts', sa.Column('network', network, nullable=True))
    op.add_column('posts', sa.Column('format', post_format, nullable=True))
    op.execute(
        """
        UPDATE posts
        SET network = 'linkedin',
            format = CASE WHEN image_id IS NULL THEN 'text' ELSE 'single' END::post_format
        """
    )
    op.alter_column('posts', 'network', nullable=False)
    op.alter_column('posts', 'format', nullable=False)

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
        SELECT id, image_id, 0 FROM posts WHERE image_id IS NOT NULL
        """
    )

    op.drop_constraint('posts_image_id_fkey', 'posts', type_='foreignkey')
    op.drop_index('ix_posts_image_id', table_name='posts')
    op.drop_column('posts', 'image_id')


def downgrade() -> None:
    """Downgrade schema. Only the first image of each post is kept."""
    op.add_column('posts', sa.Column('image_id', sa.Uuid(), nullable=True))
    op.execute(
        """
        UPDATE posts AS p
        SET image_id = (
            SELECT pi.image_id FROM post_images AS pi
            WHERE pi.post_id = p.id
            ORDER BY pi.position
            LIMIT 1
        )
        """
    )
    op.create_index('ix_posts_image_id', 'posts', ['image_id'], unique=False)
    op.create_foreign_key('posts_image_id_fkey', 'posts', 'images', ['image_id'], ['id'])

    op.drop_index('ix_post_images_image_id', table_name='post_images')
    op.drop_table('post_images')

    op.drop_column('posts', 'format')
    op.drop_column('posts', 'network')
    bind = op.get_bind()
    post_format.drop(bind, checkfirst=True)
    network.drop(bind, checkfirst=True)
