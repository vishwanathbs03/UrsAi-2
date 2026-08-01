"""Unit & Integration tests for Opportunity Detector Engine (Sprint 11.4)."""

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
from app.services.opportunity_service import OpportunityService
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_opportunity_service_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"oppuser_{ts}@example.com",
            password_hash="hash",
            full_name="Opportunity Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        service = OpportunityService(repo)

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
            legal_name="Opportunity Tech Global",
            industry="Telecommunications",
            established_year=2019,
            employee_count=15,
            annual_revenue=500000.0,
            revenue_currency="USD",
            country="US",
            state_region="Texas",
            city="Austin",
        )
        db.commit()

        fresh_biz = repo.get_by_owner(user.id)
        assert fresh_biz is not None

        # 3. Detect Opportunities
        report = service.detect_opportunities(fresh_biz)

        assert report.total_count > 0
        assert report.total_estimated_value > 0
        opp_ids = [o.id for o in report.opportunities]

        assert "opp_export_expansion" in opp_ids
        assert "opp_ecommerce_storefront" in opp_ids

        # 4. Compute full envelope
        response = service.compute(user.id)
        assert response.report is not None
        assert response.report.total_count > 0

        print("[PASS] OpportunityService unit tests passed cleanly!")

    finally:
        db.close()


def test_opportunity_api_endpoint():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    r_unauth = client.get("/api/v1/business/opportunities")
    assert r_unauth.status_code == 401, f"[FAIL] Expected 401, got {r_unauth.status_code}"

    # 2. Register user without business -> 404
    email_empty = f"opp_empty_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Empty User", "email": email_empty, "password": "Password123!"},
    )
    login_empty = client.post(
        "/api/v1/auth/login",
        json={"email": email_empty, "password": "Password123!"},
    )
    r_404 = client.get("/api/v1/business/opportunities", cookies=login_empty.cookies)
    assert r_404.status_code == 404, f"[FAIL] Expected 404, got {r_404.status_code}"

    # 3. Register user with business -> 200 OK
    email_biz = f"opp_biz_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Opportunity Biz User", "email": email_biz, "password": "Password123!"},
    )
    login_biz = client.post(
        "/api/v1/auth/login",
        json={"email": email_biz, "password": "Password123!"},
    )
    cookies = login_biz.cookies

    biz_payload = {
        "basic": {
            "legal_name": "Apex Opportunity Corp",
            "industry": "Clean Energy",
            "established_year": 2021,
            "employee_count": 25,
            "annual_revenue": 800000.0,
            "revenue_currency": "USD",
        }
    }
    client.post("/api/v1/business", json=biz_payload, cookies=cookies)

    # GET /api/v1/business/opportunities
    res = client.get("/api/v1/business/opportunities", cookies=cookies)
    assert res.status_code == 200, f"[FAIL] GET /api/v1/business/opportunities failed: {res.text}"
    body = res.json()

    assert "generated_at" in body
    assert "report" in body
    report = body["report"]
    assert "total_count" in report
    assert "total_estimated_value" in report
    assert "opportunities" in report and len(report["opportunities"]) > 0

    first_opp = report["opportunities"][0]
    assert "id" in first_opp
    assert "title" in first_opp
    assert "description" in first_opp
    assert "priority" in first_opp
    assert "impact" in first_opp
    assert "difficulty" in first_opp
    assert "estimated_value" in first_opp
    assert "category" in first_opp

    print("[PASS] GET /api/v1/business/opportunities API endpoint test passed cleanly!")


if __name__ == "__main__":
    test_opportunity_service_unit()
    test_opportunity_api_endpoint()
