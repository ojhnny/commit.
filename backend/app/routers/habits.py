from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .. import domain
from ..db import get_db
from ..models import Habit, HabitLog, User
from ..schemas import HabitCreate, HabitOut, HabitPatch, LogIn, LogOut, ReorderIn, StatsOut
from ..security import current_user
from ..services import (
    get_owned_habit,
    goal_in_to_domain,
    habit_out,
    log_out,
    logs_by_date,
    money,
    rules_of,
    set_goal_versions,
    user_today,
)

router = APIRouter(prefix="/habits", tags=["habits"])


# ---------------------------------------------------------------- habits


@router.get("", response_model=list[HabitOut])
def list_habits(
    include_archived: bool = Query(default=True, alias="includeArchived"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[HabitOut]:
    q = select(Habit).where(Habit.user_id == user.id).order_by(Habit.sort_order, Habit.created_at)
    if not include_archived:
        q = q.where(Habit.archived_at.is_(None))
    return [habit_out(h) for h in db.scalars(q)]


@router.post("", response_model=HabitOut, status_code=201)
def create_habit(body: HabitCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> HabitOut:
    next_order = (db.scalar(select(func.max(Habit.sort_order)).where(Habit.user_id == user.id)) or -1) + 1
    habit = Habit(
        user_id=user.id,
        name=body.name,
        description=(body.description or "").strip() or None,
        start_date=body.start_date,
        sort_order=next_order,
    )
    set_goal_versions(habit, [goal_in_to_domain(body.goal, body.start_date)])
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit_out(habit)


@router.get("/{habit_id}", response_model=HabitOut)
def get_habit(habit_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> HabitOut:
    return habit_out(get_owned_habit(db, user, habit_id))


@router.patch("/{habit_id}", response_model=HabitOut)
def update_habit(habit_id: str, body: HabitPatch, user: User = Depends(current_user), db: Session = Depends(get_db)) -> HabitOut:
    habit = get_owned_habit(db, user, habit_id)
    if body.name is not None:
        habit.name = body.name.strip() or habit.name
    if "description" in body.model_fields_set:
        habit.description = (body.description or "").strip() or None
    goals = rules_of(habit).goals
    if body.start_date is not None and body.start_date != habit.start_date:
        habit.start_date = body.start_date
        goals = domain.rebase_goals(goals, body.start_date)
    if body.goal is not None:
        # New rules apply from today (or from the start date if that's later), so
        # past days keep being judged by the goal that applied then.
        today = user_today(user)
        effective = body.goal_effective_date or max(today, habit.start_date)
        goals = domain.apply_goal_change(goals, goal_in_to_domain(body.goal, effective))
    set_goal_versions(habit, goals)
    habit.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(habit)
    return habit_out(habit)


@router.post("/{habit_id}/archive", response_model=HabitOut)
def archive_habit(habit_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> HabitOut:
    habit = get_owned_habit(db, user, habit_id)
    habit.archived_at = habit.archived_at or datetime.now(UTC)
    db.commit()
    db.refresh(habit)
    return habit_out(habit)


@router.post("/{habit_id}/restore", response_model=HabitOut)
def restore_habit(habit_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> HabitOut:
    habit = get_owned_habit(db, user, habit_id)
    habit.archived_at = None
    db.commit()
    db.refresh(habit)
    return habit_out(habit)


@router.delete("/{habit_id}", status_code=204)
def delete_habit(habit_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(get_owned_habit(db, user, habit_id))
    db.commit()
    return Response(status_code=204)


@router.put("/order", status_code=204, include_in_schema=True)
def reorder(body: ReorderIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    habits = {h.id: h for h in db.scalars(select(Habit).where(Habit.user_id == user.id))}
    position = {hid: i for i, hid in enumerate(body.ordered_ids) if hid in habits}
    offset = len(position)
    for h in sorted(habits.values(), key=lambda h: h.sort_order):
        if h.id in position:
            h.sort_order = position[h.id]
        else:
            h.sort_order = offset
            offset += 1
    db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------- logs


@router.get("/{habit_id}/logs", response_model=list[LogOut])
def list_logs(
    habit_id: str,
    start: date | None = Query(default=None, alias="from"),
    end: date | None = Query(default=None, alias="to"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[LogOut]:
    get_owned_habit(db, user, habit_id)
    q = select(HabitLog).where(HabitLog.habit_id == habit_id).order_by(HabitLog.date)
    if start:
        q = q.where(HabitLog.date >= start)
    if end:
        q = q.where(HabitLog.date <= end)
    return [log_out(l) for l in db.scalars(q)]


@router.get("/{habit_id}/logs/{day}", response_model=LogOut)
def get_log(habit_id: str, day: date, user: User = Depends(current_user), db: Session = Depends(get_db)) -> LogOut:
    get_owned_habit(db, user, habit_id)
    log = db.scalar(select(HabitLog).where(HabitLog.habit_id == habit_id, HabitLog.date == day))
    if log is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nothing logged on that day.")
    return log_out(log)


@router.put("/{habit_id}/logs/{day}", response_model=LogOut)
def upsert_log(
    habit_id: str, day: date, body: LogIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> LogOut:
    habit = get_owned_habit(db, user, habit_id)
    if day > user_today(user):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Cannot log progress for a future date.")
    if day < habit.start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Cannot log before the habit started.")
    note = (body.note or "").strip() or None
    # One entry per habit per day, enforced by a unique constraint and an atomic upsert.
    stmt = (
        insert(HabitLog)
        .values(habit_id=habit_id, date=day, actual_value=money(body.value), notes=note)
        .on_conflict_do_update(
            constraint="uq_habit_log_habit_date",
            set_={"actual_value": money(body.value), "notes": note, "updated_at": func.now()},
        )
        .returning(HabitLog)
    )
    log = db.scalars(stmt, execution_options={"populate_existing": True}).one()
    db.commit()
    return log_out(log)


@router.delete("/{habit_id}/logs/{day}", status_code=204)
def delete_log(habit_id: str, day: date, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    get_owned_habit(db, user, habit_id)
    db.execute(delete(HabitLog).where(HabitLog.habit_id == habit_id, HabitLog.date == day))
    db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------- statistics


@router.get("/{habit_id}/stats", response_model=StatsOut)
def habit_stats(habit_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> StatsOut:
    habit = get_owned_habit(db, user, habit_id)
    today = user_today(user)
    s = domain.compute_stats(rules_of(habit), logs_by_date(db, habit_id), today)
    return StatsOut(
        eligible_days=s.eligible_days,
        completed_days=s.completed_days,
        partial_days=s.partial_days,
        missed_days=s.missed_days,
        consistency=s.consistency,
        current_streak=s.current_streak,
        longest_streak=s.longest_streak,
        today=today,
        today_status=s.today_status,
        today_value=s.today_value,
    )
