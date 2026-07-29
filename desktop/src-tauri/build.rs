fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "probe_media",
            "companion_proxy",
            "start_proxy",
            "proxy_status",
            "start_thumbnails",
            "list_thumbnails",
            "extract_audio",
            "extract_audio_bytes",
            "open_oauth_flow",
        ]),
    ))
    .expect("failed to build Tauri application");
}
