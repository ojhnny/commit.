# commit. — Design System

> Build consistency, one day at a time.

This document is the visual and interaction source of truth for commit. Any change that contradicts it must update this file in the same change, with a one-line note in the changelog at the bottom.

---

## 1. Brand identity

- **Name:** `commit.` — always lowercase, always with the period.
- **Wordmark:** the word `commit` in primary text color (`#E7E9EC`) followed by a period in primary green (`#2DA44E`). Geist, weight 600, tight tracking (-0.02em). No icon, no container, no gradient. The wordmark is the logo.
- **Tagline:** "Build consistency, one day at a time." Set in secondary text, regular weight.
- **Philosophy:** consistency, not perfection. The UI never shames. A missed day is shown in warm orange (information, not error red). Partial effort is visibly different from no effort.
- **Core loop:** Create → Track → Visualize → Repeat.
- **Voice:** short, calm, factual. "Not logged yet", "Rest day", "Target reached". No exclamation marks, no emoji, no gamified copy.

## 2. Design philosophy

1. **The graph is the product.** Each habit's contribution graph is the centerpiece of its page. Everything else supports it.
2. **Density over decoration.** Compact type, thin borders, small radii. Information sits close together, like a developer tool.
3. **One surface step at a time.** Background → surface → secondary surface. Never nest a card inside a card.
4. **Color carries meaning.** Green means progress, orange means missed, gray means "nothing expected". Neutral UI chrome stays gray scale. Color is never the only signal: every status also has a text label.
5. **Fast logging.** Logging today's progress takes one or two interactions from the dashboard or habit page.
6. **Restraint.** No gradients, glass, glow, neon, decorative icons, or oversized headings. If an element doesn't help the user track or understand consistency, remove it.

## 3. Visual references (what we borrowed, and what we didn't)

| Reference | Borrowed | Not borrowed |
|---|---|---|
| GitHub contribution graph | 7-row week columns starting Sunday, month labels above, Mon/Wed/Fri labels left, small rounded squares, legend under the grid, year navigation, hover tooltip | GitHub's 5-step intensity scale (commit uses goal-relative states) and the "Less/More" legend wording |
| Linear | Near-black UI, compact 13–14px type, subtle 1px borders, muted secondary text, quiet modals, smooth but short transitions | Sidebar navigation (commit has two screens, no sidebar needed) |
| Vercel dashboard | Grid of clickable cards with a title, meta line, and overflow `…` menu; neutral light primary button ("Add New…"); clean empty states | Top tab bar, search bar (not needed until many habits) |
| shadcn/ui dashboard + calendar | Component anatomy (Button, Dialog, Dropdown, Tooltip, Drawer), month calendar layout, tabular numbers in stats, segmented toggles | Big KPI cards with oversized numbers; area charts |
| HabitKit / mobile trackers | One card per habit with a mini activity strip, big tap targets, floating-free bottom sheets for logging, per-habit detail page with year navigation | Multi-color habit theming, icon-per-habit, decorative stat tiles |
| Palette card (provided) | Exact palette and wordmark treatment | — |

## 4. Color palette

All colors live in `src/design/tokens.ts` (platform-neutral, shareable with a future React Native app) and are mirrored as CSS variables / Tailwind theme tokens in `src/styles/index.css`. A unit test asserts the two stay in sync.

### Neutrals

| Token | Hex | Use |
|---|---|---|
| `bg` | `#101113` | Page background |
| `surface` | `#17191C` | Cards, dialogs, sheets |
| `surface-2` | `#1B1E21` | Inputs, hover state of surfaces, segmented control track |
| `surface-3` | `#22252A` | Pressed/active states, kbd chips (derived) |
| `border` | `#303238` | 1px borders, dividers |
| `border-subtle` | `#24272C` | Dividers inside a surface (derived) |
| `text` | `#E7E9EC` | Primary text, primary button background |
| `text-muted` | `#8D929B` | Secondary text, labels, icons |
| `text-faint` | `#80858F` | Placeholders, hints, micro labels (≥4.5:1 on every surface) |

### Accents

| Token | Hex | Use |
|---|---|---|
| `green` | `#2DA44E` | Wordmark period, progress fill, "done" status, focus ring |
| `green-dark` | `#116329` | Exceeded state |
| `orange` | `#DA8B36` | Missed state, warnings |
| `danger` | `#E5534B` | Destructive text and menu items |
| `danger-strong` | `#C0392F` | Filled destructive button (white text 5.4:1) |
| `timer` | `#E8713F` | The habit timer only: its dot, the stop square and the "Add" button (dark text on it, 6.4:1). One warm accent, flat, no gradient or glow. |

### Heatmap states

| State | Hex | When |
|---|---|---|
| Empty | `#25282D` | Future, unscheduled (rest), before start, or today not yet logged |
| Missed | `#DA8B36` | Past scheduled day with 0 recorded |
| Partial | `#397C46` | 0 < progress < target |
| Done | `#2DA44E` | progress = target |
| Exceeded | `#116329` | progress > target |

Today's cell always gets a 1px `text-muted` inset ring so it can be found at a glance.

### Habit colors

Each habit may have one color, picked from a fixed set of eight so they stay easy to tell apart. The color is a label only: it appears as an 8px dot before the habit's name (card, list row, habit page title, archive) and never changes the heatmap, whose colors always mean status.

| Name | Hex |
|---|---|
| Red | `#F47067` |
| Orange | `#E0823D` |
| Yellow | `#D4B13F` |
| Green | `#57AB5A` |
| Teal | `#39C5CF` |
| Blue | `#539BF5` |
| Purple | `#B083F0` |
| Pink | `#E275AD` |

"None" is the default and shows no dot. All eight are ≥3:1 against `surface`, which is enough for a non-text marker.

### Contrast notes

- `text` on `bg`: 15.5:1. `text-muted` on `bg`: 6.0:1, on `surface`: 5.6:1. `text-faint` on `bg`: 5.1:1, on `surface-2`: 4.5:1. All pass WCAG AA.
- White text on `#2DA44E` is only ~3.2:1, so **green is never used as a filled button background with text**. The primary button is light (`text` background, `bg` text, ~15:1), following Vercel/shadcn.
- Green (5.9:1) and orange (7.0:1) as text on `bg` pass AA and may be used for short status labels.
- `danger` text on `surface` is 4.8:1; white on `danger` would be only 3.7:1, so filled destructive buttons use `danger-strong`.

## 5. Typography

- **Family:** Geist Variable for all UI text, bundled locally via `@fontsource-variable/geist` (no network fonts). Monospace is not used in Phase 1; if needed, use the system mono stack.
- **Numbers:** `font-variant-numeric: tabular-nums` on every statistic, progress value, percentage, streak, and input (`.tabular` utility / `tabular-nums` class).
- **Scale (px / line-height / weight):**

| Role | Size | LH | Weight |
|---|---|---|---|
| Wordmark | 20 | 28 | 600 |
| Page title (habit name) | 20 (mobile 18) | 28 | 600 |
| Section title | 14 | 20 | 500 |
| Body / controls | 14 | 20 | 400 |
| Small / meta | 13 | 18 | 400 |
| Micro (heatmap labels, legend) | 11 | 14 | 400 |
| Stat value | 20 | 24 | 500 |

- No headings larger than 20px. Bold (700) is not used. Emphasis comes from color (`text` vs `text-muted`) and weight 500.
- Letter-spacing: -0.01em on titles and stat values, default elsewhere.

## 6. Spacing system

4px base grid. Allowed steps: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48.

- Page gutter: 16px (mobile), 24px (≥640), 32px (≥1024).
- Max content width: 1040px, centered.
- Card padding: 16px. Dialog padding: 20px (24px ≥640).
- Gap between cards: 12px. Gap between page sections: 24px (mobile) / 32px (desktop).
- Heatmap: cell 11px, gap 3px on desktop (≥768); cell 13px, gap 3px on touch/mobile so taps land.

## 7. Shape, elevation, motion

- **Radius:** 6px controls (`rounded-md`), 8px cards (`rounded-lg`), 12px dialogs/sheets (`rounded-xl`), 2px heatmap cells, full-round only for status dots.
- **Borders:** 1px `border` everywhere a surface meets the background.
- **Shadows:** none on cards. Dialogs, sheets and menus get one soft shadow (`0 8px 24px rgb(0 0 0 / 0.4)`) to separate them from the dimmed overlay.
- **Overlay:** `rgb(0 0 0 / 0.6)`, no blur.
- **Motion:** 120–180ms ease-out for hover, menus and dialogs; sheets slide 250ms. Everything respects `prefers-reduced-motion: reduce` (transitions collapse to opacity or none).

## 8. Components

All interactive primitives are shadcn/ui-style components built on Radix (and Vaul for drawers), restyled with the tokens above. They live in `src/components/ui/`.

| Component | Style |
|---|---|
| **Button – primary** | `text` bg, `bg` text, h-9 (36px) desktop / h-11 (44px) on touch for primary actions, weight 500 |
| **Button – secondary** | `surface-2` bg, 1px `border`, `text` |
| **Button – ghost** | transparent, `text-muted`, hover `surface-2` + `text` |
| **Button – destructive** | `danger` text on transparent; the confirm dialog's action uses `danger-strong` bg with white text (5.4:1) |
| **Icon button** | 36px square desktop, 44px on touch, ghost style, always has `aria-label` |
| **Input / Textarea** | `surface-2` bg, 1px `border`, 6px radius, h-9 / h-11 touch, focus ring 2px green at 60% |
| **Segmented control** | `surface-2` track, active segment `surface-3` + `text`; used for Set total/Add, Year/Month, schedule presets |
| **Weekday selector** | 7 toggle buttons S M T W T F S, 36px circles-ish squares (radius 6), `aria-pressed` |
| **Dialog** | `surface` bg, 1px border, 12px radius, max-w 440px, title 16/500, centered |
| **Drawer (bottom sheet)** | Mobile (<640px) replacement for dialogs. `surface` bg, top radius 12px, grab handle, safe-area bottom padding |
| **Dropdown menu** | `surface` bg, 1px border, 8px radius, 32px items (40px touch), destructive item in `danger` |
| **Tooltip** | `surface-3` bg, 1px border, 12px text, 6px radius, no arrow |
| **Toast** | Sonner, bottom-center, `surface` bg, short copy ("Progress saved") |
| **Progress bar** | 6px tall, `surface-3` track, fill uses the heatmap state color (partial/done/exceeded) |
| **Status pill** | text label + 6px dot in state color; never dot alone |

### Habit card (dashboard)

```
┌───────────────────────────────────────────────┐
│ Machine Learning                         ⋯  › │
│ 2 hours / day · Every day                     │
│                                               │
│ ▪ ▪ ▪ ▪ ▪ ▪ ▣     92%  consistency            │
│ W T F S S M T                                 │
│ ● 1.5 / 2 hours today              [ + Log ]  │
└───────────────────────────────────────────────┘
```

- Whole card is a link (stretched link) to `/habits/:id`; the quick-log button sits above the link layer.
- 7-day preview: last 7 days ending today, 14px squares with weekday initial underneath.
- Today status: dot + text ("Done", "1.5 / 2 hours", "Not logged", "Rest day", "Missed" never applies to today).
- Navigation indicator: a muted chevron on the right.
- Color dot (if the habit has a color) before the name.
- Drag handle: a 6-dot grip (`GripVertical`) in the top-right corner replaces the chevron. Drag a card by its grip to move it; the other cards slide out of the way and the new order saves on drop. On touch, the grip responds after a short press so scrolling the list never drags. With a keyboard, focus the grip, press Space to pick up, arrow keys to move, Space to drop, Esc to cancel. In list view the grip sits at the right end of each row.

### Activity heatmap

- Columns are weeks starting Sunday; rows Sun→Sat. Labels on the left show Mon/Wed/Fri only.
- Month label sits above the first week column containing the 1st of that month (GitHub rule); labels that would collide (<3 columns apart) are dropped.
- Cells outside the selected year are not rendered (transparent placeholders keep alignment).
- Legend below, right-aligned: labeled swatches "Missed / Partial / Done / Exceeded" plus "No goal" (empty).
- Header: year switcher (`‹ 2026 ›`), Year/Month toggle.
- Desktop hover → floating tooltip (one shared element, not one per cell). Click / Enter → day sheet.
- Keyboard: the grid is one tab stop (roving tabindex). Arrow keys move ±1 day / ±1 week, Home/End jump to week edge, Enter/Space opens the day.

### Time spent

Hours are counted from logs on days whose goal is time-based (`minutes` or `hours`); minutes are converted to hours. Other units (pages, problems, yes/no, custom) have no duration and are left out, never guessed. Weeks start on Sunday (like the graph); "this month" is the calendar month to date. Archived habits still count, because the time was really spent.

- **Format:** under one hour → minutes ("45 min"); otherwise hours with at most one decimal ("2.5 h", "186 h"). Always tabular numbers.
- **Habit page (time-based habits only):** a second row in the stats strip, same style as the first: **Today · This week · This month · Total time**, each with a quiet hint ("of 2 h goal", "since Jan 28"). Habits that were never time-based don't show the row.
- **Dashboard:** one muted line under the "2 of 5 done today" summary: `Time spent  2.5 h today · 9 h this week · 31 h this month`, totals across all time-based habits. Hidden when no habit is time-based. Hovering (or long-press) is not needed; the line is the whole feature.

### Habit timer

Time-based habits (`minutes` or `hours`, not archived, already started) get a timer to the right of the habit's title (full width under the description on phones). Approved mockups: `screenshots/timer-archive-mockups-v2/`.

- **Idle:** outlined pill, a small `timer` dot and "Start timer".
- **Running:** the pill shows a softly blinking `timer` dot, the elapsed time (`mm:ss`, `h:mm:ss` past an hour, tabular), a ghost Pause button and a Stop button with a `timer`-colored square.
- **Paused:** the dot turns `text-faint`, the time goes `text-muted` with "Paused" after it, and Pause becomes Play.
- **Stop** pauses the timer and opens a dialog (sheet on phones): the elapsed time large, an **Add to today** stepper (rounded minutes, − and + by 1 min; in hours habits the amount is converted), one line "Today becomes 1.9 h of your 2 h goal.", and buttons **Discard** (left, destructive text), **Keep timing** and **Add N min** (`timer` fill). Add saves through the normal log path, so stats, heatmap and dashboard update at once, with the usual Undo toast. Discard also has Undo. Closing the dialog leaves the timer paused.
- The timer survives leaving the page, closing the tab or reloading (it stores its start time, not a ticking count, in this device's storage). Each habit has its own timer. A running timer also shows as a small dot and time on the habit's dashboard card or row.

### Archive page

`/archive`, opened from an **Archive** ghost button (icon + label + count; icon + count on phones) in the dashboard header next to `⋯`. Same header pattern as the habit page (back to Habits).

- Title "Archive" and one line of explanation, then one bordered list: each row has the color dot and name (a link to the habit page), then a muted line `start – archived date · N days completed · NN% consistency · total time (time-based only) · N notes`, and two buttons: **Restore** (outline) and **Delete** (destructive text).
- Delete opens the confirm dialog ("Delete Spanish?", naming the days of history and notes that will go, button "Delete forever").
- Empty state: "Nothing archived. Archive a habit from its ⋯ menu to keep its history without it on your dashboard."
- The collapsible "Archived (n)" section at the bottom of the dashboard is replaced by a quiet link to this page.

### Habit notes

Each habit has its own set of markdown notes (plans, resources, reflections), kept like documents in a folder: several per habit, each with a title and a body, sorted by last edit.

- **Entry point:** a `Notes` toggle button in the habit page header, between the habit switcher and the `⋯` menu. It shows the note count (`Notes 3`) and is `aria-pressed` while the notes view is open; pressed state uses `surface-3` + `text`. Below 640px the word "Notes" is hidden (icon + count only, with an `aria-label`) so the truncated habit name keeps its room. Pressing it again (or the header's back link) returns to the habit view.
- **Routes:** `/habits/:id/notes` (list) and `/habits/:id/notes/:noteId` (one note), so browser Back and links work. Previous/next habit arrows keep the current view (habit ↔ habit, notes ↔ notes).
- **What stays:** the title block (name, target · schedule) stays at the top in both views so the user always knows which habit they're in. Stats, heatmap and Today are replaced by the notes view.

**Notes list (Drive-style)**

```
┌───────────────────────────────────────────────┐
│ Notes  3                        [ + New note ] │
├───────────────────────────────────────────────┤
│ Study plan                      Edited 2h ago ⋯│
│ Week 1: linear models, week 2: trees…         │
├───────────────────────────────────────────────┤
│ Resources                     Edited Nov 20  ⋯│
│ - Elements of Statistical Learning            │
└───────────────────────────────────────────────┘
```

- One `Section` panel. Header: "Notes" plus a muted count, and a primary `New note` button (`+` icon only below 380px).
- Rows separated by `border-subtle` dividers (no cards inside the panel). Each row: title (body, 500, one line, truncated), a one-line plain-text snippet of the body in `text-muted` (markdown syntax stripped), and the edit time on the right in `small`/`text-faint` ("Edited just now", "Edited 2h ago", "Edited Nov 20", "Edited Nov 20, 2025" for other years). The whole row is a link; the `⋯` menu (Open, Delete) sits above the link layer, like habit cards.
- Untitled notes show "Untitled" in `text-muted`. Empty notes show "Empty note" as the snippet.
- Sorted by last edited, newest first. No folders, tags or search yet.
- Empty state: the shared `EmptyState` with "No notes yet", body "Keep plans, resources and reflections for this habit. Notes are written in Markdown.", and a `New note` button.

**Note editor**

```
┌───────────────────────────────────────────────┐
│ ‹ All notes            Saved    [Write|Preview] ⋯│
├───────────────────────────────────────────────┤
│ Study plan                                    │  ← title input, 20/600, borderless
│                                               │
│ ## Week 1                                     │  ← body textarea, grows with content
│ - Linear regression                           │
└───────────────────────────────────────────────┘
```

- One `Section`-style panel. Header row: `‹ All notes` ghost link, a save status in `small`/`text-faint` (`Saving…` → `Saved`, or `Couldn't save · Retry` in `danger`), a `Write | Preview` segmented control, and `⋯` (Delete note; in Obsidian also "Open in Obsidian").
- Title: borderless input on `surface`, page-title size (20/600, 18 on mobile), placeholder "Untitled", max 120 characters. Enter in the title moves focus to the body.
- Body: borderless textarea, body size 14/22 for comfortable reading, auto-grows (min 320px), placeholder "Write in Markdown…". It is the only scroll; no inner scrollbars.
- Preview: rendered markdown in the same panel, styled with the type scale (headings capped at 20/16/14, weight 600/500), links in `green` with underline, code on `surface-2`, blockquotes with a 2px `border` rule, task lists as read-only checkboxes. Raw HTML is sanitized.
- New notes open straight in Write with the title focused.
- Max width of the text column 720px for line length; the panel itself is full width.

## 9. Layouts

### Desktop (≥1024)

- **Dashboard:** header row (wordmark + tagline left, `⋯` menu and `+ New habit` right). Habit cards in a 2-column grid (3 columns ≥1280). Archived habits collapsed under a quiet "Archived (n)" disclosure at the bottom.
- **Dashboard views:** a Grid / List toggle (remembered per browser). *Grid* shows the cards above. *List* shows one collapsible row per habit (name, today's status, 7-day strip, consistency, streak); expanding a row reveals a recent-weeks mini graph, compact stats, a link to the full history, and today's logger. "Expand all / Collapse all" sits next to the toggle. A today summary ("2 of 5 done today") with one segment per due habit sits above both views.
- **Habit page:** back link, previous/next habit arrows and overflow menu row; title block (name, target · schedule, description); one-line stats strip (4 stats, separated by thin dividers, not cards); heatmap panel (full width) titled with the GitHub-style yearly count ("83 days completed in 2026"); below it a full-width "Today" panel whose logger puts the amount and the note side by side on ≥768px.

- **Habit page, notes view:** same header and title block; below it one full-width notes panel (list or editor). On mobile the editor's segmented control and status move under the `‹ All notes` row so nothing wraps awkwardly at 320px.

### Tablet (640–1023)

- Dashboard: 2-column grid. Habit page: single column, heatmap scrolls horizontally within its panel if needed.

### Mobile (<640)

- **Dashboard:** compact sticky header with wordmark and a `+` icon button (44px). Single-column card list. The quick-log button on each card is a 44px target.
- **Habit page:** sticky compact header (back, truncated name, `⋯`). Stats as a 2×2 grid of plain text blocks. Heatmap panel horizontally scrollable *inside the panel only*, auto-scrolled to today on mount. A Year/Month toggle offers a month calendar with 44px day buttons. "Today" logger follows; recent activity last.
- Dialogs become bottom sheets (Vaul). Numeric fields use `inputMode="decimal"` or `"numeric"`.
- Respect `env(safe-area-inset-*)` on sheets and the sticky header.

## 10. Interaction patterns

- **Create habit:** `+ New habit` → dialog/sheet. Fields: name, description (optional), type (Amount / Yes-no), target + unit, repeat (Every day / Weekdays / Weekends / Custom + weekday selector), start date (defaults to today). Enter submits. Invalid fields show inline messages under the field and `aria-invalid`.
- **Log progress (amount):** segmented "Set total | Add". Helper line states the result ("New total: 90 / 120 minutes"). `Save` commits (in Add mode the button says `Add progress`). `Mark complete` sets the total to the target in one tap. "Quick add" chips sized to the unit (+15/+30/+60 min, +0.25/+0.5/+1 h, +1 for small counts) add and save in one tap. `Clear entry` removes the day's log. Note field optional.
- **Undo:** every log, quick add, completion toggle and cleared entry shows a toast with **Undo**, which restores the previous entry exactly. This replaces confirmations for ordinary actions.
- **Keyboard:** `N` opens New habit on the dashboard (ignored while typing or when a dialog is open).
- **Log progress (yes/no):** single toggle button "Mark complete" ↔ "Completed · Undo".
- **Edit history:** click any past or today cell → day sheet with the same logger. Future dates and dates before the start date are read-only.
- **Edit habit:** overflow → Edit. Changing target/unit/schedule creates a new goal version effective today; a hint explains past days keep their original goal.
- **Archive / restore / delete:** archive from the habit page overflow menu (instant, toast with Undo). Restore and delete from the habit page or the Archive page. Delete always requires a confirm dialog that names the habit.
- **Reorder:** drag a card or row by its grip (see Habit card). Dashboard `⋯` → "Reorder habits" still offers move-up/move-down buttons as an alternative; "Done" exits.
- **Color:** the habit dialog has a **Color** row of nine swatches (None + the eight habit colors), 28px circles (36px on touch), a radio group with the color names as labels; the selected one gets a 2px `text` ring.
- **Timer:** see Habit timer (§8).
- **Feedback:** every save shows a short toast; the heatmap, stats, bar and dashboard preview update immediately from shared state.
- **Notes:** `New note` creates an untitled note and opens it. Edits save automatically 600ms after typing stops, on blur, on leaving the note, and on Cmd/Ctrl+S; there is no Save button and no toast for autosave. Deleting a note (row `⋯` or editor `⋯`) is instant with an **Undo** toast, like other ordinary actions. A note that is still empty when you leave it is discarded silently. Deleting a habit also deletes its notes, and the confirm dialog says so.
- **Notes and other devices:** if a note changes elsewhere while it is open and you have no unsaved edits, the editor takes the new text. If you do have unsaved edits, yours win on the next save (last write wins; personal app).
- **No confirmations** for ordinary actions (logging, archiving, editing).

## 11. Accessibility

- Visible focus ring on every interactive element: 2px green ring with 2px offset in `bg`.
- All icon buttons have `aria-label`. Menus and dialogs come from Radix (focus trap, Esc, return focus).
- Heatmap: `role="grid"` with row/gridcell semantics, one tab stop, arrow-key navigation, each cell `aria-label` like "Tuesday, November 24, 2026: 90 of 120 minutes, partial".
- Status is always text + color. Legend has text labels.
- Forms: `<label>` for every field, errors linked via `aria-describedby`, `aria-live="polite"` region for toasts.
- Touch targets ≥44px for primary controls on touch devices (`pointer: coarse`).
- `prefers-reduced-motion` honored globally.

## 12. Responsive breakpoints

| Name | Min width | Notes |
|---|---|---|
| base | 0 | Tested down to 320px |
| `sm` | 640px | Dialog instead of bottom sheet; 2-col dashboard |
| `md` | 768px | Desktop heatmap cell size (11px) |
| `lg` | 1024px | Habit page 2-col bottom grid, 32px gutter |
| `xl` | 1280px | 3-col dashboard |

Touch sizing is driven by `pointer: coarse`, not width, so a touch laptop still gets large targets.

## 13. Rules for consistency

1. Use tokens, never raw hex, in components (heatmap state colors come from `domain/status → tokens`).
2. One surface level per container. If you want a card inside a card, use a divider instead.
3. No new font sizes outside the scale in §5.
4. Every numeric display uses tabular numbers.
5. Every new interactive element gets a focus state, a label, and a touch-size variant.
6. Status colors are derived at render time from logs + goal versions; they are never stored.
7. New screens must be checked at 320, 390, 768 and 1280 widths before merging.
8. Changes to this document are recorded below.

## 14. Where notes are stored

| Version | Storage |
|---|---|
| Browser-only web app | Inside the same localStorage data as habits and logs, and in backup files (`notes` array; files without it still import). |
| Account (API) | `habit_notes` table (id, habit, title ≤120, markdown body ≤100,000 characters, timestamps); included in the snapshot, export and import. |
| Obsidian plugin | Real Markdown files in the vault: `commit/notes/<habit name>/<note title>.md` (the root folder is a setting). The file name is the title and the file content is the body, with no frontmatter added, so the notes behave like any other note: search, links, backlinks, graph and the normal editor all work. Renaming a note renames its file (links update); renaming a habit renames its folder. The habit ↔ folder link is stored on the habit in `habits.json`; if you rename or move the folder inside Obsidian, the plugin follows it. Files edited outside commit. show up immediately. Deleting a note or habit moves files to the trash, following Obsidian's "Deleted files" setting. Backups saved to the vault contain habits and logs only; restoring a web backup that has notes writes them as files. |

## Changelog

- 2026-11-24 — Initial version for the Phase 1 prototype.
- 2026-11-24 — Removed "Recent activity" from the habit page (low value; the heatmap and day sheet cover it). Added dashboard List view with collapsible rows, today summary bar, quick-add chips, Undo toasts, yearly count on the heatmap, previous/next habit navigation and the `N` shortcut.
- 2026-11-24 — Phase 2: added the sign-in screen (wordmark, 4-week heat preview, Sign in / Create account segmented control, single card form, cold-start notice), the "saved only in this browser" banner with Move to account, account email and Sign out in the dashboard ⋯ menu, and account-aware footer and confirm copy. "Prototype data" menu label renamed "Sample data".
- 2026-11-24 — Obsidian plugin: the same screens run inside an Obsidian view. Width breakpoints (`sm`/`md`/`lg`/`xl`) follow the pane's width (container queries) instead of the window, so the app also works in a sidebar. Dialogs, sheets, menus, tooltips and toasts render in a full-window layer. "Download backup" becomes "Save backup to vault", and the footer names the data file in the vault. The sign-in screen and the "saved only in this browser" banner are not part of the plugin.
- 2026-11-24 — Habit notes: a `Notes` toggle on the habit page switches to a Drive-style list of markdown notes per habit (title, snippet, last edited), with an autosaving editor (Write / Preview), Undo on delete, and routes `/habits/:id/notes[/:noteId]`. In Obsidian, notes are real `.md` files in `commit/notes/<habit>/` (§14).
- 2026-11-25 — Time spent: total hours per time-based habit (a second stats row on the habit page: today, this week, this month, total) and across all habits on the dashboard (today, this week, this month).
- 2026-11-25 — Habit timer (flat warm `timer` accent, Stop → add the time to today), Archive page with Restore and Delete (replaces the collapsible archived section), habit colors (eight label colors, shown as a dot), drag-to-reorder by a grip in the card corner, and the amount logger's "Save total" button renamed "Save".
