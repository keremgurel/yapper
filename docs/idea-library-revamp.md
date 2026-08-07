# Idea Bank + Content Library revamp

Status: Phases 1-4 and the hook engine (5a) shipped; item chat (5b) and transcript honesty (6) not yet implemented.
Scope: `src/lib/ideas/*`, `src/lib/content/*`, `src/components/ideas/*`, `src/components/library/*`, `src/app/api/{ideas,content,inspiration,generate}/*`, `src/lib/db/schema.ts`.

## 1. What is actually broken

Evidence from the current code, not vibes.

**1.1 Two stores, joined by a lossy one-way bridge.**
Ideas live in `localStorage` (`src/lib/ideas/store.ts:11`). Library items live in Postgres `content_items` (`src/lib/db/schema.ts:182`). "Send to library" runs `ideaToContentPatch` (`src/lib/ideas/curate.ts:10`), which takes the idea's _adaptive sections_ and flattens them into the fixed columns `hooks / points / example / cta / script`. Bullet sections get concatenated into `points`, step sections into `example`, everything else is dropped.

So the Idea Bank already produces the flexible, per-idea structure you want (`IdeaExpansionSection`, `src/lib/ideas/types.ts:48`) and the handoff destroys it. That single function is the origin of "fields after fields after fields" in the workbench.

**1.2 There is no project context.**
What the app calls content pillars is three strings in the _Inspiration_ localStorage store, defaulting to `Hooks & openers / Storytelling / Educational` (`src/lib/inspiration/store.ts:6`). Those are clip categories, not content pillars. `contentItems.pillar` is free text matched by string comparison (`src/lib/content/capture.ts`, the "snap the pillar back" logic).

Every AI call receives exactly one piece of context: `pillars: string[]`. Confirmed in `buildExpandMessages` (`src/lib/ideas/expand-prompt.ts:16`), `captureIdea`, `brainstorm`. There is no audience, no what-you-make, no voice, no offers, no things-you-never-say. The models are guessing every single time.

**1.3 The reference transcript chain has one point of failure and fails silently.**
For Instagram and TikTok, the only way to reach the media URL is Apify (`resolveInstagramMedia`, `src/lib/inspiration/apify.ts:60`). When Apify is depleted or the actor errors, `resolveInstagramReference` (`src/app/api/inspiration/resolve/route.ts:126`) catches and falls back to `resolveWrittenReference`: a Reader page-text summary with `transcript: null`.

The idea then carries a `summary` instead of a transcript, and `buildExpandMessages` is explicitly told to treat it as "a written resource rather than a video transcript" and not to invent dialogue. That is exactly the degraded output you saw. YouTube is fine because `fetchYoutubeTranscript` uses captions and never touches Apify.

**Billing bug on that path:** `reference_analysis` charges 2 credits up front and refunds on `throw`. The Instagram/TikTok fallback does _not_ throw, it returns a page summary. You are charged 2 credits for a failed transcription.

**1.4 The tables are not tables.**
Library = three columns, title/status/updated, no multiselect, no bulk actions (`src/components/library/content-table.tsx`). Idea Bank = a card list with per-card checkboxes and one bulk action (`src/components/ideas/idea-bank.tsx`). Nothing is shared between them. You cannot see pillars at a glance, filter by more than one axis, or bulk-reclassify.

**1.5 The workbench cannot be talked to.**
`ContentWorkbench` (`src/components/library/content-workbench.tsx`) is four fixed form controls plus a script box. Editing is typing into boxes. There is no chat, no voice, and AI generation is a one-shot overwrite of the whole item.

---

## 2. The model

Five moves. They are ordered so each one is shippable on its own.

### 2.1 The Project Brain

One server-backed context object per user, editable anywhere, injected into every prompt.

New table `projects`:

| column           | type            | what it is                                                  |
| ---------------- | --------------- | ----------------------------------------------------------- |
| `id`             | uuid pk         |                                                             |
| `userId`         | text fk → users |                                                             |
| `name`           | text            | "CELPIP Speaking", "karam.own.chain"                        |
| `whatIMake`      | text            | one paragraph: the account's job                            |
| `audience`       | text            | who watches, what they already know, what they want         |
| `voice`          | text            | tone rules, energy, person, pacing                          |
| `offers`         | text            | product, referral program, lead magnet, the CTAs that exist |
| `doNots`         | text            | words, framings, and claims to never use                    |
| `links`          | jsonb           | socials + product URLs                                      |
| `contextVersion` | integer         | bumped on every write; cache key for the compiled block     |
| `updatedAt`      | timestamptz     |                                                             |

New table `project_pillars`:

| column        | type                        | what it is                                            |
| ------------- | --------------------------- | ----------------------------------------------------- |
| `id`          | uuid pk                     |                                                       |
| `projectId`   | uuid fk → projects, cascade |                                                       |
| `name`        | text                        | "Question walkthroughs", "The grind"                  |
| `description` | text                        | what belongs here and what does not                   |
| `examples`    | jsonb (string[])            | 2-3 example angles, so the model has a shape to match |
| `sortOrder`   | integer                     |                                                       |

Single project per user for now. `getActiveProject(userId)` returns the user's project, creating a blank one on first access. No switcher UI is built, but `projectId` is on every row from day one, so adding account switching later is a UI change and not a data migration.

Onboarding already collects socials and pillar names into Clerk `unsafeMetadata` (`src/hooks/use-studio-onboarding.ts`). That becomes the seed for the project row on first load; `usePillarNames` and `loadPillars` are retired.

**Where it is edited:** one `ProjectBrainSheet` slide-over, opened from a persistent "Project" button in the Studio header, so it is reachable from Idea Bank, Content Library, and the workbench. Inside, each field is a plain textarea with an example placeholder, plus a pillar editor (add/rename/describe/reorder). No wizard, no multi-step form.

### 2.2 One table, two views

Ideas stop being a separate concept. An idea _is_ a content item at `stage = 'bank'`.

Add to `content_items`:

- `projectId uuid` fk → projects
- `stage text` enum `'bank' | 'library'`, default `'bank'`, with a DB check
- `pillarId uuid` fk → project_pillars (keep the existing `pillar text` column, read-through only, for legacy rows)

"Send to library" becomes `UPDATE content_items SET stage='library'`. Nothing is transformed, nothing is lost. `src/lib/ideas/curate.ts` is deleted.

Both surfaces render the same `ItemTable` component with a shared column set and shared bulk-action bar:

| column                                        | Idea Bank             | Library               |
| --------------------------------------------- | --------------------- | --------------------- |
| select checkbox                               | yes                   | yes                   |
| Title + source chip                           | yes                   | yes                   |
| Pillar                                        | yes (inline editable) | yes (inline editable) |
| Type (original / semi-original / inspiration) | yes                   | hidden by default     |
| Transcript status                             | yes                   | hidden by default     |
| Status (drafted → posted)                     | hidden                | yes                   |
| Script (has one / doesn't)                    | hidden                | yes                   |
| Updated                                       | yes                   | yes                   |

Bulk actions on both: **set pillar**, **send to library** (bank only) / **send back to bank**, **set status** (library only), **delete**. Filters on both: pillar, type, search. The difference between the two pages is the default filter (`stage`) and which columns are on. One component, one sort module (`src/lib/content/sort.ts` extended), one selection hook (`use-id-selection.ts` already exists).

**Capture stays instant.** The composer writes an optimistic row locally and POSTs in the background, exactly like today's flow where the card appears before the expansion returns. A small outbox retries failed writes so a dropped connection never eats a captured thought.

### 2.3 A body that is not a template

Replace the fixed columns with a flexible body, keeping the two things you said always matter.

Add to `content_items`:

- `blocks jsonb`: `{ id, label, kind: 'paragraph'|'bullets'|'steps'|'script', text?, items? }[]`. Same shape as today's `IdeaExpansionSection`, now persisted end to end.
- `hooks jsonb` upgraded from `string[]` to `{ text, pattern, why }[]` (see 2.4). A normalizer reads legacy plain strings as `{ text, pattern: null, why: null }`.
- `script text`: unchanged, but promoted to a first-class always-present surface.
- `format text`, `summary text`: the model's read on the creative form and the adaptation angle.
- `originalNote text`: **your exact words, verbatim, immutable.** This exists today only client-side (`Idea.originalTranscript`) and must not be lost in the move to Postgres.
- `sourceTranscript text`, `sourceSummary text`, `sourceReferenceType text`, `sourcePlatform text`, `transcriptStatus text`.

`points`, `example`, `cta` stay in the schema as nullable, are read-through by a single `normalizeItem()` function so old rows still render, are never written again, and are dropped in a later migration once no row depends on them.

The detail view becomes, top to bottom: title → source card (link, transcript status, verbatim transcript, collapsible) → **your exact words** (read-only, never regenerated) → **hook variations** → **full script** → adaptive blocks → pipeline controls. Three fixed things you always want, then whatever this particular idea needs.

### 2.4 The hook engine

A versioned pattern library in source: `src/lib/content/hook-patterns.ts`. Each entry is `{ id, name, mechanism, whenToUse, shape, example }` covering the archetypes that actually work in short form: contrarian claim, negation ("stop doing X"), stakes-first, false-start / mid-action cold open, specific-number proof, POV framing, named-enemy, curiosity gap with a concrete payoff, credential-flash, direct-address callout.

The hook prompt gets the pattern list plus the project brain. Each generated hook comes back tagged: `{ text, pattern, why }`. The UI shows the pattern name as a chip and the reasoning on hover, so you can tell _why_ a hook should work instead of picking blind. Roughly 200 tokens of pattern library, injected only in hook generation, not in every call.

This also makes hooks regenerable per-pattern: "give me three more, all stakes-first."

### 2.5 Chat with any item

New table `content_messages`: `id`, `contentItemId` (fk, cascade), `userId`, `role`, `content`, `patch jsonb`, `createdAt`.

New route `POST /api/content/[id]/chat`. The model sees: project brain, the item (verbatim note, source transcript, hooks, script, blocks), and the last N turns. It returns a reply **plus an optional structured patch** describing what to change. The UI applies the patch through the existing autosave path and shows an undo chip on the affected field.

Same component works on a bank idea and a library item. Voice in is the mic button from `use-voice-capture.ts`, already built. This is the "chat with my ideas" surface, and it replaces the current one-shot "Generate with AI" overwrite in the workbench.

The existing `/api/content/brainstorm` route collapses into this; it is the same thing scoped to a reference clip.

---

## 3. Prompt architecture and token cost

Your concern about blowing up token consumption is the right one. The design:

**A compiled context block, built once, cached, and placed first.**
`src/lib/content/project-context.ts` exports a pure `buildProjectContext(project, pillars, opts)` returning a compact block, hard-capped (default ~400 tokens) with per-field truncation so one rambling field cannot starve the rest:

```
PROJECT: CELPIP Speaking
Makes: short-form video for people preparing for the CELPIP exam...
Audience: test-takers 20-40, mostly newcomers to Canada, anxious about speaking...
Voice: direct, warm, zero corporate filler, second person, fast cold opens
Offers: the practice app (free tier), referral program
Never: "unlock your potential", guaranteed-score claims
PILLARS:
- Question walkthroughs: one real task, answered live. e.g. "Task 5 in 60 seconds"
- Funny/relatable: exam anxiety played for laughs, never mocking the test-taker
- Direct education: one rule, one example, one drill
- Referral announcements: short, concrete, no hype
```

Cost control:

1. It is **compiled once per `contextVersion`** and memoized, not rebuilt per request.
2. It is **appended to the end of the system prompt**, after the fixed instructions, and is byte-identical across calls, so provider prompt caching keeps it nearly free on repeat requests. (This reverses the original draft of this plan, which put the block first. Both orderings are stable for one creator and so cache equally across that creator's repeated calls, but instructions-first additionally makes the leading prefix identical for _every_ user, so it can cache across creators too. Strictly better, same token count.)
3. It is **tiered**: capture and classification get pillars only (~120 tokens); expansion, hooks, script, and chat get the full block (~400 tokens).
4. Pillar descriptions and examples are truncated per pillar, so 12 pillars cannot balloon the block.

400 tokens against an expansion call already sending a full reference transcript (up to 4000 chars) is a rounding error. This is a cheap change, not an expensive one.

**Prompting stays deliberately non-deterministic where it should be.** No new fixed template. The expansion prompt keeps its current "choose 2-6 sections that fit THIS reference" instruction (`src/lib/ideas/expand-prompt.ts:42`), which is already right, and gains the project brain plus one instruction: say _why this could work for this specific audience_. Ideation should vary. Structure should not be forced.

---

## 4. Reference transcripts: keep Apify, stop lying about failures

**Decision: Apify stays as the media-URL resolver.** It was evaluated against yt-dlp and won on the only axis that matters, access.

For the record, so this is not relitigated later. Apify does not transcribe anything; Deepgram does. Apify resolves the CDN media URL, which is the hard part, because Instagram will not hand media URLs to anonymous requests. Tested directly (2026-08-06, yt-dlp 2026.03.17, from a residential IP):

| Platform  | yt-dlp result                                                        |
| --------- | -------------------------------------------------------------------- |
| YouTube   | works, direct audio-only URL in one call                             |
| TikTok    | fails, needs `curl_cffi` impersonation, a native dependency          |
| Instagram | fails, `Instagram API is not granting access`, needs browser cookies |

Server-side this gets worse, not better: Vercel functions call from datacenter IPs, which Instagram reputation-scores out within a handful of requests. What Apify actually sells is a residential/mobile proxy pool plus extractors somebody else repairs every time Meta ships a change. Rebuilding that in-house is a maintenance treadmill for a cost that is not currently material.

So the chain keeps its current resolvers and fixes only the failure behavior:

```
YouTube      captions → Deepgram
Instagram    Apify media → Deepgram
             ↓ fail
             transcriptStatus = 'needs_media'  (user attaches, we transcribe)
TikTok       same shape as Instagram
Web/article  Reader summary, referenceType = 'article'   (correct, not a fallback)
```

The change is that a failed resolve now **stops** and says so, instead of silently sliding into `resolveWrittenReference` and handing the expansion prompt a page summary labelled as a written resource.

`transcriptStatus` on the item: `'ready' | 'pending' | 'needs_media' | 'unavailable'`. The idea card shows it plainly with a retry button, instead of quietly pretending a Reel was an article.

**The always-works escape hatch:** when automated resolution cannot reach the media, the idea shows "Attach the video": drop the file, or paste a transcript. Attached media goes through the ASR we already own (`/api/transcribe`, Deepgram nova-3 with Groq whisper-large-v3 failover, `src/app/api/transcribe/route.ts`). You are right that we have the capability; today nothing wires the user's own file into the reference slot.

**Billing correctness:** `reference_analysis` must only be charged when a transcript is actually delivered. Either reserve after the resolution succeeds, or refund on the page-summary fallback path the same way the throw path does. That is a bug fix regardless of the rest of this plan.

Charging credits for transcripts is fine and stays: it fits the trial → subscription-with-monthly-credits → top-ups model. The fix is that a _failed_ transcription must not bill.

---

## 5. Migration

1. **Additive schema first.** New tables and new nullable columns. Old columns keep working. No destructive step in the same deploy.
2. **Project seed.** On first Studio load after the deploy, create the project row from Clerk onboarding metadata (socials, pillar names). Fields the user never filled stay empty and the Brain sheet shows a soft prompt to fill them, since the AI quality gain is the incentive.
3. **Pillar reconciliation.** Existing `content_items.pillar` free-text values seed the new `project_pillars` rows case-insensitively (`seedPillarsIfEmpty`), so no name is dropped. Rows themselves are **not** back-linked by `pillarId`: `listContentItems` left-joins the pillar and returns `coalesce(pillar.name, contentItems.pillar)`, so a legacy row reads correctly with no backfill, and the link wins as soon as the item is reclassified. Writing a `pillarId` clears the free text, so a stale name can never outlive the reclassify that replaced it.

   Both write paths (`PATCH /api/content/[id]` and the bulk bar) validate the id against the caller's own project via `resolveOwnPillar`. The FK proves the pillar exists, not whose it is; without the check a guessed uuid would file an item under another creator's pillar and read that pillar's name back out of the list.

4. **localStorage idea import.** One-time, dedupe by the existing `sourceClientId` unique index (`content_items_import_unique`), which already exists for exactly this purpose. Ideas land at `stage='bank'`, carrying `originalNote`, source, transcript, and their adaptive sections into `blocks` with nothing flattened. `src/lib/ideas/store.ts` becomes the importer, then is deleted.
5. **Legacy body read-through.** `normalizeItem()` maps old `points`/`example`/`cta` into blocks at read time. Nothing is rewritten in place.
6. **Cleanup migration, later.** Drop `points`, `example`, `cta`, and `pillar` once telemetry says no row is falling back to them.

---

## 6. Phases

Each phase is independently shippable and leaves the app working.

**Phase 1: Project Brain.** _(shipped)_ `projects` + `project_pillars` tables, `getActiveProject`, the Brain sheet reachable from both surfaces, onboarding seed, pillar reconciliation. Wire `buildProjectContext` into the four existing prompts (expand, capture, brainstorm, script). Immediate quality win with no UI upheaval.

**Phase 2: Unify the store.** _(shipped)_ `projectId` + `stage` on `content_items`, the localStorage importer, ideas served from Postgres. Delete `curate.ts`. Idea Bank and Library still look the same at this point; only the plumbing changed.

**Phase 3: One table.** _(shipped)_ The shared `ItemTable`, columns, filters, multiselect, bulk actions on both surfaces. This is the phase you feel most.

One seam surfaced after the fact and is fixed: the table rendered the legacy free-text `pillar` while the bulk bar wrote `pillarId`, so reclassifying appeared to do nothing. The read is now a coalesce over both, the workbench picks a pillar by id like the bulk bar does, and both writers check ownership. `usePillarNames` (the localStorage reader the plan retires) is now used only by `clip-chat.tsx` on the Inspiration surface; it goes when that surface moves onto the project brain.

**Phase 4: Flexible body UI.** _(shipped)_ The schema landed early in Phase 2, because importing localStorage ideas losslessly required `blocks`, `originalNote` and the source-transcript columns to exist first: otherwise the very migration meant to stop data loss would have caused it. What remained, and is now done, is the detail-view rebuild.

The workbench is a composition root over `src/components/workbench/*`, ordered source → your exact words → hooks → script → adaptive blocks → pipeline. Blocks are editable: rename a section, change its kind, reorder it, delete it. Changing kind carries content across the prose/list divide instead of dropping it, so exploring a shape is non-destructive (`src/lib/content/block-edits.ts`).

Deleting the four fixed controls meant retiring everything that fed them, or generation would have written to fields nothing renders:

- `/api/generate/idea` returns adaptive `sections` instead of `points`/`example`/`cta`, parsed through the same `parseSections` the reference expansion uses.
- `/api/generate/script` reads the item's blocks and the creator's verbatim note rather than the fixed columns.
- Capture and the Inspiration seed write blocks (`capturedIdeaToBlocks`, `seedBlocks`).
- The teleprompter's notes view builds from blocks. It skips section labels (the one line you must not read aloud by accident) and `script` blocks (that is the other view).
- `parseContentInput` no longer parses `points`/`example`/`cta` at all. They stay on old rows and are folded into blocks by `normalizeBody` on read; accepting a write would let a legacy column come back and shadow the block it became.

**Phase 4 (original wording): Flexible body.** `blocks`, `hooks` as objects, `originalNote`, `format`, `summary`, the `normalizeItem` read-through. Rebuild the detail view: verbatim words → hooks → script → adaptive blocks. Delete the four fixed form controls.

**Phase 5a: The hook engine.** _(shipped)_ `src/lib/content/hook-patterns.ts` holds the ten archetypes as data. `/api/generate/hooks` returns `{text, pattern, why}` per hook, charge-on-success at 1 credit, with `patternId` narrowing every hook to one archetype so "three more, all stakes-first" is a first-class request rather than a reroll. Generated hooks append rather than replace, so a fresh batch never discards the line the creator was weighing up. The chip shows the pattern name and the reasoning on hover.

Two corrections to the plan, both from building it:

- The library costs about **390 tokens**, not the ~200 in §2.4. Only `mechanism` and `example` go into the prompt (`whenToUse` and `shape` are for the UI picker, and the example already demonstrates the shape); sending all four fields was ~680. A narrowed request is ~40 tokens, so per-pattern regeneration really is the cheaper call rather than a filter over a generic one. A test pins the bound so adding a pattern is a deliberate trade.
- An unrecognised `pattern` from the model is stored as `null`, not kept. A chip is only worth showing if it names a mechanism the creator can look up. When one pattern was requested, that id wins over whatever the model labelled the line, because it was told to write only that.

**Phase 5b: Chat with any item.** _(not started)_ `content_messages`, `/api/content/[id]/chat` with structured patches and undo, voice input. Fold `brainstorm` into it.

**Phase 6: Transcript honesty.** Apify stays. Stop the silent downgrade to a page summary, surface `transcriptStatus` in the UI with a retry, add the attach-media escape hatch, and fix the billing so a failed resolve does not charge 2 credits. The billing fix can be pulled forward at any time; it is small and independent of everything else here.

---

## 7. Open questions

- **Instagram's own auto-captions.** Many Reels already carry auto-generated captions. Checking for them before calling Apify would be free and instant when it hits. One request to find out, not scheduled, worth a spike if Apify spend ever becomes material.
- **Chat credit cost.** A chat turn is cheap but unbounded in frequency. Likely 1 credit per turn with a soft daily allowance, decided against the monthly-allotment sizing.
- **Blocks editing model.** Whether blocks are directly editable inline, chat-only, or both. Both is right long-term; inline editing of arbitrary block kinds is meaningful UI work and could land after Phase 5.
