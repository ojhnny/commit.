# commit.

> Build consistency, one day at a time.

A personal consistency tracker: every habit gets its own GitHub-style contribution graph.

**Status: Phase 2.** React web app + FastAPI/PostgreSQL backend with sign-in, so your habits are saved online and sync across devices. See [DEPLOY.md](./DEPLOY.md) to put it online for free, [DESIGN.md](./DESIGN.md) for the design system and [PLAN.md](./PLAN.md) for the plan.

The web app runs in one of two modes:

- **Account mode** (`VITE_API_URL` set): sign in, data lives in Postgres through the API in [`backend/`](./backend).
- **Browser-only mode** (no `VITE_API_URL`): data lives in this browser's `localStorage`. Used for the clickable preview.

## Run it

Requires Node 20+ (tested on Node 22).

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm test             # Vitest unit tests (domain logic, repository, token sync)
npm run typecheck    # strict TypeScript
npm run build        # production build to dist/
npm run preview      # serve the production build (http://localhost:4173)
npm run build:static # build with hash routing, for hosts that can't rewrite deep links
```

## Browser-only mode data

- Data lives in your browser's `localStorage` under the key `commit:v1`. **It is browser-specific and does not sync between devices or browsers.** Clearing site data erases it.
- On the very first visit, six sample habits are generated (relative to that day) and saved. They never regenerate on refresh.
- Dashboard `⋯` menu → **Remove sample habits** removes only the sample ones; **Add sample habits** brings them back; **Reset all data** wipes everything (with confirmation).
- Dashboard `⋯` → **Download backup** saves everything as a JSON file; **Restore from backup…** loads it back (replacing current data). Backups work in both modes, so a browser-only backup can be restored into an account.
- After signing in on a browser that has browser-only habits, the dashboard offers **Move to account** once (sample habits are skipped; the browser copy is kept).
- The app asks the browser for persistent storage so data isn't evicted under storage pressure.
- If storage is blocked (some private modes), the app still works for the session but nothing is saved.

## Architecture

```
src/
├── domain/       Pure TS business logic (no React/DOM/storage): dates, scheduling,
│                 goal versions, day status, consistency, streaks, heatmap grid, validation
├── design/       tokens.ts: colors, type scale, spacing (platform-neutral)
├── services/     HabitRepository interface, LocalStorageHabitRepository, HttpHabitRepository,
│                 ApiClient (bearer token, readable errors), sample data
├── state/        HabitStore (loads from the repository, exposes actions), Account (sign-in gate)
├── hooks/        useToday (rolls over at midnight), useMediaQuery
├── components/   ui/ (shadcn-style primitives on Radix + Vaul), habits/, heatmap/, layout/
├── pages/        Dashboard (/), HabitDetails (/habits/:habitId), SignIn, NotFound
└── styles/       Tailwind v4 theme mirroring tokens.ts
```

```
backend/
├── app/
│   ├── domain.py     Python port of the day-status, consistency and streak rules
│   ├── models.py     users, sessions, habits, habit_goal_versions, habit_logs
│   ├── routers/      auth (/auth/*), habits + logs + stats (/habits/*), data (/snapshot, /export, /import)
│   └── security.py   argon2 passwords, hashed bearer-token sessions
├── alembic/          migrations
└── tests/            test_domain.py mirrors src/domain/domain.test.ts; test_api.py hits a real Postgres
```

- `domain/` and `design/tokens.ts` have no browser dependencies, so they can move into a shared package for a future React Native / Expo app.
- Components never touch storage. `main.tsx` picks the HTTP or localStorage repository from `VITE_API_URL`.
- The API decides "today" in the account's time zone, which the app keeps matched to the device.
- One entry per habit per day is enforced by a unique constraint and an atomic upsert.
- Heatmap colors are always derived from logs + goal versions, never stored.
- Goal changes create a new goal version effective today, so past days are judged by the rules that applied then.

## Rules implemented

| Case | Result |
|---|---|
| Past scheduled day, nothing logged | Missed (orange) |
| 0 < progress < target | Partial (muted green) |
| progress = target | Done (green) |
| progress > target | Exceeded (dark green) |
| Today, nothing logged yet | Gray, never missed |
| Future / before start / unscheduled | Gray, excluded from stats |
| Consistency | completed eligible scheduled days ÷ eligible scheduled days |
| Today in consistency | Counted only once completed |
| Streaks | Consecutive completed scheduled days; rest days skipped; unfinished today doesn't break it |
