"""Test suite for Insights API backend — Sprint 16."""

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
from app.utils.database import Base, engine

Base.metadata.create_all(bind=engine)


def test_insights_api():
    client = TestClient(app)
    ts = int(time.time())
    email = f"insights_test_{ts}@example.com"

    # 1. Unauthenticated -> 401
    assert client.get("/api/v1/insights").status_code == 401

    # 2. Register & Login
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Insights User", "email": email, "password": "Password123!"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    cookies = login.cookies

    # 3. Missing profile -> 404
    assert client.get("/api/v1/insights", cookies=cookies).status_code == 404

    # 4. Create business profile -> 200 OK
    client.post(
        "/api/v1/business",
        json={
            "basic": {
                "legal_name": "Apex Quantum Tech",
                "industry": "Robotics",
                "established_year": 2019,
                "employee_count": 14,
                "annual_revenue": 650000.0,
                "revenue_currency": "USD",
            }
        },
        cookies=cookies,
    )

    get_res = client.get("/api/v1/insights", cookies=cookies)
    assert get_res.status_code == 200
    body = get_res.json()
    assert "generated_at" in body
    assert "insights" in body
    insights = body["insights"]
    assert len(insights["key_findings"]) >= 1
    assert len(insights["positive_observations"]) >= 1
    assert len(insights["improvement_suggestions"]) >= 1
    assert "industry_comparison" in insights
    assert insights["industry_comparison"]["industry_name"] == "Robotics"

    print("[PASS] Insights API test suite passed cleanly!")


if __name__ == "__main__":
    test_insights_api()
