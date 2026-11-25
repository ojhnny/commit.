<sub>A personal project, built mainly for my own daily use. Feel free to use it too.</sub><br>
<sub>Looking for the full-stack web app (React + FastAPI + Postgres) instead? It's on the <a href="https://github.com/ojhnny/commit./tree/fullstack"><code>fullstack</code> branch</a>.</sub>

# commit. for Obsidian

> Build consistency, one day at a time.

A habit tracker for Obsidian where every habit gets its own GitHub-style contribution graph. Log progress in a couple of clicks, then watch your streaks and consistency build up, all inside your vault.

<p align="center">
  <img src="docs/screenshots/demo.gif" alt="Demo: reordering habits by dragging, logging progress, timing a session, exploring the yearly heatmap, opening a note, and switching to list view" width="800">
</p>

- **A contribution graph per habit.** Year, month and calendar views, colored by how each day went.
- **Flexible goals.** Yes/no, or an amount per day (minutes, hours, pages, problems, workouts, or your own unit).
- **Custom schedules.** Every day, weekdays, weekends or specific days. Rest days never count against you.
- **Streaks and consistency.** Current streak, longest streak, completed days and consistency %.
- **Time spent and a timer.** Hours today, this week, this month and in total, plus a start/pause/stop timer that adds the time to today.
- **Notes per habit.** Markdown notes for each habit, saved as normal `.md` files in your vault.
- **Colors, order and archive.** Color-code habits, drag them into any order, and keep finished ones in the archive.
- **Your data stays in your vault.** One JSON file that syncs wherever your vault syncs. No account, no server, no network requests.
- **Desktop and mobile.** Works on macOS, Windows, Linux, iPhone, iPad and Android.

## Screenshots

*The plugin uses the same interface as the commit. web app. These screenshots use the built-in sample data.*

**Dashboard.** Every habit at a glance: the last 7 days, current streak, consistency and today's progress. Drag a habit by its grip to reorder.

![Dashboard in grid view](docs/screenshots/dashboard.png)

**Yearly heatmap.** One square per day, colored by how that day went. Hover over or tap any day for the details.

![Yearly heatmap with a tooltip](docs/screenshots/heatmap.png)

**Timer and time spent.** Start a timer on any minutes or hours habit. When you stop it, the time goes straight onto today.

![Habit page with a running timer and time totals](docs/screenshots/timer.png)

**Notes.** Each habit has its own markdown notes, like documents in a folder.

![A habit's notes](docs/screenshots/notes.png)

**List view.** Collapsible rows with the full graph and a quick logger for each habit.

![Dashboard in list view, expanded](docs/screenshots/list-view.png)

**On your phone.**

<p>
  <img src="docs/screenshots/mobile-dashboard.png" alt="Dashboard on a phone" width="280">
  &nbsp;
  <img src="docs/screenshots/mobile-habit.png" alt="Habit page on a phone" width="280">
</p>

## Install

### Option 1: BRAT (easiest, gets updates)

1. In Obsidian, install and enable **BRAT** from **Settings → Community plugins → Browse**.
2. Run **BRAT: Add a beta plugin for testing** from the command palette (Cmd/Ctrl+P).
3. Paste `ojhnny/commit.` and click **Add plugin**.
4. Go to **Settings → Community plugins** and turn on **commit.**

### Option 2: Manual

1. Open the [latest release](https://github.com/ojhnny/commit./releases/latest) and download `commit-habits.zip`. Or download the three files `main.js`, `manifest.json` and `styles.css` from the release.
2. Unzip it. You get a folder named `commit-habits`.
3. Move that folder into your vault at `<your vault>/.obsidian/plugins/commit-habits/`.
   - `.obsidian` is a hidden folder. On macOS press **Cmd+Shift+.** in Finder to show it. On Windows turn on **View → Show → Hidden items**.
   - If there's no `plugins` folder yet, create it.
4. In Obsidian open **Settings → Community plugins**.
   - If **Restricted mode** is on, turn it off.
   - Click the **reload icon** next to "Installed plugins".
   - Turn on **commit.**

**On iPhone or iPad:** copy the same `commit-habits` folder into your vault's `.obsidian/plugins/` folder with the Files app, or let Obsidian Sync or iCloud bring it over from your computer. Then turn it on under **Settings → Community plugins**, the same as on desktop.

## Getting started

1. **Open it.** Click the **calendar-check icon** in the left ribbon, or run **commit.: Open habits** from the command palette. It opens as a normal tab, so you can pin it, split it or drag it into a sidebar.
2. **Look around first (optional).** On a fresh start you can choose **Explore with sample data** to see a few months of example habits and how the graphs look. You can remove them later with **⋯ → Remove sample habits**.
3. **Create a habit.** Click **New habit**, or press **N** while the commit. view is focused.
   - **Name**, for example "Reading", plus an optional description of why it matters or what counts.
   - **Goal type:** *Yes / no* for things you either did or didn't do, or an amount with a **Unit** (minutes, pages, workouts, or a custom unit like "km") and a **Daily target**.
   - **Repeat:** every day, weekdays, weekends or custom days. Unscheduled days are rest days and are skipped in your stats.
   - **Start date:** days before this aren't counted.
4. **Log progress.** Click a habit to log today. Use **Quick add** for common amounts, **Add** to add to today's total or **Set total** to replace it, and add a note about what you worked on. **Undo** reverts the last change.
5. **Read your graph.** Hover over or tap any square to see that day. Switch between **Year**, **Month** and **Calendar view** on a habit's page, and between **Grid view** and **List view** on the dashboard.
6. **Time it (optional).** Habits measured in minutes or hours have a **Start timer** button next to their title. Pause and resume as often as you like; the timer keeps running if you close the view or restart Obsidian. Press the square to stop, adjust the minutes if you need to, and **Add** puts them on today's total.
7. **Keep notes.** Press **Notes** on a habit's page to write markdown notes for that habit (see [Notes](#notes) below).
8. **Organize.** Pick one of eight **colors** in a habit's Edit dialog. **Drag** a habit by the ⋮⋮ grip in its corner to reorder (with a keyboard: focus the grip, then Space and the arrow keys).
9. **Edit, archive or delete** a habit from its page. Changing a goal only applies from today on, so your past days are still judged by the goal you had back then. The **Archive** button on the dashboard lists archived habits, where you can restore them or delete them for good.

### What the colors mean

| Day | Color |
|---|---|
| Hit your target | Green |
| Went past your target | Dark green |
| Some progress, but under target | Muted green |
| Scheduled day that passed with nothing logged | Orange (missed) |
| Today with nothing logged yet | Gray. Never counts as missed until the day is over. |
| Rest day, before the start date, or in the future | Gray, left out of your stats |

**Consistency** is the share of scheduled days you completed. Today only counts once you finish it. **Streaks** count consecutive completed scheduled days. Rest days don't break them, and an unfinished today doesn't either.

## Your data

Habits and logged progress live in one file in your vault: **`commit/habits.json`**. You can change the path under **Settings → commit. → Data file**.

- **Sync:** it syncs with whatever syncs your vault (Obsidian Sync, iCloud, Dropbox, git). If the file changes on another device, any open commit. views reload by themselves.
- **Backups:** **Save backup to vault** in the **⋯** menu writes a dated copy to `commit/backups/`. You can change that folder under **Settings → commit. → Backup folder**.
- **Restore:** **Restore from backup…** in the **⋯** menu loads a backup and replaces your current data.
- **Timers** are kept on the device they were started on and don't sync.

### Notes

Each habit's notes are normal Markdown files at `commit/notes/<habit name>/<note title>.md` (the root folder is under **Settings → commit. → Notes folder**). Nothing extra is added to the files, so search, links, backlinks and the graph all work, and you can edit a note in Obsidian's own editor (**Open in Obsidian** in the note's ⋯ menu) or inside commit.

- Changing a note's title renames its file, and links to it are updated. Renaming a habit renames its folder.
- If you move or rename a habit's notes folder in Obsidian, commit. follows it.
- Deleting a note or a habit moves the files to the trash, following Obsidian's "Deleted files" setting.
- Backups saved to the vault contain habits and logs only, since the notes are already files.

## Commands

| Command | What it does |
|---|---|
| **commit.: Open habits** | Open the habits view |
| **commit.: Open habits in a new tab** | Open it in a separate tab |
| **commit.: Open habits in the right sidebar** | Keep it docked next to your notes |
| **N** (inside the view) | New habit |

## Build from source

Requires Node 20+.

```bash
npm install
npm test                    # domain, repository and vault storage tests
npm run build               # type-checks, then writes dist/commit-habits/ (main.js, manifest.json, styles.css)
node scripts/harness.mjs    # builds harness-out/, a browser page that runs the plugin against a mocked Obsidian API
```

`src/domain`, `src/components`, `src/pages` and `src/state` are shared with the web app. The Obsidian-specific parts are `src/obsidian/` (plugin, view, vault JSON storage, notes as vault files) and `src/platform/` (portal target, backups, shortcut scope). `scripts/build.mjs` compiles Tailwind and scopes every rule under `.commit-root`, so nothing leaks into Obsidian or your theme.

The `main.js`, `manifest.json` and `styles.css` at the root of this branch are the built plugin, kept in the repo so it can be installed straight from here.

## Web app

commit. also exists as a full-stack web app (React, FastAPI and PostgreSQL) with sign-in and sync across browsers. It isn't hosted publicly yet, but you can run it yourself. The code and setup guide are on the [`fullstack` branch](https://github.com/ojhnny/commit./tree/fullstack).

## License

[MIT](./LICENSE)
