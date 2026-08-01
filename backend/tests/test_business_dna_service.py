"""Unit tests for Business DNA Engine (Sprint 11.1)."""

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
from app.services.business_dna_service import BusinessDNAService
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_business_dna_service_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"dnauser_{ts}@example.com",
            password_hash="hash",
            full_name="DNA Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        service = BusinessDNAService(repo)

        # 1. No business -> raises BusinessNotFound
        raised = False
        try:
            service.compute(user.id)
        except BusinessNotFound:
            raised = True
        assert raised, "[FAIL] Expected BusinessNotFound when business does not exist"

        # 2. Create business profile
        biz = repo.create(
            owner_id=user.id,
            legal_name="DNA Quantum Labs",
            industry="Software & AI",
            established_year=2015,
            employee_count=35,
            annual_revenue=500000.0,
            revenue_currency="USD",
            country="US",
            state_region="California",
            city="Palo Alto",
        )
        repo.replace_products(
            biz,
            [
                {"name": "AI Suite", "category": "Product", "unit_price": 5000.0},
                {"name": "Consulting", "category": "Service", "unit_price": 1000.0},
            ],
        )
        repo.replace_export_history(
            biz,
            [{"destination_country": "UK", "product_category": "Software"}],
        )
        db.commit()

        fresh_biz = repo.get_by_owner(user.id)
        assert fresh_biz is not None

        # 3. Analyze DNA
        dna_data = service.analyze_dna(fresh_biz)

        assert dna_data.business_stage in ["Early Stage", "Growth", "Mature", "Established"]
        assert dna_data.digital_maturity in ["Low", "Medium", "High", "Advanced"]
        assert dna_data.operational_complexity in ["Low", "Medium", "High"]
        assert dna_data.growth_potential in ["Moderate", "High", "Very High"]
        assert dna_data.market_position == "Global Exporter"
        assert dna_data.automation_level in ["Manual", "Semi-Automated", "Fully Automated"]
        assert dna_data.risk_profile in ["Low", "Moderate", "Elevated", "High"]
        assert dna_data.overall_dna == "Global Exporter"

        # 4. Compute Full Payload
        res_dict = service.compute(user.id)
        assert "dna" in res_dict
        dna_payload = res_dict["dna"]
        assert dna_payload.business_dna is not None
        assert dna_payload.business_dna.overall_dna == "Global Exporter"

        print("[PASS] BusinessDNAService unit tests passed cleanly!")

    finally:
        db.close()


def test_business_dna_api_endpoint():
    client = TestClient(app)
    ts = int(time.time())
    email = f"dna_api_{ts}@example.com"

    # Register & Login
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "DNA API User", "email": email, "password": "Password123!"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    cookies = login_res.cookies

    # Create business
    biz_payload = {
        "basic": {
            "legal_name": "API DNA Enterprise",
            "industry": "Robotics",
            "established_year": 2020,
            "employee_count": 12,
            "annual_revenue": 300000.0,
            "revenue_currency": "USD",
        }
    }
    client.post("/api/v1/business", json=biz_payload, cookies=cookies)

    # GET /api/v1/business/dna
    res = client.get("/api/v1/business/dna", cookies=cookies)
    assert res.status_code == 200, f"[FAIL] GET /api/v1/business/dna failed: {res.text}"
    body = res.json()
    assert "dna" in body
    assert "business_dna" in body["dna"]
    b_dna = body["dna"]["business_dna"]
    assert b_dna["business_stage"] is not None
    assert b_dna["digital_maturity"] is not None
    assert b_dna["operational_complexity"] is not None
    assert b_dna["growth_potential"] is not None
    assert b_dna["market_position"] is not None
    assert b_dna["automation_level"] is not None
    assert b_dna["risk_profile"] is not None
    assert b_dna["overall_dna"] is not None

    print("[PASS] GET /api/v1/business/dna API endpoint test passed cleanly!")


if __name__ == "__main__":
    test_business_dna_service_unit()
    test_business_dna_api_endpoint()
