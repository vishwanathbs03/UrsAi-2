# -*- coding: utf-8 -*-
"""
UrsBiz E2E Verification Script - Complete First-Time User Journey
Tests all 18 steps end-to-end using the correct API schema.
"""
import json
import time
import urllib.request
import urllib.error

BASE = "http://localhost:8001"
EMAIL = f"e2etest_{int(time.time())}@gmail.com"
PASSWORD = "SecurePass123!"
FULL_NAME = "E2E Test User"

results = []
cookie_jar = {}


def req(method, path, body=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json", "Accept": "*/*"}
    if cookie_jar:
        headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookie_jar.items())
    data = json.dumps(body).encode() if body else None
    req_obj = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req_obj, timeout=20) as r:
            for hdr in r.getheaders():
                if hdr[0].lower() == "set-cookie":
                    parts = hdr[1].split(";")
                    kv = parts[0].strip().split("=", 1)
                    if len(kv) == 2:
                        cookie_jar[kv[0].strip()] = kv[1].strip()
            raw = r.read()
            ct = dict(r.getheaders()).get("Content-Type", "")
            # Return raw bytes for binary responses (PDF, CSV, etc.)
            if "json" in ct or (raw and raw[:1] in (b'{', b'[')):
                try:
                    return r.status, json.loads(raw)
                except Exception:
                    pass
            return r.status, {"_raw": True, "size": len(raw)}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw.decode(errors="replace")[:300]}
    except Exception as ex:
        return 0, {"error": str(ex)}


def check(label, ok, detail=""):
    icon = "[PASS]" if ok else "[FAIL]"
    msg = f"{icon} {label}"
    if detail:
        msg += f"\n       >> {detail}"
    print(msg, flush=True)
    results.append({"label": label, "ok": ok, "detail": detail})
    return ok


print("\n" + "=" * 60)
print(" UrsBiz - Complete E2E First-Time User Journey")
print("=" * 60 + "\n")

# ----------------------------------------------------------------
# Step 6: Backend Health
# ----------------------------------------------------------------
status, body = req("GET", "/health")
db_ok = body.get("database", {}).get("ok", False)
check("Step 6 -- Backend Running", status == 200 and db_ok,
      f"status={status} db={db_ok} version={body.get('version','?')}")

# ----------------------------------------------------------------
# Step 7: Frontend Reachability
# ----------------------------------------------------------------
try:
    fe = urllib.request.urlopen("http://localhost:3000", timeout=15)
    check("Step 7 -- Frontend Running", fe.status == 200, f"status={fe.status}")
except Exception as ex:
    check("Step 7 -- Frontend Running", False, str(ex)[:100])

# ----------------------------------------------------------------
# Step 8: Register new account
# ----------------------------------------------------------------
status, body = req("POST", "/api/v1/auth/register", {
    "email": EMAIL, "full_name": FULL_NAME, "password": PASSWORD
})
reg_ok = status in (200, 201)
check("Step 8 -- Register New Account", reg_ok,
      f"status={status} email={EMAIL} err={body.get('detail','') if not reg_ok else 'OK'}")

# ----------------------------------------------------------------
# Step 9: Login
# ----------------------------------------------------------------
status, body = req("POST", "/api/v1/auth/login", {"email": EMAIL, "password": PASSWORD})
login_ok = status == 200
user_id = body.get("id")
check("Step 9a -- Login", login_ok,
      f"status={status} user_id={user_id} err={body.get('detail','') if not login_ok else 'OK'}")

# Verify session cookie
status2, me = req("GET", "/api/v1/auth/me")
check("Step 9b -- Session Cookie (/me)", status2 == 200,
      f"status={status2} email={me.get('email','?')}")

# ----------------------------------------------------------------
# Step 10: Business Profile Wizard (correct nested schema)
# ----------------------------------------------------------------
biz_payload = {
    "basic": {
        "legal_name": "E2E Textile Exports Ltd",
        "industry": "Manufacturing",
        "business_type": "private_limited",
        "established_year": 2018,
        "employee_count": 45,
        "annual_revenue": 2500000.0,
        "revenue_currency": "INR",
        "description": "Textile export company for E2E testing",
        "country": "India",
        "state_region": "Maharashtra",
        "city": "Mumbai",
    },
    "capacity": {
        "production_capacity": "5000 units/month",
        "capacity_utilization_pct": 75,
    },
    "digital_presence": {
        "website_url": "https://e2e-textile.example.com",
        "has_ecommerce": True,
        "uses_digital_marketing": True,
        "uses_cloud_systems": True,
    },
    "certifications": [
        {"name": "ISO 9001", "issuing_body": "Bureau Veritas"},
        {"name": "ZED Certification", "issuing_body": "Ministry of MSME"},
    ],
    "products": [
        {"name": "Cotton Fabric Roll", "category": "Textiles", "description": "Premium cotton"},
        {"name": "Denim Cloth", "category": "Textiles", "description": "Heavy denim fabric"},
    ],
}
status, body = req("POST", "/api/v1/business", biz_payload)
biz_ok = status in (200, 201)
biz_id = body.get("id") or (body.get("business") or {}).get("id")
check("Step 10 -- Create Business Profile (Wizard)", biz_ok,
      f"status={status} id={biz_id} err={str(body.get('detail',''))[:200] if not biz_ok else 'OK'}")

# Fetch business
status2, biz = req("GET", "/api/v1/business")
check("Step 10b -- Fetch Business Profile", status2 == 200,
      f"status={status2} name={biz.get('basic',{}).get('legal_name','?') if isinstance(biz,dict) else '?'}")

# ----------------------------------------------------------------
# Step 11: Dashboard
# ----------------------------------------------------------------
status, body = req("GET", "/api/v1/dashboard")
check("Step 11 -- Dashboard API", status == 200,
      f"status={status} keys={list(body.keys())[:6] if isinstance(body,dict) else '?'}")

# ----------------------------------------------------------------
# Step 12: Analytics (twin + recommendations)
# ----------------------------------------------------------------
status, body = req("GET", "/api/v1/business/twin")
health = body.get("health_summary", {}).get("overall_health", "?") if isinstance(body, dict) else "?"
check("Step 12a -- Analytics Digital Twin", status == 200,
      f"status={status} health={health}")

status2, recs = req("GET", "/api/v1/business/recommendations")
count = len(recs.get("recommendations", [])) if isinstance(recs, dict) else "?"
check("Step 12b -- Analytics Recommendations", status2 == 200,
      f"status={status2} count={count}")

# ----------------------------------------------------------------
# Step 13: Predictive Analysis (Roadmap)
# ----------------------------------------------------------------
status, body = req("GET", "/api/v1/business/roadmap")
check("Step 13 -- Predictive Analysis (Roadmap)", status == 200,
      f"status={status} keys={list(body.keys())[:5] if isinstance(body,dict) else '?'}")

# ----------------------------------------------------------------
# Step 14: AI Advisor
# ----------------------------------------------------------------
status, body = req("GET", "/api/v1/advisor")
check("Step 14 -- AI Advisor", status == 200,
      f"status={status} keys={list(body.keys())[:5] if isinstance(body,dict) else '?'}")

# ----------------------------------------------------------------
# Step 15: AI Assistant (chat session)
# ----------------------------------------------------------------
# Create session
status, sess_body = req("POST", "/api/v1/chat", {"title": "E2E Test Session"})
sess_ok = status in (200, 201)
sess_id = sess_body.get("id") or sess_body.get("session_id")
check("Step 15a -- AI Assistant Create Session", sess_ok,
      f"status={status} session_id={sess_id}")

if sess_id:
    # Send message
    status2, chat_body = req("POST", f"/api/v1/chat/{sess_id}/message",
                              {"content": "What is my business health score?"})
    reply = chat_body.get("content") or chat_body.get("response") or chat_body.get("message") or ""
    check("Step 15b -- AI Assistant Chat Message", status2 == 200,
          f"status={status2} reply_len={len(str(reply))}")
else:
    check("Step 15b -- AI Assistant Chat Message", False, "no session_id from step 15a")

# ----------------------------------------------------------------
# Step 16: Government Schemes
# ----------------------------------------------------------------
status, body = req("GET", "/api/v1/schemes")
count = len(body) if isinstance(body, list) else len(body.get("schemes", body.get("results", [])))
check("Step 16 -- Government Schemes", status == 200,
      f"status={status} count={count}")

# ----------------------------------------------------------------
# Step 17: Reports (binary responses ΓÇö check status only)
# ----------------------------------------------------------------
status_pdf, pdf_body = req("GET", "/api/v1/reports/pdf")
pdf_ok = status_pdf in (200, 201)
check("Step 17a -- PDF Report", pdf_ok,
      f"status={status_pdf} size={pdf_body.get('size','?')}bytes" if pdf_ok else
      f"status={status_pdf} err={str(pdf_body.get('detail',''))[:100]}")

status_csv, csv_body = req("GET", "/api/v1/reports/csv")
csv_ok = status_csv in (200, 201)
check("Step 17b -- CSV Report", csv_ok,
      f"status={status_csv} size={csv_body.get('size','?')}bytes" if csv_ok else
      f"status={status_csv} err={str(csv_body.get('detail',''))[:100]}")

# ----------------------------------------------------------------
# Step 18: Notifications
# ----------------------------------------------------------------
status, body = req("GET", "/api/v1/notifications")
notifs = body if isinstance(body, list) else body.get("notifications", body.get("items", []))
check("Step 18 -- Notifications", status == 200,
      f"status={status} count={len(notifs) if isinstance(notifs, list) else '?'}")

# ----------------------------------------------------------------
# Logout
# ----------------------------------------------------------------
status, _ = req("POST", "/api/v1/auth/logout")
check("Cleanup -- Logout", status in (200, 204), f"status={status}")

# ----------------------------------------------------------------
# Final Summary
# ----------------------------------------------------------------
passed = sum(1 for r in results if r["ok"])
failed = sum(1 for r in results if not r["ok"])
total = len(results)

print(f"\n{'=' * 60}")
print(f" RESULT: {passed} PASSED | {failed} FAILED | {total} TOTAL")
print(f"{'=' * 60}\n")

if failed:
    print("FAILED CHECKS:")
    for r in results:
        if not r["ok"]:
            print(f"  [FAIL] {r['label']}")
            if r["detail"]:
                print(f"         >> {r['detail']}")
    print()

if failed == 0:
    print("[PASS] All checks passed. UrsBiz is fully clone-ready.")
else:
    print(f"[WARN] {failed} check(s) need attention.")
