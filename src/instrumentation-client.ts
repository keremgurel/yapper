import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    // Send telemetry directly to PostHog instead of paying Vercel to proxy it.
    api_host: "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    // AnalyticsProvider owns page views. Enabling both counts each load twice.
    capture_pageview: false,
    capture_pageleave: false,
    capture_heatmaps: false,
    disable_session_recording: true,
    autocapture: false,
    capture_performance: false,
    advanced_disable_feature_flags: true,
    disable_surveys: true,
    respect_dnt: false,
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
