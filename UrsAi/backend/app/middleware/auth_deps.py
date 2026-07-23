"""Authentication dependencies.

The current-user dependency accepts the JWT from either:
  * The HTTP-only ``atlas_access_token`` cookie (browser clients), or
  * The standard ``Authorization: Bearer <token>`` header (API clients).
"""

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.utils.database import get_db
from app.utils.security import TokenError, decode_access_token


_bearer_scheme = HTTPBearer(auto_error=False)


def _extract_token(
    request: Request,
    bearer: HTTPAuthorizationCredentials | None,
) -> str | None:
    """Pull the access token from Authorization header or cookie."""
    if bearer and bearer.scheme.lower() == "bearer" and bearer.credentials:
        return bearer.credentials
    cookie_name = get_settings().cookie_name
    return request.cookies.get(cookie_name)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    bearer: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    atlas_access_token: str | None = Cookie(default=None),
) -> User:
    """Resolve the current user from the access token, or 401."""
    # Honor the cookie name configured in settings even if FastAPI
    # bound it to a default parameter name.
    token = _extract_token(
        request,
        bearer,
    ) or atlas_access_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(token)
    except TokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = UserRepository(db).get_by_id(user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
