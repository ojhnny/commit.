"""Glue between database rows, API schemas and domain rules."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import domain
from .models import Habit, HabitGoalVersion, HabitLog, HabitNote, User
from .schemas import GoalIn, GoalOut, HabitOut, LogOut, NoteOut, Schedule


def money(v: float) -> Decimal:
    return Decimal(str(round(v, 2)))


def user_today(user: User) -> date:
    return domain.today_in(user.timezone)


def get_owned_habit(db: Session, user: User, habit_id: str) -> Habit:
    habit = db.get(Habit, habit_id)
    if habit is None or habit.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Habit not found.")
    return habit


# ---------------------------------------------------------------- conversions


def goal_to_domain(v: HabitGoalVersion) -> domain.Goal:
    return domain.Goal(
        effective_date=v.effective_date,
        target_value=float(v.target_value),
        unit=v.unit,
        custom_unit=v.custom_unit,
        schedule_preset=v.schedule_preset,  # type: ignore[arg-type]
        schedule_days=tuple(v.schedule_days),
    )


def goal_in_to_domain(goal: GoalIn, effective: date) -> domain.Goal:
    preset, days = domain.normalize_schedule(goal.schedule.days)
    binary = goal.unit == "completion"
    return domain.Goal(
        effective_date=effective,
        target_value=1.0 if binary else goal.target_value,
        unit=goal.unit,
        custom_unit=(goal.custom_unit or "").strip() or None if goal.unit == "custom" else None,
        schedule_preset=preset,
        schedule_days=days,
    )


def set_goal_versions(habit: Habit, goals: list[domain.Goal]) -> None:
    """Replace a habit's goal version rows with `goals`, reusing rows by date."""
    existing = {v.effective_date: v for v in habit.goal_versions}
    rows: list[HabitGoalVersion] = []
    for g in goals:
        row = existing.get(g.effective_date) or HabitGoalVersion(effective_date=g.effective_date)
        row.target_value = money(g.target_value)
        row.unit = g.unit
        row.custom_unit = g.custom_unit
        row.schedule_preset = g.schedule_preset
        row.schedule_days = list(g.schedule_days)
        rows.append(row)
    habit.goal_versions = rows


def rules_of(habit: Habit) -> domain.HabitRules:
    return domain.HabitRules(start_date=habit.start_date, goals=[goal_to_domain(v) for v in habit.goal_versions])


def habit_out(h: Habit) -> HabitOut:
    return HabitOut(
        id=h.id,
        name=h.name,
        description=h.description,
        start_date=h.start_date,
        goal_versions=[
            GoalOut(
                effective_date=v.effective_date,
                target_value=float(v.target_value),
                unit=v.unit,  # type: ignore[arg-type]
                custom_unit=v.custom_unit,
                schedule=Schedule(preset=v.schedule_preset, days=list(v.schedule_days)),  # type: ignore[arg-type]
            )
            for v in h.goal_versions
        ],
        order=h.sort_order,
        created_at=h.created_at,
        updated_at=h.updated_at,
        archived_at=h.archived_at,
        is_sample=h.is_sample,
        color=h.color,  # type: ignore[arg-type]
    )


def log_out(log: HabitLog) -> LogOut:
    return LogOut(
        id=log.id,
        habit_id=log.habit_id,
        date=log.date,
        value=float(log.actual_value),
        note=log.notes,
        created_at=log.created_at,
        updated_at=log.updated_at,
    )


def logs_by_date(db: Session, habit_id: str) -> dict[date, float]:
    rows = db.execute(select(HabitLog.date, HabitLog.actual_value).where(HabitLog.habit_id == habit_id)).all()
    return {d: float(v) for d, v in rows}


def note_out(note: HabitNote) -> NoteOut:
    return NoteOut(
        id=note.id,
        habit_id=note.habit_id,
        title=note.title,
        body=note.body,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def get_owned_note(db: Session, user: User, note_id: str) -> HabitNote:
    note = db.get(HabitNote, note_id)
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found.")
    habit = db.get(Habit, note.habit_id)
    if habit is None or habit.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found.")
    return note
