"""Authentication service.

Handles business logic for registration and login. Token issuance is
done here so the same rules apply regardless of the calling endpoint.

Logout strategy
---------------
Access tokens are stateless JWTs with a 60-minute expiry. There is no
server-side token store by default. ``logout`` therefore issues an
opaque response telling the client to discard its token. Production
deployments that need server-side invalidation can add a Redis-backed
denylist keyed by token ``jti``; the shape of ``create_access_token``
already supports adding a ``jti`` claim when that is introduced.
"""

from fastapi import status
from fastapi.exceptions import HTTPException

from app.config.settings import get_settings
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from app.utils.security import create_access_token, hash_password, verify_password


class AuthError(HTTPException):
    """HTTP error with a consistent shape for the auth surface."""

    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(status_code=status_code, detail=detail)


class AuthService:
    """Stateless façade around the user repository for auth flows."""

    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo

    # ---- Registration --------------------------------------------------

    def register(self, payload: RegisterRequest) -> TokenResponse:
        if self._repo.get_by_email(payload.email) is not None:
            raise AuthError("An account with this email already exists.", status.HTTP_409_CONFLICT)

        user = self._repo.create(
            full_name=payload.full_name,
            email=payload.email,
            password_hash=hash_password(payload.password),
        )
        return self._issue_token(user)

    # ---- Login ---------------------------------------------------------

    def login(self, payload: LoginRequest) -> TokenResponse:
        user = self._repo.get_by_email(payload.email)
        if user is None or not verify_password(payload.password, user.password_hash):
            # Single message so attackers can't enumerate accounts.
            raise AuthError("Invalid email or password.", status.HTTP_401_UNAUTHORIZED)
        if not user.is_active:
            raise AuthError("This account is disabled.", status.HTTP_403_FORBIDDEN)
        return self._issue_token(user)

    # ---- Internals -----------------------------------------------------

    def _issue_token(self, user: User) -> TokenResponse:
        settings = get_settings()
        token = create_access_token(subject=user.id)
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in=settings.jwt_access_token_expire_minutes * 60,
            user=UserPublic.model_validate(user),
        )
