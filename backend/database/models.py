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
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    PUBLISHED = "published"


class Project(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    target_audience: Mapped[str | None] = mapped_column(Text)
    voice_tone: Mapped[str | None] = mapped_column(Text)

    subjects: Mapped[list["Subject"]] = relationship(back_populates="project")


class Subject(UUIDMixin, TimestampMixin, Base):
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
    __tablename__ = "posts"

    user_id: Mapped[str] = mapped_column(String(255), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PostStatus] = mapped_column(
        Enum(
            PostStatus,
            name="post_status",
            values_callable=lambda e: [member.value for member in e],
        ),
        default=PostStatus.DRAFT,
    )
    expected_date: Mapped[date | None] = mapped_column(Date)

    subject: Mapped["Subject"] = relationship(back_populates="posts")
    images: Mapped[list["Image"]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )


class Image(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "images"

    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), index=True
    )
    key: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)

    post: Mapped["Post"] = relationship(back_populates="images")
