"""Authentication request/response schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---- Registration --------------------------------------------------------


class RegisterRequest(BaseModel):
    """Payload for POST /auth/register."""

    full_name: Annotated[str, Field(min_length=2, max_length=120)]
    email: EmailStr
    password: Annotated[str, Field(min_length=8, max_length=128)]

    @field_validator("password")
    @classmethod
    def _validate_password_strength(cls, value: str) -> str:
        """Enforce 1 uppercase, 1 lowercase, 1 number."""
        errors: list[str] = []
        if not any(c.isupper() for c in value):
            errors.append("uppercase letter")
        if not any(c.islower() for c in value):
            errors.append("lowercase letter")
        if not any(c.isdigit() for c in value):
            errors.append("number")
        if errors:
            raise ValueError(
                "Password must contain at least one " + ", ".join(errors) + "."
            )
        return value


# ---- Login ---------------------------------------------------------------


class LoginRequest(BaseModel):
    """Payload for POST /auth/login."""

    email: EmailStr
    password: Annotated[str, Field(min_length=1, max_length=128)]


# ---- Responses -----------------------------------------------------------


class UserPublic(BaseModel):
    """Public user representation. Never includes the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    """Returned after a successful register or login.

    The token is also set as an HTTP-only cookie by the route handler
    for browser-based clients.
    """

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(
        description="Token lifetime in seconds.",
    )
    user: UserPublic
