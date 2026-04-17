import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    capture_pageview: false,
    capture_pageleave: true,
    capture_heatmaps: true,
    disable_session_recording: false,
    autocapture: true,
    respect_dnt: true,
    persistence: "localStorage+cookie",
    mask_all_text: false,
    mask_all_element_attributes: false,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { email: true, password: true },
    },
    debug: process.env.NODE_ENV === "development",
  });
}
