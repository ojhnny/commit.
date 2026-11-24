"""Whole-account operations: snapshot load, backup export/import, sample data, reset."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .. import domain
from ..db import get_db
from ..models import Habit, HabitLog, User, new_id
from ..schemas import Backup, BackupIn, ImportResult, Snapshot
from ..security import current_user
from ..services import habit_out, log_out, money, set_goal_versions

router = APIRouter(tags=["data"])


def _snapshot(db: Session, user: User) -> Snapshot:
    habits = list(db.scalars(select(Habit).where(Habit.user_id == user.id).order_by(Habit.sort_order, Habit.created_at)))
    ids = [h.id for h in habits]
    logs = db.scalars(select(HabitLog).where(HabitLog.habit_id.in_(ids)).order_by(HabitLog.date)) if ids else []
    return Snapshot(habits=[habit_out(h) for h in habits], logs=[log_out(l) for l in logs])


@router.get("/snapshot", response_model=Snapshot)
def snapshot(user: User = Depends(current_user), db: Session = Depends(get_db)) -> Snapshot:
    """Every habit and log for the signed-in user (what the web app loads on start)."""
    return _snapshot(db, user)


@router.get("/export", response_model=Backup)
def export(user: User = Depends(current_user), db: Session = Depends(get_db)) -> Backup:
    snap = _snapshot(db, user)
    return Backup(habits=snap.habits, logs=snap.logs, exported_at=datetime.now(UTC))


@router.post("/import", response_model=ImportResult)
def import_backup(
    body: BackupIn,
    mode: str = Query(default="merge", pattern="^(merge|replace)$"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ImportResult:
    """Adds habits from a backup file (new ids are assigned). `replace` deletes existing data first."""
    if mode == "replace":
        db.execute(delete(Habit).where(Habit.user_id == user.id))
    base_order = (db.scalar(select(func.max(Habit.sort_order)).where(Habit.user_id == user.id)) or -1) + 1
    id_map: dict[str, Habit] = {}
    for i, h in enumerate(sorted(body.habits, key=lambda h: h.order)):
        habit = Habit(
            id=new_id(),
            user_id=user.id,
            name=h.name.strip(),
            description=(h.description or "").strip() or None,
            start_date=h.start_date,
            sort_order=base_order + i,
            archived_at=h.archived_at,
            is_sample=h.is_sample,
        )
        goals = sorted(
            (
                domain.Goal(
                    effective_date=g.effective_date,
                    target_value=g.target_value,
                    unit=g.unit,
                    custom_unit=g.custom_unit,
                    schedule_preset=domain.normalize_schedule(g.schedule.days)[0],
                    schedule_days=domain.normalize_schedule(g.schedule.days)[1],
                )
                for g in h.goal_versions
            ),
            key=lambda g: g.effective_date,
        )
        set_goal_versions(habit, domain.rebase_goals(goals, h.start_date))
        db.add(habit)
        id_map[h.id] = habit
    db.flush()

    seen: set[tuple[str, object]] = set()
    count = 0
    for log in body.logs:
        habit = id_map.get(log.habit_id)
        if habit is None or (habit.id, log.date) in seen:
            continue
        seen.add((habit.id, log.date))
        db.add(HabitLog(habit_id=habit.id, date=log.date, actual_value=money(log.value), notes=(log.note or "").strip() or None))
        count += 1
    db.commit()
    return ImportResult(habits=len(id_map), logs=count)


@router.delete("/sample-data", status_code=204)
def remove_sample_data(user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    db.execute(delete(Habit).where(Habit.user_id == user.id, Habit.is_sample.is_(True)))
    db.commit()
    return Response(status_code=204)


@router.delete("/data", status_code=204)
def reset_all(user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    db.execute(delete(Habit).where(Habit.user_id == user.id))
    db.commit()
    return Response(status_code=204)
