"""documents, chunks and agent runs

Documents for the RAG (chunks with embedding and full-text vector) and the
agent's runs and steps (decision 34).

Revision ID: 7bf2fed60ff8
Revises: 485cbbcc361a
Create Date: 2026-11-08 16:12:00.509381

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7bf2fed60ff8'
down_revision: Union[str, Sequence[str], None] = '485cbbcc361a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Fixed here on purpose: a migration must not change with the settings.
# Must match settings.embedding_dimensions (text-embedding-3-small = 1536).
EMBEDDING_DIMENSIONS = 1536

document_type = postgresql.ENUM('pdf', 'docx', 'txt', name='document_type', create_type=False)
document_status = postgresql.ENUM(
    'pending', 'processing', 'ready', 'error', name='document_status', create_type=False
)
agent_mode = postgresql.ENUM('ideation', 'creation', name='agent_mode', create_type=False)
run_status = postgresql.ENUM(
    'running', 'completed', 'error', 'limit_reached', name='run_status', create_type=False
)
ENUMS = (document_type, document_status, agent_mode, run_status)


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    """Upgrade schema."""
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    for enum_type in ENUMS:
        enum_type.create(op.get_bind())

    op.create_table(
        'documents',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', document_type, nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('s3_key', sa.String(length=500), nullable=False),
        sa.Column('status', document_status, nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('chunk_count', sa.Integer(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='documents_project_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='documents_pkey'),
    )
    op.create_index('ix_documents_user_id', 'documents', ['user_id'])
    op.create_index('ix_documents_project_id', 'documents', ['project_id'])

    op.create_table(
        'chunks',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('document_id', sa.Uuid(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(EMBEDDING_DIMENSIONS), nullable=False),
        sa.Column(
            'search_vector', postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('portuguese', content)", persisted=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['document_id'], ['documents.id'], name='chunks_document_id_fkey',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name='chunks_pkey'),
    )
    op.create_index('ix_chunks_document_id', 'chunks', ['document_id'])
    op.create_index(
        'ix_chunks_embedding', 'chunks', ['embedding'],
        postgresql_using='hnsw', postgresql_ops={'embedding': 'vector_cosine_ops'},
    )
    op.create_index(
        'ix_chunks_search_vector', 'chunks', ['search_vector'], postgresql_using='gin'
    )

    op.create_table(
        'agent_runs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=False),
        sa.Column('mode', agent_mode, nullable=False),
        sa.Column('request', sa.Text(), nullable=False),
        sa.Column('status', run_status, nullable=False),
        sa.Column('response', sa.Text(), nullable=True),
        sa.Column('post_id', sa.Uuid(), nullable=True),
        sa.Column('iterations', sa.Integer(), server_default='0', nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ['project_id'], ['projects.id'], name='agent_runs_project_id_fkey',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['post_id'], ['posts.id'], name='agent_runs_post_id_fkey', ondelete='SET NULL'
        ),
        sa.PrimaryKeyConstraint('id', name='agent_runs_pkey'),
    )
    op.create_index('ix_agent_runs_user_id', 'agent_runs', ['user_id'])
    op.create_index('ix_agent_runs_project_id', 'agent_runs', ['project_id'])

    op.create_table(
        'agent_steps',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('run_id', sa.Uuid(), nullable=False),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('tool', sa.String(length=100), nullable=False),
        sa.Column('arguments', postgresql.JSONB(), nullable=False),
        sa.Column('result', postgresql.JSONB(), nullable=True),
        sa.Column('result_summary', sa.Text(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ['run_id'], ['agent_runs.id'], name='agent_steps_run_id_fkey', ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id', name='agent_steps_pkey'),
        sa.UniqueConstraint('run_id', 'step_number', name='agent_steps_run_id_step_number_key'),
    )
    op.create_index('ix_agent_steps_run_id', 'agent_steps', ['run_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('agent_steps')
    op.drop_table('agent_runs')
    op.drop_table('chunks')
    op.drop_table('documents')
    for enum_type in reversed(ENUMS):
        enum_type.drop(op.get_bind())
    op.execute('DROP EXTENSION IF EXISTS vector')
