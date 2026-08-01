"""Integration tests for Aggregated Intelligence Endpoint (Sprint 11.6)."""

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
from app.repositories.business_repository import BusinessRepository
from app.services.intelligence_aggregate_service import IntelligenceAggregateService
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_intelligence_aggregate_service():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"intelagg_{ts}@example.com",
            password_hash="hash",
            full_name="Intelligence Aggregate User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        service = IntelligenceAggregateService(repo)

        repo.create(
            owner_id=user.id,
            legal_name="Unified Intelligence Systems",
            industry="Software & AI",
            established_year=2018,
            employee_count=22,
            annual_revenue=600000.0,
            revenue_currency="USD",
            country="US",
            state_region="California",
            city="San Francisco",
        )
        db.commit()

        payload = service.get_full_intelligence(user.id)
        assert payload.dna is not None
        assert payload.swot is not None
        assert payload.readiness is not None
        assert payload.benchmark is not None
        assert payload.opportunities is not None

        print("[PASS] IntelligenceAggregateService integration test passed cleanly!")

    finally:
        db.close()


def test_get_business_intelligence_api():
    client = TestClient(app)
    ts = int(time.time())
    email = f"intel_api_{ts}@example.com"

    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Intel API User", "email": email, "password": "Password123!"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    cookies = login_res.cookies

    client.post(
        "/api/v1/business",
        json={
            "basic": {
                "legal_name": "Apex Intelligence Enterprise",
                "industry": "Information Technology",
                "established_year": 2017,
                "employee_count": 45,
                "annual_revenue": 1200000.0,
                "revenue_currency": "USD",
            }
        },
        cookies=cookies,
    )

    res = client.get("/api/v1/business/intelligence", cookies=cookies)
    assert res.status_code == 200, f"[FAIL] GET /api/v1/business/intelligence failed: {res.text}"
    body = res.json()

    assert "generated_at" in body
    assert "overall" in body
    assert "analyzers" in body
    assert "dna" in body and body["dna"] is not None
    assert "swot" in body and body["swot"] is not None
    assert "readiness" in body and body["readiness"] is not None
    assert "benchmark" in body and body["benchmark"] is not None
    assert "opportunities" in body and body["opportunities"] is not None

    print("[PASS] GET /api/v1/business/intelligence API endpoint integration test passed cleanly!")


if __name__ == "__main__":
    test_intelligence_aggregate_service()
    test_get_business_intelligence_api()
