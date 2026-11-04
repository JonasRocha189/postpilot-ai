import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    """A social media post. Belongs to a project through its subject."""

    __tablename__ = "posts"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PostStatus] = mapped_column(
        Enum(PostStatus, name="post_status", values_callable=_enum_values),
        default=PostStatus.DRAFT,
    )
    network: Mapped[Network] = mapped_column(
        Enum(Network, name="network", values_callable=_enum_values)
    )
    format: Mapped[PostFormat] = mapped_column(
        Enum(PostFormat, name="post_format", values_callable=_enum_values)
    )
    expected_date: Mapped[date | None] = mapped_column(Date)

    subject: Mapped["Subject"] = relationship(back_populates="posts")
    # Images from the project's library, in carousel order. Loaded with the post.
    images: Mapped[list["PostImage"]] = relationship(
        order_by="PostImage.position",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def image_ids(self) -> list[uuid.UUID]:
        """Image ids in order (what the API returns)."""
        return [item.image_id for item in self.images]


class PostImage(Base):
    """An image of a post (carousel slide). Deleting an image in use is refused (409)."""

    __tablename__ = "post_images"

    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True
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
