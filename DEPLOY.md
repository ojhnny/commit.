# Putting commit. online (free)

Three free services, each doing one job:

| Piece | Service | What it holds |
|---|---|---|
| Database | **Neon** (free Postgres) | Your account, habits and every logged day |
| API | **Render** (free web service, Docker) | The FastAPI backend in `backend/` |
| Web app | **Vercel** (free Hobby plan) | The React app, built with `VITE_API_URL` pointing at the API |

You need the code on GitHub first (Render and Vercel both deploy from a repo).

## 1. Database: Neon

1. Sign up at neon.tech and create a project (any region close to you).
2. Copy the **connection string** (it starts with `postgresql://` and ends with `?sslmode=require`). Keep it private.

## 2. API: Render

1. Sign up at render.com with GitHub, then **New → Blueprint** and pick this repo. Render reads `render.yaml`.
2. When asked for environment variables:
   - `DATABASE_URL`: the Neon connection string.
   - `CORS_ORIGINS`: leave as `http://localhost:5173` for now; you'll set it after step 3.
3. Deploy. The container runs the database migrations on start, then serves the API.
4. Open `https://<your-service>.onrender.com/health`. It should say `{"status":"ok"}`. Interactive API docs are at `/docs`.

## 3. Web app: Vercel

1. Sign up at vercel.com with GitHub, **Add New → Project**, pick this repo. Framework: Vite (auto-detected).
2. Add an environment variable `VITE_API_URL` = your Render URL (for example `https://commit-api.onrender.com`, no trailing slash).
3. Deploy. Copy the site URL (for example `https://commit-yourname.vercel.app`).
4. Back in Render, set `CORS_ORIGINS` to that Vercel URL and save (Render redeploys).

## 4. Create your account, then close sign-ups

1. Open your Vercel URL, choose **Create account**.
2. If you used the app before in that same browser, it offers to **Move to account**. Do that once.
3. In Render, set `ALLOW_SIGNUP` to `false`. Nobody else can create an account after that; you can still sign in on any device.

## Things to know about the free plans

- **Render's free service sleeps after about 15 minutes without traffic.** The first visit after that takes up to about a minute while it wakes; the app shows "Waking up the server…". Everything is fast after that. Your data is never lost by sleeping: it's in Neon.
- Neon's free plan is far bigger than one person's habit log will ever need.
- Plans and limits change; check each service's pricing page if something looks different.
- Keep a backup now and then: **⋯ → Download backup** gives you a JSON file you can restore into any account.

## Running everything on your computer

```bash
docker compose up --build          # Postgres on :5432 and the API on :8000
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm install && npm run dev         # web app on :5173
```

Without `VITE_API_URL` the web app runs in browser-only mode (what the clickable preview uses).

## Backend development

```bash
cd backend
uv sync
cp .env.example .env               # point DATABASE_URL at a local Postgres
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
uv run pytest                      # needs a database named commit_test (see tests/conftest.py)
uv run ruff check . && uv run ruff format --check .
```

After changing `app/models.py`, create a migration with `uv run alembic revision --autogenerate -m "what changed"` and review it before committing.
