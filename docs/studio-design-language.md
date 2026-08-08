# Studio design language

The contract for every Studio work surface (Home, Idea Bank, Content Library,
workbench). Three agents build against this in parallel; where this doc and a
personal instinct disagree, this doc wins. The workbench redesign
(`src/components/workbench/*`, `src/components/library/script-section.tsx`) is
the reference implementation: match it, do not contradict it.

The shared primitives live in `src/components/studio-ui/`. Use them instead of
inventing per-surface variants. Import from the barrel:

```ts
import {
  Chip,
  StatBlock,
  EmptyState,
  PageHeader,
  Toolbar,
  Section,
} from "@/components/studio-ui";
```

## 1. Voice: this is a tool, not a landing page

Studio surfaces are rooms the creator works in every day. They do not
re-introduce themselves. No accent-colored eyebrow ("HOME"), no clamp-sized
marketing headline, no sales-copy subtitles. A page states its name at working
size and gets out of the way.

## 2. Type

**One family. Hanken Grotesk for everything, Geist Mono for numerals.**
A second display family is explicitly ruled out: the app already reads as one
voice, the workbench was rebuilt on Hanken alone, and a new font would force a
re-audit of every surface. Contrast comes from size, weight, case and tracking.
`--sg-font-mono` (Geist Mono) is reserved for tabular numerals: stat values,
durations, counts, timecodes. Never for prose or labels.

The scale (exact classes, use these strings):

| Role                                   | Classes                                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page title                             | `font-display text-[22px] font-bold tracking-[-0.01em] text-foreground`                                                                               |
| Page description                       | `text-sm text-muted-foreground max-w-[60ch]`                                                                                                          |
| Section lead                           | `font-display text-[13px] font-black uppercase tracking-[0.14em] text-foreground` + hairline (`border-b border-border/70 pb-1.5`) spanning the column |
| Section quiet                          | `text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground`                                                                              |
| Body / content                         | `text-[15px] leading-relaxed`                                                                                                                         |
| Hero prose (script, teleprompter text) | `text-[17px] leading-[1.75] max-w-[68ch]`                                                                                                             |
| Table title cell                       | `text-sm font-medium text-foreground`                                                                                                                 |
| Table cell                             | `text-[13px]`                                                                                                                                         |
| Table header                           | `text-xs font-semibold text-muted-foreground`                                                                                                         |
| Meta (timestamps, counts, helper text) | `text-xs text-muted-foreground`                                                                                                                       |
| Stat value                             | `font-mono text-[26px] font-semibold tabular-nums tracking-[-0.01em]`                                                                                 |
| Chip                                   | `text-[11px] font-semibold`                                                                                                                           |

Section lead and section quiet are already implemented as
`<Section rank="lead" />` and `<Section rank="quiet" />` in
`src/components/workbench/section.tsx` (re-exported from `studio-ui`). Use it;
do not hand-roll section headers.

Hard rules:

- **Weight is rationed.** `font-black` (900) is legal only on uppercase labels
  of 13px or smaller (the Section lead treatment). Titles are `font-bold`,
  running text is `font-normal` to `font-semibold`. Today Home has 900 on
  metric labels, metric values, card titles, video titles and list items at
  once; when everything is black, nothing is.
- **Floor is 11px**, and 11px is only for chips and quiet labels. `text-[10px]`
  is banned everywhere.
- **Reading measure**: any multi-line prose (scripts, notes, descriptions) is
  capped at `max-w-[68ch]`. Never let a textarea or paragraph run the full
  width of a wide column.
- At most **one uppercase label per group** of content. Never stack an
  uppercase micro-label above every control in a rail; use the inline
  `RailRow` pattern (`src/components/workbench/rail-row.tsx`).

## 3. Depth and surfaces

Three levels, and only three:

- **Level 0, the page**: `--sg-bg` (`bg-background`). Most content sits
  directly on it. Sections are separated by whitespace and Section headers,
  not by wrapping everything in cards.
- **Level 1, the card**: `bg-card border border-border rounded-xl`. Opaque.
  For things that are genuinely one object: the shared item table, the shoot
  rail, a board card, the stat band.
- **Level -1, the well**: `bg-muted` (`--sg-surface-sunken`), **no border**.
  For table headers, input wells, kanban column backgrounds, icon circles in
  empty states.

Rules:

- **One border per branch.** Nothing with a border may sit inside something
  else with a border. Inside a card, group with `divide-y divide-border/60`
  hairlines or a sunken well, exactly as `shoot-rail.tsx` does. The old Home
  channel cards (bordered card, inside a bordered section, containing a
  bordered icon tile and a bordered divider grid) are the anti-pattern.
- **Opaque fills only.** `bg-card/35`, `bg-card/55`, `bg-background/45` and
  friends are banned; translucent washes produce four accidental greys per
  screen and break in one of the two themes. Use the tokens as shipped.
- `sg-glass` is reserved for floating overlays that sit above content: the
  idea composer and the bulk-select bar keep it. Nothing in normal page flow
  gets glass.
- Shadows: `shadow-card` on floating/overlay elements only. Cards in page flow
  rely on their border.
- Everything must work with the `.dark` block in `src/app/globals.css`. Never
  hard-code a hex; use tokens or the chip tone system below.

## 4. Spacing rhythm

4px base. Allowed gaps: **4, 8, 12, 16, 24, 32** (`gap-1/2/3/4/6/8`).

- Between page sections: `space-y-8`.
- PageHeader to content: `mb-6` (built into the primitive).
- Card padding: `p-4`; `p-5` only for a hero surface (the script card).
- Toolbar to table: `mb-3` (built into the primitive).
- Inside-group element gaps: `gap-2` or `gap-3`.
- Table rows: `min-h-10` (40px), `px-4`, vertical centering. Dense like
  Notion, not airy like a marketing card grid.

## 5. Color semantics

Orange stops being the only color. Meanings are fixed per hue; hue identifies
the value, **shape identifies the system**, so a row with three colored things
still scans.

| Hue (tokens)           | Means                                   | Used for                                                                                                                                                    |
| ---------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orange `--sg-accent`   | **Action and selection. Nothing else.** | The one primary button per view, selected checkboxes, active tab underline, focus rings. Never categorical data, never label color, never decorative icons. |
| Cyan `--sg-cyan-*`     | In progress / informational             | Status: Planned. Format: Short-form.                                                                                                                        |
| Yellow `--sg-yellow-*` | Waiting / caution                       | Status: Scheduled. Degraded reference states ("Summary only", "No transcript"). Format: Thread.                                                             |
| Green `--sg-green-*`   | Done / healthy                          | Status: Posted. Connected channels. Format: Carousel.                                                                                                       |
| Violet `--sg-violet-*` | AI provenance                           | Anything the AI wrote or is writing (generated-script marker, Chirpy). Format: Long-form.                                                                   |
| Pink `--sg-pink-*`     | No standalone meaning                   | Pillar palette and Format: Article only.                                                                                                                    |
| Neutral (ink ramp)     | Default / inactive                      | Status: Drafted. Format: Newsletter. Idea type. Everything else.                                                                                            |

The three chip systems (all rendered by `Chip` from `studio-ui`):

- **Status** chips: `variant="tint"` + `pill` (fully rounded). Tones come from
  `statusTone()` in `studio-ui`: drafted=neutral, planned=cyan,
  scheduled=yellow, posted=green. `status-select.tsx` migrates its ad-hoc
  Tailwind `cyan/amber/emerald` classes to this.
- **Format** chips: `variant="tint"`, square-ish (`rounded-md`, the default).
  Tones come from `formatTone()` in `studio-ui`. This **replaces** the `chip`
  class strings in `src/lib/content/formats.ts`: that palette (raw Tailwind
  blue/amber/rose/teal/slate) is off-system and its amber/rose read as the
  orange accent at 11px. Wave 2: point `format-chips.tsx` at
  `Chip` + `formatTone()` and delete the `chip` field from `formats.ts`.
- **Pillar** chips: `variant="dot"` (neutral chip, colored 6px dot). Pillars
  have no stored color, so the tone is derived deterministically from the
  pillar name via `pillarTone()` in `studio-ui`; the same pillar is the same
  color on every surface. The dot variant keeps five arbitrary pillar hues
  from visually colliding with the status/format tint chips beside them.

Categorical data that stays plain muted text, not chips: idea type
(Original / Semi-original / Inspiration) and healthy transcript states. Only
problems get color (yellow).

## 6. Density and reading measure

- Shared item table: 40px rows, `px-4`, title at `text-sm font-medium`, other
  cells `text-[13px]`, header row on a sunken well (`bg-muted`, no extra
  border weight).
- Board cards: `p-3`, title `text-[13px] font-semibold`, two lines max.
- Stat band: one Level-1 card containing `StatBlock`s separated by
  `divide-x divide-border` (not one bordered box per stat).
- Prose: `max-w-[68ch]`. Page descriptions: `max-w-[60ch]`.

## 7. Empty states

One pattern, the `EmptyState` primitive, everywhere: a 40px sunken icon
circle, a title (`text-sm font-semibold`), one supporting line
(`text-[13px] text-muted-foreground`, max 36ch), and at most one action.
Sits directly on the page or inside the surface it belongs to.

- No dashed borders. No lonely single-line "Nothing here." floating in
  whitespace.
- The empty state names the next action, not the absence: "Capture your first
  idea above", not "No data".
- Loading is not an empty state: use skeletons (`item-table-skeleton.tsx`,
  `StatBlock` with `value={null}`) so the page keeps its shape.

## 8. Motion

CSS-first, restrained, always behind `prefers-reduced-motion`.

- Durations and easing from tokens only: `--sg-dur-fast` (140ms) for
  hover/color/opacity, `--sg-dur-base` (240ms) for reveals and slides, with
  `--sg-ease-out`.
- Animate `opacity`, `transform` and colors. Never `width`/`height`/layout.
- Allowed: hover background/border color on rows and cards, chevron rotation,
  the bulk bar sliding in (`animate-in slide-in-from-bottom`), fade-in of
  freshly loaded content, `t-shimmer` on loading text.
- Banned in Studio: hover scale/lift on rows and cards (`t-lift` is for
  marketing pages), infinite ambient animation, staggered entrances on
  dashboards, spring bounces on layout.

## 9. Controls

- **One accent-filled primary action per view.** Everything else is
  `variant="outline"` or `ghost`. (The workbench already did this: Record is
  primary, Generate is outline.)
- Secondary controls appear on hover/focus-within of their group when they
  would otherwise be a field of 20+ always-visible buttons (see
  `block-editor.tsx`).
- Icon-only buttons always carry `aria-label`. Focus states are
  `focus-visible` rings in `--sg-accent`. Real semantic elements: `button`,
  `a`, `table`-like grids keep their keyboard behavior.

## 10. Do-not list

The specific things that made it look bad. All banned:

1. `font-black` on anything except ≤13px uppercase labels.
2. `text-[10px]` anywhere.
3. Translucent surface washes (`bg-card/35`, `bg-background/45`, ...).
4. A border inside a border.
5. Orange for anything that is not action/selection; two accent-filled
   buttons visible at once.
6. Accent-colored uppercase eyebrows and marketing-sized (`text-3xl`+)
   headlines on work surfaces.
7. Identical uppercase micro-labels repeated down a page or stacked above
   every control.
8. Full-width textareas for prose; any reading line over 68ch.
9. Dashed-border or single-dead-line empty states.
10. Per-surface ad-hoc chip palettes (raw Tailwind color classes); all chips
    go through `Chip` + a tone.
11. Decorative icons in section headers (a sparkle next to "Five for today"
    adds nothing; the label carries the meaning).
12. Em dashes in any copy.

## 11. Primitive inventory (`src/components/studio-ui/`)

| Primitive                 | Props                                                          | Use                                                                                         |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Chip`                    | `tone, variant?: "tint" \| "dot", pill?, className?, children` | Every colored label: status, format, pillar.                                                |
| `ChipTone` / `CHIP_TONES` | type + class map                                               | Tone vocabulary; tones auto-theme via `color-mix` with `--sg-text`.                         |
| `statusTone(status)`      | `ContentStatus -> ChipTone`                                    | Status chip color.                                                                          |
| `formatTone(id)`          | format id `-> ChipTone`                                        | Format chip color; replaces `formats.ts` `chip` strings.                                    |
| `pillarTone(name)`        | pillar name `-> ChipTone`                                      | Stable pillar color, hashed from the name.                                                  |
| `StatBlock`               | `label, value (string \| null), detail?`                       | Home stat band; `null` renders a skeleton. Compose several inside one card with `divide-x`. |
| `EmptyState`              | `icon?, title, description?, action?`                          | Every empty surface.                                                                        |
| `PageHeader`              | `title, description?, actions?`                                | The one page-title treatment.                                                               |
| `Toolbar`                 | `children, end?`                                               | Filter/view-control row above a table or board.                                             |
| `Section`                 | re-export of `workbench/section.tsx`                           | In-page section headers, lead or quiet.                                                     |
| `RailRow`                 | re-export of `workbench/rail-row.tsx`                          | Inline label/value rows in side rails.                                                      |
