import posthog from "posthog-js";

const key =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ??
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

if (key) {
  posthog.init(key, {
    api_host: host,
    /* We fire $pageview manually via AnalyticsProvider for SPA accuracy */
    capture_pageview: false,
    capture_pageleave: true,
    /* Session recording (free tier includes 5K/mo) */
    disable_session_recording: false,
    /* Autocapture for heatmaps / click tracking */
    autocapture: true,
    /* Respect Do-Not-Track */
    respect_dnt: true,
    /* Persist across sessions */
    persistence: "localStorage+cookie",
    /* Privacy: mask sensitive inputs in session recordings */
    mask_all_text: false,
    mask_all_element_attributes: false,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { email: true, password: true },
    },
  });
}
