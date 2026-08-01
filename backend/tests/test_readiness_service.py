"""Unit & Integration tests for Business Readiness Engine (Sprint 11.3)."""

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
from app.services.readiness_service import ReadinessService
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_readiness_service_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"readinessuser_{ts}@example.com",
            password_hash="hash",
            full_name="Readiness Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        service = ReadinessService(repo)

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
            legal_name="Readiness Dynamics Corp",
            industry="Aerospace",
            established_year=2015,
            employee_count=40,
            annual_revenue=1500000.0,
            revenue_currency="USD",
            country="US",
            state_region="Washington",
            city="Seattle",
        )
        repo.replace_products(
            biz,
            [
                {"name": "Flight Sensor", "category": "Hardware", "unit_price": 1200.0},
            ],
        )
        repo.replace_export_history(
            biz,
            [{"destination_country": "Canada", "product_category": "Hardware"}],
        )
        repo.replace_certifications(
            biz,
            [{"name": "AS9100", "issuer": "SAE", "year_obtained": 2019}],
        )
        db.commit()

        fresh_biz = repo.get_by_owner(user.id)
        assert fresh_biz is not None

        # 3. Analyze Readiness
        report = service.analyze_readiness(fresh_biz)

        assert 0 <= report.overall_score <= 100
        assert report.grade in ["A", "B", "C", "D", "E", "F"]
        assert len(report.breakdown) == 6

        dimensions = [b.dimension for b in report.breakdown]
        assert "Digital" in dimensions
        assert "Operations" in dimensions
        assert "Finance" in dimensions
        assert "Market" in dimensions
        assert "Compliance" in dimensions
        assert "Growth" in dimensions

        # 4. Compute full envelope
        response = service.compute(user.id)
        assert response.readiness is not None
        assert response.readiness.overall_score > 0

        print("[PASS] ReadinessService unit tests passed cleanly!")

    finally:
        db.close()


def test_readiness_api_endpoint():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    r_unauth = client.get("/api/v1/business/readiness")
    assert r_unauth.status_code == 401, f"[FAIL] Expected 401, got {r_unauth.status_code}"

    # 2. Register user without business -> 404
    email_empty = f"readiness_empty_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Empty User", "email": email_empty, "password": "Password123!"},
    )
    login_empty = client.post(
        "/api/v1/auth/login",
        json={"email": email_empty, "password": "Password123!"},
    )
    r_404 = client.get("/api/v1/business/readiness", cookies=login_empty.cookies)
    assert r_404.status_code == 404, f"[FAIL] Expected 404, got {r_404.status_code}"

    # 3. Register user with business -> 200 OK
    email_biz = f"readiness_biz_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Readiness Biz User", "email": email_biz, "password": "Password123!"},
    )
    login_biz = client.post(
        "/api/v1/auth/login",
        json={"email": email_biz, "password": "Password123!"},
    )
    cookies = login_biz.cookies

    biz_payload = {
        "basic": {
            "legal_name": "Apex Readiness Systems",
            "industry": "Electronics",
            "established_year": 2017,
            "employee_count": 22,
            "annual_revenue": 600000.0,
            "revenue_currency": "USD",
        }
    }
    client.post("/api/v1/business", json=biz_payload, cookies=cookies)

    # GET /api/v1/business/readiness
    res = client.get("/api/v1/business/readiness", cookies=cookies)
    assert res.status_code == 200, f"[FAIL] GET /api/v1/business/readiness failed: {res.text}"
    body = res.json()

    assert "generated_at" in body
    assert "readiness" in body
    readiness = body["readiness"]
    assert "overall_score" in readiness
    assert "grade" in readiness
    assert "breakdown" in readiness and len(readiness["breakdown"]) == 6

    print("[PASS] GET /api/v1/business/readiness API endpoint test passed cleanly!")


if __name__ == "__main__":
    test_readiness_service_unit()
    test_readiness_api_endpoint()
