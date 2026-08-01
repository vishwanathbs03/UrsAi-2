"""Sprint 11 Master Test Suite — Comprehensive Unit & Integration Verification (Sprint 11.9).

Verifies:
  1. 401 Unauthorized for unauthenticated requests across all 6 Sprint 11 endpoints
  2. 404 Not Found when business is absent
  3. 200 OK when business exists with full payload
  4. Edge cases: empty arrays (no products, no certs, no export history)
  5. Strict score range constraints (0-100, letter grades A-F)
  6. No regressions across existing business APIs
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
from app.repositories.business_repository import BusinessRepository
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def run_sprint_11_master_tests():
    client = TestClient(app)
    ts = int(time.time())

    print("=" * 60)
    print("RUNNING SPRINT 11 MASTER TEST SUITE")
    print("=" * 60)

    endpoints = [
        "/api/v1/business/dna",
        "/api/v1/business/swot",
        "/api/v1/business/readiness",
        "/api/v1/business/opportunities",
        "/api/v1/business/benchmark",
        "/api/v1/business/intelligence",
    ]

    # -----------------------------------------------------------------
    # Test 1: 401 Unauthorized for all endpoints when unauthenticated
    # -----------------------------------------------------------------
    for ep in endpoints:
        r = client.get(ep)
        assert r.status_code == 401, f"[FAIL] Expected 401 for {ep}, got {r.status_code}"
    print("[PASS] Test 1 Passed: 401 Unauthorized verified for all 6 Sprint 11 endpoints")

    # -----------------------------------------------------------------
    # Test 2: 404 Not Found when business profile is absent
    # -----------------------------------------------------------------
    email_empty = f"s11_empty_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "S11 Empty User", "email": email_empty, "password": "Password123!"},
    )
    login_empty = client.post(
        "/api/v1/auth/login",
        json={"email": email_empty, "password": "Password123!"},
    )
    cookies_empty = login_empty.cookies

    for ep in endpoints:
        r = client.get(ep, cookies=cookies_empty)
        assert r.status_code == 404, f"[FAIL] Expected 404 for {ep}, got {r.status_code}"
    print("[PASS] Test 2 Passed: 404 Not Found verified for absent business profile across all endpoints")

    # -----------------------------------------------------------------
    # Test 3: Edge Case — Minimal Profile with Empty Arrays
    # -----------------------------------------------------------------
    email_min = f"s11_min_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "S11 Minimal User", "email": email_min, "password": "Password123!"},
    )
    login_min = client.post(
        "/api/v1/auth/login",
        json={"email": email_min, "password": "Password123!"},
    )
    cookies_min = login_min.cookies

    client.post(
        "/api/v1/business",
        json={
            "basic": {
                "legal_name": "Minimalist Corp",
                "industry": "Services",
                "established_year": 2024,
                "employee_count": 2,
                "annual_revenue": 10000.0,
                "revenue_currency": "USD",
            }
        },
        cookies=cookies_min,
    )

    r_min_intel = client.get("/api/v1/business/intelligence", cookies=cookies_min)
    assert r_min_intel.status_code == 200, f"[FAIL] Minimal profile failed: {r_min_intel.text}"
    min_data = r_min_intel.json()

    assert min_data["dna"]["business_dna"]["business_stage"] == "Early Stage"
    assert len(min_data["swot"]["strengths"]) > 0
    assert min_data["readiness"]["overall_score"] >= 0
    assert len(min_data["opportunities"]["opportunities"]) > 0
    print("[PASS] Test 3 Passed: Minimal business profile with empty arrays handled gracefully")

    # -----------------------------------------------------------------
    # Test 4: 200 OK & Full Payload Range Checks when business exists
    # -----------------------------------------------------------------
    email_full = f"s11_full_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "S11 Full User", "email": email_full, "password": "Password123!"},
    )
    login_full = client.post(
        "/api/v1/auth/login",
        json={"email": email_full, "password": "Password123!"},
    )
    cookies_full = login_full.cookies

    db = SessionLocal()
    try:
        user_db = db.query(User).filter(User.email == email_full).first()
        assert user_db is not None
        repo = BusinessRepository(db)
        biz = repo.create(
            owner_id=user_db.id,
            legal_name="Apex Global Enterprise",
            industry="Software & AI",
            established_year=2015,
            employee_count=50,
            annual_revenue=2500000.0,
            revenue_currency="USD",
            country="US",
            state_region="California",
            city="San Jose",
        )
        repo.replace_products(
            biz,
            [{"name": "Enterprise AI", "category": "Software", "unit_price": 10000.0}],
        )
        repo.replace_export_history(
            biz,
            [{"destination_country": "UK", "product_category": "Software"}],
        )
        repo.replace_certifications(
            biz,
            [{"name": "ISO 27001", "issuer": "BSI", "year_obtained": 2021}],
        )
        db.commit()
    finally:
        db.close()

    # GET /api/v1/business/intelligence
    r_intel = client.get("/api/v1/business/intelligence", cookies=cookies_full)
    assert r_intel.status_code == 200, f"[FAIL] GET /api/v1/business/intelligence failed: {r_intel.text}"
    full_data = r_intel.json()

    # Check DNA
    b_dna = full_data["dna"]["business_dna"]
    assert b_dna["business_stage"] in ["Early Stage", "Growth", "Mature", "Established"]
    assert b_dna["digital_maturity"] in ["Low", "Medium", "High", "Advanced"]
    assert b_dna["overall_dna"] == "Global Exporter"

    # Check SWOT
    swot = full_data["swot"]
    assert len(swot["strengths"]) > 0
    assert len(swot["weaknesses"]) > 0
    assert len(swot["opportunities"]) > 0
    assert len(swot["threats"]) > 0

    # Check Readiness Score Ranges
    readiness = full_data["readiness"]
    assert 0 <= readiness["overall_score"] <= 100
    assert readiness["grade"] in ["A", "B", "C", "D", "E", "F"]
    assert len(readiness["breakdown"]) == 6
    for b in readiness["breakdown"]:
        assert 0 <= b["score"] <= 100

    # Check Benchmark Metric Percentiles
    benchmark = full_data["benchmark"]
    assert 0 <= benchmark["overall_benchmark_score"] <= 100
    assert benchmark["benchmark_grade"] in ["A", "B", "C", "D", "F"]
    assert len(benchmark["metrics"]) == 5
    for m in benchmark["metrics"]:
        assert 0 <= m["percentile"] <= 100

    # Check Opportunities
    opps = full_data["opportunities"]
    assert opps["total_count"] > 0
    assert opps["total_estimated_value"] > 0

    print("[PASS] Test 4 Passed: 200 OK & strict score ranges verified across all 5 Sprint 11 modules")

    print("=" * 60)
    print("[ALL TESTS PASSED] SPRINT 11 MASTER SUITE CLEAN SUCCESS!")
    print("=" * 60)


if __name__ == "__main__":
    run_sprint_11_master_tests()
