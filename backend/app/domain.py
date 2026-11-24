"""Business rules, mirrored from the web app's `src/domain` (TypeScript).

Pure Python: no database or HTTP. The two implementations are kept in step by
mirrored unit tests (tests/test_domain.py ↔ src/domain/domain.test.ts).
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

SchedulePreset = Literal["daily", "weekdays", "weekends", "custom"]
DayStatus = Literal["future", "before-start", "rest", "pending", "missed", "partial", "done", "exceeded"]

ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
WEEKDAYS = [1, 2, 3, 4, 5]
WEEKENDS = [0, 6]
EPS = 1e-9


@dataclass(frozen=True)
class Goal:
    effective_date: date
    target_value: float
    unit: str
    schedule_days: tuple[int, ...]
    schedule_preset: SchedulePreset = "daily"
    custom_unit: str | None = None

    def same_rules(self, other: Goal) -> bool:
        return (
            abs(self.target_value - other.target_value) < EPS
            and self.unit == other.unit
            and (self.custom_unit or "") == (other.custom_unit or "")
            and tuple(sorted(self.schedule_days)) == tuple(sorted(other.schedule_days))
        )


@dataclass
class HabitRules:
    start_date: date
    goals: list[Goal] = field(default_factory=list)  # sorted by effective_date


@dataclass(frozen=True)
class Day:
    date: date
    status: DayStatus
    value: float
    scheduled: bool
    eligible: bool


# ---------------------------------------------------------------- dates


def weekday(d: date) -> int:
    """0 = Sunday … 6 = Saturday (matches JavaScript's getDay)."""
    return (d.weekday() + 1) % 7


def today_in(tz: str, now: datetime | None = None) -> date:
    try:
        zone = ZoneInfo(tz)
    except Exception:
        zone = ZoneInfo("UTC")
    return (now or datetime.now(tz=zone)).astimezone(zone).date()


def each_day(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


# ---------------------------------------------------------------- scheduling


def make_schedule(preset: SchedulePreset, days: list[int] | None = None) -> tuple[SchedulePreset, tuple[int, ...]]:
    if preset == "daily":
        return "daily", tuple(ALL_DAYS)
    if preset == "weekdays":
        return "weekdays", tuple(WEEKDAYS)
    if preset == "weekends":
        return "weekends", tuple(WEEKENDS)
    return normalize_schedule(days or [])


def normalize_schedule(days: list[int] | tuple[int, ...]) -> tuple[SchedulePreset, tuple[int, ...]]:
    key = tuple(sorted(set(days)))
    if key == tuple(ALL_DAYS):
        return "daily", key
    if key == tuple(WEEKDAYS):
        return "weekdays", key
    if key == tuple(WEEKENDS):
        return "weekends", key
    return "custom", key


def goal_for(rules: HabitRules, d: date) -> Goal:
    if not rules.goals:
        raise ValueError("Habit has no goal versions")
    current = rules.goals[0]
    for g in rules.goals:
        if g.effective_date <= d:
            current = g
        else:
            break
    return current


def apply_goal_change(goals: list[Goal], new: Goal) -> list[Goal]:
    """New rules from `new.effective_date` on; earlier days keep theirs."""
    active = goal_for(HabitRules(start_date=goals[0].effective_date, goals=goals), new.effective_date)
    before_first = new.effective_date < goals[0].effective_date
    if not before_first and active.same_rules(new):
        return goals
    merged = [g for g in goals if g.effective_date < new.effective_date] + [new]
    out: list[Goal] = []
    for g in merged:
        if out and out[-1].same_rules(g):
            continue
        out.append(g)
    return out


def rebase_goals(goals: list[Goal], start_date: date) -> list[Goal]:
    """The first goal version always starts on the habit's start date."""
    before = [g for g in goals if g.effective_date <= start_date]
    after = [g for g in goals if g.effective_date > start_date]
    base = before[-1] if before else (after.pop(0) if after else None)
    if base is None:
        return goals
    return [replace(base, effective_date=start_date), *after]


# ---------------------------------------------------------------- evaluation


def status_for_value(value: float, target: float) -> DayStatus | None:
    if not value > 0:
        return None
    if value < target - EPS:
        return "partial"
    if value > target + EPS:
        return "exceeded"
    return "done"


def evaluate_day(rules: HabitRules, value: float | None, d: date, today: date) -> Day:
    goal = goal_for(rules, d)
    scheduled = weekday(d) in goal.schedule_days
    v = value or 0.0
    if d > today:
        return Day(d, "future", v, scheduled, False)
    if d < rules.start_date:
        return Day(d, "before-start", v, scheduled, False)
    progress = status_for_value(v, goal.target_value)
    if not scheduled:
        return Day(d, progress or "rest", v, scheduled, False)
    if d == today:
        complete = progress in ("done", "exceeded")
        return Day(d, progress or "pending", v, scheduled, complete)
    return Day(d, progress or "missed", v, scheduled, True)


def is_complete(status: DayStatus) -> bool:
    return status in ("done", "exceeded")


@dataclass(frozen=True)
class Stats:
    eligible_days: int
    completed_days: int
    partial_days: int
    missed_days: int
    consistency: float | None
    current_streak: int
    longest_streak: int
    today_status: DayStatus
    today_value: float


def compute_stats(rules: HabitRules, logs: dict[date, float], today: date) -> Stats:
    days = (
        [evaluate_day(rules, logs.get(d), d, today) for d in each_day(rules.start_date, today)]
        if rules.start_date <= today
        else []
    )
    eligible = [d for d in days if d.eligible]
    completed = sum(1 for d in eligible if is_complete(d.status))
    partial = sum(1 for d in eligible if d.status == "partial")
    missed = sum(1 for d in eligible if d.status == "missed")

    longest = run = 0
    for d in days:
        if not d.scheduled:
            continue
        if is_complete(d.status):
            run += 1
            longest = max(longest, run)
        elif d.status in ("pending", "partial") and not d.eligible:
            continue  # today, still in progress
        else:
            run = 0

    current = 0
    for i in range(len(days) - 1, -1, -1):
        d = days[i]
        if not d.scheduled:
            continue
        if is_complete(d.status):
            current += 1
            continue
        if i == len(days) - 1 and d.status in ("pending", "partial") and not d.eligible:
            continue
        break

    t = evaluate_day(rules, logs.get(today), today, today)
    return Stats(
        eligible_days=len(eligible),
        completed_days=completed,
        partial_days=partial,
        missed_days=missed,
        consistency=(completed / len(eligible) * 100) if eligible else None,
        current_streak=current,
        longest_streak=longest,
        today_status=t.status,
        today_value=t.value,
    )
