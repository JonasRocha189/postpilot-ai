import enum
import uuid
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Computed,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.config import settings
from database.db import Base, TimestampMixin


class UUIDMixin:
    """Mixin class to add a UUID primary key to models."""

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class PostStatus(enum.StrEnum):
    """Lifecycle of a post: draft -> review -> approved -> published."""

    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    PUBLISHED = "published"


class Network(enum.StrEnum):
    """Social network a post is written for."""

    LINKEDIN = "linkedin"
    INSTAGRAM = "instagram"
    X = "x"


class PostFormat(enum.StrEnum):
    """How the post is published: text only, one image or several (carousel)."""

    TEXT = "text"
    SINGLE = "single"
    CAROUSEL = "carousel"


def _enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [str(member.value) for member in enum_cls]


class Project(UUIDMixin, TimestampMixin, Base):
    """The user's own brand or a client. Top of the hierarchy."""

    __tablename__ = "projects"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    target_audience: Mapped[str | None] = mapped_column(Text)
    voice_tone: Mapped[str | None] = mapped_column(Text)

    subjects: Mapped[list["Subject"]] = relationship(back_populates="project")


class Subject(UUIDMixin, TimestampMixin, Base):
    """A topic inside a project. Empty audience/tone fall back to the project's."""

    __tablename__ = "subjects"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    target_audience: Mapped[str | None] = mapped_column(Text)
    voice_tone: Mapped[str | None] = mapped_column(Text)

    project: Mapped["Project"] = relationship(back_populates="subjects")
    posts: Mapped[list["Post"]] = relationship(back_populates="subject")


class Post(UUIDMixin, TimestampMixin, Base):
    """A social media post (the idea). Belongs to a project through its subject.

    What changes per network (text, format, images, status, date) lives in its
    variations: at most one per network.
    """

    __tablename__ = "posts"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))

    subject: Mapped["Subject"] = relationship(back_populates="posts")
    # Ordered by the enum order (LinkedIn, Instagram, X). Loaded with the post;
    # variations removed from this list are deleted.
    variations: Mapped[list["PostVariation"]] = relationship(
        back_populates="post",
        order_by="PostVariation.network",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PostVariation(UUIDMixin, TimestampMixin, Base):
    """The post adapted to one network: the detail of the master-detail screen."""

    __tablename__ = "post_variations"
    __table_args__ = (
        UniqueConstraint("post_id", "network", name="uq_post_variations_post_id_network"),
    )

    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), index=True
    )
    network: Mapped[Network] = mapped_column(
        Enum(Network, name="network", values_callable=_enum_values)
    )
    format: Mapped[PostFormat] = mapped_column(
        Enum(PostFormat, name="post_format", values_callable=_enum_values)
    )
    content: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PostStatus] = mapped_column(
        Enum(PostStatus, name="post_status", values_callable=_enum_values),
        default=PostStatus.DRAFT,
    )
    # Indexed: the calendar lists variations by date
    expected_date: Mapped[date | None] = mapped_column(Date, index=True)

    post: Mapped["Post"] = relationship(back_populates="variations")
    # Images from the project's library, in carousel order. Loaded with the variation.
    images: Mapped[list["VariationImage"]] = relationship(
        order_by="VariationImage.position",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def image_ids(self) -> list[uuid.UUID]:
        """Image ids in order (what the API returns)."""
        return [item.image_id for item in self.images]


class VariationImage(Base):
    """An image of a variation (carousel slide). Deleting an image in use is refused (409)."""

    __tablename__ = "variation_images"

    variation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("post_variations.id", ondelete="CASCADE"), primary_key=True
    )
    image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("images.id"), primary_key=True, index=True
    )
    position: Mapped[int]


class Image(UUIDMixin, TimestampMixin, Base):
    """An image in a project's library. Stores only the S3 key, never the URL."""

    __tablename__ = "images"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    key: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)


class IdeaSource(enum.StrEnum):
    """Who wrote the idea: the user or the agent (Ideation mode)."""

    MANUAL = "manual"
    AGENT = "agent"


class Idea(UUIDMixin, TimestampMixin, Base):
    """A possible post, before it is written. Scoped to a project."""

    __tablename__ = "ideas"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    # Deleting the project deletes its ideas
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    # Deleting the subject keeps the idea, without a subject
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), index=True
    )
    # Networks suggested for the post (may be empty)
    networks: Mapped[list[Network]] = mapped_column(
        ARRAY(Enum(Network, name="network", values_callable=_enum_values)),
        default=list,
    )
    source: Mapped[IdeaSource] = mapped_column(
        Enum(IdeaSource, name="idea_source", values_callable=_enum_values),
        default=IdeaSource.MANUAL,
    )
    # The post created from the idea; deleting the post makes the idea open again
    post_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("posts.id", ondelete="SET NULL"), index=True
    )


class Metric(UUIDMixin, TimestampMixin, Base):
    """One collection of a published variation's numbers (typed in or imported from CSV).

    The numbers are totals at `collected_at` (what the network shows), not the
    difference since the previous collection: the most recent one is current.
    """

    __tablename__ = "metrics"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    # Deleting the variation (or its post) deletes its metrics
    variation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("post_variations.id", ondelete="CASCADE"), index=True
    )
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    impressions: Mapped[int]
    likes: Mapped[int]
    comments: Mapped[int]
    shares: Mapped[int]
    clicks: Mapped[int]


class DocumentType(enum.StrEnum):
    """File types accepted for the RAG."""

    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"


class DocumentStatus(enum.StrEnum):
    """Processing: pending (waiting for the upload) -> processing -> ready or error."""

    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class Document(UUIDMixin, TimestampMixin, Base):
    """A file uploaded to a project, used only by that project's RAG."""

    __tablename__ = "documents"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    # No cascade: a project with documents can't be deleted (409)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="document_type", values_callable=_enum_values)
    )
    size_bytes: Mapped[int]
    # Only the S3 key, never the URL
    s3_key: Mapped[str] = mapped_column(String(500))
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status", values_callable=_enum_values),
        default=DocumentStatus.PENDING,
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    chunk_count: Mapped[int | None]


class Chunk(UUIDMixin, Base):
    """A piece of a document's text, with its embedding and full-text vector."""

    __tablename__ = "chunks"
    __table_args__ = (
        # Vector search (cosine distance) and full-text search
        Index(
            "ix_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_chunks_search_vector", "search_vector", postgresql_using="gin"),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    # Order of the chunk in the document (0, 1, 2...)
    position: Mapped[int]
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dimensions))
    # Filled in by Postgres from `content`; never written by the app
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR, Computed("to_tsvector('portuguese', content)", persisted=True)
    )


class AgentMode(enum.StrEnum):
    """Ideation suggests topics; creation writes the post."""

    IDEATION = "ideation"
    CREATION = "creation"


class RunStatus(enum.StrEnum):
    """running -> completed, error (a tool failed) or limit_reached (8 iterations)."""

    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"
    LIMIT_REACHED = "limit_reached"


class AgentRun(UUIDMixin, TimestampMixin, Base):
    """One request to the agent. `created_at` is when it started."""

    __tablename__ = "agent_runs"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    mode: Mapped[AgentMode] = mapped_column(
        Enum(AgentMode, name="agent_mode", values_callable=_enum_values)
    )
    request: Mapped[str] = mapped_column(Text)
    status: Mapped[RunStatus] = mapped_column(
        Enum(RunStatus, name="run_status", values_callable=_enum_values),
        default=RunStatus.RUNNING,
    )
    # The agent's final answer
    response: Mapped[str | None] = mapped_column(Text)
    # Draft saved by the agent (creation mode)
    post_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("posts.id", ondelete="SET NULL"))
    iterations: Mapped[int] = mapped_column(default=0)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    steps: Mapped[list["AgentStep"]] = relationship(
        back_populates="run", order_by="AgentStep.step_number", cascade="all, delete-orphan"
    )


class AgentStep(UUIDMixin, Base):
    """One tool call of a run: arguments, result, duration and error."""

    __tablename__ = "agent_steps"
    __table_args__ = (UniqueConstraint("run_id", "step_number"),)

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True
    )
    step_number: Mapped[int]
    tool: Mapped[str] = mapped_column(String(100))
    arguments: Mapped[dict[str, object]] = mapped_column(JSONB)
    # Full result: only in the database and the logs; the screen shows the summary
    result: Mapped[object | None] = mapped_column(JSONB)
    result_summary: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int | None]
    error: Mapped[str | None] = mapped_column(Text)

    run: Mapped[AgentRun] = relationship(back_populates="steps")
