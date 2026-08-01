"""Test suite for Notifications API — Sprint 16."""

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
from app.utils.database import Base, engine

Base.metadata.create_all(bind=engine)


def test_notifications_crud():
    client = TestClient(app)
    ts = int(time.time())
    email = f"notif_test_{ts}@example.com"

    # Register & Login
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Notif User", "email": email, "password": "Password123!"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    cookies = login.cookies

    # 1. GET initial notifications -> seed items created automatically
    res = client.get("/api/v1/notifications", cookies=cookies)
    assert res.status_code == 200
    data = res.json()
    assert data["total_count"] >= 3
    assert data["unread_count"] >= 3

    # 2. CREATE custom notification -> 201
    create_res = client.post(
        "/api/v1/notifications",
        json={
            "title": "Quarterly Tax Return Reminder",
            "message": "Filing deadline for Q3 GST/Tax return is approaching in 7 days.",
            "category": "reminder",
        },
        cookies=cookies,
    )
    assert create_res.status_code == 201
    item = create_res.json()
    item_id = item["id"]
    assert item["is_read"] is False

    # 3. MARK single read -> 200
    read_res = client.patch(f"/api/v1/notifications/{item_id}/read", cookies=cookies)
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # 4. MARK ALL read -> 200
    all_read_res = client.post("/api/v1/notifications/mark-all-read", cookies=cookies)
    assert all_read_res.status_code == 200

    # 5. GET notifications -> unread_count is 0
    get_res = client.get("/api/v1/notifications", cookies=cookies)
    assert get_res.status_code == 200
    assert get_res.json()["unread_count"] == 0

    # 6. DELETE notification -> 204
    del_res = client.delete(f"/api/v1/notifications/{item_id}", cookies=cookies)
    assert del_res.status_code == 204

    print("[PASS] Notifications CRUD test suite passed cleanly!")


if __name__ == "__main__":
    test_notifications_crud()
