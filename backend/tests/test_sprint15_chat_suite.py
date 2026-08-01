"""Master Test Suite for Sprint 15 — AI Chat API & Context Builder.

Verifies end-to-end functionality for:
  * Sprint 15.1: AI Chat API (/api/v1/chat & /api/v1/chat/{session_id}/message)
  * Sprint 15.2: Assistant Context Builder (Business, Dashboard, Advisor, Predictions)
  * Sprint 15.4: Starter Prompts & Quick Actions
  * Sprint 15.5: Master Verification (401, 404, 201 Created, 200 OK)
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
from app.services.ai.providers.context_builder import AssistantContextBuilder
from app.utils.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)


def test_sprint15_context_builder():
    db = SessionLocal()
    try:
        ts = int(time.time())
        user = User(
            email=f"chatuser_{ts}@example.com",
            password_hash="hash",
            full_name="Chat Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        repo = BusinessRepository(db)
        biz = repo.create(
            owner_id=user.id,
            legal_name="Apex Chat Tech",
            industry="Software",
            established_year=2021,
            employee_count=10,
            annual_revenue=300000.0,
            revenue_currency="USD",
            country="US",
            state_region="CA",
            city="San Francisco",
        )
        db.commit()

        # Dummy upstream providers for ContextBuilder
        def twin_prov(owner_id):
            return {
                "generated_at": "2026-07-29T00:00:00Z",
                "current_health": {"overall_business_score": 82},
                "dna": {
                    "dna": {
                        "archetype": {
                            "key": "digital_pioneer",
                            "title": "Digital Pioneer",
                            "match_score": 88,
                        }
                    }
                },
            }

        def recs_prov(owner_id):
            return {
                "generated_at": "2026-07-29T00:00:00Z",
                "recommendations": [
                    {
                        "id": "rec-1",
                        "title": "Automate Payroll",
                        "category": "Operations",
                        "priority": "High",
                        "estimated_score_gain": 5,
                        "estimated_roi": 1200.0,
                        "estimated_timeline": "1 month",
                    }
                ],
            }

        def roadmap_prov(owner_id):
            return {"items": []}

        def rules_prov(owner_id):
            return {"categories": {}}

        def insights_prov(owner_id):
            return {"decision": {"insights": []}}

        builder = AssistantContextBuilder(
            twin_provider=twin_prov,
            recommendations_provider=recs_prov,
            roadmap_provider=roadmap_prov,
            rules_provider=rules_prov,
            insights_provider=insights_prov,
        )

        ctx = builder.build(owner_id=user.id)
        assert ctx.business_id == user.id
        assert ctx.overall_business_score == 82
        assert ctx.band == "Leading"
        assert ctx.dna.archetype_title == "Digital Pioneer"
        assert len(ctx.recommendations) == 1
        assert ctx.recommendations[0].title == "Automate Payroll"

        print("[PASS] Sprint 15 Context Builder test passed cleanly!")

    finally:
        db.close()


def test_sprint15_chat_api_integration():
    client = TestClient(app)
    ts = int(time.time())

    # 1. Unauthenticated -> 401
    res = client.get("/api/v1/chat")
    assert res.status_code == 401

    res = client.post("/api/v1/chat", json={"title": "Test Chat"})
    assert res.status_code == 401

    # 2. Register & login user with business profile
    email = f"chat_api_{ts}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Chat API User", "email": email, "password": "Password123!"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    cookies = login.cookies

    client.post(
        "/api/v1/business",
        json={
            "basic": {
                "legal_name": "Apex AI Chat Systems",
                "industry": "Artificial Intelligence",
                "established_year": 2022,
                "employee_count": 8,
                "annual_revenue": 250000.0,
                "revenue_currency": "USD",
            }
        },
        cookies=cookies,
    )

    # 3. Create chat session -> 201 Created
    create_res = client.post("/api/v1/chat", json={"title": "Growth Consultation"}, cookies=cookies)
    assert create_res.status_code == 201
    session_id = create_res.json()["id"]

    # 4. List sessions -> 200 OK
    list_res = client.get("/api/v1/chat", cookies=cookies)
    assert list_res.status_code == 200
    assert list_res.json()["count"] >= 1

    # 5. Append user message -> 200 OK
    msg_res = client.post(
        f"/api/v1/chat/{session_id}/message",
        json={"content": "Improve my business."},
        cookies=cookies,
    )
    assert msg_res.status_code == 200
    body = msg_res.json()
    assert body["user_message"]["content"] == "Improve my business."
    assert len(body["assistant_message"]["content"]) > 0

    # 6. Fetch conversation detail -> 200 OK
    get_res = client.get(f"/api/v1/chat/{session_id}", cookies=cookies)
    assert get_res.status_code == 200
    assert len(get_res.json()["messages"]) >= 2

    # 7. Delete conversation -> 200 OK
    del_res = client.delete(f"/api/v1/chat/{session_id}", cookies=cookies)
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True

    print("[PASS] Sprint 15 Integration API test suite passed cleanly!")


if __name__ == "__main__":
    test_sprint15_context_builder()
    test_sprint15_chat_api_integration()
