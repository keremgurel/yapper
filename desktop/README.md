# Yapper Studio (desktop)

Native desktop build of the Studio editor. Tauri 2 + Vite + React 19, with all media
work done by a native `ffmpeg`/`ffprobe` engine instead of the browser's WebCodecs/mp4box.

See `../docs/desktop-app-architecture.md` for the full plan.

## Phase 0 (current)

Proves the core thesis: the HEVC/DJI file that broke the browser opens, probes, transcodes
to a playable H.264 proxy, and extracts one clean audio file — all natively.

Native commands live in `src-tauri/src/lib.rs`:

- `probe_media` → ffprobe JSON (container/codec/duration)
- `make_proxy` → H.264 preview the webview can always play
- `extract_audio` → one mono file for ASR (no in-browser demux, no 4.5 MB chunking)

## Prerequisites

- Node 22+, Rust (stable), and `ffmpeg` + `ffprobe` on PATH (Homebrew).
  Dev resolves the system binaries; release builds will bundle ffmpeg as a Tauri sidecar.

## Run

```bash
cd desktop
npm install
npm run tauri dev
```

## Next phases

1. Import & preview (done in phase 0)
2. Transcribe (local extract → R2 → Deepgram-by-URL) + auto-edit (reuse `studio-core`)
3. Export (ffmpeg trim+concat+captions)
4. Clerk deep-link auth + cross-post
5. Signed/notarized DMG + auto-update; then Windows
