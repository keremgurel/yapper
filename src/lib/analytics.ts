import posthog from "posthog-js";

/* ------------------------------------------------------------------ */
/*  Core tracking helpers                                              */
/* ------------------------------------------------------------------ */

/** Safe event capture */
export function track(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

/** Track a page view (call on route changes) */
export function trackPageView(url?: string) {
  posthog.capture("$pageview", {
    $current_url: url ?? window.location.href,
  });
}

/** Identify a user (e.g. after waitlist signup) */
export function identifyUser(
  distinctId: string,
  properties?: Record<string, unknown>,
) {
  posthog.identify(distinctId, properties);
}

/** Set properties on the current user without identifying */
export function setUserProperties(properties: Record<string, unknown>) {
  posthog.people.set(properties);
}

/* ------------------------------------------------------------------ */
/*  Typed event helpers — the dashboard events                        */
/* ------------------------------------------------------------------ */

/** User pulled the slot lever or got a new random topic */
export function trackTopicGenerated(props: {
  category: string;
  difficulty: string;
}) {
  track("topic_generated", props);
}

/** User changed the category or difficulty filter */
export function trackFilterChanged(props: {
  filter: "category" | "difficulty";
  value: string;
}) {
  track("filter_changed", props);
}

/** User started a practice session */
export function trackSessionStarted(props: {
  mode: "topic" | "freestyle";
  timerSeconds: number;
  cameraOn: boolean;
  micOn: boolean;
  category?: string;
  difficulty?: string;
  topicText?: string;
}) {
  track("session_started", props);
}

/** User paused/resumed a session */
export function trackSessionPaused(props: { action: "pause" | "resume" }) {
  track("session_paused", props);
}

/** Session completed (timer ran out or user hit finish) */
export function trackSessionCompleted(props: {
  mode: "topic" | "freestyle";
  timerSeconds: number;
  elapsedSeconds: number;
  finishedEarly: boolean;
  cameraOn: boolean;
  micOn: boolean;
  hadRecording: boolean;
  endReason: "auto" | "manual";
}) {
  track("session_completed", props);
}

/** User reset the timer mid-session (abandon) */
export function trackSessionReset(props: {
  mode: "topic" | "freestyle";
  elapsedSeconds: number;
  timerSeconds: number;
}) {
  track("session_reset", props);
}

/** User toggled camera or mic */
export function trackMediaToggle(props: {
  media: "camera" | "mic";
  enabled: boolean;
}) {
  track("media_toggle", props);
}

/** User adjusted the timer duration */
export function trackTimerAdjusted(props: { seconds: number }) {
  track("timer_adjusted", props);
}

/** User downloaded their recording */
export function trackRecordingDownloaded(props: { hasVideo: boolean }) {
  track("recording_downloaded", props);
}

/** User shared their recording */
export function trackRecordingShared() {
  track("recording_shared");
}

/** User submitted waitlist email */
export function trackWaitlistSubmitted(props: { success: boolean }) {
  track("waitlist_submitted", props);
}

/** User switched between random/freestyle mode on landing */
export function trackModeChanged(props: { mode: string }) {
  track("mode_changed", props);
}

/** User toggled fullscreen */
export function trackFullscreenToggled(props: { entered: boolean }) {
  track("fullscreen_toggled", props);
}

/** User clicked a blog post */
export function trackBlogPostViewed(props: { slug: string; title: string }) {
  track("blog_post_viewed", props);
}

/* ------------------------------------------------------------------ */
/*  Re-export posthog for advanced use                                */
/* ------------------------------------------------------------------ */

export { posthog };
