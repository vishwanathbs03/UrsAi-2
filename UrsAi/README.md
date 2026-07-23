# Atlas AI

The intelligence layer for modern SMBs.

This is the **Sprint 4 — Part 3 (Polish & UX Enhancement)**
milestone deliverable. On top of the Sprint 4 Part 2
Action Board, the dashboard and action board now ship
production-quality UX:

**Dashboard** — animated score counters, circular Business
Health indicator, Business DNA confidence badge, color-coded
score cards, trend placeholders, TanStack Query caching,
and a clearer "Refresh Analysis" indicator.

**Action Board** — search + filter + sort controls, progress
/ impact / improvement summary panel, slide-over action
details with related knowledge articles + AI explanation +
"Move to" picker, estimated timeline badges, and a
Business Journey preview showing current vs projected
Business DNA.

---

## Tech Stack

**Frontend**

- Next.js 15.5 (App Router)
- TypeScript (strict)
- Tailwind CSS 3
- shadcn/ui-style component primitives
- React Hook Form + Zod (form validation)
- lucide-react icons
- TanStack Query v5 (caching for dashboard / action board)
- ESLint + Prettier

**Backend**

- FastAPI
- Python 3.12 (managed via `uv` venv)
- Pydantic v2 + pydantic-settings
- SQLAlchemy 2 + Alembic
- passlib[bcrypt] (password hashing) + python-jose (JWT)
- Uvicorn

**Database**

- PostgreSQL (production default)
- SQLite (dev convenience when Postgres isn't installed)

---

## Repository Structure

```
atlas-ai/
├── frontend/          Next.js 15 application (auth-enabled UI shell)
├── backend/           FastAPI service (auth endpoints + users table)
├── database/          Connection notes + migrations
├── deployment/        Reserved for future deployment assets
├── docs/              Project documentation
└── README.md          You are here
```

---

## Prerequisites

- **Node.js 20+** and **npm 10+**
- **Python 3.12+**
- **uv** — https://docs.astral.sh/uv/
- **PostgreSQL 14+** for production (optional for local dev — SQLite
  is the dev default)

---

## Backend

### Install

```bash
cd backend
uv venv --python 3.12 .venv
uv pip install -r requirements.txt
cp .env.example .env
```

### Database setup

The dev `.env` uses SQLite (`./atlas_ai.db`) so it works out of the
box. For production, switch `DATABASE_URL` in `.env` to a PostgreSQL
DSN, then run migrations.

```bash
cd backend
.venv/Scripts/python.exe -c "from alembic.config import Config; from alembic import command; cfg = Config('migrations.ini'); cfg.set_main_option('script_location', 'migrations'); command.upgrade(cfg, 'head')"
```

The first migration creates the `users` table.

### Run (development)

```bash
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Auth endpoints

| Method | Path                  | Auth     | Description                          |
| ------ | --------------------- | -------- | ------------------------------------ |
| POST   | `/api/v1/auth/register` | none   | Create account, return JWT + cookie  |
| POST   | `/api/v1/auth/login`    | none   | Verify credentials, return JWT + cookie |
| POST   | `/api/v1/auth/logout`   | optional | Clear auth cookie                   |
| GET    | `/api/v1/auth/me`       | JWT    | Return the current user              |
| GET    | `/api/v1/health`        | none   | Liveness — `{"status":"ok"}`        |

Tokens are JWTs (HS256, 60-minute expiry) returned both in the JSON
body **and** set as an HTTP-only, SameSite cookie
(`atlas_access_token`). Clients can authenticate by either sending
`Authorization: Bearer <token>` or letting the browser send the
cookie.

### Folder layout (auth additions)

```
backend/
├── app/
│   ├── api/v1/endpoints/
│   │   └── auth.py
│   ├── middleware/
│   │   ├── auth_deps.py     # get_current_user dependency
│   │   └── rate_limit.py    # rate-limit hook structure
│   ├── models/
│   │   └── user.py
│   ├── repositories/
│   │   └── user_repository.py
│   ├── schemas/
│   │   └── auth.py
│   ├── services/
│   │   └── auth_service.py
│   └── utils/
│       └── security.py      # password hash/verify + JWT
├── migrations/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 20260101_0001_create_users_table.py
└── migrations.ini
```

---

## Frontend

### Install

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

### Run (development)

```bash
cd frontend
npm run dev
```

Open http://localhost:3000

### Other scripts

```bash
npm run build         # production build
npm run start         # serve production build
npm run lint          # ESLint
npm run type-check    # tsc --noEmit
npm run format        # Prettier write
```

### Folder layout (Sprint 4 additions)

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (app)/
│       ├── layout.tsx                    # hosts QueryProvider
│       ├── dashboard/page.tsx            # protected
│       ├── action-board/page.tsx         # protected
│       └── business/page.tsx             # protected
├── components/
│   ├── auth/                             # auth UI primitives
│   ├── common/                           # AnimatedCounter, TrendBadge,
│   │                                     # SlideOver, QueryProvider, ...
│   ├── dashboard/                        # DashboardCard, CircularScore,
│   │                                     # ProgressBar, RadarChart, ...
│   ├── layout/                           # AppLayout, Navbar, Sidebar
│   ├── marketing/                        # landing-page sections
│   └── ui/                               # button, input, alert, ...
├── features/
│   ├── action-board/
│   │   ├── ActionBoardView.tsx           # top-level composition
│   │   ├── ActionCard.tsx                # draggable card
│   │   ├── KanbanColumn.tsx              # column + drop target
│   │   ├── BoardControls.tsx             # search / filter / sort
│   │   ├── BoardSummaryPanel.tsx         # progress / lift / impact
│   │   ├── BusinessJourneyPreview.tsx    # current vs projected DNA
│   │   ├── ActionDetailsPanel.tsx        # slide-over body
│   │   ├── use-action-board-data.ts      # rules + decision join
│   │   ├── use-action-board-filters.ts   # filter + sort helpers
│   │   └── use-action-status-storage.ts  # localStorage persistence
│   └── dashboard/
│       ├── DashboardView.tsx             # top-level composition
│       ├── DashboardHeader.tsx           # greeting + refresh
│       ├── OverallHealthCard.tsx         # circular hero
│       ├── DnaCard.tsx                   # archetype + confidence
│       ├── ReadinessCard.tsx             # 4-up score bars
│       ├── ScoresRadarCard.tsx           # radar + colour-coded list
│       ├── SwotSummaryCard.tsx           # 2x2 SWOT
│       ├── AiDecisionCard.tsx            # AI insights
│       ├── RecentAnalysisCard.tsx        # freshness
│       ├── LevelBadge.tsx                # pill primitive
│       ├── tones.ts                      # colour helpers
│       └── use-dashboard-data.ts         # TanStack Query bundle
├── lib/
│   ├── env.ts
│   ├── navigation.ts
│   ├── query-client.ts                   # QueryClient factory
│   ├── query-keys.ts                     # cache keys
│   ├── theme.ts
│   ├── utils.ts
│   └── validators/auth.ts
├── services/                             # api-client + per-endpoint services
└── types/auth.ts, types/dashboard.ts
```

### Routes

| Path         | Auth     | Purpose                              |
| ------------ | -------- | ------------------------------------ |
- `/`          | public   | Marketing landing page               |
| `/login`     | public*  | Sign in (already-authed → /dashboard)|
| `/register`  | public*  | Sign up (already-authed → /dashboard)|
| `/dashboard` | JWT      | Authenticated dashboard              |
| `/action-board` | JWT   | Interactive Action Board (Sprint 4) |
| `/business`  | JWT      | Business profile placeholder         |

`*` Authenticated users are auto-redirected to `/dashboard` if they
visit `/login` or `/register`. Protected pages (`/dashboard`,
`/business`) redirect to `/login?next=...` if no session is found.

### Validation

- Email format validated client-side and server-side
- Password: 8+ chars, 1 uppercase, 1 lowercase, 1 number (live
  strength meter on the registration form)

---

## Quick Start (both services)

In two terminals:

```bash
# Terminal 1 — backend
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
```

Then open:

- http://localhost:3000            — landing page
- http://localhost:3000/register   — create an account
- http://localhost:3000/login      — sign in
- http://localhost:3000/dashboard  — protected (auto-redirects to /login)
- http://127.0.0.1:8000/docs       — backend Swagger UI

### End-to-end auth flow

1. Open http://localhost:3000/register
2. Fill in name, email, password (8+ chars, mixed case, a number)
3. Submit → redirected to /dashboard, your name and email shown
4. Refresh the page → you stay signed in (cookie-based session)
5. Click **Sign out** → redirected to landing, cookie cleared
6. Try to open http://localhost:3000/dashboard → redirected to /login

---

## Out of Scope (this milestone)

- AI / rule engine / simulation
- Business profile data entry
- Dashboards, charts, reports
- Password reset / email verification
- OAuth / SSO
- Deployment scripts

These are scheduled for later milestones.
