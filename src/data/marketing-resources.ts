// Each link continues the visitor's current task, including across workflow groups.
export const relatedFeatures: Record<string, string[]> = {
  "idea-capture": ["ai-script-writer", "content-library"],
  "ai-script-writer": ["idea-capture", "teleprompter-recorder"],
  "teleprompter-recorder": ["ai-script-writer", "transcript-video-editor"],
  "transcript-video-editor": ["automatic-captions", "social-publishing"],
  "automatic-captions": ["transcript-video-editor", "social-publishing"],
  "social-publishing": ["content-calendar", "automatic-captions"],
  "content-calendar": ["social-publishing", "content-library"],
  "content-library": ["idea-capture", "content-calendar"],
};

export const speakingGuides = [
  {
    href: "/blog/how-to-practice-public-speaking-alone",
    title: "How to practice public speaking alone",
    description:
      "A repeatable way to record, review, and improve without an audience.",
  },
  {
    href: "/blog/public-speaking-practice-exercises",
    title: "Public speaking practice exercises",
    description:
      "Choose a drill for clarity, delivery, and thinking on your feet.",
  },
  {
    href: "/blog/overcome-filler-words",
    title: "How to reduce filler words",
    description:
      "Notice the patterns in your recordings and practice a deliberate pause.",
  },
];
