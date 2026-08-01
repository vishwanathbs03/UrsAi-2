# UrsBiz — AI-Powered Business Intelligence Platform for MSMEs

UrsBiz is a full-stack AI Business Intelligence platform for **Micro, Small & Medium Enterprises (MSMEs)**. It provides a Business Digital Twin, Health Scoring Engine, AI Advisor, Predictive Analytics, Government Scheme Discovery, Executive Reports, and an AI Assistant — all in one unified dashboard.

Built with **FastAPI (Python 3.12)** + **Next.js 15 (TypeScript)** + **PostgreSQL** (SQLite fallback for dev).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Development)](#quick-start-development)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [Environment Variables](#environment-variables)
6. [Database](#database)
7. [Running the Application](#running-the-application)
8. [Expected URLs](#expected-urls)
9. [Docker (Production)](#docker-production)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Python** | 3.11 or 3.12 | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 18.x or 20.x LTS | [nodejs.org](https://nodejs.org/) |
| **PostgreSQL** | 14 or 15 | Optional — SQLite is used in dev by default |
| **Git** | Any | For cloning |

---

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/UrsAi.git
cd UrsAi

# 2. Setup backend
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt

# 3. Create backend env file (SQLite dev default — works with zero config)
cp .env.example .env
# Edit .env if you want PostgreSQL — see DATABASE_URL below

# 4. Start backend (port 8001)
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# 5. In a new terminal — setup frontend
cd ../frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Visit **http://localhost:3000** to open UrsBiz.

---

## Backend Setup

### 1. Create virtual environment

```bash
cd backend

# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```dotenv
DATABASE_URL=sqlite:///./atlas_ai.db    # zero-config SQLite for dev
JWT_SECRET_KEY=your-long-random-secret  # change this!
CORS_ORIGINS=http://localhost:3000
```

> For PostgreSQL: `DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/ursbiz`

### 4. Start backend

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

On startup you will see a validation banner:

```
[PASS] JWT Loaded — algorithm=HS256
[PASS] CORS OK — origins=http://localhost:3000
[PASS] Database Connected — url=.../atlas_ai.db
[PASS] Migrations Applied — schema already present
[PASS] Security Config
[PASS] API Ready — http://0.0.0.0:8001/docs
```

---

## Frontend Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Default `.env.local`:

```dotenv
NEXT_PUBLIC_APP_NAME=UrsBiz
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8001
```

If your backend runs on a different host or port, change `NEXT_PUBLIC_API_URL`.

### 3. Start frontend

```bash
npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `Atlas AI` | Application display name |
| `APP_ENV` | `development` | `development` or `production` |
| `APP_HOST` | `0.0.0.0` | Bind address |
| `APP_PORT` | `8000` | Bind port (run on 8001 to match frontend proxy) |
| `DATABASE_URL` | `sqlite:///./atlas_ai.db` | SQLAlchemy database URL |
| `JWT_SECRET_KEY` | *(required)* | Generate: `openssl rand -hex 32` |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token TTL |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `COOKIE_SECURE` | `false` | Set `true` in production (requires HTTPS) |
| `COOKIE_SAMESITE` | `lax` | `lax`, `strict`, or `none` |
| `AI_PROVIDER` | `placeholder` | `placeholder` or `ollama` |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_APP_NAME` | `UrsBiz` | App display name |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Frontend canonical URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8001` | Backend API base URL |

---

## Database

### SQLite (default, zero-config)

The backend auto-creates all tables on first startup. No setup needed.

```dotenv
DATABASE_URL=sqlite:///./atlas_ai.db
```

### PostgreSQL

```bash
# Create database
psql -U postgres -c "CREATE DATABASE ursbiz;"

# Set in backend/.env
DATABASE_URL=postgresql+psycopg2://postgres:yourpassword@localhost:5432/ursbiz
```

Tables are auto-created on first backend startup via `bootstrap_schema()`.

---

## Running the Application

| Service | Command | URL |
|---------|---------|-----|
| Backend | `uvicorn app.main:app --port 8001 --reload` | http://localhost:8001 |
| API Docs | *(auto)* | http://localhost:8001/docs |
| Frontend | `npm run dev` | http://localhost:3000 |

---

## Expected URLs

| Page | URL |
|------|-----|
| Landing Page | http://localhost:3000 |
| Login | http://localhost:3000/login |
| Register | http://localhost:3000/register |
| Dashboard | http://localhost:3000/dashboard |
| Analytics | http://localhost:3000/analytics |
| AI Advisor | http://localhost:3000/advisor |
| AI Assistant | http://localhost:3000/assistant |
| Government Schemes | http://localhost:3000/schemes |
| Reports | http://localhost:3000/reports |
| Business Profile | http://localhost:3000/business |
| Notifications | http://localhost:3000/notifications |
| API Swagger Docs | http://localhost:8001/docs |
| API Health Check | http://localhost:8001/health |

---

## Docker (Production)

```bash
# Build and start all services
docker-compose up --build -d

# Stop services
docker-compose down
```

Make sure to create a production `.env` with strong secrets before building.

---

## Troubleshooting

### Backend fails to start — "address already in use"

Another process is using port 8001. Kill it or use a different port:

```bash
# Windows — find and kill process on port 8001
netstat -ano | findstr :8001
taskkill /PID <PID> /F

# Linux / macOS
lsof -ti:8001 | xargs kill -9
```

### Frontend shows "Backend server is not running"

- Confirm backend is running: `curl http://localhost:8001/health`
- Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`

### CORS errors in browser

- Ensure `CORS_ORIGINS` in `backend/.env` includes your frontend URL exactly.
- Default: `CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`

### Database errors — "no such table"

Backend auto-creates tables on startup. If this fails:

```bash
cd backend
python -c "from app.utils.database import bootstrap_schema; bootstrap_schema(); print('Done')"
```

### SQLite database locked

Stop all running backend processes, then restart.

### JWT errors — 401 Unauthorized

Check that `JWT_SECRET_KEY` is set in `backend/.env` and is not empty.

### Cookie not sent on login

Ensure `credentials: "include"` is used in all fetch calls (already configured in `api-client.ts`).
For cross-origin dev, both `CORS_ORIGINS` and `COOKIE_SAMESITE=lax` must be set.

### Port mismatch

Backend default in `.env.example` is port 8000, but the frontend proxy and `.env.local` point to **8001**. Always start the backend with `--port 8001`.

---

## Project Structure

```
UrsAi/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # FastAPI route handlers
│   │   ├── config/             # Settings & logging
│   │   ├── middleware/         # CORS, security, performance
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # AI engines & business logic
│   │   └── utils/              # Database, security utilities
│   ├── .env.example            # ← Copy to .env
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # Reusable UI components
│   ├── features/               # Dashboard, Analytics, Advisor, Reports
│   ├── services/               # API client & domain services
│   ├── .env.local.example      # ← Copy to .env.local
│   └── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| State | React Query (TanStack Query v5) |
| Backend | FastAPI, Python 3.12, Pydantic v2 |
| Database | PostgreSQL 15 (SQLite for dev) |
| ORM | SQLAlchemy 2, Alembic |
| Auth | JWT + HTTPOnly Cookies |
| AI Layer | Rule-Based Deterministic Engines (6 engines) |
| Reports | ReportLab (PDF), CSV export |
| Deployment | Docker, Docker Compose, Nginx |
