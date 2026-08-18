/**
 * The options the training onboarding asks about. Kept as data so the steps
 * stay dumb and the answers can be reported on without re-reading JSX.
 */

export interface OnboardingChoice {
  id: string;
  label: string;
}

/**
 * What someone is practicing for. This is the one answer the coach can
 * actually use: register and expectations differ a lot between an interview
 * answer and a first date, so it gets passed into the feedback prompt.
 */
export const PRACTICE_GOALS: OnboardingChoice[] = [
  { id: "interviews", label: "Job interviews" },
  { id: "work", label: "Meetings and presentations" },
  { id: "conversation", label: "Everyday conversation" },
  { id: "social", label: "Dating and social situations" },
  { id: "camera", label: "Talking to camera" },
  { id: "exam", label: "An English speaking exam" },
  { id: "fluency", label: "General fluency and confidence" },
];

/** Attribution, for knowing which channels are worth more effort. */
export const HEARD_ABOUT_OPTIONS: OnboardingChoice[] = [
  { id: "google", label: "Google" },
  { id: "reddit", label: "Reddit" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "friend", label: "A friend" },
  { id: "other", label: "Somewhere else" },
];
