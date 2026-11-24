# commit. — Implementation plan (Phase 1: frontend prototype)

Scope: interactive frontend only. No backend, auth, native app or production infra until the prototype is approved.

## Architecture

```
src/
├── domain/        Pure TypeScript. No React, no DOM, no storage.
│   ├── types.ts        Habit, GoalVersion, HabitLog, Schedule, DayStatus
│   ├── dates.ts        DateKey ("YYYY-MM-DD") math in UTC day numbers (DST-safe, leap-year aware)
│   ├── scheduling.ts   isScheduled, goalFor(date) using goal versions
│   ├── progress.ts     dayStatus(habit, log, date, today), formatting values/units
│   ├── consistency.ts  consistency %, completed/partial/missed counts
│   ├── streaks.ts      current and longest streak
│   ├── heatmap.ts      year grid (weeks × weekdays, month label positions)
│   └── validation.ts   habit and log input validation
├── design/tokens.ts    Colors, type scale, spacing (platform-neutral)
├── services/
│   ├── habitRepository.ts        Async repository interface (future: REST client)
│   ├── localStorageRepository.ts Implementation over a KeyValueStorage adapter
│   └── demoData.ts               Deterministic seeded sample data
├── state/HabitStore.tsx  React context: loads from the repository, exposes actions
├── hooks/                useToday (rolls over at midnight), useMediaQuery
├── components/ui/        shadcn-style primitives (Radix + Vaul)
├── components/habits/    HabitCard, HabitList, HabitStatistics, HabitFormDialog, ProgressLogger, DaySheet…
├── components/heatmap/   ActivityHeatmap, HeatmapTooltip, HeatmapLegend, MonthlyCalendar, WeekPreview
├── components/layout/    AppHeader, Wordmark, Page
└── pages/                Dashboard (/), HabitDetails (/habits/:habitId), NotFound
```

Everything in `domain/` and `design/tokens.ts` is written to move unchanged into a shared `packages/core` for a future Expo app. The repository interface is async so the localStorage implementation can be swapped for an HTTP client without touching components.

## Key decisions

- **Goal versions from day one.** A habit holds `goalVersions[]` (target, unit, schedule, effectiveDate). Editing target/schedule appends a version effective today, so past days are judged by the rules that applied then. Mirrors the planned `HabitGoalVersions` table.
- **Status is derived, never stored.** Heatmap colors come from `dayStatus()`.
- **One log per habit per day**, keyed by `habitId + date` (upsert), matching the planned unique constraint.
- **Dates are local calendar days** stored as `YYYY-MM-DD` strings. "Today" is computed once per render tree and rolls over at local midnight.
- **Sample data is seeded once** (first visit only), flagged `isSample`, and removable from the dashboard menu.

## Steps

1. DESIGN.md (done) and this plan.
2. Scaffold Vite + React + strict TS + Tailwind v4 + Router; tokens and fonts.
3. Domain modules + Vitest unit tests (dates/leap years, scheduling, goal changes, statuses incl. today, consistency, streaks, repository uniqueness).
4. Repository + demo data + store.
5. UI primitives, then dashboard, habit page, heatmap, month calendar, logger, create/edit, archive/delete, reorder.
6. Playwright pass at 320/390/430/768/1280/1440: overflow, clipping, alignment, flows, persistence. Fix issues.
7. Report, then stop for approval.

## Phase 2 (approved 2026-11-24): backend and sign-in, done

- FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL in `backend/`, Docker image and `docker-compose.yml`.
- Email + password accounts (argon2), bearer-token sessions stored as SHA-256 hashes, `ALLOW_SIGNUP` to close sign-ups.
- REST: habits (CRUD, archive, restore, reorder), logs per day (PUT upsert, range list), stats per habit, snapshot, export/import, sample data, reset.
- Rules ported to Python with mirrored tests; 37 backend tests run against real Postgres.
- Web app: `HttpHabitRepository`, sign-in screen, move browser data into the account, cold-start notice, reload on tab focus for cross-device sync.
- Free hosting: Vercel (web) + Render (API) + Neon (Postgres). See DEPLOY.md.

## Later

PWA (manifest, icons, offline queue), optimistic updates, password reset by email, Expo app sharing `domain/` and tokens.
