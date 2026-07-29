use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Resolve a bundled/system binary. In dev we lean on the system install
/// (Homebrew); a later phase ships ffmpeg as a Tauri sidecar so release builds
/// don't depend on the user's PATH.
fn resolve_bin(name: &str) -> String {
    let candidates = [
        format!("/opt/homebrew/bin/{name}"),
        format!("/usr/local/bin/{name}"),
        format!("/usr/bin/{name}"),
    ];
    for c in candidates {
        if Path::new(&c).exists() {
            return c;
        }
    }
    name.to_string() // fall back to PATH lookup
}

fn tmp_out(stem: &str, cache_key: &str, suffix: &str, ext: &str) -> PathBuf {
    let mut p = std::env::temp_dir();
    p.push(format!("yapper_{stem}_{cache_key}_{suffix}.{ext}"));
    p
}

fn file_stem(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("clip")
        .chars()
        .filter(|c| c.is_alphanumeric())
        .take(24)
        .collect()
}

/// A stable cache key that changes when the source file changes. Including the
/// canonical path prevents same-named clips in different folders from sharing
/// proxy/audio/thumb outputs; size + modified time invalidate old derivatives
/// when a file is replaced in place.
fn media_cache_key(path: &Path) -> Result<String, String> {
    let metadata = path
        .metadata()
        .map_err(|e| format!("read media metadata: {e}"))?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    metadata.len().hash(&mut hasher);
    modified.hash(&mut hasher);
    Ok(format!("{:016x}", hasher.finish()))
}

fn ffprobe_can_read(path: &Path) -> bool {
    Command::new(resolve_bin("ffprobe"))
        .args([
            "-v",
            "error",
            "-protocol_whitelist",
            "file",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .output()
        .is_ok_and(|out| out.status.success() && !out.stdout.is_empty())
}

fn marker_is_recent(path: &Path, max_age: std::time::Duration) -> bool {
    path.metadata()
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .is_some_and(|age| age <= max_age)
}

fn proxy_command(path: &Path, out: &Path, hardware: bool) -> Command {
    let mut command = Command::new(resolve_bin("ffmpeg"));
    command.args(["-y", "-nostdin", "-loglevel", "error"]);
    #[cfg(target_os = "macos")]
    if hardware {
        command.args(["-hwaccel", "videotoolbox"]);
    }
    command
        .args(["-protocol_whitelist", "file", "-i"])
        .arg(path)
        .args(["-map", "0:v:0", "-map", "0:a:0?", "-vf", "scale=-2:960"]);
    #[cfg(target_os = "macos")]
    if hardware {
        command.args(["-c:v", "h264_videotoolbox", "-b:v", "4M"]);
    } else {
        command.args(["-c:v", "libx264", "-preset", "veryfast", "-crf", "24"]);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = hardware;
        command.args(["-c:v", "libx264", "-preset", "veryfast", "-crf", "24"]);
    }
    command
        .args([
            "-g",
            "15",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
        ])
        .arg(out);
    command
}

fn thumbnail_at_command(path: &Path, output: &Path, time: f64, height: u32) -> Command {
    let mut command = Command::new(resolve_bin("ffmpeg"));
    command
        .args([
            "-y",
            "-nostdin",
            "-loglevel",
            "error",
            "-ss",
            &format!("{time:.6}"),
            "-protocol_whitelist",
            "file",
            "-i",
        ])
        .arg(path)
        .args([
            "-map",
            "0:v:0",
            "-frames:v",
            "1",
            "-vf",
            &format!("scale=-2:{height}"),
            "-q:v",
            "4",
        ])
        .arg(output);
    command
}

/// Refuse any path that could be misread as a command-line flag or a
/// network/composed-protocol URL by ffmpeg/ffprobe's own argument parser,
/// instead of a literal local file — the one thing every real caller ever
/// needs. A path chosen through the native file dialog, or one we generated
/// ourselves in the system temp dir, can never look like this; only a caller
/// invoking these commands directly with an arbitrary string could construct
/// one — worth guarding against since the main window's webview loads a live
/// remote site (`https://ypr.app`) rather than code bundled with the app, so
/// a compromised frontend is a real (if narrow) part of the threat model.
/// Canonicalizing also confirms the file genuinely exists, closing off any
/// relative-path or traversal tricks.
fn validate_media_path(path: &str) -> Result<PathBuf, String> {
    if path.starts_with('-') {
        return Err("invalid path".into());
    }
    let first_slash = path.find('/').unwrap_or(path.len());
    if path[..first_slash].contains(':') {
        return Err("invalid path".into());
    }
    let canonical = std::fs::canonicalize(path).map_err(|e| format!("invalid path: {e}"))?;
    if !canonical.is_file() {
        return Err("invalid path".into());
    }
    Ok(canonical)
}

/// ffprobe → format + streams as JSON. This is the call that "just works" on the
/// HEVC DJI file the browser choked on. Also grants the asset protocol scope
/// for this one file: the main window loads a live remote site rather than
/// bundled code, so a broad (`**`) asset scope would let any future
/// compromise of that frontend read arbitrary files on disk. Granting scope
/// per validated, canonicalized path — instead of a blanket allowlist in
/// config — keeps that surface to exactly the files this app has actually
/// opened.
#[tauri::command]
fn probe_media(path: String, app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri::Manager;
    let path = validate_media_path(&path)?;
    let _ = app.asset_protocol_scope().allow_file(&path);
    let out = Command::new(resolve_bin("ffprobe"))
        .args([
            "-v",
            "error",
            "-protocol_whitelist",
            "file",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
        ])
        .arg(&path)
        .output()
        .map_err(|e| format!("spawn ffprobe: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).into_owned());
    }
    serde_json::from_slice(&out.stdout).map_err(|e| format!("parse ffprobe json: {e}"))
}

/// DJI and several other cameras write a low-resolution, edit-friendly file
/// beside the original. Prefer that ready-made proxy immediately instead of
/// spending nearly a minute transcoding a duplicate of it.
#[tauri::command]
fn companion_proxy(path: String, app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri::Manager;
    let original = validate_media_path(&path)?;
    for extension in ["LRF", "lrf"] {
        let candidate = original.with_extension(extension);
        if !candidate.exists() {
            continue;
        }
        let candidate = validate_media_path(&candidate.to_string_lossy())?;
        if ffprobe_can_read(&candidate) {
            let _ = app.asset_protocol_scope().allow_file(&candidate);
            return Ok(Some(candidate.to_string_lossy().into_owned()));
        }
    }
    Ok(None)
}

/// Kick off a transcode to a clean H.264 proxy the webview can always play,
/// regardless of the original codec/container, scaled down for fast preview.
/// Returns immediately with the output path — call `proxy_status` on it to
/// poll for completion. A blocking `.status()` call here (waiting for the
/// WHOLE file to transcode before returning) ties up a runtime thread for as
/// long as the source is long, the same mistake `start_thumbnails` was
/// rewritten to avoid.
#[tauri::command]
fn start_proxy(path: String, app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let path = validate_media_path(&path)?;
    let stem = file_stem(&path.to_string_lossy());
    let cache_key = media_cache_key(&path)?;
    let out_path = tmp_out(&stem, &cache_key, "proxy", "mp4");
    let out_str = out_path.to_string_lossy().into_owned();
    let done_path = out_path.with_extension("done");
    let error_path = out_path.with_extension("error");
    let working_path = out_path.with_extension("working");
    if ffprobe_can_read(&out_path) {
        let _ = app.asset_protocol_scope().allow_file(&out_path);
        return Ok(out_str);
    }
    if marker_is_recent(&working_path, std::time::Duration::from_secs(15 * 60)) {
        let _ = app.asset_protocol_scope().allow_file(&out_path);
        return Ok(out_str);
    }
    let _ = std::fs::remove_file(&out_path); // drop any stale run's output first
    let _ = std::fs::remove_file(&done_path);
    let _ = std::fs::remove_file(&error_path);
    let _ = std::fs::write(&working_path, b"working");
    // Grant asset-protocol scope for this output now, not once it's actually
    // finished — the frontend won't fetch it via asset:// until `proxy_status`
    // confirms it's ready, so there's no window where an incomplete file is
    // reachable that a finished one wouldn't also be.
    let _ = app.asset_protocol_scope().allow_file(&out_path);
    // Hardware HEVC decode + H.264 encode keeps the editor responsive and is
    // several times faster on macOS. The background worker retries with
    // software x264 if VideoToolbox is unavailable.
    let use_hardware = cfg!(target_os = "macos");
    let child = proxy_command(&path, &out_path, use_hardware).spawn();
    let mut child = child.map_err(|e| {
        let _ = std::fs::remove_file(&working_path);
        format!("spawn ffmpeg: {e}")
    })?;
    let fallback_path = path.clone();
    let fallback_out = out_path.clone();
    std::thread::spawn(move || {
        let hardware_ok = child.wait().is_ok_and(|status| status.success());
        let fallback_ok = if !hardware_ok && use_hardware {
            let _ = std::fs::remove_file(&fallback_out);
            proxy_command(&fallback_path, &fallback_out, false)
                .status()
                .is_ok_and(|status| status.success())
        } else {
            false
        };
        let marker = if hardware_ok || fallback_ok {
            done_path
        } else {
            error_path
        };
        let _ = std::fs::remove_file(working_path);
        let _ = std::fs::write(marker, b"ok");
    });
    Ok(out_str)
}

/// Has a `start_proxy` run finished? `+faststart` remuxes the moov atom to
/// the front as a separate pass after encoding, so the output file can exist
/// and even stop growing before it's actually valid — rather than guess at a
/// stability window, ask ffprobe for its duration: a partially-written mp4
/// has no readable moov atom yet, so this only succeeds once the whole
/// transcode (encode + remux) is genuinely done.
#[tauri::command]
fn proxy_status(out_path: String) -> Result<String, String> {
    let path = Path::new(&out_path);
    if path.with_extension("error").exists() {
        return Ok("failed".into());
    }
    if !path.exists() {
        return Ok("pending".into());
    }
    // Not yet a full transcode, so `validate_media_path`'s "is this a
    // playable media file" framing doesn't quite fit, but the same
    // argv-injection guard (no leading `-`, no protocol prefix) still
    // applies before this reaches ffprobe's argument list.
    let Ok(canonical) = validate_media_path(&out_path) else {
        return Ok("pending".into());
    };
    if ffprobe_can_read(&canonical) {
        Ok("ready".into())
    } else if path.with_extension("done").exists() {
        Ok("failed".into())
    } else {
        Ok("pending".into())
    }
}

/** One frame of a clip's filmstrip: where it plays, and where its jpeg lives. */
#[derive(serde::Serialize)]
struct Thumb {
    time: f64,
    path: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ThumbnailBatch {
    thumbs: Vec<Thumb>,
    done: bool,
    failed: bool,
}

/**
 * Kick off a whole filmstrip extraction in ONE ffmpeg pass, instead of seeking
 * a <video> and drawing to canvas frame-by-frame in JS (the slow "add to
 * timeline" wait). Returns immediately with the output directory — frames
 * come out at `fps` per second, scaled to `height`, and land on disk as the
 * (still-running) ffmpeg process writes them. Call `list_thumbnails` on the
 * returned directory to stream them in as they appear.
 */
#[tauri::command]
fn start_thumbnails(
    path: String,
    fps: f64,
    height: u32,
    duration: f64,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use tauri::Manager;
    let path = validate_media_path(&path)?;
    let stem = file_stem(&path.to_string_lossy());
    let cache_key = media_cache_key(&path)?;
    let mut dir = std::env::temp_dir();
    dir.push(format!("yapper_thumbs2_{stem}_{cache_key}"));
    let done_path = dir.join(".done");
    let error_path = dir.join(".error");
    let working_path = dir.join(".working");
    if done_path.exists() {
        let _ = app.asset_protocol_scope().allow_directory(&dir, false);
        return Ok(dir.to_string_lossy().into_owned());
    }
    if marker_is_recent(&working_path, std::time::Duration::from_secs(15 * 60)) {
        let _ = app.asset_protocol_scope().allow_directory(&dir, false);
        return Ok(dir.to_string_lossy().into_owned());
    }
    // Clear any stale frames from a previous run of the same file so a repeat
    // extraction never mixes old and new numbering.
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {e}"))?;
    std::fs::write(&working_path, b"working").map_err(|e| format!("mark working: {e}"))?;
    // Non-recursive: the frames land flat in this one directory.
    let _ = app.asset_protocol_scope().allow_directory(&dir, false);
    let rate = if fps > 0.0 { fps } else { 1.5 };
    let frame_count = ((duration.max(0.0) * rate).ceil() as usize).max(1);
    let dir_string = dir.to_string_lossy().into_owned();
    let path = std::sync::Arc::new(path);
    let dir = std::sync::Arc::new(dir);
    std::thread::spawn(move || {
        // Independent input seeks reach every part of a long clip immediately.
        // A single `fps` decode has to walk the entire 4K source sequentially,
        // which made the far end of a six-minute timeline wait almost a minute.
        let next = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let failed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let worker_count = frame_count.min(8);
        let mut workers = Vec::with_capacity(worker_count);
        for _ in 0..worker_count {
            let next = next.clone();
            let failed = failed.clone();
            let path = path.clone();
            let dir = dir.clone();
            workers.push(std::thread::spawn(move || loop {
                let index = next.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                if index >= frame_count {
                    break;
                }
                let output = dir.join(format!("t_{:04}.jpg", index + 1));
                let time = (index as f64 + 0.5) / rate;
                if !thumbnail_at_command(&path, &output, time, height)
                    .status()
                    .is_ok_and(|status| status.success())
                {
                    failed.store(true, std::sync::atomic::Ordering::Relaxed);
                }
            }));
        }
        for worker in workers {
            if worker.join().is_err() {
                failed.store(true, std::sync::atomic::Ordering::Relaxed);
            }
        }
        let marker = if !failed.load(std::sync::atomic::Ordering::Relaxed) {
            done_path
        } else {
            error_path
        };
        let _ = std::fs::remove_file(working_path);
        let _ = std::fs::write(marker, b"ok");
    });

    Ok(dir_string)
}

/**
 * Whatever frames a `start_thumbnails` run has produced so far. While ffmpeg
 * may still be writing, a frame is only reported once the NEXT one also
 * exists — proof its own write finished — so the frontend never loads a
 * half-written jpeg mid-stream. Once the background process writes its done
 * marker, every frame present is reported, including the final one.
 */
#[tauri::command]
fn list_thumbnails(dir: String, fps: f64) -> Result<ThumbnailBatch, String> {
    let rate = if fps > 0.0 { fps } else { 1.5 };
    let dir_path = std::fs::canonicalize(&dir).map_err(|e| format!("invalid thumb dir: {e}"))?;
    let temp_dir =
        std::fs::canonicalize(std::env::temp_dir()).map_err(|e| format!("temp dir: {e}"))?;
    let valid_name = dir_path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with("yapper_thumbs2_"));
    if !dir_path.starts_with(temp_dir) || !valid_name {
        return Err("invalid thumb dir".into());
    }
    let done = dir_path.join(".done").exists();
    let failed = dir_path.join(".error").exists();
    let mut out: Vec<Thumb> = Vec::new();
    let mut i = 1u32;
    loop {
        let f = dir_path.join(format!("t_{i:04}.jpg"));
        if !f.exists() {
            break;
        }
        if !done && !dir_path.join(format!("t_{:04}.jpg", i + 1)).exists() {
            break;
        }
        out.push(Thumb {
            time: (i as f64 - 0.5) / rate,
            path: f.to_string_lossy().into_owned(),
        });
        i += 1;
    }
    Ok(ThumbnailBatch {
        thumbs: out,
        done,
        failed,
    })
}

/// Pull ONE mono AAC file out of the video for ASR — no in-browser demux, no
/// chunk-and-stitch. 48kbps mono keeps a ~12-minute take under the backend's
/// request-body cap so it transcribes in a single request, which is what lets
/// us drop the seam-merging that silently ate repeated takes.
fn run_extract_audio(path: &str) -> Result<PathBuf, String> {
    let path = validate_media_path(path)?;
    let stem = file_stem(&path.to_string_lossy());
    let cache_key = media_cache_key(&path)?;
    let out_path = tmp_out(&stem, &cache_key, "audio", "m4a");
    if ffprobe_can_read(&out_path) {
        return Ok(out_path);
    }
    let status = Command::new(resolve_bin("ffmpeg"))
        .args([
            "-y",
            "-nostdin",
            "-loglevel",
            "error",
            "-protocol_whitelist",
            "file",
            "-i",
        ])
        .arg(&path)
        .args([
            "-vn",
            "-ac",
            "1",
            "-c:a",
            "aac",
            "-b:a",
            "48k",
            &out_path.to_string_lossy(),
        ])
        .status()
        .map_err(|e| format!("spawn ffmpeg: {e}"))?;
    if !status.success() {
        return Err("ffmpeg audio extract failed".into());
    }
    Ok(out_path)
}

#[tauri::command]
async fn extract_audio(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(run_extract_audio(&path)?.to_string_lossy().into_owned())
    })
    .await
    .map_err(|error| format!("audio worker failed: {error}"))?
}

/// Same extraction, but hand the bytes back over IPC so the frontend can POST
/// them to /api/transcribe directly (no cross-origin asset-URL fetch).
#[tauri::command]
async fn extract_audio_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let out = run_extract_audio(&path)?;
        std::fs::read(&out).map_err(|e| format!("read audio: {e}"))
    })
    .await
    .map_err(|error| format!("audio worker failed: {error}"))??;
    Ok(tauri::ipc::Response::new(bytes))
}

/** Is this a URL of our own app (vs a third-party OAuth / sign-in page)? */
fn is_internal_host(host: Option<&str>) -> bool {
    match host {
        Some(h) => h == "ypr.app" || h == "www.ypr.app" || h == "localhost",
        None => true, // about:blank / data: — never treat as external
    }
}

/**
 * Has the OAuth popup DEFINITELY landed back on our own domain? Unlike
 * `is_internal_host`, a hostless navigation (`None`) is NOT treated as home —
 * it's `false` here. A WKWebView loading `WebviewUrl::External(...)` commits a
 * transitional, hostless navigation before the real external URL (TikTok's,
 * Google's) ever loads, and that transitional state was being read as "back
 * on our site, the flow finished," closing the popup before the provider's
 * page ever painted. Only a CONFIRMED match to one of our own hosts means the
 * flow actually completed.
 */
fn is_confirmed_home(host: Option<&str>) -> bool {
    matches!(host, Some(h) if h == "ypr.app" || h == "www.ypr.app" || h == "localhost")
}

fn studio_start_url() -> String {
    if cfg!(debug_assertions) {
        if let Ok(url) = std::env::var("YAPPER_STUDIO_URL") {
            if url.starts_with("http://localhost:") || url.starts_with("http://127.0.0.1:") {
                return url;
            }
        }
    }
    "https://ypr.app/studio/home".into()
}

/// Run a third-party sign-in flow (a platform connection, or Google/Clerk auth)
/// in a popup window that SHARES the app's session, instead of letting it
/// navigate the main window away and hijack the whole app. When the flow returns
/// to our own site, the popup closes and the main window refreshes to pick up the
/// new connection or session.
///
/// Detection runs on `on_page_load`'s `Finished` event, NOT `on_navigation`.
/// `on_navigation` is a yes/no gate on whether a navigation may proceed at all
/// — returning `false` there doesn't just skip closing the popup a moment
/// early, it CANCELS the request outright. The previous version used it to
/// detect "we're back on our own domain" and returned `false` to stop there,
/// which canceled the popup's request to our own OAuth callback API route —
/// the one request that actually exchanges the OAuth code and saves the
/// connection server-side. The callback's own logic never ran, so the flow
/// looked like it completed (the popup closed, the user signed in fine)
/// while nothing was ever actually connected. `on_page_load` only fires once
/// a navigation has already been ALLOWED and the response has loaded, so by
/// the time we see our own host here the server round trip — code exchange,
/// DB write — has already happened; it's then safe to close the popup and
/// refresh main.
/// Invokable entry point for starting an OAuth flow directly in the popup,
/// bypassing the main window's own `on_navigation` guard entirely. Without
/// this, a plain link to a same-origin route like `/api/publish/connect/
/// tiktok` is allowed through by `is_internal_host` (it's only intercepted
/// once the redirect chain reaches an EXTERNAL host, e.g. TikTok's), so the
/// main window actually navigates away and its whole page — and every
/// connection row's React state along with it — tears down and remounts
/// before the popup ever opens. That's what made connecting one platform
/// show every OTHER platform's row flash back to a loading state too: the
/// entire page had just been thrown away and rebuilt. Calling this instead
/// means the main window's document is never touched until the flow
/// actually completes and `open_oauth_popup` reloads it on purpose.
#[tauri::command]
fn open_oauth_flow(url: String, app: tauri::AppHandle) {
    open_oauth_popup(&app, url);
}

fn open_oauth_popup(handle: &tauri::AppHandle, url_str: String) {
    use tauri::webview::PageLoadEvent;
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    let parsed = match url_str.parse() {
        Ok(u) => u,
        Err(_) => return,
    };
    if let Some(w) = handle.get_webview_window("oauth") {
        let _ = w.navigate(parsed);
        let _ = w.set_focus();
        return;
    }
    let h = handle.clone();
    let _ = WebviewWindowBuilder::new(handle, "oauth", WebviewUrl::External(parsed))
        .title("Sign in")
        .inner_size(520.0, 720.0)
        .on_page_load(move |window, payload| {
            if payload.event() != PageLoadEvent::Finished {
                return;
            }
            if !is_confirmed_home(payload.url().host_str()) {
                return;
            }
            let _ = window.close();
            if let Some(main) = h.get_webview_window("main") {
                let _ = main.eval("window.location.reload()");
                let _ = main.set_focus();
            }
        })
        .build();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();
            let start = WebviewUrl::External(studio_start_url().parse().expect("valid start url"));
            WebviewWindowBuilder::new(app, "main", start)
                .title("Yapper Studio")
                .inner_size(1280.0, 860.0)
                .min_inner_size(1000.0, 680.0)
                .resizable(true)
                .on_navigation(move |url| {
                    if is_internal_host(url.host_str()) {
                        return true;
                    }
                    // OAuth / third-party sign-in: send it to a session-sharing
                    // popup so the main window is never navigated away.
                    open_oauth_popup(&handle, url.as_str().to_string());
                    false
                })
                .build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            probe_media,
            companion_proxy,
            start_proxy,
            proxy_status,
            start_thumbnails,
            list_thumbnails,
            extract_audio,
            extract_audio_bytes,
            open_oauth_flow
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
