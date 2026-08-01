"""Unit & Integration tests for Industry Benchmark Engine (Sprint 11.5)."""

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
from app.services.benchmark_service import BenchmarkService
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_benchmark_service_unit():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"benchuser_{ts}@example.com",
            password_hash="hash",
            full_name="Benchmark Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        service = BenchmarkService(repo)

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
            legal_name="Benchmark IT Solutions",
            industry="Information Technology",
            established_year=2014,
            employee_count=30,
            annual_revenue=900000.0,
            revenue_currency="USD",
            country="US",
            state_region="California",
            city="San Jose",
        )
        repo.replace_certifications(
            biz,
            [
                {"name": "ISO 27001", "issuer": "BSI", "year_obtained": 2021},
                {"name": "ISO 9001", "issuer": "TUV", "year_obtained": 2020},
            ],
        )
        db.commit()

        fresh_biz = repo.get_by_owner(user.id)
        assert fresh_biz is not None

        # 3. Analyze Benchmark
        report = service.compute_benchmark(fresh_biz)

        assert report.industry == "Information Technology"
        assert 0 <= report.overall_benchmark_score <= 100
        assert report.benchmark_grade in ["A", "B", "C", "D", "F"]
        assert len(report.metrics) == 5

        m_names = [m.metric_name for m in report.metrics]
        assert "Digital Adoption Index" in m_names
        assert "Workforce Scale" in m_names
        assert "Annual Revenue Scale" in m_names
        assert "Certifications Count" in m_names
        assert "Business Readiness Index" in m_names

        # 4. Compute full envelope
        response = service.compute(user.id)
        assert response.report is not None
        assert response.report.overall_benchmark_score > 0

        print("[PASS] BenchmarkService unit tests passed cleanly!")

    finally:
        db.close()


def test_benchmark_api_endpoint():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    r_unauth = client.get("/api/v1/business/benchmark")
    assert r_unauth.status_code == 401, f"[FAIL] Expected 401, got {r_unauth.status_code}"

    # 2. Register user without business -> 404
    email_empty = f"bench_empty_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Empty User", "email": email_empty, "password": "Password123!"},
    )
    login_empty = client.post(
        "/api/v1/auth/login",
        json={"email": email_empty, "password": "Password123!"},
    )
    r_404 = client.get("/api/v1/business/benchmark", cookies=login_empty.cookies)
    assert r_404.status_code == 404, f"[FAIL] Expected 404, got {r_404.status_code}"

    # 3. Register user with business -> 200 OK
    email_biz = f"bench_biz_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Benchmark Biz User", "email": email_biz, "password": "Password123!"},
    )
    login_biz = client.post(
        "/api/v1/auth/login",
        json={"email": email_biz, "password": "Password123!"},
    )
    cookies = login_biz.cookies

    biz_payload = {
        "basic": {
            "legal_name": "Apex Benchmark Systems",
            "industry": "Software & AI",
            "established_year": 2018,
            "employee_count": 20,
            "annual_revenue": 650000.0,
            "revenue_currency": "USD",
        }
    }
    client.post("/api/v1/business", json=biz_payload, cookies=cookies)

    # GET /api/v1/business/benchmark
    res = client.get("/api/v1/business/benchmark", cookies=cookies)
    assert res.status_code == 200, f"[FAIL] GET /api/v1/business/benchmark failed: {res.text}"
    body = res.json()

    assert "generated_at" in body
    assert "report" in body
    report = body["report"]
    assert "industry" in report
    assert "overall_benchmark_score" in report
    assert "benchmark_grade" in report
    assert "metrics" in report and len(report["metrics"]) == 5

    first_metric = report["metrics"][0]
    assert "metric_name" in first_metric
    assert "user_score" in first_metric
    assert "industry_average" in first_metric
    assert "difference" in first_metric
    assert "percentile" in first_metric
    assert "status" in first_metric

    print("[PASS] GET /api/v1/business/benchmark API endpoint test passed cleanly!")


if __name__ == "__main__":
    test_benchmark_service_unit()
    test_benchmark_api_endpoint()
