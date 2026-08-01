"""Unit and Integration tests for /api/v1/analytics endpoint — Sprint 13.1."""

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
from app.services.analytics_v1_service import AnalyticsV1Service
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_analytics_v1_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"anv1_new_{ts}@example.com",
            password_hash="hash",
            full_name="Analytics V1 User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        service = AnalyticsV1Service(repo)

        # 1. Profile missing -> raises BusinessNotFound
        try:
            service.compute(user.id)
            assert False, "Expected BusinessNotFound"
        except BusinessNotFound:
            pass

        # 2. Create business
        repo.create(
            owner_id=user.id,
            legal_name="Apex Global Logistics",
            industry="Supply Chain",
            established_year=2019,
            employee_count=16,
            annual_revenue=520000.0,
            revenue_currency="USD",
            country="US",
            state_region="IL",
            city="Chicago",
        )
        db.commit()

        fresh = repo.get_by_owner(user.id)
        assert fresh is not None

        res = service.calculate_overview(fresh)
        assert res.overview.business_name == "Apex Global Logistics"
        assert res.overview.health_score > 0
        assert res.metrics.growth_score > 0
        assert res.metrics.digital_readiness > 0
        assert len(res.trends.monthly_trend) == 6
        assert len(res.trends.yearly_trend) == 3
        assert len(res.strengths) >= 1

        print("[PASS] Unit test for AnalyticsV1Service passed cleanly!")

    finally:
        db.close()


def test_analytics_v1_api():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    res = client.get("/api/v1/analytics")
    assert res.status_code == 401

    # 2. Register & login
    email = f"anv1_api_new_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "API User", "email": email, "password": "Password123!"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    cookies = login.cookies

    # 3. Missing profile -> 404
    assert client.get("/api/v1/analytics", cookies=cookies).status_code == 404

    # 4. Create business -> 200 OK
    client.post(
        "/api/v1/business",
        json={
            "basic": {
                "legal_name": "Apex Analytics Enterprise",
                "industry": "Robotics",
                "established_year": 2020,
                "employee_count": 20,
                "annual_revenue": 780000.0,
                "revenue_currency": "USD",
            }
        },
        cookies=cookies,
    )

    get_res = client.get("/api/v1/analytics", cookies=cookies)
    assert get_res.status_code == 200
    body = get_res.json()
    assert "generated_at" in body
    assert "analytics" in body
    assert body["analytics"]["overview"]["business_name"] == "Apex Analytics Enterprise"

    print("[PASS] Integration test for /api/v1/analytics passed cleanly!")


if __name__ == "__main__":
    test_analytics_v1_unit()
    test_analytics_v1_api()
