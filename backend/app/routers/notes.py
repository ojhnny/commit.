"""Markdown notes attached to habits (several per habit)."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import HabitNote, User
from ..schemas import NoteIn, NoteOut, NotePatch
from ..security import current_user
from ..services import get_owned_habit, get_owned_note, note_out

router = APIRouter(tags=["notes"])


@router.get("/habits/{habit_id}/notes", response_model=list[NoteOut])
def list_notes(habit_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[NoteOut]:
    """A habit's notes, most recently edited first."""
    habit = get_owned_habit(db, user, habit_id)
    q = select(HabitNote).where(HabitNote.habit_id == habit.id).order_by(HabitNote.updated_at.desc(), HabitNote.title)
    return [note_out(n) for n in db.scalars(q)]


@router.post("/habits/{habit_id}/notes", response_model=NoteOut, status_code=201)
def create_note(habit_id: str, body: NoteIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> NoteOut:
    habit = get_owned_habit(db, user, habit_id)
    note = HabitNote(habit_id=habit.id, title=body.title.strip(), body=body.body)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note_out(note)


@router.get("/notes/{note_id}", response_model=NoteOut)
def get_note(note_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> NoteOut:
    return note_out(get_owned_note(db, user, note_id))


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: str, body: NotePatch, user: User = Depends(current_user), db: Session = Depends(get_db)) -> NoteOut:
    """Changes the title and/or body. The web app autosaves through this while typing."""
    note = get_owned_note(db, user, note_id)
    if body.title is not None:
        note.title = body.title.strip()
    if body.body is not None:
        note.body = body.body
    db.commit()
    db.refresh(note)
    return note_out(note)


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    note = get_owned_note(db, user, note_id)
    db.delete(note)
    db.commit()
    return Response(status_code=204)
