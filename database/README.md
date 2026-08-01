# Database

PostgreSQL is the **production** data store for Atlas AI. SQLite is the
dev convenience driver when Postgres isn't available.

## Status

- Database connection is **configured** in the backend.
- One business table exists: ``users`` (added in Sprint 1 Part 3).

## Production: PostgreSQL

Default connection string (matches `backend/.env.example`):

```
postgresql+psycopg2://postgres:postgres@localhost:5432/atlas_ai
```

Override with the `DATABASE_URL` environment variable in
`backend/.env`.

### Setting up locally

1. Install PostgreSQL 14+ and ensure it is running.
2. Create a database:

   ```sql
   CREATE DATABASE atlas_ai;
   ```

3. (Optional) Verify with `psql`:

   ```bash
   psql -h localhost -U postgres -d atlas_ai -c "SELECT 1;"
   ```

4. Run migrations:

   ```bash
   cd backend
   .venv/Scripts/python.exe -m alembic upgrade head
   ```

## Development: SQLite

For local development without a Postgres install, the dev `.env`
points at a local SQLite file (`./atlas_ai.db`). The migrations are
dialect-agnostic so the same `alembic upgrade head` works on both.

## Migrations

Alembic is initialized at `backend/alembic/`. To create new
migrations:

```bash
cd backend
.venv/Scripts/python.exe -m alembic revision --autogenerate -m "describe change"
.venv/Scripts/python.exe -m alembic upgrade head
```

Migration files live under `backend/alembic/versions/`. The first
migration (``20260101_0001_create_users_table.py``) creates the
``users`` table.
