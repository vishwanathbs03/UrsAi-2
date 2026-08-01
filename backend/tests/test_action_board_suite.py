"""Test suite for Action Board backend CRUD operations."""

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


def test_action_board_crud():
    client = TestClient(app)
    ts = int(time.time())
    email = f"ab_crud_{ts}@example.com"

    # Register & Login
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Action Board User", "email": email, "password": "Password123!"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    cookies = login.cookies

    # 1. GET initial empty/default board -> 200
    res = client.get("/api/v1/action-board", cookies=cookies)
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert data["summary"]["total_tasks"] == 0

    # 2. CREATE task -> 201
    create_res = client.post(
        "/api/v1/action-board",
        json={
            "title": "Setup Accounting Software",
            "description": "Integrate QuickBooks for automated expense tracking",
            "category": "To Do",
            "priority": "High",
            "due_date": "2026-08-15",
        },
        cookies=cookies,
    )
    assert create_res.status_code == 201
    item = create_res.json()
    item_id = item["id"]
    assert item["title"] == "Setup Accounting Software"

    # 3. UPDATE task -> 200
    update_res = client.patch(
        f"/api/v1/action-board/{item_id}",
        json={"category": "Completed", "is_completed": True},
        cookies=cookies,
    )
    assert update_res.status_code == 200
    updated_item = update_res.json()
    assert updated_item["is_completed"] is True
    assert updated_item["category"] == "Completed"

    # 4. GET board -> summary updated
    get_res = client.get("/api/v1/action-board", cookies=cookies)
    assert get_res.status_code == 200
    summary = get_res.json()["summary"]
    assert summary["total_tasks"] == 1
    assert summary["completed_tasks"] == 1
    assert summary["progress_pct"] == 100

    # 5. DELETE task -> 204
    del_res = client.delete(f"/api/v1/action-board/{item_id}", cookies=cookies)
    assert del_res.status_code == 204

    print("[PASS] Action Board CRUD test suite passed cleanly!")


if __name__ == "__main__":
    test_action_board_crud()
