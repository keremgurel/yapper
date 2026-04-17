import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  // Enables capturing unhandled exceptions via Error Tracking
  capture_exceptions: true,
  // Manual pageview tracking for SPA accuracy
  capture_pageview: false,
  capture_pageleave: true,
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
