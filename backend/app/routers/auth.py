from functools import lru_cache
from zoneinfo import available_timezones

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import User
from ..schemas import Credentials, SessionOut, UserOut, UserPatch
from ..security import create_session, current_token, current_user, hash_password, revoke_session, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@lru_cache
def _zones() -> frozenset[str]:
    return frozenset(available_timezones())


def _valid_tz(tz: str | None) -> str:
    return tz if tz and tz in _zones() else "UTC"


@router.post("/signup", response_model=SessionOut, status_code=201)
def signup(body: Credentials, db: Session = Depends(get_db)) -> SessionOut:
    if not get_settings().allow_signup:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sign-ups are closed.")
    email = body.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with that email already exists.")
    user = User(email=email, password_hash=hash_password(body.password), timezone=_valid_tz(body.timezone))
    db.add(user)
    db.flush()
    token, expires = create_session(db, user)
    db.commit()
    return SessionOut(token=token, expires_at=expires, user=UserOut.model_validate(user))


@router.post("/login", response_model=SessionOut)
def login(body: Credentials, db: Session = Depends(get_db)) -> SessionOut:
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if user is None or not verify_password(user.password_hash, body.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    if body.timezone and body.timezone != user.timezone:
        user.timezone = _valid_tz(body.timezone)
    token, expires = create_session(db, user)
    db.commit()
    return SessionOut(token=token, expires_at=expires, user=UserOut.model_validate(user))


@router.post("/logout", status_code=204)
def logout(token: str = Depends(current_token), db: Session = Depends(get_db)) -> Response:
    revoke_session(db, token)
    db.commit()
    return Response(status_code=204)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(body: UserPatch, user: User = Depends(current_user), db: Session = Depends(get_db)) -> UserOut:
    if body.timezone not in _zones():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown time zone.")
    user.timezone = body.timezone
    db.commit()
    return UserOut.model_validate(user)
