"""Master Test Suite for Sprint 12 — Business Advisor Engines.

Verifies end-to-end functionality for:
  * Sprint 12.1 & 12.2: Recommendations & Priority Engine
  * Sprint 12.3: Risk Detection Engine
  * Sprint 12.4: Growth Advisor Engine
  * Sprint 12.5: Funding Advisor Engine
  * Sprint 12.6: Compliance Advisor Engine
  * Sprint 12.7: Aggregated Advisor Engine (GET /api/v1/business/advisor)
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
from app.services.advisor_aggregate_service import AdvisorAggregateService
from app.services.compliance_service import ComplianceService
from app.services.funding_service import FundingService
from app.services.growth_service import GrowthService
from app.services.recommendation_service import RecommendationService
from app.services.risk_service import RiskService
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_sprint12_services_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"sprint12_user_{ts}@example.com",
            password_hash="hash",
            full_name="Sprint 12 Master User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        biz = repo.create(
            owner_id=user.id,
            legal_name="Apex Sprint 12 Enterprise",
            industry="Healthcare Technology",
            established_year=2020,
            employee_count=14,
            annual_revenue=420000.0,
            revenue_currency="USD",
            country="US",
            state_region="Massachusetts",
            city="Boston",
        )
        db.commit()

        fresh = repo.get_by_owner(user.id)
        assert fresh is not None

        # 1. Recommendation & Priority Engine
        recs_rep = RecommendationService(repo).generate_recommendations(fresh)
        assert recs_rep.total_count > 0
        scores = [r.priority_score for r in recs_rep.recommendations]
        assert scores == sorted(scores, reverse=True), "[FAIL] Recommendations not sorted by priority_score"

        # 2. Risk Detection Engine
        risk_rep = RiskService(repo).detect_risks(fresh)
        assert risk_rep.total_risks_detected > 0
        assert risk_rep.overall_risk_level in ["High", "Medium", "Low"]

        # 3. Growth Advisor Engine
        growth_rep = GrowthService(repo).generate_growth_advice(fresh)
        assert growth_rep.total_advice_count >= 6
        cats = {g.category for g in growth_rep.recommendations}
        assert {"sales", "marketing", "operations", "digital", "hiring", "products"}.issubset(cats)

        # 4. Funding Advisor Engine
        funding_rep = FundingService(repo).analyze_funding(fresh)
        assert 0 <= funding_rep.loan_readiness_score <= 100
        assert 0 <= funding_rep.investor_readiness_score <= 100
        assert 0 <= funding_rep.grant_eligibility_score <= 100
        assert len(funding_rep.msme_schemes) > 0
        assert len(funding_rep.funding_checklist) > 0

        # 5. Compliance Advisor Engine
        compliance_rep = ComplianceService(repo).analyze_compliance(fresh)
        assert 0 <= compliance_rep.compliance_score <= 100
        assert len(compliance_rep.items) > 0

        # 6. Aggregate Advisor Service
        agg_res = AdvisorAggregateService(repo).compute(user.id)
        assert agg_res.report.recommendations.total_count > 0
        assert agg_res.report.risks.total_risks_detected > 0
        assert agg_res.report.growth.total_advice_count >= 6
        assert agg_res.report.funding.loan_readiness_score >= 0
        assert agg_res.report.compliance.compliance_score >= 0

        print("[PASS] Sprint 12 Unit Services master suite passed cleanly!")

    finally:
        db.close()


def test_sprint12_api_integration():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    r_unauth = client.get("/api/v1/business/advisor")
    assert r_unauth.status_code == 401, f"[FAIL] Expected 401, got {r_unauth.status_code}"

    # 2. Register user without business -> 404
    email_empty = f"sp12_empty_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Empty User", "email": email_empty, "password": "Password123!"},
    )
    login_empty = client.post(
        "/api/v1/auth/login",
        json={"email": email_empty, "password": "Password123!"},
    )
    r_404 = client.get("/api/v1/business/advisor", cookies=login_empty.cookies)
    assert r_404.status_code == 404, f"[FAIL] Expected 404, got {r_404.status_code}"

    # 3. Register user with business -> 200 OK
    email_biz = f"sp12_biz_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Sprint 12 User", "email": email_biz, "password": "Password123!"},
    )
    login_biz = client.post(
        "/api/v1/auth/login",
        json={"email": email_biz, "password": "Password123!"},
    )
    cookies = login_biz.cookies

    biz_payload = {
        "basic": {
            "legal_name": "Apex Sprint 12 Corp",
            "industry": "Robotics",
            "established_year": 2019,
            "employee_count": 22,
            "annual_revenue": 650000.0,
            "revenue_currency": "USD",
        }
    }
    client.post("/api/v1/business", json=biz_payload, cookies=cookies)

    # Test all Sprint 12 Endpoints
    endpoints = [
        "/api/v1/business/recommendations",
        "/api/v1/business/risks",
        "/api/v1/business/growth",
        "/api/v1/business/funding",
        "/api/v1/business/compliance",
        "/api/v1/business/advisor",
    ]

    for ep in endpoints:
        res = client.get(ep, cookies=cookies)
        assert res.status_code == 200, f"[FAIL] {ep} returned status {res.status_code}: {res.text}"

    print("[PASS] Sprint 12 Integration API test suite passed cleanly!")


if __name__ == "__main__":
    test_sprint12_services_unit()
    test_sprint12_api_integration()
