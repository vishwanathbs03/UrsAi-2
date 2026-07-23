"""Rate-limiting hooks.

The structure is provided so the auth surface can be protected by a
real limiter in production without changing call sites.

Recommended integration (not enabled by default in this milestone):

    from slowapi import Limiter
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address)

    @router.post("/login")
    @limiter.limit("5/minute")
    def login(...): ...

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

The two ``RateLimited`` constants below are the canonical place to
declare limits for each sensitive endpoint.
"""

from fastapi import Request

# Public knobs. Wire these into a limiter instance in main.py or a
# dedicated extension module.
LOGIN_RATE_LIMIT = "5/minute"
REGISTER_RATE_LIMIT = "5/hour"
PASSWORD_RESET_RATE_LIMIT = "3/hour"


def client_key(request: Request) -> str:
    """Default keying strategy: client IP address.

    Production should combine IP with a fingerprint or signed
    client-hint to prevent trivial bypass via proxies.
    """
    if request.client is None:
        return "unknown"
    return request.client.host
