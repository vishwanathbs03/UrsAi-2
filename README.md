# UrsBiz — Deterministic Business Intelligence for Indian MSMEs

**One-sentence value proposition:** UrsBiz gives a micro- or small-business owner a stored business profile, a deterministic 0–100 Profile Readiness Score, profile-matched government schemes with cited sources, and bank-ready PDF/CSV reports — every number reproducible from the profile.

> **Live demo:** *(public URL pending deployment — see `docs/DEPLOYMENT_HACKATHON.md` and `H7_6_PUBLIC_DEPLOYMENT_REPORT.md` for the verified smoke-test path)*
> **Demo credentials (seeded workspace):** `acme.textiles@example.com` / `AcmeDemoPass1` — Acme Textiles, Tirupur (12 employees, ₹1.8 Cr annual revenue, ₹3 Cr target encoded as a `BusinessGoal` row titled "Grow annual revenue to ₹3 Cr" — there is no `Business.target_revenue` column)
> **Architecture diagram:** [`docs/architecture-hackathon.svg`](docs/architecture-hackathon.svg)

---

## Table of Contents

1. [The Real Problem](#the-real-problem)
2. [Who It's For](#who-its-for)
3. [Three Outcomes You Can Verify](#three-outcomes-you-can-verify)
4. [AI Trust Architecture](#ai-trust-architecture)
5. [Local Setup](#local-setup)
6. [Verification Commands](#verification-commands)
7. [Demo Screenshots](#demo-screenshots)
8. [Known Limitations](#known-limitations)
9. [Roadmap](#roadmap)
10. [Hackathon Work Completed](#hackathon-work-completed)

---

## The Real Problem

Indian micro & small enterprises (MSMEs) navigate **multiple government portals** (msme.gov.in, nsic.co.in, kvib.gov.in, etc.) to find applicable subsidies, **manually re-type spreadsheets** for every CA or bank-loan visit, and **rely on intuition** for the next 3–12 months of cash flow. There is no single stored business profile that a CA, banker, or scheme portal can re-use, and no auditable trail of *why* a particular scheme was suggested.

UrsBiz addresses the workflow, not the politics of approvals. We do not predict funding success and we do not call any figure a guarantee.

---

## Who It's For

- **MSME founders** who need a single, current record of their business profile and a defensible health snapshot to share with a CA or banker.
- **Chartered Accountants** servicing MSME clients who want one-click PDF/CSV reports with every figure traceable to a stored input.
- **Hackathon judges and reviewers** who want to clone, run, and reproduce every claim in this README from the public demo workspace.

---

## Three Outcomes You Can Verify

Every outcome below is reproducible from the seeded demo workspace and is asserted by the verification suite (`scripts/verification/`). Numbers, not marketing language.

| # | Outcome | How to verify |
|---|---------|---------------|
| **1** | **Deterministic 0–100 Profile Readiness Score** — measures how completely the founder has filled in their business profile across six weighted sections (profile completeness, business info, products/services, team, financial, online presence). Same inputs → same score, every run. **It is not a measure of business health or risk;** it tells you how complete the digital twin is. | `GET /api/v1/business/scores` returns the score and per-section breakdowns for the demo workspace. Source: `backend/app/services/health_score_service.py`. |
| **2** | **Profile-matched schemes** with match %, source authority, last-verified date, and disclaimer per match. Catalog has **7 curated entries** — CGTMSE, ZED, PMEGP, Export Promotion (Capital Goods), MUDRA Shishu, NSIC, Udyam — sourced from `backend/app/services/schemes_sprint16_service.py` (`SCHEMES_CATALOG`). | `GET /api/v1/business/schemes` returns the on-disk catalog matches. The catalog itself lives in `backend/app/services/schemes_sprint16_service.py`, loaded into a knowledge base at startup. |
| **3** | **3m / 6m / 12m scenario horizons** for forward-looking estimates, each with confidence and a `no guarantee` label, plus **1-click PDF + CSV reports** formatted for bank-loan applications. | `GET /api/v1/business/predictions/{growth,revenue,risk}` and `GET /api/v1/analytics` return the horizon scenarios; the Reports UI exports PDF (ReportLab) and CSV with the health snapshot, scheme matches, and scenarios. |

We use **"Profile match"**, never "You are eligible" / "Approved" / "Guaranteed" / "You will receive funding" — see [`docs/HACKATHON_VISION.md`](docs/HACKATHON_VISION.md).

---

## AI Trust Architecture

> Full diagram: [`docs/architecture-hackathon.svg`](docs/architecture-hackathon.svg)

The AI layer has two clearly separated parts. The trust boundary is a hard rule in the codebase, not just a UI label.

| Layer | What it does | Where to look |
|-------|--------------|---------------|
| **Deterministic engines** | Compute Profile Readiness Score (per-section completeness), scheme profile-match %, and scenario horizons from the stored business profile. Pure rule-driven. Same inputs always produce the same outputs. | `backend/app/services/health_score_service.py`, `backend/app/services/business_service.py`, scheme engine under `backend/app/services/`. |
| **Grounded generative synthesis** | An *optional* OpenAI-compatible LLM rephrases the deterministic evidence bundle (scores + schemes + horizon) into natural-language answers. If no API key is set, a safe placeholder provider is used. | `backend/app/services/ai/providers/` (`base.py`, `factory.py`, `openai_compatible.py`, `prompt_builder.py`, `context_builder.py`). |

What is **explicitly not** in the architecture:

- ❌ **Vector store / embeddings / Hybrid RAG.** The repo ships without a vector layer. Retrieval is from the deterministic engine outputs, not the open web.
- ❌ **AES-256 encryption at rest.** Auth uses JWT HS256 signed tokens delivered via the `atlas_access_token` HTTPOnly cookie. There is no envelope-encryption layer in this codebase.
- ❌ **Sub-50ms API latency.** No benchmark exists. Local measured latency on the smoke-test machine is recorded in [`H7_6_PUBLIC_DEPLOYMENT_REPORT.md`](H7_6_PUBLIC_DEPLOYMENT_REPORT.md) — do not treat it as a global SLO.
- ❌ **"100% test pass rate across N sprints"** as a public guarantee. The verification suite (`scripts/verification/`) executes a defined set of checks; individual verifier reports record what passed.

### Trust labels in the UI

Every value the user sees is tagged with one of:

- `rule-engine` — output of a deterministic engine, fully reproducible
- `scenario estimate` — horizon from the scenario engine, with horizon + confidence
- `retrieved` — pulled from the on-disk scheme catalog with cited source
- `generated` — natural-language text from the LLM, grounded in the evidence bundle

---

## Local Setup

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11 or 3.12 |
| Node.js | 18.x or 20.x LTS |
| Git | Any |

PostgreSQL is optional — SQLite is the zero-config dev default.

### One-time setup

```bash
git clone <your-fork-url> ursbiz
cd ursbiz

# Backend
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Frontend (new terminal)
cd ../frontend
npm install
cp .env.local.example .env.local
```

### Run the stack (native)

```bash
# Terminal 1 — backend on :8001
# (canonical dev port. Matches backend/.env.example, the
# frontend rewrite proxy fallback in frontend/next.config.mjs,
# and the production overlay.)
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 — frontend on :3000
cd frontend
npm run dev
```

Visit **http://localhost:3000**.

### Run the production-mode smoke test (seeded workspace)

```bash
# Use the prebuilt ursbiz_prod.db so you get the Acme Textiles demo
DATABASE_URL=sqlite:///./ursbiz_prod.db \
  uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Login at `/login` with the demo credentials above. Health:

```bash
curl http://localhost:8001/api/v1/health/live    # 200 always
curl http://localhost:8001/api/v1/health/ready   # 200 only if DB + knowledge + AI + migrations are green
```

See [`docs/DEPLOYMENT_HACKATHON.md`](docs/DEPLOYMENT_HACKATHON.md) for the container path (Docker Compose: nginx + backend + frontend + prometheus + grafana) and security/observability notes.

---

## Verification Commands

Run the deterministic verifiers to confirm the claims above. Every command below is run from the **repo root** unless otherwise noted.

```bash
# Backend health (live + ready)
curl http://localhost:8001/api/v1/health/live
curl http://localhost:8001/api/v1/health/ready
```

Test files use a per-process SQLite fixture (`backend/atlas_ai.db`) that is wiped on every pytest run by `tests/conftest.py`. The fixture requires `pydantic-settings` to read `backend/.env` — i.e. pytest must run **with the `backend/` directory as the CWD** so the relative `env_file=".env"` path resolves. From the repo root:

```bash
cd backend

# Auth + business persistence (H7.1)
pytest tests/test_h7_1_business_persistence.py -v

# Grounded generative AI + safe-placeholder fallback (H7.3)
pytest tests/test_h7_3_grounded_generative_ai.py -v

# Wire-payload completion (H7.8C — top-level provenance fields)
pytest tests/test_h7_8c_wire_payload_completion.py -v

# Full suite (52 test files, 232 tests)
pytest tests/ -v
```

> The tests can also be invoked from the repo root via `pytest backend/tests/...` — `pyproject.toml` sets `pythonpath = ["backend"]` for that case — but the SQLite URL still resolves to the `.env` in the *current* working directory, so running from `backend/` is the most reliable form. Do not run the test files directly with `python backend/tests/test_*.py`; `pytest` is the supported runner.

Older verifier scripts under `scripts/verification/` exercise specific H5–H6 contracts (assistant default consultant, history, brand trust, credibility, deployment) — they print PASS/FAIL per check and are safe to re-run.

### Seed / reset the demo workspace

If you don't have `backend/ursbiz_prod.db` (or want to rebuild it from scratch):

```bash
# Drop only the demo rows (safe; prompts for confirmation unless --yes)
python scripts/demo/reset_demo_business.py --yes

# (Re)seed the demo user + business. Idempotent. Use env vars to override
# the defaults (DEMO_USER_EMAIL, DEMO_USER_PASSWORD, DEMO_USER_FULL_NAME,
# DEMO_BUSINESS_NAME, DEMO_TARGET_REVENUE, DEMO_CURRENT_REVENUE).
python scripts/demo/seed_demo_business.py
```

Then point the backend at it:

```bash
cd backend
DATABASE_URL=sqlite:///./ursbiz_prod.db \
  uvicorn app.main:app --host 0.0.0.0 --port 8001
```

---

## Demo Screenshots

> Drop real screenshots into `docs/screenshots/` and reference them here. Captures should be of the running demo workspace (Acme Textiles, Tirupur), not mockups — see `HACKATHON_VISION.md` for the screens that matter most:

- Landing page (`/`)
- Dashboard (`/dashboard`) — health snapshot
- Schemes (`/schemes`) — profile-matched cards with match % + disclaimer
- Analytics (`/analytics`) — 3m / 6m / 12m horizons with confidence labels
- Advisor (`/advisor`) — grounded reply with trust labels
- Reports (`/reports`) — exported PDF

---

## Known Limitations

Read this section before quoting the marketing site.

1. **No embeddings, no vector store.** The AI layer is rule engines + an optional LLM rephraser. Any "vector search over official gazettes" claim is wrong and was removed from the marketing copy in P7.
2. **No AES-256 at rest.** Auth uses JWT HS256 with HTTPOnly cookies. Database-at-rest encryption depends on the deployment platform (Postgres volume encryption, disk encryption, etc.) — UrsBiz does not provide it.
3. **No sub-50ms latency SLO.** Measured latency on dev hardware is recorded in `H7_6_PUBLIC_DEPLOYMENT_REPORT.md`; do not treat it as a global SLA.
4. **Scheme catalog is 7 curated entries** — CGTMSE, ZED, PMEGP, Export Promotion (Capital Goods), MUDRA Shishu, NSIC, Udyam. Authoritative source: `backend/app/services/schemes_sprint16_service.py` → `SCHEMES_CATALOG`. Each entry is profile-matched, not all match every business. The catalog grows under the same module as new schemes are verified.
5. **No autonomous background scheduler.** "Daily briefings" are produced on demand by hitting the AI endpoint; no cron or background worker ships in this codebase.
6. **Single-process demo DB.** `backend/ursbiz_prod.db` is SQLite and is for the hackathon demo. For multi-user / production traffic, switch `DATABASE_URL` to PostgreSQL.
7. **No national-scale impact claims.** Statistics about "63M+ MSMEs", "30% GDP contribution", or "110M+ employment impact" were removed because UrsBiz has no measurement methodology for them. Outcome numbers in the demo are demo numbers.
8. **No fabricated customer testimonials.** The landing page now publishes a "What You Can Verify" panel instead of invented quotes.
9. **Generated text is only as grounded as the evidence bundle.** If a profile is sparse, the LLM will say so or fall back to placeholder.

---

## Roadmap

- **Lender-grade audit bundle** — signed PDF with hash of input profile so a banker can re-run the same numbers.
- **Udyam portal data import** — one-click profile population from the official Udyam registration.
- **Multi-language scheme explanations** — generate grounded summaries in Hindi, Tamil, Telugu, Bengali.
- **PostgreSQL migration hardening** — connection pooling, backup scripts (a `backup.sh` already exists in `deployment/scripts/`).
- **Per-tenant scheme catalog overlays** — state-specific rules on top of the central MSME catalog.

---

## Hackathon Work Completed

This section lists the H0–H7 verifications that produced the current codebase, in order. Each row is backed by a report under the repo root.

| # | Milestone | Report |
|---|-----------|--------|
| H1–H6 | Pre-hackathon baseline (auth, business persistence, scheme engine, forecast, reports, advisor) | `docs/MILESTONE_HISTORY.md`, `docs/HACKATHON_VISION.md` |
| H7.0 | Baseline + recovery on `release/hackathon-clean` | `H7_0_BASELINE_AND_RECOVERY_REPORT.md` |
| H7.1 | Auth + business persistence verified | `H7_1_AUTH_AND_BUSINESS_PERSISTENCE_REPORT.md` |
| H7.2 | Real-browser end-to-end (Playwright) | `H7_2_REAL_BROWSER_E2E_REPORT.md` |
| H7.3 | Grounded generative AI + safe-placeholder fallback | `H7_3_GROUNDED_GENERATIVE_AI_REPORT.md` |
| H7.4 | Trust + explainability labels in the UI | `H7_4_TRUST_AND_EXPLAINABILITY_REPORT.md` |
| H7.5 | Demo workspace + measured impact | `H7_5_DEMO_AND_IMPACT_REPORT.md` |
| H7.6 | Public deployment + smoke test | `H7_6_PUBLIC_DEPLOYMENT_REPORT.md` |
| H7.7 | **Claims audit, README rewrite, architecture diagram** | `H7_7_CLAIMS_AND_DOCUMENTATION_REPORT.md` |

---

## Tech Stack (honest summary)

| Layer | What it actually is |
|-------|---------------------|
| Frontend | Next.js 15 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS |
| State | React Query (TanStack Query v5) |
| Backend | FastAPI, Python 3.12, Pydantic v2, SQLAlchemy 2, Alembic |
| Database | PostgreSQL 14/15 (SQLite for dev and demo) |
| Auth | JWT HS256 + HTTPOnly cookie (`atlas_access_token`) |
| AI | Rule-based deterministic engines + optional OpenAI-compatible LLM rephraser (safe placeholder fallback when no key set) |
| Reports | ReportLab (PDF) + native CSV |
| Deployment | Docker Compose (nginx + backend + frontend + prometheus + grafana) or native uvicorn + standalone Next.js |