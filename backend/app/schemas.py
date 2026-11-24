"""Request/response models. JSON uses camelCase to match the web app's TypeScript types."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

UnitId = Literal["minutes", "hours", "problems", "pages", "workouts", "sessions", "tasks", "completion", "custom"]
SchedulePreset = Literal["daily", "weekdays", "weekends", "custom"]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------------------------------------------------------------- auth


class Credentials(ApiModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    timezone: str | None = Field(default=None, max_length=64)


class UserOut(ApiModel):
    id: str
    email: str
    timezone: str


class SessionOut(ApiModel):
    token: str
    expires_at: datetime
    user: UserOut


class UserPatch(ApiModel):
    timezone: str = Field(max_length=64)


# ---------------------------------------------------------------- habits


class Schedule(ApiModel):
    preset: SchedulePreset
    days: list[int] = Field(max_length=7)

    @field_validator("days")
    @classmethod
    def valid_days(cls, v: list[int]) -> list[int]:
        if not v:
            raise ValueError("Pick at least one day.")
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("Days are 0 (Sunday) to 6 (Saturday).")
        return sorted(set(v))


class GoalIn(ApiModel):
    target_value: float = Field(gt=0, le=100_000)
    unit: UnitId
    custom_unit: str | None = Field(default=None, max_length=20)
    schedule: Schedule


class GoalOut(GoalIn):
    effective_date: date


class HabitCreate(ApiModel):
    name: str = Field(min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=280)
    start_date: date
    goal: GoalIn

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Give the habit a name.")
        return v


class HabitPatch(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=280)
    start_date: date | None = None
    goal: GoalIn | None = None
    goal_effective_date: date | None = None


class HabitOut(ApiModel):
    id: str
    name: str
    description: str | None = None
    start_date: date
    goal_versions: list[GoalOut]
    order: int
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None
    is_sample: bool = False


class ReorderIn(ApiModel):
    ordered_ids: list[str] = Field(max_length=1000)


# ---------------------------------------------------------------- logs


class LogIn(ApiModel):
    value: float = Field(ge=0, le=100_000)
    note: str | None = Field(default=None, max_length=500)


class LogOut(ApiModel):
    id: str
    habit_id: str
    date: date
    value: float
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class StatsOut(ApiModel):
    eligible_days: int
    completed_days: int
    partial_days: int
    missed_days: int
    consistency: float | None
    current_streak: int
    longest_streak: int
    today: date
    today_status: str
    today_value: float


# ---------------------------------------------------------------- data


class Snapshot(ApiModel):
    habits: list[HabitOut]
    logs: list[LogOut]


class Backup(Snapshot):
    app: Literal["commit"] = "commit"
    version: Literal[1] = 1
    exported_at: datetime


class BackupHabitIn(ApiModel):
    """Lenient shape accepted on import (matches the web app's backup files)."""

    id: str
    name: str = Field(min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=280)
    start_date: date
    goal_versions: list[GoalOut] = Field(min_length=1)
    order: int = 0
    archived_at: datetime | None = None
    is_sample: bool = False


class BackupLogIn(ApiModel):
    habit_id: str
    date: date
    value: float = Field(ge=0, le=100_000)
    note: str | None = Field(default=None, max_length=500)


class BackupIn(ApiModel):
    app: Literal["commit"]
    version: Literal[1]
    habits: list[BackupHabitIn] = Field(max_length=500)
    logs: list[BackupLogIn] = Field(max_length=200_000)


class ImportResult(ApiModel):
    habits: int
    logs: int
