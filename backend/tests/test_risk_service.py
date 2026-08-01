"""Unit & Integration tests for Risk Detection Engine (Sprint 12.3)."""

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
from app.services.risk_service import RiskService
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_risk_service_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"riskuser_{ts}@example.com",
            password_hash="hash",
            full_name="Risk Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        service = RiskService(repo)

        # 1. Empty profile -> raises BusinessNotFound
        raised = False
        try:
            service.compute(user.id)
        except BusinessNotFound:
            raised = True
        assert raised, "[FAIL] Expected BusinessNotFound when profile does not exist"

        # 2. Create business profile with risk triggers
        biz = repo.create(
            owner_id=user.id,
            legal_name="Risk Sensitive Goods",
            industry="Retail",
            established_year=2022,
            employee_count=2,  # Operational risk trigger
            annual_revenue=40000.0,  # Financial risk trigger
            revenue_currency="USD",
            country="US",
            state_region="Nevada",
            city="Las Vegas",
        )
        db.commit()

        fresh_biz = repo.get_by_owner(user.id)
        assert fresh_biz is not None

        # 3. Detect Risks
        report = service.detect_risks(fresh_biz)

        assert report.overall_risk_level in ["High", "Medium", "Low"]
        assert report.total_risks_detected > 0
        assert len(report.risks) > 0

        categories = [r.category for r in report.risks]
        assert "financial" in categories
        assert "operational" in categories
        assert "digital" in categories

        first = report.risks[0]
        assert first.risk is not None
        assert first.severity in ["Critical", "High", "Medium", "Low"]
        assert first.recommendation is not None

        # 4. Compute full envelope
        response = service.compute(user.id)
        assert response.report is not None
        assert response.report.total_risks_detected > 0

        print("[PASS] RiskService unit tests passed cleanly!")

    finally:
        db.close()


def test_risk_api_endpoint():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    r_unauth = client.get("/api/v1/business/risks")
    assert r_unauth.status_code == 401, f"[FAIL] Expected 401, got {r_unauth.status_code}"

    # 2. Register user without business -> 404
    email_empty = f"risk_empty_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Empty User", "email": email_empty, "password": "Password123!"},
    )
    login_empty = client.post(
        "/api/v1/auth/login",
        json={"email": email_empty, "password": "Password123!"},
    )
    r_404 = client.get("/api/v1/business/risks", cookies=login_empty.cookies)
    assert r_404.status_code == 404, f"[FAIL] Expected 404, got {r_404.status_code}"

    # 3. Register user with business -> 200 OK
    email_biz = f"risk_biz_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Risk Biz User", "email": email_biz, "password": "Password123!"},
    )
    login_biz = client.post(
        "/api/v1/auth/login",
        json={"email": email_biz, "password": "Password123!"},
    )
    cookies = login_biz.cookies

    biz_payload = {
        "basic": {
            "legal_name": "Apex Risk Corp",
            "industry": "Logistics",
            "established_year": 2019,
            "employee_count": 5,
            "annual_revenue": 120000.0,
            "revenue_currency": "USD",
        }
    }
    client.post("/api/v1/business", json=biz_payload, cookies=cookies)

    # GET /api/v1/business/risks
    res = client.get("/api/v1/business/risks", cookies=cookies)
    assert res.status_code == 200, f"[FAIL] GET /api/v1/business/risks failed: {res.text}"
    body = res.json()

    assert "generated_at" in body
    assert "report" in body
    report = body["report"]
    assert "overall_risk_level" in report
    assert "total_risks_detected" in report
    assert "risks" in report and len(report["risks"]) > 0

    first_item = report["risks"][0]
    assert "risk" in first_item
    assert "category" in first_item
    assert "severity" in first_item
    assert "recommendation" in first_item

    print("[PASS] GET /api/v1/business/risks API endpoint test passed cleanly!")


if __name__ == "__main__":
    test_risk_service_unit()
    test_risk_api_endpoint()
