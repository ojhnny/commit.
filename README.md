# commit.

> Build consistency, one day at a time.

A personal consistency tracker: every habit gets its own GitHub-style contribution graph.

**Status: Phase 1, interactive frontend prototype.** No backend, auth, or sync yet. See [DESIGN.md](./DESIGN.md) for the design system and [PLAN.md](./PLAN.md) for the implementation plan.

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

## Prototype data

- Data lives in your browser's `localStorage` under the key `commit:v1`. **It is browser-specific and does not sync between devices or browsers.** Clearing site data erases it.
- On the very first visit, six sample habits are generated (relative to that day) and saved. They never regenerate on refresh.
- Dashboard `⋯` menu → **Remove sample habits** removes only the sample ones; **Add sample habits** brings them back; **Reset all data** wipes everything (with confirmation).
- If storage is blocked (some private modes), the app still works for the session but nothing is saved.

## Architecture

```
src/
├── domain/       Pure TS business logic (no React/DOM/storage): dates, scheduling,
│                 goal versions, day status, consistency, streaks, heatmap grid, validation
├── design/       tokens.ts: colors, type scale, spacing (platform-neutral)
├── services/     HabitRepository interface + LocalStorageHabitRepository + sample data
├── state/        HabitStore React context (loads from the repository, exposes actions)
├── hooks/        useToday (rolls over at midnight), useMediaQuery
├── components/   ui/ (shadcn-style primitives on Radix + Vaul), habits/, heatmap/, layout/
├── pages/        Dashboard (/), HabitDetails (/habits/:habitId), NotFound
└── styles/       Tailwind v4 theme mirroring tokens.ts
```

- `domain/` and `design/tokens.ts` have no browser dependencies, so they can move into a shared package for a future React Native / Expo app.
- Components never touch storage. Swapping `LocalStorageHabitRepository` for an HTTP client (FastAPI backend) is a change in `main.tsx`.
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
