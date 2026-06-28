# Overnight autonomous build log

## ☀️ Final summary (for Kerem, morning)

Built the whole Phase 2 creation flow overnight — **auth-free, keyless, local-first,
no AI-feedback yet** — shipped to `main` across 12 green-gated iterations (each
passed build + lint + typecheck before pushing; new features are additive routes
so the existing site stayed stable the whole time).

**What's live (try these in order):**

- **`/inspiration`** — swipe-file library. Folders by content pillar; paste a
  YouTube/TikTok/Instagram link → auto-detects platform, pulls title/author/
  thumbnail (oEmbed/OG) + best-effort YouTube transcript. Search, per-item notes,
  folder rename, local-first persistence. "Turn into idea" on any card.
- **`/ideation`** — turn a saved clip (or a blank) into a structured draft:
  hook options, key points, example, CTA. "Copy script" to clipboard.
- **`/studio`** — in-browser video editor. Upload a video (or arrive via
  "Edit this take"): on-device **Whisper transcription** (loads from CDN at
  runtime, nothing uploaded), then **edit by editing the transcript** — select
  words → cut the video, "remove fillers", "remove earlier takes", plus
  Web-Audio **silence removal**, split/trim, skip-cuts preview, **undo/redo**
  - keyboard shortcuts.
- **Record → Edit** — the practice recording completion screen now has an
  "Edit this take" button that opens it in Studio.
- **`/create`** — hub that tells the Inspiration → Ideas → Record → Edit story.
  A **Create** dropdown (works on mobile) + a home-page section make it
  discoverable. The home/training redesign + theme fix from before are also live.

**Known limits / decisions:**

- YouTube caption transcripts are best-effort (Google blocks server fetches from
  datacenter IPs); the reliable transcript path is Studio's on-device Whisper.
- Studio editing is **non-destructive preview** (an edit-decision list). Rendering
  the edited result to a downloadable file (**ffmpeg.wasm export**) is the main
  thing left — I deliberately did NOT ship it autonomously because it needs
  cross-origin isolation (COOP/COEP) that can break GTM/PostHog/embeds. Worth
  doing carefully with you (single-threaded ffmpeg-core, or scoped to /studio).
- Persistence is `localStorage` per browser; great for a no-auth tool, but data
  is device-local. IndexedDB / sync would come with accounts later.

**Suggested next steps:** (1) greenlight ffmpeg export; (2) try the flow on your
phone and tell me what to tighten; (3) decide if Studio should be promoted in the
top nav; (4) richer per-pillar ideation templates. The per-iteration detail is
below.

---

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

### Iteration 3 — Ideation step (shipped)

- New `/ideation` route + "Ideas" nav link. Completes Inspiration → Ideation.
- "Turn into idea" on any inspiration card seeds a structured draft (topic-filled
  hook options + key points + example + CTA), links back to the source, and opens
  the ideation editor.
- Editor: list of drafts (left) + editable draft (right) — title, add/remove
  hooks and points (reusable `EditableList`), example, CTA. Auto-saved local-first
  via an `IdeasProvider`. Verified live end-to-end in Chrome.
- Next: start the transcript-based video editor (/studio) — load recording,
  in-browser Whisper, synced transcript, then editing.

### Iteration 4 — Studio editor foundation (shipped)

- New `/studio` route + "Studio" nav link. Keyless, local-first, no heavy deps yet.
- Upload a video (drag/drop or picker); object-URL player; nothing is uploaded.
- Non-destructive EDL clip model (`lib/studio/clips.ts`): split at playhead,
  delete clip, trim start/end, source↔timeline mapping, playback resolver.
- "Remove silences" via Web Audio RMS (`lib/studio/silence.ts`) — decodes audio,
  finds low-energy regions, cuts them from the clip list.
- Preview that skips removed regions during playback (`use-studio-playback`).
- Timeline shows clips proportionally with a playhead; click to scrub/select.
- Core clip math validated with assertions (split/remove/map/skip all correct).
  Browser file-upload couldn't be automated here, so interactive upload wasn't
  screenshotted, but the page + logic are verified.
- Next: in-browser Whisper transcript (transformers.js, lazy) → delete-words-cuts,
  remove-earlier-takes; then wire Record → Edit; ffmpeg.wasm export last.

### Iteration 5 — Studio transcription (shipped)

- In-browser Whisper (`Xenova/whisper-tiny.en`) via transformers.js, loaded at
  RUNTIME from CDN through a hidden dynamic import so the bundler never touches
  it — zero bundle impact, build stays green, fully keyless/on-device.
- `lib/studio/audio-decode.ts`: decode + downmix + resample to mono 16 kHz via
  Web Audio (OfflineAudioContext) for Whisper input.
- `lib/studio/transcribe.ts`: ASR pipeline with word-level timestamps (falls back
  to segment-level), model-download progress callback.
- Studio context gains `words` + transcribe status/progress + `transcribe()`.
- New transcript panel (right column): Transcribe button → download-progress bar →
  transcribing spinner → transcript with the current word highlighted and
  click-to-seek. Errors degrade gracefully (editor still works).
- Build verified green (transformers.js excluded from bundle); page renders.
  Full transcription run needs a real upload (browser upload automation
  unavailable here) + model download, so not screenshotted end-to-end.
- Next: transcript editing — delete words → cut source ranges; remove earlier takes.

### Iteration 6 — Transcript-based editing (shipped)

- `lib/studio/transcript-edit.ts`: `selectionToRanges` (order-aware: contiguous
  selected words → one cut span, disjoint → separate), `isWordCut`,
  `findFillerIds`, `findEarlierTakeRanges` (exact normalized n-gram retake
  detector — cuts the earlier attempt up to the restart, keeps the last take).
- Studio context: `deleteWords`, `removeFillers`, `removeEarlierTakes` map words →
  source ranges → `removeSourceRange` on the clips (cut shows instantly in the
  timeline + skip-cuts preview).
- Interactive transcript (`transcript-words.tsx`): click selects + seeks,
  Shift-click range, ⌘/Ctrl-click multi-select; "Delete N words" cuts them;
  cut words render struck-through/dimmed; one-click "Remove fillers" and
  "Remove earlier takes" in the toolbar.
- Logic validated with node assertions (selection grouping + retake detection).
- This makes editing-by-transcript real: the core of the Record→Edit vision.
- Next: wire Record → Edit (open a practice recording in /studio); later ffmpeg
  export, then polish + a unified create hub.

### Iteration 7 — Wire Record → Edit (shipped)

- "Edit this take" (scissors) button on the recording completion screen hands the
  recorded video to Studio via an in-memory handoff (`lib/studio/handoff.ts`);
  client-side nav preserves it, so no store/query needed.
- `lib/studio/load-source.ts`: robust StudioSource loader that fixes the
  MediaRecorder webm `duration: Infinity` bug (force-seek to compute duration);
  the uploader now uses it too.
- StudioProvider consumes the pending recording on mount and loads it.
- Connects the vision loop: Record → Edit now flows directly.
- Build green; full record→edit flow needs a real camera recording so not
  automated end-to-end, but each piece is verified and the page renders.
- Next: ffmpeg.wasm export (isolated), then a polish pass + unified Create hub.

### Iteration 8 — Create hub + cohesive nav (shipped)

- New `/create` hub: the Inspiration → Ideas → Record → Edit flow as numbered
  step cards with copy, plus SEO metadata — makes the new tools discoverable and
  the story legible.
- Replaced the three desktop-only header links (Inspiration/Ideas/Studio — which
  were invisible on mobile) with a single theme-aware **Create** dropdown that
  works on every screen size, fixing the mobile nav gap. Footer links to /create.
- Shared `data/create-nav.ts` keeps the dropdown + hub in sync; `CreateIcon`
  maps icon keys to lucide icons.
- Verified live in Chrome (hub + dropdown). Build green (41 routes).
- Next: optional careful ffmpeg export; otherwise more polish / killer features.

### Iteration 9 — Studio undo/redo (shipped)

- `hooks/use-clip-history.ts`: undoable clip state (past/present/future). All edits
  (split, delete clip, trim, remove-silences, transcript cuts, fillers, earlier
  takes) flow through it as one history entry each; new source resets history.
- Undo/Redo buttons in the transport (disabled when unavailable) + keyboard
  shortcuts: ⌘/Ctrl+Z undo, ⌘/Ctrl+Shift+Z (or Ctrl+Y) redo, Space play/pause,
  S split at playhead, Delete/Backspace delete selected clip. Shortcuts ignore
  typing in inputs/textareas.
- History reducer validated with node assertions (undo/redo/no-op/future-clear).
- Build green. Editing is now safely reversible.
- Next: discoverability (surface the Create flow), more polish, careful export.

### Iteration 10 — Home discoverability (shipped)

- Reusable `CreateFlowSection` added to the home page (after the practice stage):
  an "The full workflow" section with the four Inspiration → Ideas → Record → Edit
  step cards + a CTA to /create. Surfaces the new tools beyond the menu (SEO +
  adoption) while keeping the home's aesthetic; theme-token based + responsive.
- Verified live in Chrome (light). Build green.
- Next: light/dark polish sweep across new routes; small killer features.

### Iteration 11 — Copy idea as script (shipped)

- `lib/inspiration/idea-format.ts` `ideaToScript` formats a draft into a clean,
  paste-ready outline (title, hook options, key points, example, CTA).
- "Copy script" button in the idea editor (clipboard + "Copied" confirmation),
  so ideation output is usable in a teleprompter/notes. Format validated by test.
- Verified live in Chrome (light). Build green.

### Iteration 12 — Dark-mode verification sweep (no code changes needed)

- Toggled dark and reviewed /, /create, /inspiration, /ideation, /studio,
  /training, and a drill page. All render correctly in dark — the theme tokens +
  class-based `dark:` variant hold everywhere; no contrast/overlap/invisible-text
  issues found. Create dropdown opens correctly in dark.
- Added the morning final-summary at the top of this log.
- Stopping the autonomous loop here: the create flow is broad, cohesive, undoable,
  and polished; the main remaining item (ffmpeg export) carries cross-origin-
  isolation risk that shouldn't be pushed unattended. Handing back to Kerem.

### Iteration 13 — Studio full-screen layout + filmstrip timeline (Kerem feedback)

- Studio is now a FULL-SCREEN editor (h-dvh): big preview + transport + timeline
  on the left, transcript panel on the right.
- **Resizable** transcript panel via a drag handle (`use-resizable-panel`);
  stacks below the preview on mobile.
- **Vertical (9:16) video** now displays tall and centered (`max-h-full
max-w-full`) instead of being letterboxed in a 16:9 box.
- **Filmstrip timeline** (`use-filmstrip`): generates frame thumbnails in-browser
  and lays them out per clip; taller track with a scrub ruler + draggable playhead.
- Scrub verified live: clicking/dragging the ruler seeks and the preview + time
  update. (Tested by injecting a real vertical webm via the file input.)

### Iteration 14 — Granular timeline: zoom, trim, resize, fixed-height tracks

- Wheel to zoom (cursor-anchored, px/sec model) + horizontal scroll on a real
  scrollable track; ruler with time ticks.
- Draggable trim handles on each clip (live preview, one undo step per trim,
  clamped by neighbors + source bounds) via `setClipRange`.
- Vertically resizable timeline panel (drag the handle to take height from the
  preview).
- Tracks are FIXED height (CapCut-style): resizing the panel taller reveals room
  for more tracks instead of stretching the filmstrip. Groundwork for multi-track.
- Verified live with a real vertical clip: vertical preview centered, real
  filmstrip frames, zoom, and constant track height all correct.
- NEXT (bigger build, needs sign-off): true multi-track — add overlay video /
  audio tracks, drag to reorder, top track composited over lower ones, per-track
  mute/lock. This changes the clip model from one track to tracks[].

### Iteration 15 — Multi-track stage 1: audio tracks

- `AudioTrack` model + context actions (addAudio/moveAudio/toggleAudioMuted/
  removeAudio); audio is additive on top of the base video EDL, so the existing
  transcript editor keeps working.
- "Add audio" in the transport; audio clips render as draggable rows on the
  timeline below the video track (position by drag, mute, delete).
- `AudioTracksPlayer` keeps hidden <audio> elements in sync with the master
  (edited-timeline) clock so music/voiceover mixes under the video.
- Verified live: added an audio file -> draggable audio track row appears.
- NEXT (stage 2): overlay video track (PiP compositing in the preview) +
  drag-reorder of tracks; then ffmpeg.wasm export of the composite.

### Iteration 16 — Tabbed right panel, Media library + overlays, audio waveform

- Right panel is now TABBED: **Media** | **Transcript**.
- Media tab: upload photos/videos into a library; "Add as overlay" places media as
  an overlay that composites over the base video in the preview (image or synced
  video) and appears as a draggable row on the timeline (delete).
- `OverlayLayer` preview compositor + Overlay/MediaAsset model in context.
- **Audio waveform** rendered along the bottom of each video clip (Web-Audio peaks
  via `use-waveform`), so you can trim by where sound starts (CapCut-style).
- Verified live with a real video: waveform + tabs + overlay all working.
- Requested next: remove-silences on the SELECTED track (+ as splits); a main
  track that defines the project aspect ratio; drag from Media onto the timeline;
  PiP position/resize; then export.
