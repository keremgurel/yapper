fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "probe_media",
            "companion_proxy",
            "start_proxy",
            "proxy_status",
            "start_edit_preview",
            "edit_preview_status",
            "start_thumbnails",
            "list_thumbnails",
            "start_waveform",
            "list_waveform",
            "extract_audio",
            "extract_audio_bytes",
            "prepare_pcm",
            "extract_pcm_chunk",
            "prepare_export_pcm",
            "extract_export_pcm_chunk",
            "open_oauth_flow",
        ]),
    ))
    .expect("failed to build Tauri application");
}
