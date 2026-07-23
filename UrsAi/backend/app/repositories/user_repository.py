"""User data-access layer.

Keeps all SQL out of the service / API layers. Future migrations that
add related tables will add new methods here rather than scattering
queries across the codebase.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    """Thin wrapper around a SQLAlchemy session."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_id(self, user_id: int) -> User | None:
        return self._db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        normalized = email.strip().lower()
        stmt = select(User).where(User.email == normalized)
        return self._db.scalar(stmt)

    def create(self, *, full_name: str, email: str, password_hash: str) -> User:
        user = User(
            full_name=full_name.strip(),
            email=email.strip().lower(),
            password_hash=password_hash,
            is_active=True,
        )
        self._db.add(user)
        self._db.commit()
        self._db.refresh(user)
        return user
