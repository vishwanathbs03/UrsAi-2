"""Master Test Suite for Sprint 14 — Predictive Engines.

Verifies end-to-end functionality for:
  * Sprint 14.1: Revenue Forecast Engine
  * Sprint 14.2: Business Growth Forecast Engine
  * Sprint 14.3: Future Risk Prediction Engine
  * Sprint 14.5: Integration API Endpoints (401, 404, 200 OK)
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
from app.services.predictive_sprint14_service import (
    FutureRiskPredictionService,
    GrowthPredictionService,
    RevenuePredictionService,
)
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_sprint14_services_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"preduser_{ts}@example.com",
            password_hash="hash",
            full_name="Predictive Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        rev_service = RevenuePredictionService(repo)

        # 1. Empty profile -> raises BusinessNotFound
        raised = False
        try:
            rev_service.compute(user.id)
        except BusinessNotFound:
            raised = True
        assert raised, "[FAIL] Expected BusinessNotFound when profile does not exist"

        # 2. Create business profile
        biz = repo.create(
            owner_id=user.id,
            legal_name="Apex Predictive Systems",
            industry="Healthcare Technology",
            established_year=2020,
            employee_count=12,
            annual_revenue=350000.0,
            revenue_currency="USD",
            country="US",
            state_region="Massachusetts",
            city="Boston",
        )
        db.commit()

        fresh = repo.get_by_owner(user.id)
        assert fresh is not None

        # 3. Revenue Forecast Service (Sprint 14.1)
        rev_rep = rev_service.forecast_revenue(fresh)
        assert rev_rep.current_annual_revenue == 350000.0
        assert rev_rep.forecast_3m >= rev_rep.current_annual_revenue
        assert rev_rep.forecast_6m >= rev_rep.forecast_3m
        assert rev_rep.forecast_12m >= rev_rep.forecast_6m
        assert 0 <= rev_rep.confidence <= 100
        assert rev_rep.trend in ["Upward Growth", "Stable", "Downward Risk"]

        # 4. Growth Forecast Service (Sprint 14.2)
        growth_service = GrowthPredictionService(repo)
        growth_rep = growth_service.forecast_growth(fresh)
        assert growth_rep.predicted_employees_12m >= fresh.employee_count
        assert growth_rep.predicted_products_12m >= 0
        assert growth_rep.expansion_readiness in ["High", "Medium", "Low"]
        assert 0 <= growth_rep.growth_confidence <= 100

        # 5. Future Risk Prediction Service (Sprint 14.3)
        risk_service = FutureRiskPredictionService(repo)
        risk_rep = risk_service.forecast_risks(fresh)
        assert risk_rep.total_predicted_risks >= 0
        assert len(risk_rep.future_risks) == risk_rep.total_predicted_risks

        print("[PASS] Sprint 14 Unit Services passed cleanly!")

    finally:
        db.close()


def test_sprint14_api_integration():
    client = TestClient(app)
    ts = int(time.time())

    endpoints = [
        "/api/v1/business/predictions/revenue",
        "/api/v1/business/predictions/growth",
        "/api/v1/business/predictions/risk",
    ]

    # 1. Unauthenticated -> 401
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401, f"[FAIL] {ep} expected 401, got {res.status_code}"

    # 2. Register user without business -> 404
    email_empty = f"pred_empty_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Empty User", "email": email_empty, "password": "Password123!"},
    )
    login_empty = client.post(
        "/api/v1/auth/login",
        json={"email": email_empty, "password": "Password123!"},
    )
    for ep in endpoints:
        res = client.get(ep, cookies=login_empty.cookies)
        assert res.status_code == 404, f"[FAIL] {ep} expected 404, got {res.status_code}"

    # 3. Register user with business -> 200 OK
    email_biz = f"pred_biz_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Predictive User", "email": email_biz, "password": "Password123!"},
    )
    login_biz = client.post(
        "/api/v1/auth/login",
        json={"email": email_biz, "password": "Password123!"},
    )
    cookies = login_biz.cookies

    biz_payload = {
        "basic": {
            "legal_name": "Apex Predictive Corp",
            "industry": "Robotics",
            "established_year": 2019,
            "employee_count": 18,
            "annual_revenue": 450000.0,
            "revenue_currency": "USD",
        }
    }
    client.post("/api/v1/business", json=biz_payload, cookies=cookies)

    for ep in endpoints:
        res = client.get(ep, cookies=cookies)
        assert res.status_code == 200, f"[FAIL] {ep} returned status {res.status_code}: {res.text}"
        body = res.json()
        assert "generated_at" in body
        assert "report" in body

    print("[PASS] Sprint 14 Integration API test suite passed cleanly!")


if __name__ == "__main__":
    test_sprint14_services_unit()
    test_sprint14_api_integration()
