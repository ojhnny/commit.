import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import AuthSession, User

_hasher = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerificationError:
        return False


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(UTC) + timedelta(days=get_settings().session_days)
    db.add(AuthSession(token_hash=_digest(token), user_id=user.id, expires_at=expires))
    # Opportunistic cleanup of this user's expired sessions.
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id, AuthSession.expires_at < datetime.now(UTC)))
    return token, expires


def revoke_session(db: Session, token: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.token_hash == _digest(token)))


def current_token(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    return creds.credentials


def current_user(token: str = Depends(current_token), db: Session = Depends(get_db)) -> User:
    row = db.execute(
        select(User, AuthSession.expires_at)
        .join(AuthSession, AuthSession.user_id == User.id)
        .where(AuthSession.token_hash == _digest(token))
    ).first()
    if row is None or row[1] < datetime.now(UTC):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Your session expired. Sign in again.", headers={"WWW-Authenticate": "Bearer"}
        )
    return row[0]
