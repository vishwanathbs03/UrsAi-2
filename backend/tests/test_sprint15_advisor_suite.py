"""Master Test Suite for Sprint 15 AI Advisor API.

Verifies end-to-end functionality for:
  * GET /api/v1/business/advisor
  * GET /api/v1/advisor
  * 401 Unauthorized, 404 Not Found, 200 OK
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///" + str(BACKEND / "atlas_ai.db").replace("\\", "/")
os.environ["JWT_SECRET_KEY"] = "test-secret-32-bytes-long-key-12345"

from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User
from app.repositories.business_repository import BusinessRepository
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_sprint15_advisor_api():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    for ep in ["/api/v1/business/advisor", "/api/v1/advisor"]:
        res = client.get(ep)
        assert res.status_code == 401, f"[FAIL] Expected 401 for {ep}, got {res.status_code}"

    # 2. Register user without business -> 404
    email_empty = f"adv_empty_new_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Empty User", "email": email_empty, "password": "Password123!"},
    )
    login_empty = client.post(
        "/api/v1/auth/login",
        json={"email": email_empty, "password": "Password123!"},
    )
    for ep in ["/api/v1/business/advisor", "/api/v1/advisor"]:
        res = client.get(ep, cookies=login_empty.cookies)
        assert res.status_code == 404, f"[FAIL] Expected 404 for {ep}, got {res.status_code}"

    # 3. Register user with business -> 200 OK
    email_biz = f"adv_biz_new_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Advisor User", "email": email_biz, "password": "Password123!"},
    )
    login_biz = client.post(
        "/api/v1/auth/login",
        json={"email": email_biz, "password": "Password123!"},
    )
    cookies = login_biz.cookies

    client.post(
        "/api/v1/business",
        json={
            "basic": {
                "legal_name": "Apex AI Advisor Enterprise",
                "industry": "Software",
                "established_year": 2021,
                "employee_count": 16,
                "annual_revenue": 480000.0,
                "revenue_currency": "USD",
            }
        },
        cookies=cookies,
    )

    for ep in ["/api/v1/business/advisor", "/api/v1/advisor"]:
        res = client.get(ep, cookies=cookies)
        assert res.status_code == 200, f"[FAIL] Expected 200 for {ep}, got {res.status_code}"
        body = res.json()
        assert "generated_at" in body
        assert "report" in body
        rep = body["report"]
        assert rep["overall_advisor_score"] > 0
        assert len(rep["executive_summary"]) > 0
        assert "swot_analysis" in rep
        assert "risk_assessment" in rep

    print("[PASS] Sprint 15 Advisor API test suite passed cleanly!")


if __name__ == "__main__":
    test_sprint15_advisor_api()
