# Yapper: App vs Website, and the Ideas Engine

Status: direction locked 2026-07-28. Companion to `desktop-app-architecture.md`
(the how) — this is the _what_ and _why_.

## 1. The split: app = tool, website = marketing/SEO

The desktop app and the website stop being the same thing.

- **Desktop app** = the entire product/tooling. Its only job is to make it **as clear
  as possible how to use the tools**. No marketing, no SEO chrome. It should read like
  CapCut's app or the ChatGPT/Codex app — a clean app home, not a site in a window.
- **Website (`ypr.app`)** = pure marketing + SEO. We **remove all functionality** from it.
  - Landing page = a marketing page like CapCut's: hero + a **Download CTA**, nothing more.
  - Keep the **SEO lead-magnet tools** (free topic generator, etc.) that pull in organic
    search traffic → funnel those visitors to the app download.

Implication: the Studio dashboard (all nine sidebar surfaces) migrates to being _the app_.
The web keeps only marketing pages + the free standalone SEO tools.

### First de-website step (done)

The app was rendering the marketing site navbar (`TrainingHeader`) inside the Studio
shell — the main reason it "looked like a website." Now gated behind `[data-app]`
(set only in the Tauri shell): the marketing navbar is hidden and its height reservation
collapses. Web is untouched. Full app-home redesign is the next build (below).

## 2. App shell direction (next build)

Reference feel: CapCut app home + ChatGPT/Codex app. Clean, native, obvious.

- Native window: transparent + macOS vibrancy + inset traffic lights (already wired).
- App home (replaces the web dashboard landing): a clear "what do you want to do" surface
  — Record, Editor, Ideas, Poster — plus recent projects, in an app layout (not the
  marketing-derived shell). Translucent surfaces so the native glass shows through.
- Sidebar stays as the nav spine (Ideas, Content Library, Recorder, Editor, Poster,
  Calendar, Automations, Dictionary, Connections) but styled as app chrome, not web nav.

## 3. The Ideas Engine (rename + upgrade "Inspiration")

**Rename "Inspiration" → "Ideas."** It now holds three types, all auto-categorized and
auto-expanded. We evolve the existing `lib/inspiration` model (`InspirationItem`,
`content/capture.ts`, `lib/generate/idea.ts`) rather than start over.

### The three idea types

| Type                   | Input                                                                            | Example                                                          |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Original idea**      | A voice note (or typed note) of something you want to shoot — no external source | "I want to make a video about why filler words kill authority"   |
| **Semi-original idea** | An inspiration link **+ your added context**                                     | Drop an IG Reel link, then add "do this but for CELPIP speaking" |
| **Inspiration**        | Just a dropped link, no added context                                            | Paste a TikTok URL to study later                                |

The current model already has the raw materials: `url`, `transcript`, `note` (free-form
context), creator/video kinds. The new `type` is derived from _what was provided_:
link only → inspiration; link + note → semi-original; note/voice only → original.

### Voice-note pipeline (the core new capability)

When the user voice-notes an idea:

1. **Transcribe and preserve the EXACT transcript, always.** The user's original words are
   sacred — stored verbatim and never overwritten. (This is the same "keep the source of
   truth" principle we enforced in the transcription work.)
2. **Auto-expand, automatically** (no manual step): from that transcript, generate and store
   - category/pillar classification
   - hooks
   - content outline
   - key points
   - the full script
   - (title/angle already exist in `CapturedIdea`)
3. Both live together on the idea: `originalTranscript` (immutable) + the generated
   expansion (regenerable). Editing/regenerating never touches the original.

This is a superset of today's `content/capture.ts` (title/angle/hooks/points) — it adds the
preserved transcript, full outline, and full script, and runs automatically on capture.
Native app makes this better: local recording + local transcription (ffmpeg, no upload cap),
instant, offline-capable.

### Capture → curate → Content Library flow

- **Frictionless add:** dropping a link, typing, or voice-noting all create an idea and
  auto-expand it. One smooth entry point.
- **Curate with multi-select:** browse the Ideas tab, **multi-select** the ideas/inspirations
  you might shoot, and **send them to the Content Library** in one move.
- **Content Library** = the curated shortlist of things you actually intend to shoot next,
  distinct from the raw Ideas inbox.

Mental model:

```
Ideas (inbox)  ──curate (multi-select)──▶  Content Library (shortlist to shoot)  ──▶  Recorder/Editor
  ├─ original      (voice/typed)
  ├─ semi-original (link + context)
  └─ inspiration   (link only)
     all auto-categorized + auto-expanded, original transcript preserved
```

## 3b. Onboarding philosophy: progressive, never forced

The app must **work magically out of the box** and **never block or force** anyone into setup.
Value scales with the info a user gives — and we make that clear — but every path is valid:

- **Editor-only** (like CapCut): open, edit, export. Zero onboarding.
- **Capture → teleprompter → edit → post**: no accounts needed.
- **AI idea generation**: better with connected accounts + content pillars + inspirations,
  but never required.

**Onboarding = optional profile enrichment**, and even that is mostly _derived_, not asked:

- **Connect accounts** → auto-pull the user's ~20 most recent posts → **auto-derive content
  pillars** as best we can → user just edits them. (They can also add pillars/inspirations
  manually, or skip entirely.)
- The more they give, the better the AI output — surface that value, don't gate on it.

**No empty NUX walls.** Ideas and Content Library **start as a working database (Notion-like)**,
seamless and well-designed, never an empty "get started" CTA screen. Populate with sensible
starter/derived content so day-one looks alive.

**Guided tour = later.** A step-by-step "what you can do on this screen" highlight, with a
persistent **?** button to replay it, is a near-launch add. **Right now the goal is the
perfect underlying UX**, not the tour.

## 4. Build sequence (proposed)

1. **App-native shell + home** — biggest "looks like an app" win; strips remaining web
   chrome, adds the clean app home + translucent surfaces (glass visible).
2. **Ideas Engine** — rename to Ideas, add the `type` taxonomy, the voice-note pipeline
   (preserve transcript + auto full-expand), and the multi-select curate → Content Library.
3. **Native media bridge** — route Editor decode/proxy/transcribe/export through the ffmpeg
   commands already built (kills the "Alright ×3" bug in the desktop build, fast export).
4. **Website slim-down** — strip functionality from the web, CapCut-style landing + download
   CTA, keep SEO tools.
5. Package: signed/notarized DMG + auto-update; then Windows.
