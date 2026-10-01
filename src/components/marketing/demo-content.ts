import type { ContentSummary } from "@/lib/content/client";

export const demoHook = "Your first video doesn’t need a new camera.";
export const demoScript =
  "I spent weeks choosing a camera before I made my first video.\n\nThen I tried something smaller: one idea, my phone, and sixty seconds to say it.\n\nThe first take wasn’t perfect. But listening back showed me exactly what to change.\n\nStart with the idea you keep thinking about. Record it today. You can make the next one better.";
export const demoRevisedScript =
  "I spent weeks picking a camera. Then I made my first video on my phone.\n\nOne idea. A stack of books. A window for light. That was the whole setup.\n\nThe first take was awkward. But watching it back taught me more than another gear review.\n\nPick one thing you want to say. Record it today. Make the next one better.";
export const demoHooks = [
  "I spent weeks picking a camera. Then I used my phone.",
  "The best camera for your first video? The one you already own.",
  "I wasn’t waiting for a camera. I was waiting to feel ready.",
];
export const spokenIdea =
  "I want to make a video about how I kept putting off my first post because I thought I needed a better camera. Then I just used my phone. It could be a personal story about getting started.";
export const demoIdeas: ContentSummary[] = [
  demoHook,
  "Three ways to find your next video idea",
  "What I learned from recording every day",
  "A simpler setup for talking to camera",
].map((title, index) => ({
  id: `sample-${index}`,
  title,
  status: (["captured", "drafting", "ready", "captured"] as const)[index],
  stage: "library",
  formats: index === 1 ? ["short", "carousel"] : ["short"],
  ideaType: (["original", "semi-original", "original", "inspiration"] as const)[
    index
  ],
  scheduledFor: null,
  submissionId: null,
  pillar: [
    "Creating content",
    "Content strategy",
    "Speaking practice",
    "Creating content",
  ][index],
  pillarId: null,
  sourceUrl: null,
  sourceTitle: null,
  sourcePlatform: null,
  transcriptStatus: null,
  script: demoScript,
  originalNote: index === 0 ? spokenIdea : title,
  updatedAt: "2026-10-01T10:00:00Z",
  createdAt: "2026-10-01T10:00:00Z",
}));
