"""Integration test for GET /api/v1/dashboard (Sprint 10 Task 10.1)."""

from __future__ import annotations

import os
import sys
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


def test_dashboard_flow():
    client = TestClient(app)

    # 1. Unauthenticated request -> 401
    r_unauth = client.get("/api/v1/dashboard")
    assert r_unauth.status_code == 401, f"Expected 401, got {r_unauth.status_code}"

    # 2. Register & Login user with unique email
    import time
    email = f"dashuser_{int(time.time())}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Dash User", "email": email, "password": "Password123!"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    cookies = login_res.cookies

    # 3. User with no business -> 404
    r_nobiz = client.get("/api/v1/dashboard", cookies=cookies)
    assert r_nobiz.status_code == 404, f"Expected 404, got {r_nobiz.status_code}"

    # 4. Create Business Profile
    biz_payload = {
        "basic": {
            "legal_name": "Dashboard Enterprises",
            "industry": "Technology",
            "established_year": 2022,
            "employee_count": 10,
            "annual_revenue": 150000.0,
            "revenue_currency": "USD",
        }
    }
    create_res = client.post("/api/v1/business", json=biz_payload, cookies=cookies)
    assert create_res.status_code == 201, f"Create business failed: {create_res.text}"

    # 5. Fetch Dashboard -> 200 OK
    dash_res = client.get("/api/v1/dashboard", cookies=cookies)
    assert dash_res.status_code == 200, f"Expected 200, got {dash_res.status_code}"
    data = dash_res.json()

    # Validate required response keys
    assert "business" in data and data["business"]["legal_name"] == "Dashboard Enterprises"
    assert "kpis" in data
    assert "health_score" in data or "healthScore" in data
    assert "ai_summary" in data or "aiSummary" in data
    assert "recent_activity" in data or "recentActivity" in data
    assert "quick_actions" in data or "quickActions" in data

    print("[SUCCESS] GET /api/v1/dashboard test passed cleanly!")


if __name__ == "__main__":
    test_dashboard_flow()
