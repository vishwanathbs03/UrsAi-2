"""Unit & Integration tests for SWOT Engine (Sprint 11.2)."""

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
from app.services.swot_service import SwotService
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_swot_service_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"swotuser_{ts}@example.com",
            password_hash="hash",
            full_name="SWOT Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        service = SwotService(repo)

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
            legal_name="SWOT Manufacturing Inc",
            industry="Industrial Goods",
            established_year=2016,
            employee_count=25,
            annual_revenue=750000.0,
            revenue_currency="USD",
            country="US",
            state_region="Illinois",
            city="Chicago",
        )
        repo.replace_products(
            biz,
            [
                {"name": "Industrial Valve", "category": "Equipment", "unit_price": 250.0},
            ],
        )
        repo.replace_export_history(
            biz,
            [{"destination_country": "Mexico", "product_category": "Equipment"}],
        )
        repo.replace_certifications(
            biz,
            [{"name": "ISO 9001", "issuer": "TUV", "year_obtained": 2020}],
        )
        db.commit()

        fresh_biz = repo.get_by_owner(user.id)
        assert fresh_biz is not None

        # 3. Analyze SWOT
        report = service.analyze_swot(fresh_biz)

        assert len(report.strengths) > 0
        assert len(report.opportunities) > 0
        assert any(s.title == "International Footprint" or "Export" in s.title for s in report.strengths)
        assert any(c.title == "Quality Certifications" for c in report.strengths)

        # 4. Compute full envelope
        response = service.compute(user.id)
        assert response.swot is not None
        assert len(response.swot.strengths) > 0

        print("[PASS] SwotService unit tests passed cleanly!")

    finally:
        db.close()


def test_swot_api_endpoint():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    r_unauth = client.get("/api/v1/business/swot")
    assert r_unauth.status_code == 401, f"[FAIL] Expected 401, got {r_unauth.status_code}"

    # 2. Register user without business -> 404
    email_empty = f"swot_empty_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Empty User", "email": email_empty, "password": "Password123!"},
    )
    login_empty = client.post(
        "/api/v1/auth/login",
        json={"email": email_empty, "password": "Password123!"},
    )
    r_404 = client.get("/api/v1/business/swot", cookies=login_empty.cookies)
    assert r_404.status_code == 404, f"[FAIL] Expected 404, got {r_404.status_code}"

    # 3. Register user with business -> 200 OK
    email_biz = f"swot_biz_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "SWOT Biz User", "email": email_biz, "password": "Password123!"},
    )
    login_biz = client.post(
        "/api/v1/auth/login",
        json={"email": email_biz, "password": "Password123!"},
    )
    cookies = login_biz.cookies

    biz_payload = {
        "basic": {
            "legal_name": "Apex SWOT Corp",
            "industry": "Renewables",
            "established_year": 2018,
            "employee_count": 18,
            "annual_revenue": 400000.0,
            "revenue_currency": "USD",
        }
    }
    client.post("/api/v1/business", json=biz_payload, cookies=cookies)

    # GET /api/v1/business/swot
    res = client.get("/api/v1/business/swot", cookies=cookies)
    assert res.status_code == 200, f"[FAIL] GET /api/v1/business/swot failed: {res.text}"
    body = res.json()

    assert "generated_at" in body
    assert "swot" in body
    swot = body["swot"]
    assert "strengths" in swot and isinstance(swot["strengths"], list)
    assert "weaknesses" in swot and isinstance(swot["weaknesses"], list)
    assert "opportunities" in swot and isinstance(swot["opportunities"], list)
    assert "threats" in swot and isinstance(swot["threats"], list)

    print("[PASS] GET /api/v1/business/swot API endpoint test passed cleanly!")


if __name__ == "__main__":
    test_swot_service_unit()
    test_swot_api_endpoint()
