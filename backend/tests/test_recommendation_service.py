"""Unit & Integration tests for Recommendation Engine (Sprint 12.1)."""

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
from app.services.recommendation_service import RecommendationService
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_recommendation_service_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"recuser_{ts}@example.com",
            password_hash="hash",
            full_name="Recommendation Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        service = RecommendationService(repo)

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
            legal_name="Apex Recommendation Systems",
            industry="Healthcare Technology",
            established_year=2021,
            employee_count=12,
            annual_revenue=350000.0,
            revenue_currency="USD",
            country="US",
            state_region="Massachusetts",
            city="Boston",
        )
        db.commit()

        fresh_biz = repo.get_by_owner(user.id)
        assert fresh_biz is not None

        # 3. Generate Recommendations
        report = service.generate_recommendations(fresh_biz)

        assert report.total_count > 0
        assert len(report.recommendations) > 0

        first = report.recommendations[0]
        assert first.id is not None
        assert first.title is not None
        assert first.description is not None
        assert first.category in ["export", "digital", "compliance", "operations", "financial"]
        assert first.priority in ["Critical", "High", "Medium", "Low"]
        assert 0 <= first.priority_score <= 100
        assert first.impact in ["High", "Medium", "Low"]
        assert first.effort in ["Low", "Medium", "High"]

        # Verify descending sort order by priority_score
        scores = [r.priority_score for r in report.recommendations]
        assert scores == sorted(scores, reverse=True), "[FAIL] Recommendations are not sorted descending by priority_score"

        # 4. Compute full envelope
        response = service.compute(user.id)
        assert "report" in response
        assert response["report"].total_count > 0

        print("[PASS] RecommendationService & Priority Engine unit tests passed cleanly!")

    finally:
        db.close()


def test_recommendation_api_endpoint():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    r_unauth = client.get("/api/v1/business/recommendations")
    assert r_unauth.status_code == 401, f"[FAIL] Expected 401, got {r_unauth.status_code}"

    # 2. Register user without business -> 404
    email_empty = f"rec_empty_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Empty User", "email": email_empty, "password": "Password123!"},
    )
    login_empty = client.post(
        "/api/v1/auth/login",
        json={"email": email_empty, "password": "Password123!"},
    )
    r_404 = client.get("/api/v1/business/recommendations", cookies=login_empty.cookies)
    assert r_404.status_code == 404, f"[FAIL] Expected 404, got {r_404.status_code}"

    # 3. Register user with business -> 200 OK
    email_biz = f"rec_biz_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Recommendation Biz User", "email": email_biz, "password": "Password123!"},
    )
    login_biz = client.post(
        "/api/v1/auth/login",
        json={"email": email_biz, "password": "Password123!"},
    )
    cookies = login_biz.cookies

    biz_payload = {
        "basic": {
            "legal_name": "Apex Recommendation Corp",
            "industry": "Robotics",
            "established_year": 2020,
            "employee_count": 18,
            "annual_revenue": 450000.0,
            "revenue_currency": "USD",
        }
    }
    client.post("/api/v1/business", json=biz_payload, cookies=cookies)

    # GET /api/v1/business/recommendations
    res = client.get("/api/v1/business/recommendations", cookies=cookies)
    assert res.status_code == 200, f"[FAIL] GET /api/v1/business/recommendations failed: {res.text}"
    body = res.json()

    assert "generated_at" in body
    assert "report" in body
    report = body["report"]
    assert "total_count" in report
    assert "recommendations" in report and len(report["recommendations"]) > 0

    first_item = report["recommendations"][0]
    assert "id" in first_item
    assert "title" in first_item
    assert "description" in first_item
    assert "category" in first_item
    assert "priority" in first_item
    assert "impact" in first_item
    assert "effort" in first_item

    print("[PASS] GET /api/v1/business/recommendations API endpoint test passed cleanly!")


if __name__ == "__main__":
    test_recommendation_service_unit()
    test_recommendation_api_endpoint()
