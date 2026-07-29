# Handoff: fix the Yapper Studio desktop editor (AI edit quality + perf + layout)

**Written for a fresh agent. Read this whole file before touching code.** The
previous agent (me) built a native media pipeline this session and it made some
things better and one important thing look _worse_. Your job is to fix the list
below, in order. Do not trust my conclusions blindly — several are hypotheses
labeled as such, and step 1 of each problem is _verify the cause on the real
file_ before changing code.

The user is (rightly) frustrated. Move carefully, reproduce before you fix, and
test on the real recording, not a toy input.

---

## 0. The one reproduction asset that matters

A real recording with many repeated takes lives at:

```
/Volumes/G Micro Pro/DCIM/DJI_001/DJI_20260719173505_0045_D.MP4
```

(An earlier session also used `/Volumes/G MicroSD/DCIM/DJI_001/DJI_20260721200853_0313_D.MP4`.)
These are **4K HEVC vertical** clips off a DJI camera on an external SD card.
Every bug below should be reproduced against this file. It is ~1:40, ~718
transcribed words, and the speaker restarts the same sentence 4-6 times. That
repetition is the whole point — it is what the AI edit must clean up and
currently does not.

---

## 1. TOP PRIORITY — AI "remove mistakes" / 1-Click edit keeps almost all the retakes

### Symptom (from the user's screenshot)

After "1-Click Edit + Captions" on the file above, the transcript still contains
the same sentence many times over, mostly **not** struck through (not cut). E.g.
"You can take full practice tests, drill individual questions, or go through the
course modules directly at the site" appears ~5 times and only some are removed.
The result is unusable. The user says it is "way worse than we were."

### What is actually going on (important nuance)

The transcript itself is now **correct and complete** — every take is present.
That is the _native single-file transcription working as intended_ (see §6). The
old browser path used to silently _drop_ repeated takes during chunk-stitching,
which hid them. So the transcript is no longer the bug. **The bug is the
retake-cleaning stage, which under-cuts.** My transcription change did not create
this weakness; it exposed it by finally feeding the cleaner a complete transcript.

### The exact pipeline (trace it end to end)

`autoEdit()` in `src/components/studio/studio-context.tsx` (~line 1345):

1. `decodeToMono16k(source.url)` → PCM (for silence VAD).
2. `transcribeAudio(...)` → `words` (via `transcribeUrl`, now native single-file).
3. `aiCuts = await cleanTranscriptRemote(w).catch(() => null)` — **note the
   `.catch(() => null)`: any failure here silently degrades to deterministic-only
   cutting.**
4. `planAutoEdit({ words: w, aiCuts, ... })` →
   `combineRetakeCuts(words, aiCuts)` in `src/lib/studio/auto-edit.ts:186`.

The AI cut derivation:

- `src/lib/studio/clean-transcript.ts` → POST `/api/clean-transcript`.
- `src/app/api/clean-transcript/route.ts`: asks SURPLUS model
  (`AI_CLEAN_MODEL`, default `gpt-5.4`) to return the **cleaned speech text**
  (final takes only), then calls
  `cutsFromCleanedText(words, cleaned)` in `src/lib/studio/align-transcript.ts`
  to turn that cleaned text back into index ranges to cut.
- The deterministic fallback/union is `findEarlierTakeRanges` +
  `combineRetakeCuts` in `src/lib/studio/transcript-edit.ts` (catches only
  n=4 **exact** repeated n-grams; it will NOT catch paraphrased or
  number-varied retakes).

### Two prime suspects — verify which one (or both) before fixing

**Suspect A (check first, it's cheap): the SURPLUS AI call is failing/absent in
prod, so we fall to deterministic-only, which can't catch paraphrased retakes.**

- `/api/clean-transcript` returns **501** if `SURPLUS_API_KEY` is unset, or
  **502** on any upstream error. `cleanTranscriptRemote` turns 501 into `null`;
  `autoEdit`'s `.catch(() => null)` swallows 502. Either way → `aiCuts = null`
  → only exact-repeat deterministic cuts run → most near-identical retakes
  survive. This matches the screenshot exactly.
- **Verify:** in the desktop app (or Safari at ypr.app) open devtools, run a
  1-click edit, watch the Network tab for `POST /api/clean-transcript`. Is it
  200 with a non-empty `cuts` array? Or 501/502/empty? Also confirm
  `SURPLUS_API_KEY` and `AI_CLEAN_MODEL` are set in the **production** Vercel env
  (`vercel env ls`), not just preview/dev. This session only ever confirmed the
  pipeline logic in unit tests, never that the prod key is live.
- If this is the cause: fix the env, and **stop swallowing the error** — surface
  "AI cleanup unavailable" to the user instead of quietly under-cutting so it
  never again looks like the feature "ran fine" while doing almost nothing.

**Suspect B: `cutsFromCleanedText` greedy right-to-left alignment under-cuts on
highly repetitive transcripts, even when the cleaned text is perfect.**

- `cutsFromCleanedText` (`align-transcript.ts:20`) walks source and cleaned
  tokens from the right, greedily marking `keep` on `src[i] === cleaned[j]`
  matches. On text with 5 near-identical copies of a phrase, a greedy
  subsequence match **zig-zags across different takes** and marks words to keep
  inside earlier takes too, so those earlier takes are never fully cut. This is
  a classic greedy-LCS failure on repetitive input.
- **Verify:** capture the actual `words` array and the SURPLUS `cleaned` string
  for the repro file (add a temporary `console.log`/`console.info` of both in
  the route or client), then unit-test `cutsFromCleanedText(words, cleaned)`
  and inspect whether it keeps words in earlier takes. Add this as a real test
  fixture under `src/lib/studio/align-transcript.test.ts`.
- If this is the cause: replace the greedy pass with a proper global alignment
  (Needleman-Wunsch / full LCS with backtracking) that, on ties, prefers keeping
  the **rightmost** run contiguous — i.e. keep the last complete take intact and
  cut whole earlier takes. Keep it well-tested; this is pure, deterministic, and
  unit-testable, so lean on tests with the real transcript as a fixture.

### Definition of done for §1

On the repro file, 1-Click edit cuts the sentence down to a single clean take
each, the kept transcript reads like the final script (roughly what the captions
column already shows), and there is a regression test built from the real
transcript so this can't silently rot again.

---

## 2. Upload is not instant (~1 minute before waveforms appear)

CapCut shows frames + waveform immediately. We do not. Two separate slow paths,
neither is truly "instant" yet:

- **Waveform** (`generateWaveform` in `src/lib/studio/filmstrip.ts:~139`,
  driven by `useWaveforms` in `src/hooks/use-timeline-media.ts`): does
  `fetch(url)` → `decodeAudioData` over the **entire** audio at ~120 peaks/sec.
  This is NOT wired to native and decodes the whole 4K file's audio in-browser.
  This is the ~1 minute.
- **Thumbnails** (`nativeThumbnails` → Rust `extract_thumbnails` in
  `desktop/src-tauri/src/lib.rs`): I made this "one ffmpeg pass," but it still
  **fully decodes the whole 4K HEVC** at 1.5fps before returning any frame. On
  HEVC off an SD card that is not instant either, and no frame shows until the
  whole pass finishes.

### Direction (the CapCut approach)

- Generate a **fast low-res proxy first** (the `make_proxy` command exists and
  now writes dense keyframes). Play, thumbnail, and waveform off the _proxy_, not
  the 4K original. Decoding a 960px H.264 proxy is far cheaper than 4K HEVC.
- Make thumbnails **stream/progressive**: emit frames as they are produced (or
  only generate the currently-visible time range on demand) so the filmstrip
  fills in immediately instead of after a full pass. `generateFilmstrip` already
  had a streaming `onProgress` contract; the native path threw that away by
  returning all frames at once — restore streaming for native.
- Derive the **waveform from the already-extracted native audio** (we already
  run `extract_audio`/`extract_audio_bytes` for transcription — reuse those PCM
  bytes for peaks instead of a second full decode of the video).
- Show placeholders instantly (grey tiles / flat line) and fill in, so the UI is
  never blocked.

---

## 3. Timeline zoom: not smooth, and can't zoom out far enough on big screens

- **Zoom-out range:** `src/components/studio/studio-timeline.tsx:49-50` caps
  `MIN_PX = 4` (px/sec) and `MAX_PX = 800`. The user wants to see the whole clip
  at once on a large display. Lower `MIN_PX` (try 1-2) AND add an explicit
  **"fit to width"** control that computes `pxPerSec = containerWidth / total`
  and clamps — that is what the user actually wants ("let me zoom out more,
  especially when the screen is big").
- **Smoothness:** zoom re-lays-out the whole timeline including every filmstrip
  `<img>` on each wheel step. The zoom already tries to coalesce via
  `zoomRafRef` (~line 137), but the heavy child re-render is the cost. Options:
  CSS-transform-scale the strip layer during the gesture and reflow once on
  settle; virtualize the filmstrip so only visible tiles render;
  `content-visibility`/`will-change` on tiles. Profile first (see §7).

---

## 4. Play / pause is not smooth

Known and previously documented. `src/hooks/use-studio-playback.ts` calls
`setTimelineTime(clockRef.current)` on **every** presented frame (rVFC/rAF, ~line
120). That re-renders the ~1000-line `studio-timeline.tsx` and its consumers
30-60 times/sec, starving audio/video → the stutter.

**Fix (the real one):** decouple the playhead time from React state. Keep the
frame clock in a ref and drive **only the playhead element's transform** each
frame (direct DOM write, or a tiny subscription/store that only the playhead
component subscribes to). React state should update coarsely (e.g. on
pause/seek/boundary), not per frame. Do this with the user able to test audio
smoothness — it is easy to make audio worse here.

Note the earlier "hop 1 second forward then play" scrub complaint: the dense-
keyframe proxy (§2) is the enabler for accurate seeks, but confirm the seek
guard at `use-studio-playback.ts:94`
(`if (Math.abs(v.currentTime - srcTime) > 0.05) v.currentTime = srcTime`) plus
playing off the proxy actually removes it. Reproduce by seeking then pressing
play.

---

## 5. Cinema layout: 3 columns look terrible on a small window → make it responsive

`src/components/studio/right-panel.tsx`: when `layout === "cinema"` it always
renders Media | Transcript | Captions as three side-by-side columns
(`right-panel.tsx:53`). On a small/narrow window they're crushed (see the user's
first screenshot). Classic mode already implements the good fallback: a tabbed
single panel (`right-panel.tsx:72+`, `TABS`, `tab` state).

**Fix:** make Cinema **width-aware**. Below a container-width breakpoint, render
the Classic tabbed panel instead of three columns (measure with a
ResizeObserver / container query, not the viewport — the panel is not the whole
screen). Above it, keep the three columns. Keep it simple; reuse the existing
tab UI rather than inventing a new one.

---

## 6. What I changed this session (so you know the current state of the diff)

All uncommitted on `main` (nothing committed). Native pipeline, gated by
`isNative()` (`window.__TAURI__` present) so **web behavior is unchanged**:

New: `src/lib/studio/native/{bridge,media,path-registry,load-native-source}.ts`

- `bridge.ts`: `isNative()`, `invoke()`, `assetUrl()` (convertFileSrc),
  `pickVideoPath()` (native file dialog).
- `path-registry.ts`: maps a clip's asset URL → `{ path, aspect, duration }`, so
  downstream code reaches the original file without threading `path` through
  every type.
- `media.ts`: `nativeProbe`, `nativeThumbnails`, `nativeAudioBlob`.
- `load-native-source.ts`: picked path → `StudioSource` (plays off disk).

Injected native branches (all fall back to the old browser path on any failure):

- `src/components/studio/video-uploader.tsx`: native file picker.
- `src/hooks/use-timeline-media.ts` (`useFilmstrips`): native thumbnails.
- `src/lib/studio/transcribe-remote.ts` (`transcribeUrl`): **native single-file
  audio → one `/api/transcribe` request**, bypassing the in-browser decode +
  `chunkMonoPcm` + `mergeTranscribedChunks`/`findSeamAnchor` stitch that used to
  drop retakes. **This part works and should stay** — it is why the transcript
  is now complete.
- `src/lib/studio/audio-decode.ts` (`decodeFresh`): decode the IPC audio bytes
  instead of fetching the `asset://` URL (avoids cross-origin fetch of the asset
  protocol).

Rust (`desktop/src-tauri/src/lib.rs`): `probe_media`, `make_proxy` (now dense
keyframes `-g 15 -keyint_min 15 -sc_threshold 0`), `extract_thumbnails`,
`extract_audio`, `extract_audio_bytes` (returns bytes via `tauri::ipc::Response`
so no CORS). `tauri.conf.json`: added `withGlobalTauri: true` (required so the
external ypr.app frontend can reach IPC), `windows: []` (window is built in code
in `lib.rs run()`), `assetProtocol.scope: ["**"]`.

**Body cap correction:** an earlier memory said `/api/transcribe` truncates at
4.5MB. The prod build log shows `proxyClientMaxBodySize: "64mb"`. At 48kbps mono
that's ~3h of audio in one request, so the single-file transcribe path is safe
for essentially any video. R2-URL streaming is not needed for length reasons.

**Known weak spots I introduced:** native thumbnails are not streaming (whole
pass before any frame); waveform still not native; `make_proxy` is built but NOT
wired into playback yet (video still plays the 4K original off disk). These feed
directly into §2/§3/§4.

---

## 7. How to build, deploy, and test (the beta loop)

- **The desktop app loads `https://ypr.app/studio/home` at runtime** (an external
  URL, set in `desktop/src-tauri/src/lib.rs run()`), NOT the bundled `dist`. So
  **frontend changes only take effect after you deploy to prod.** The bundled
  Vite `dist` is essentially unused.
- **Deploy frontend to prod** (from repo root; the auto-mode classifier blocks
  the agent from running this, so ask the user to run it in-session with `!`):
  ```
  vercel --prod --yes --scope kerem-gurels-projects
  ```
  It uploads the working tree (uncommitted changes included) and aliases ypr.app.
- **Build the DMG:** `cd desktop && npx tauri build` →
  `desktop/src-tauri/target/release/bundle/dmg/Yapper Studio_0.1.0_aarch64.dmg`.
  Unsigned: install = drag to Applications, right-click → Open once. Version is
  `0.1.0` and overwrites in place — **bump the version per build** so the user
  can tell builds apart (they asked for this).
- **ffmpeg is NOT bundled.** Rust `resolve_bin` looks in `/opt/homebrew/bin`
  first, then `/usr/local/bin`, then PATH. Works on the user's machine (they have
  Homebrew ffmpeg) but a sidecar must be bundled before any wider beta.
- **Fast iteration without a rebuild:** most of these bugs (AI edit, waveform,
  zoom, layout) are frontend and reproduce **in Safari at https://ypr.app**.
  Safari === the WKWebView engine, so it catches WKWebView-only bugs Chrome
  hides. Use Safari for frontend work; only rebuild the DMG for Rust/native
  changes. (Native paths won't activate in Safari since `isNative()` is false —
  test native specifically in the app, but the _algorithms_ like
  `cutsFromCleanedText` are testable anywhere and via unit tests.)
- **Profiling perf:** React DevTools Profiler + Chrome/Safari performance panel
  on ypr.app while scrubbing/zooming will show the re-render storm directly.

---

## 8. Hard constraints / landmines (do not relearn these the hard way)

- **NO em dashes anywhere, ever** — copy, comments, commit messages, this kind of
  doc. The user is firm on this.
- **Do NOT migrate the Neon Postgres DB.** It is their real cloud DB. The Idea
  bank etc. are intentionally localStorage-backed for now.
- **WKWebView gotchas:** CSS percentage heights on flex items collapse to 0
  (this bit the voice waveform — it had to become a `<canvas>`). Test layout in
  Safari.
- **Voice waveform** must stay canvas-based, analyze a **cloned** mic track, and
  resume the AudioContext each frame or it reads silence.
- **Outward-facing/side-effectful commands** (prod deploy, account/API changes)
  are blocked for the agent by the classifier — write them for the user to run
  with `!` instead of fighting the block.
- The voice-capture shortcut is **Cmd+D** (final).
- Keep files small and single-responsibility (the user's global rule): many
  small focused modules over god-files/god-hooks. The `native/` split follows
  this; keep it up.

---

## 9. Suggested order of attack

1. **§1 AI edit quality.** Start with Suspect A (is the SURPLUS call actually
   succeeding in prod? cheap to check) before touching alignment. This is the
   thing the user cares about most and the thing that regressed in _perceived_
   quality. Build a real regression test from the repro transcript.
2. **§2 instant upload** (proxy-first + streaming thumbnails + waveform from
   native audio). Biggest visible "feels like CapCut" win.
3. **§5 responsive Cinema layout.** Small, self-contained, quick morale win.
4. **§3 zoom-out range + fit** (cheap), then **§4 playback decouple** and **§3
   zoom smoothness** (the harder perf refactors, do with the user testing audio).

Reproduce each on the DJI file, verify the cause, then fix. Do not ship a second
"should be fixed" without watching it work on that file.
