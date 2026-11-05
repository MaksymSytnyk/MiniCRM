from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import (
    String,
    Text,
    DateTime,
    Date,
    Numeric,
    ForeignKey,
    Table,
    Column,
    UniqueConstraint,
    Index,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def now():
    return datetime.now(timezone.utc)


class Identity:
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )


class User(Identity, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    company: Mapped[str] = mapped_column(String(200), default="")
    theme: Mapped[str] = mapped_column(String(10), default="dark")


class Owned(Identity):
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )


client_tags = Table(
    "client_tags",
    Base.metadata,
    Column("client_id", ForeignKey("clients.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Owned, Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name"),)
    name: Mapped[str] = mapped_column(String(40))


class Client(Owned, Base):
    __tablename__ = "clients"
    full_name: Mapped[str] = mapped_column(String(120), index=True)
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str] = mapped_column(String(40), default="")
    company: Mapped[str] = mapped_column(String(200), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    last_interaction_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    tags: Mapped[list[Tag]] = relationship(secondary=client_tags, lazy="selectin")


class Lead(Owned, Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint("status IN ('New','Contacted','Qualified','Converted','Lost')"),
        CheckConstraint("estimated_value >= 0"),
    )
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str] = mapped_column(String(40), default="")
    company: Mapped[str] = mapped_column(String(200), default="")
    source: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(20), default="New", index=True)
    estimated_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    converted_client_id: Mapped[str | None] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL")
    )
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Deal(Owned, Base):
    __tablename__ = "deals"
    __table_args__ = (
        CheckConstraint("status IN ('Open','In Progress','Won','Lost')"),
        CheckConstraint("value >= 0"),
        Index("ix_deals_owner_status", "user_id", "status"),
    )
    title: Mapped[str] = mapped_column(String(200))
    client_id: Mapped[str | None] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"), index=True
    )
    client: Mapped[Client | None] = relationship(lazy="joined")
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="Open")
    expected_close_date: Mapped[date | None] = mapped_column(Date)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    description: Mapped[str] = mapped_column(Text, default="")


class Task(Owned, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("status IN ('Pending','In Progress','Completed')"),
        CheckConstraint("priority IN ('Low','Medium','High')"),
        Index("ix_tasks_owner_due", "user_id", "due_date"),
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[date | None] = mapped_column(Date)
    priority: Mapped[str] = mapped_column(String(10), default="Medium")
    status: Mapped[str] = mapped_column(String(20), default="Pending")
    client_id: Mapped[str | None] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"), index=True
    )
    deal_id: Mapped[str | None] = mapped_column(
        ForeignKey("deals.id", ondelete="SET NULL"), index=True
    )
    client: Mapped[Client | None] = relationship(lazy="joined")
    deal: Mapped[Deal | None] = relationship(lazy="joined")


class ActivityLog(Owned, Base):
    __tablename__ = "activity_logs"
    action: Mapped[str] = mapped_column(String(30))
    entity_type: Mapped[str] = mapped_column(String(20))
    entity_id: Mapped[str] = mapped_column(String(36))
    description: Mapped[str] = mapped_column(String(300))


class AuthSession(Owned, Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
