"""ideas

A possible post, before it is written (decision 31). Scoped to a project;
the subject and the post created from it are optional links.

Revision ID: b806fb1c596b
Revises: 73686293714e
Create Date: 2026-11-06 16:58:48.514779

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b806fb1c596b'
down_revision: Union[str, Sequence[str], None] = '73686293714e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# "network" already exists (created with posts); "idea_source" is new
network = postgresql.ENUM('linkedin', 'instagram', 'x', name='network', create_type=False)
idea_source = postgresql.ENUM('manual', 'agent', name='idea_source', create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    idea_source.create(op.get_bind())
    op.create_table(
        'ideas',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('subject_id', sa.Uuid(), nullable=True),
        sa.Column('networks', postgresql.ARRAY(network), nullable=False),
        sa.Column('source', idea_source, nullable=False),
        sa.Column('post_id', sa.Uuid(), nullable=True),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['project_id'], ['projects.id'], name='ideas_project_id_fkey', ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(
            ['subject_id'], ['subjects.id'], name='ideas_subject_id_fkey', ondelete='SET NULL'
        ),
        sa.ForeignKeyConstraint(
            ['post_id'], ['posts.id'], name='ideas_post_id_fkey', ondelete='SET NULL'
        ),
        sa.PrimaryKeyConstraint('id', name='ideas_pkey'),
    )
    op.create_index('ix_ideas_user_id', 'ideas', ['user_id'])
    op.create_index('ix_ideas_project_id', 'ideas', ['project_id'])
    op.create_index('ix_ideas_subject_id', 'ideas', ['subject_id'])
    op.create_index('ix_ideas_post_id', 'ideas', ['post_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_ideas_post_id', table_name='ideas')
    op.drop_index('ix_ideas_subject_id', table_name='ideas')
    op.drop_index('ix_ideas_project_id', table_name='ideas')
    op.drop_index('ix_ideas_user_id', table_name='ideas')
    op.drop_table('ideas')
    idea_source.drop(op.get_bind())
