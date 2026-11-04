"""image library per project

Images move from a post to the project's library (images.project_id), and a
post points to one library image (posts.image_id, optional).

Revision ID: be16ff6a976f
Revises: 38bc47f3b886
Create Date: 2026-11-03 19:20:51.531868

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'be16ff6a976f'
down_revision: Union[str, Sequence[str], None] = '38bc47f3b886'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # New columns start nullable so existing rows can be filled in first
    op.add_column('images', sa.Column('user_id', sa.String(length=255), nullable=True))
    op.add_column('images', sa.Column('project_id', sa.Uuid(), nullable=True))
    op.add_column('posts', sa.Column('image_id', sa.Uuid(), nullable=True))

    # Existing images: move to the project of their post, and keep them on that post
    op.execute(
        """
        UPDATE images AS i
        SET user_id = p.user_id, project_id = s.project_id
        FROM posts AS p
        JOIN subjects AS s ON s.id = p.subject_id
        WHERE p.id = i.post_id
        """
    )
    op.execute(
        """
        UPDATE posts AS p
        SET image_id = (
            SELECT i.id FROM images AS i
            WHERE i.post_id = p.id
            ORDER BY i.created_at
            LIMIT 1
        )
        """
    )

    op.alter_column('images', 'user_id', nullable=False)
    op.alter_column('images', 'project_id', nullable=False)

    op.drop_constraint('images_post_id_fkey', 'images', type_='foreignkey')
    op.drop_index('ix_images_post_id', table_name='images')
    op.drop_column('images', 'post_id')

    op.create_index('ix_images_user_id', 'images', ['user_id'], unique=False)
    op.create_index('ix_images_project_id', 'images', ['project_id'], unique=False)
    op.create_foreign_key(
        'images_project_id_fkey', 'images', 'projects', ['project_id'], ['id']
    )
    op.create_index('ix_posts_image_id', 'posts', ['image_id'], unique=False)
    op.create_foreign_key('posts_image_id_fkey', 'posts', 'images', ['image_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema.

    Library images not used by any post cannot go back to a post, so they are
    deleted from the table (their S3 objects are left in place).
    """
    op.add_column('images', sa.Column('post_id', sa.Uuid(), nullable=True))
    op.execute(
        """
        UPDATE images AS i
        SET post_id = (
            SELECT p.id FROM posts AS p
            WHERE p.image_id = i.id
            ORDER BY p.created_at
            LIMIT 1
        )
        """
    )

    op.drop_constraint('posts_image_id_fkey', 'posts', type_='foreignkey')
    op.drop_index('ix_posts_image_id', table_name='posts')
    op.drop_column('posts', 'image_id')

    op.execute("DELETE FROM images WHERE post_id IS NULL")
    op.alter_column('images', 'post_id', nullable=False)
    op.create_index('ix_images_post_id', 'images', ['post_id'], unique=False)
    op.create_foreign_key(
        'images_post_id_fkey', 'images', 'posts', ['post_id'], ['id'], ondelete='CASCADE'
    )

    op.drop_constraint('images_project_id_fkey', 'images', type_='foreignkey')
    op.drop_index('ix_images_project_id', table_name='images')
    op.drop_index('ix_images_user_id', table_name='images')
    op.drop_column('images', 'project_id')
    op.drop_column('images', 'user_id')
