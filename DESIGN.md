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

### Heatmap states

| State | Hex | When |
|---|---|---|
| Empty | `#25282D` | Future, unscheduled (rest), before start, or today not yet logged |
| Missed | `#DA8B36` | Past scheduled day with 0 recorded |
| Partial | `#397C46` | 0 < progress < target |
| Done | `#2DA44E` | progress = target |
| Exceeded | `#116329` | progress > target |

Today's cell always gets a 1px `text-muted` inset ring so it can be found at a glance.

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

### Activity heatmap

- Columns are weeks starting Sunday; rows Sun→Sat. Labels on the left show Mon/Wed/Fri only.
- Month label sits above the first week column containing the 1st of that month (GitHub rule); labels that would collide (<3 columns apart) are dropped.
- Cells outside the selected year are not rendered (transparent placeholders keep alignment).
- Legend below, right-aligned: labeled swatches "Missed / Partial / Done / Exceeded" plus "No goal" (empty).
- Header: year switcher (`‹ 2026 ›`), Year/Month toggle.
- Desktop hover → floating tooltip (one shared element, not one per cell). Click / Enter → day sheet.
- Keyboard: the grid is one tab stop (roving tabindex). Arrow keys move ±1 day / ±1 week, Home/End jump to week edge, Enter/Space opens the day.

## 9. Layouts

### Desktop (≥1024)

- **Dashboard:** header row (wordmark + tagline left, `⋯` menu and `+ New habit` right). Habit cards in a 2-column grid (3 columns ≥1280). Archived habits collapsed under a quiet "Archived (n)" disclosure at the bottom.
- **Dashboard views:** a Grid / List toggle (remembered per browser). *Grid* shows the cards above. *List* shows one collapsible row per habit (name, today's status, 7-day strip, consistency, streak); expanding a row reveals a recent-weeks mini graph, compact stats, a link to the full history, and today's logger. "Expand all / Collapse all" sits next to the toggle. A today summary ("2 of 5 done today") with one segment per due habit sits above both views.
- **Habit page:** back link, previous/next habit arrows and overflow menu row; title block (name, target · schedule, description); one-line stats strip (4 stats, separated by thin dividers, not cards); heatmap panel (full width) titled with the GitHub-style yearly count ("83 days completed in 2026"); below it a full-width "Today" panel whose logger puts the amount and the note side by side on ≥768px.

### Tablet (640–1023)

- Dashboard: 2-column grid. Habit page: single column, heatmap scrolls horizontally within its panel if needed.

### Mobile (<640)

- **Dashboard:** compact sticky header with wordmark and a `+` icon button (44px). Single-column card list. The quick-log button on each card is a 44px target.
- **Habit page:** sticky compact header (back, truncated name, `⋯`). Stats as a 2×2 grid of plain text blocks. Heatmap panel horizontally scrollable *inside the panel only*, auto-scrolled to today on mount. A Year/Month toggle offers a month calendar with 44px day buttons. "Today" logger follows; recent activity last.
- Dialogs become bottom sheets (Vaul). Numeric fields use `inputMode="decimal"` or `"numeric"`.
- Respect `env(safe-area-inset-*)` on sheets and the sticky header.

## 10. Interaction patterns

- **Create habit:** `+ New habit` → dialog/sheet. Fields: name, description (optional), type (Amount / Yes-no), target + unit, repeat (Every day / Weekdays / Weekends / Custom + weekday selector), start date (defaults to today). Enter submits. Invalid fields show inline messages under the field and `aria-invalid`.
- **Log progress (amount):** segmented "Set total | Add". Helper line states the result ("New total: 90 / 120 minutes"). `Save` commits. `Mark complete` sets the total to the target in one tap. "Quick add" chips sized to the unit (+15/+30/+60 min, +0.25/+0.5/+1 h, +1 for small counts) add and save in one tap. `Clear entry` removes the day's log. Note field optional.
- **Undo:** every log, quick add, completion toggle and cleared entry shows a toast with **Undo**, which restores the previous entry exactly. This replaces confirmations for ordinary actions.
- **Keyboard:** `N` opens New habit on the dashboard (ignored while typing or when a dialog is open).
- **Log progress (yes/no):** single toggle button "Mark complete" ↔ "Completed · Undo".
- **Edit history:** click any past or today cell → day sheet with the same logger. Future dates and dates before the start date are read-only.
- **Edit habit:** overflow → Edit. Changing target/unit/schedule creates a new goal version effective today; a hint explains past days keep their original goal.
- **Archive / restore / delete:** only in the habit page overflow menu. Archive is instant (toast with Undo). Delete requires a confirm dialog that names the habit.
- **Reorder:** dashboard `⋯` → "Reorder habits" toggles move-up/move-down buttons on cards; "Done" exits. No drag-and-drop in Phase 1.
- **Feedback:** every save shows a short toast; the heatmap, stats, bar and dashboard preview update immediately from shared state.
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

## Changelog

- 2026-11-24 — Initial version for the Phase 1 prototype.
- 2026-11-24 — Removed "Recent activity" from the habit page (low value; the heatmap and day sheet cover it). Added dashboard List view with collapsible rows, today summary bar, quick-add chips, Undo toasts, yearly count on the heatmap, previous/next habit navigation and the `N` shortcut.
