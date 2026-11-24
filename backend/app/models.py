"""Database schema (spec §16). Heatmap colors and statistics are never stored;
they are derived from logs + goal versions at read time."""

import datetime as dt
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def new_id() -> str:
    return str(uuid.uuid4())


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(Timestamped, Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    # IANA zone, e.g. "America/Detroit". Decides when "today" ends for this user.
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")


class AuthSession(Base):
    __tablename__ = "sessions"

    # SHA-256 of the bearer token; the raw token is never stored.
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Habit(Timestamped, Base):
    __tablename__ = "habits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    description: Mapped[str | None] = mapped_column(String(280))
    start_date: Mapped[date] = mapped_column(Date)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)

    goal_versions: Mapped[list["HabitGoalVersion"]] = relationship(
        back_populates="habit",
        cascade="all, delete-orphan",
        order_by="HabitGoalVersion.effective_date",
        lazy="selectin",
    )


class HabitGoalVersion(Base):
    """Target and schedule in force from `effective_date` onward."""

    __tablename__ = "habit_goal_versions"
    __table_args__ = (
        UniqueConstraint("habit_id", "effective_date", name="uq_goal_version_habit_date"),
        CheckConstraint("target_value > 0", name="ck_goal_target_positive"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    habit_id: Mapped[str] = mapped_column(ForeignKey("habits.id", ondelete="CASCADE"), index=True)
    effective_date: Mapped[date] = mapped_column(Date)
    target_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    unit: Mapped[str] = mapped_column(String(20))
    custom_unit: Mapped[str | None] = mapped_column(String(20))
    schedule_preset: Mapped[str] = mapped_column(String(10))
    # 0 = Sunday … 6 = Saturday
    schedule_days: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger))

    habit: Mapped[Habit] = relationship(back_populates="goal_versions")


class HabitLog(Timestamped, Base):
    __tablename__ = "habit_logs"
    __table_args__ = (
        UniqueConstraint("habit_id", "date", name="uq_habit_log_habit_date"),
        CheckConstraint("actual_value >= 0", name="ck_log_value_non_negative"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    habit_id: Mapped[str] = mapped_column(ForeignKey("habits.id", ondelete="CASCADE"))
    date: Mapped[dt.date] = mapped_column(Date)
    actual_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(Text)
