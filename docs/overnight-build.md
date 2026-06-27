# Overnight autonomous build log

Mission: move Yapper toward the Phase 2 vision (Inspiration → Ideation → Record →
Edit → Publish) — **auth-free, keyless, no AI-feedback yet**. Each iteration:
PM (pick highest-value step) → Engineer (build) → Reviewer (review + fix). All on
`main`, every push gated on green `npm run build` + lint + typecheck. New features
ship as new routes so existing pages stay stable.

## Constraints discovered

- No transcription/LLM API key (only Resend + PostHog). So everything is keyless:
  - Link metadata via public oEmbed (YouTube, TikTok) + og-scrape (Instagram).
  - YouTube transcripts via public timedtext (no key).
  - Editor transcription via in-browser Whisper (transformers.js), silence
    detection via Web Audio — all client-side, private, no auth.

## Roadmap

1. **Inspiration library** — folders by content pillar; paste a YT/TikTok/IG link
   → auto-detect platform → fetch metadata + transcript → save into a folder.
   Local-first persistence (no auth).
2. **Transcript-based video editor** — load a recording, transcribe in-browser,
   edit by editing the transcript: delete words → cut video, remove silences,
   remove earlier takes, CapCut-style split/trim. Non-destructive preview first,
   export (ffmpeg.wasm) last.
3. Cleanups + killer features as they surface.

## Iteration log

### Iteration 0 — ship prior work + scaffolding

- Pushed the training redesign / baked-in recorder / theme fix to `main`.
- Created this log. Starting the Inspiration library.

### Iteration 1 — Inspiration library v1 (shipped)

- New `/inspiration` route: content-pillar folders (sidebar), paste-a-link dialog,
  card grid, local-first persistence (localStorage), move/delete, transcript view.
- Keyless link resolver API `/api/inspiration/resolve`: platform auto-detect +
  oEmbed (YouTube/TikTok) + Open Graph scrape fallback (Instagram) + best-effort
  YouTube transcript (balanced-bracket caption parser).
- Added an "Inspiration" link to the shared header.
- Verified live: paste YouTube link → title/author/thumbnail/card all work.
- **Known limit:** YouTube `timedtext` returns empty to datacenter IPs (their
  anti-scraping), so YT transcripts are best-effort. Reliable transcripts will
  come from the editor's in-browser Whisper. TikTok/IG metadata works; transcript
  not attempted there yet.
- Next: polish inspiration (search, notes, drag-to-folder), then start the editor.

### Iteration 2 — Inspiration polish (shipped)

- Search/filter across title, author, note, and transcript.
- Per-item notes (inline add/edit, persisted) via a focused `ItemNote` component.
- Folder rename (double-click or pencil) alongside delete in the sidebar.
- Loading skeletons before the local store hydrates (no empty-state flash).
- Cards bottom-align their actions for an even grid.
- Next: Ideation step (saved item → hook/points draft, template-based), then the
  transcript-based editor.
