# Yapper Studio — Desktop App Architecture

Status: proposed. Owner: Kerem. Target: free download, macOS first, Windows later.

## TL;DR decision

Build **Yapper Studio** as a **Tauri 2 + React 19** desktop app that hosts the **entire
existing Studio frontend** — every sidebar surface (Inspiration, Content Library, Recorder,
Editor, Poster, Calendar, Automations, Dictionary, Connections) — and does all media work
through a **bundled native `ffmpeg`/`ffprobe` sidecar**. The existing Vercel app stays as
the backend (auth, AI clean, transcription orchestration, cross-posting, billing, blog).

**Scope rule (non-negotiable):** the desktop experience must be **at least as good as web,
never worse**, and identical everywhere except where native is genuinely better. We get this
for free by hosting the _same frontend_ rather than rebuilding it — parity is guaranteed by
construction, and native only replaces what's under the Editor's hood. The standalone editor
UI in `desktop/src/App.tsx` is **only a native-bridge test harness**, not the product UI.

We keep React — the part that is "the state of the art for frontend" does not change.
What changes is the _shell_ (a native window instead of a browser tab) and the _media
engine_ (native ffmpeg instead of the browser's flaky `WebCodecs`/`mp4box`/`MediaRecorder`).

## Why Tauri (and the one honest caveat)

|             | **Tauri 2** (pick)                                 | Electron                    |
| ----------- | -------------------------------------------------- | --------------------------- |
| UI          | Your React app, unchanged                          | Your React app, unchanged   |
| Runtime     | System webview (WKWebView on Mac, WebView2 on Win) | Bundles its own Chromium    |
| App size    | ~3–15 MB                                           | ~100–200 MB                 |
| Memory      | Low                                                | High                        |
| Native code | Rust core + sidecar processes                      | Node.js main process        |
| Maturity    | Stable (v2 GA), modern                             | Very mature, huge ecosystem |

**Why Tauri:** small, fast, modern, secure by default, first-class **sidecar** support
(ship a real `ffmpeg` binary and call it), and a clean plugin set for everything we need
(fs, dialog, shell, deep-link, updater, keychain). Mac-first plays to its strength —
WKWebView has excellent HEVC/VideoToolbox support, which is the exact thing that broke in
the browser.

**The one caveat, stated honestly:** Tauri renders in the _system_ webview, so rendering
can differ slightly across OSes. We neutralize this by never asking the webview to decode
raw camera media — ffmpeg makes an H.264 **proxy** on import and the webview only ever
plays clean H.264 (which every modern webview handles). If we ever hit a webview wall,
Electron is the fallback because it guarantees Chromium — but for a Mac-first editor with
a native media engine, Tauri is the right call.

> Not considered: React Native for desktop. It would mean rewriting the whole UI in native
> primitives — the opposite of "reuse what we have."

## The core architectural win

The bug that started this (retakes not removed, "Alright" ×3) lives entirely in the
**browser media layer** — the only stage we could never reproduce outside a browser.
Going native deletes that whole class of failure and three specific problems:

1. **HEVC / odd containers** (your DJI file: HEVC + 3 data streams + mjpeg thumbnail) —
   ffmpeg demuxes/decodes it deterministically. No more `WebCodecs`/`mp4box` roulette.
2. **The 4.5 MB upload cap** — the entire chunk-and-stitch-with-seam-guessing machinery
   (`asr-audio.ts`, `transcribe-remote.ts` merge logic) exists only because Vercel rejects
   request bodies over 4.5 MB. Desktop uploads audio to R2 and hands Deepgram a URL. The
   chunking layer is **deleted**, not ported.
3. **Export** — native ffmpeg is frame-accurate and fast (already proven: the validation
   render was ffmpeg doing the `export/` pipeline's job, but reliably).

## What runs where

```
┌─────────────────────────── Desktop app (Tauri) ───────────────────────────┐
│  React 19 + Vite  (the Studio UI — reused from apps/web/src/components)     │
│    • timeline, transcript panel, captions, recorder, transport             │
│    • all pure logic: auto-edit, transcript-edit, align, silence, clips      │
│  Rust core                                                                  │
│    • ffmpeg / ffprobe sidecar  → decode, proxy, thumbnails, waveform, export │
│    • fs / dialog (open local files, save exports)                           │
│    • deep-link (yapper://auth) + OS keychain (session token)                │
│    • updater (auto-update)                                                   │
└────────────────────────────────────────────────────────────────────────────┘
                  │ HTTPS (Clerk session token)
                  ▼
┌─────────────────────── Existing Vercel app (unchanged-ish) ────────────────┐
│  Clerk auth · /api/clean-transcript (SURPLUS) · transcription orchestration │
│  (now "transcribe this R2 URL") · /api/publish/* (YouTube/TikTok/Instagram/ │
│  LinkedIn) · Stripe billing · marketing site · blog · SEO                    │
│  R2 storage (presigned upload from desktop)                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

Nothing about auth, billing, publishing, or the marketing site moves. The desktop app is
**just the editor + a native media engine + a thin client** to the same backend.

## Repo shape (monorepo)

Convert the single repo into a small workspace so the Studio code is shared, not copied:

```
yapper/
  apps/
    web/            ← today's Next.js app (marketing, backend, API routes)
    desktop/        ← new Tauri + Vite + React shell
  packages/
    studio-core/    ← extracted from src/: components/studio, lib/studio, hooks
                       + a MediaEngine interface (see below)
```

`studio-core` is imported by **both** `web` and `desktop`. This matches the house rule of
many small focused modules over god-files, and means bug fixes land in one place.

## The one abstraction that makes this clean: `MediaEngine`

Every browser-coupled call today (~24 files: `audio-decode.ts`, `asr-audio.ts`,
`video-export.ts`, `export/*`, `filmstrip.ts`, `demux-audio.ts`, …) goes behind one
interface:

```ts
interface MediaEngine {
  probe(path): Promise<{ duration; width; height; codec }>; // ffprobe
  extractAudioForAsr(path): Promise<Blob | { r2Url }>; // ffmpeg → one file, no chunking
  decodeMono16k(path): Promise<Float32Array>; // ffmpeg → VAD input
  makeProxy(path): Promise<string>; // ffmpeg → H.264 preview
  thumbnails(path, times): Promise<string[]>; // ffmpeg → filmstrip
  waveform(path): Promise<Float32Array>; // ffmpeg → peaks
  export(plan): Promise<string>; // ffmpeg trim+concat+captions
}
```

- **Web** implements it with the current browser code (keeps the web Studio alive).
- **Desktop** implements it by invoking the ffmpeg sidecar over Tauri commands.

The pure logic (`planAutoEdit`, `combineRetakeCuts`, `cutsFromCleanedText`,
`detectSpeechSegments`, `clips`, `captions`) is engine-agnostic and ports with **zero
changes** — it's the same code the validation run used.

## What ports as-is vs. what gets replaced

| Ports untouched                                             | Replaced by ffmpeg sidecar                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| All Studio React components & hooks (UI)                    | `audio-decode.ts` (WebAudio)                                           |
| `auto-edit.ts`, `transcript-edit.ts`, `align-transcript.ts` | `asr-audio.ts` + `audio/*` demux/chunk stack (**deleted**, not ported) |
| `silence.ts`, `clips.ts`, `captions.ts`, caption split      | `video-export.ts`, `export/*` (WebCodecs encode)                       |
| Transcript/AI-clean client calls                            | `filmstrip.ts`, `waveform.tsx` data                                    |
| Cross-post client                                           | `load-source.ts` probing                                               |

Recorder (`teleprompter-recorder.tsx`, `use-media-stream.ts`): `getUserMedia` works inside
the webview, so the recorder **keeps working as-is** on day one; we can later swap to native
capture for cleaner files (also retires the MediaRecorder/WebM duration quirks).

## Transcription redesign (removes the bug's home)

Today: browser extracts audio → chunks under 4.5 MB → POST each to `/api/transcribe` →
seam-stitch. Desktop:

1. ffmpeg extracts one clean audio file locally (any length, any codec).
2. Upload it to R2 via a presigned URL (no Vercel body cap).
3. Server tells Deepgram to transcribe the **R2 URL** (Deepgram supports URL input).
4. AI clean (`/api/clean-transcript`) and alignment are unchanged.

Net: `buildAsrAudioChunks`, `mergeTranscribedChunks`, `findSeamAnchor`, the ADTS remux —
all gone. Simpler and strictly more reliable.

## Auth on desktop (Clerk)

Sign-in opens the system browser to a Clerk-hosted flow → redirect to `yapper://auth`
(Tauri deep-link plugin) → exchange for a session token → store in the OS keychain. Every
backend call carries the token. Billing/paywall/credits keep working through the account
exactly as on web. "Free to download" = no gate on the download; AI features still require
sign-in + the existing credit/paywall rules.

## Phased plan (Mac-first)

- **Phase 0 — Scaffold (½ wk):** monorepo split; `apps/desktop` Tauri+Vite+React booting
  the Studio shell against a stub `MediaEngine`; bundle `ffmpeg`/`ffprobe` as a sidecar.
- **Phase 1 — Import & preview (1 wk):** open a local file → ffprobe → H.264 proxy →
  timeline/scrub. This is where HEVC "just works."
- **Phase 2 — Transcribe & auto-edit (1 wk):** local audio extract → R2 → Deepgram-by-URL →
  existing AI clean + `planAutoEdit`. The exact pipeline validated in this investigation,
  now native.
- **Phase 3 — Export (½ wk):** ffmpeg trim+concat+caption-overlay (the render already
  demonstrated). Frame-accurate, fast.
- **Phase 4 — Auth & publish (1 wk):** Clerk deep-link sign-in; wire cross-post
  (YouTube/TikTok/Instagram, + LinkedIn) through the existing server.
- **Phase 5 — Ship Mac (½ wk):** notarized signed DMG + Sparkle/Tauri auto-update.
- **Phase 6 — Windows (later):** WebView2, code-signing cert, MSI/NSIS, same sidecar.

Rough order of magnitude: a working Mac beta in ~4–5 focused weeks; Windows is mostly
packaging/signing on top.

## Open decisions (my defaults in **bold**)

1. **Monorepo now** (npm/pnpm workspaces) vs. copy code into a separate repo → **monorepo**,
   so fixes stay single-sourced.
2. ffmpeg distribution: **bundle a static ffmpeg sidecar** (simplest, deterministic) vs.
   link a Rust media lib → **bundle sidecar** first; optimize later.
3. Recorder: **keep `getUserMedia` in the webview** for v1 → native capture later.
4. Frontend build: **Vite** (drop Next.js for the desktop shell — its server features are
   dead weight in a native app) vs. Next static export → **Vite**.

## Risks

- **Code signing / notarization** (Apple Developer acct + Windows cert) — real setup cost,
  not code. Start the Apple side early.
- **Webview rendering differences** — mitigated by the H.264-proxy rule; revisit only if a
  specific UI breaks on WebView2.
- **ffmpeg licensing** — ship an LGPL/GPL build appropriately; use a permissive static build
  and honor attribution.
- **Two frontends to keep in sync** — solved by `studio-core` being the single source.
