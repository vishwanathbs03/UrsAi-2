"""Master Test Suite for Sprint 13 Part 1 — Business Analytics API.

Verifies end-to-end functionality for:
  * GET /api/v1/business/analytics (401, 404, 200 OK)
  * BusinessAnalyticsService calculations
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
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.services.analytics_sprint13_service import BusinessAnalyticsService
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_sprint13_analytics_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"analyticsuser_{ts}@example.com",
            password_hash="hash",
            full_name="Analytics Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        service = BusinessAnalyticsService(repo)

        # 1. Empty profile -> raises BusinessNotFound
        raised = False
        try:
            service.compute(user.id)
        except BusinessNotFound:
            raised = True
        assert raised, "[FAIL] Expected BusinessNotFound when profile does not exist"

        # 2. Create business profile
        biz = repo.create(
            owner_id=user.id,
            legal_name="Apex Analytics Corp",
            industry="Retail Trade",
            established_year=2019,
            employee_count=24,
            annual_revenue=640000.0,
            revenue_currency="USD",
            country="US",
            state_region="TX",
            city="Austin",
        )
        db.commit()

        fresh = repo.get_by_owner(user.id)
        assert fresh is not None

        # 3. Compute Analytics Data
        res = service.calculate_analytics(fresh)
        assert res.profile_completion > 0
        assert res.health_score > 0
        assert res.products_count >= 0
        assert res.years_in_business >= 0
        assert res.business_age_category in [
            "Early Startup",
            "Growing Business",
            "Established Enterprise",
            "Mature Enterprise",
        ]
        assert len(res.monthly_growth) == 6
        assert len(res.health_history) == 6

        print("[PASS] Sprint 13 Part 1 Unit Analytics test passed cleanly!")

    finally:
        db.close()


def test_sprint13_analytics_api():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    res = client.get("/api/v1/business/analytics")
    assert res.status_code == 401

    # 2. Register & login user with business profile
    email = f"analytics_api_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Analytics API User", "email": email, "password": "Password123!"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    cookies = login.cookies

    # 3. Registered user without business -> 404
    assert client.get("/api/v1/business/analytics", cookies=cookies).status_code == 404

    # 4. Create business -> 200 OK
    client.post(
        "/api/v1/business",
        json={
            "basic": {
                "legal_name": "Apex Analytics Solutions",
                "industry": "Manufacturing",
                "established_year": 2018,
                "employee_count": 32,
                "annual_revenue": 820000.0,
                "revenue_currency": "USD",
            }
        },
        cookies=cookies,
    )

    get_res = client.get("/api/v1/business/analytics", cookies=cookies)
    assert get_res.status_code == 200
    body = get_res.json()
    assert "generated_at" in body
    assert "analytics" in body
    assert body["analytics"]["industry"] == "Manufacturing"

    print("[PASS] Sprint 13 Part 1 Integration Analytics API test passed cleanly!")


if __name__ == "__main__":
    test_sprint13_analytics_unit()
    test_sprint13_analytics_api()
