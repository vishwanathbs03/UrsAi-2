"""Service layer package.

Business services live here. Each service is a stateless façade that
combines repositories, utilities, and external clients.
"""

from app.services.auth_service import AuthError, AuthService
from app.services.business_service import BusinessService

__all__ = ["AuthService", "AuthError", "BusinessService"]
