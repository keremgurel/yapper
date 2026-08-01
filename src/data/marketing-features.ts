export type MarketingFeature = {
  slug: string;
  eyebrow: string;
  title: string;
  shortTitle: string;
  description: string;
  promise: string;
  accent: string;
  number: string;
  highlights: string[];
  steps: { title: string; description: string }[];
  seoTitle: string;
  seoDescription: string;
};

export const marketingFeatures: MarketingFeature[] = [
  {
    slug: "idea-capture",
    eyebrow: "Ideas",
    title: "Catch the idea before it disappears",
    shortTitle: "Idea capture",
    description:
      "Speak a thought, type a note, or drop a reference link. Yapper keeps the original and turns it into something you can actually make.",
    promise: "A calm inbox for every half-formed idea.",
    accent: "#ff8a2b",
    number: "01",
    highlights: [
      "Voice notes preserved word for word",
      "Links and personal context in one place",
      "Automatic content-pillar organization",
      "Move the best ideas into your production queue",
    ],
    steps: [
      {
        title: "Capture",
        description: "Talk, type, or paste a link the moment inspiration hits.",
      },
      {
        title: "Expand",
        description:
          "Get hooks, angles, key points, and a draft without losing the source.",
      },
      {
        title: "Curate",
        description: "Send the ideas worth making to your content library.",
      },
    ],
    seoTitle: "Content Idea Capture for Creators",
    seoDescription:
      "Capture content ideas by voice, text, or link. Yapper organizes and expands every idea into hooks, outlines, and scripts.",
  },
  {
    slug: "ai-script-writer",
    eyebrow: "Write",
    title: "Turn rough thoughts into scripts that sound like you",
    shortTitle: "AI script writer",
    description:
      "Build hooks, outlines, talking points, and full scripts from your own ideas and references—not a blank prompt box.",
    promise: "Structure when you need it. Your voice when it matters.",
    accent: "#f5b91a",
    number: "02",
    highlights: [
      "Multiple hook directions",
      "Outline and key-point generation",
      "Full teleprompter-ready drafts",
      "Grounded in your ideas and content pillars",
    ],
    steps: [
      {
        title: "Choose an idea",
        description: "Start from something you already wanted to say.",
      },
      {
        title: "Shape the angle",
        description: "Compare hooks and arrange the points that support them.",
      },
      {
        title: "Make it yours",
        description: "Edit freely before sending the script to the recorder.",
      },
    ],
    seoTitle: "AI Script Writer for Short-Form Video",
    seoDescription:
      "Write short-form video hooks, outlines, talking points, and teleprompter scripts from your own content ideas with Yapper.",
  },
  {
    slug: "teleprompter-recorder",
    eyebrow: "Record",
    title: "Record without juggling five different tools",
    shortTitle: "Teleprompter recorder",
    description:
      "Keep your script in sight, frame the shot, choose your devices, and capture a clean take in the same workflow.",
    promise: "From script to camera without breaking focus.",
    accent: "#ff5d5d",
    number: "03",
    highlights: [
      "Built-in scrolling teleprompter",
      "Camera and microphone controls",
      "Portrait-first recording guides",
      "Takes saved directly to the project",
    ],
    steps: [
      {
        title: "Open your script",
        description: "Your selected draft is ready in the teleprompter.",
      },
      {
        title: "Set your pace",
        description: "Adjust text size, scroll speed, framing, and devices.",
      },
      {
        title: "Keep the take",
        description: "Review it and continue directly into the editor.",
      },
    ],
    seoTitle: "Teleprompter and Video Recorder for Creators",
    seoDescription:
      "Record creator videos with a built-in teleprompter, camera controls, portrait guides, and a direct path into editing.",
  },
  {
    slug: "transcript-video-editor",
    eyebrow: "Edit",
    title: "Edit the words. Yapper edits the video.",
    shortTitle: "Transcript editor",
    description:
      "Cut mistakes, retakes, filler words, and dead air by editing a transcript instead of wrestling with a traditional timeline.",
    promise: "Video editing that feels like editing a document.",
    accent: "#22d3ee",
    number: "04",
    highlights: [
      "Word-level transcript editing",
      "Silence and pause removal",
      "Timeline controls when you want precision",
      "Fast local desktop processing",
    ],
    steps: [
      {
        title: "Transcribe",
        description: "Yapper turns the recording into timed, editable words.",
      },
      {
        title: "Clean",
        description:
          "Delete the words and pauses you do not want in the final cut.",
      },
      {
        title: "Refine",
        description:
          "Use the timeline for overlays, audio, and precise finishing.",
      },
    ],
    seoTitle: "Transcript-Based Video Editor",
    seoDescription:
      "Edit talking-head videos by editing text. Remove mistakes, filler words, silences, and retakes with Yapper's transcript video editor.",
  },
  {
    slug: "automatic-captions",
    eyebrow: "Caption",
    title: "Captions that are already in the right place",
    shortTitle: "Automatic captions",
    description:
      "Generate timed captions from the transcript, style them for the frame, and teach Yapper the names it should always spell correctly.",
    promise: "Readable, on-brand captions without the cleanup marathon.",
    accent: "#a78bfa",
    number: "05",
    highlights: [
      "Word-synced caption timing",
      "Reusable caption styles",
      "Safe placement for vertical video",
      "Personal transcription dictionary",
    ],
    steps: [
      {
        title: "Generate",
        description: "Captions inherit timing from the editable transcript.",
      },
      {
        title: "Style",
        description: "Choose the look and placement that fit your content.",
      },
      {
        title: "Teach",
        description:
          "Add brand names and vocabulary once for cleaner future captions.",
      },
    ],
    seoTitle: "Automatic Captions for Creator Videos",
    seoDescription:
      "Create word-synced, styled captions for short-form videos and improve spelling with a personal transcription dictionary.",
  },
  {
    slug: "creator-feedback",
    eyebrow: "Improve",
    title: "Get useful feedback before the comments section does",
    shortTitle: "Creator feedback",
    description:
      "Review delivery, pacing, clarity, and on-camera presence while the recording is still fresh enough to improve.",
    promise: "A private second opinion for every take.",
    accent: "#34d399",
    number: "06",
    highlights: [
      "Pacing and pause analysis",
      "Filler-word and clarity signals",
      "On-camera delivery review",
      "Concrete suggestions for the next take",
    ],
    steps: [
      {
        title: "Choose a review",
        description: "Focus on the audio, the visual delivery, or both.",
      },
      {
        title: "See the signals",
        description:
          "Understand pacing, clarity, fillers, and presentation patterns.",
      },
      {
        title: "Try again",
        description: "Use specific coaching notes on the very next recording.",
      },
    ],
    seoTitle: "AI Speaking and On-Camera Feedback for Creators",
    seoDescription:
      "Get private feedback on pacing, filler words, clarity, and on-camera delivery before publishing your creator video.",
  },
  {
    slug: "social-publishing",
    eyebrow: "Publish",
    title: "Finish once. Publish wherever your audience is.",
    shortTitle: "Social publishing",
    description:
      "Prepare the caption, thumbnail, and destination for each platform without rebuilding the same post from scratch.",
    promise: "The last mile of publishing, inside the same studio.",
    accent: "#60a5fa",
    number: "07",
    highlights: [
      "Platform-specific post preparation",
      "Thumbnail selection",
      "Connected social accounts",
      "Cross-post automation controls",
    ],
    steps: [
      {
        title: "Choose the cut",
        description: "Pick the finished take from your content library.",
      },
      {
        title: "Prepare each post",
        description: "Set the caption, thumbnail, and platform details.",
      },
      {
        title: "Send it out",
        description: "Publish now or place it into your posting plan.",
      },
    ],
    seoTitle: "Social Media Publishing for Video Creators",
    seoDescription:
      "Prepare and publish short-form video across social platforms with per-platform captions, thumbnails, and connected accounts.",
  },
  {
    slug: "content-calendar",
    eyebrow: "Plan",
    title: "See the whole content pipeline, not another blank calendar",
    shortTitle: "Content calendar",
    description:
      "Plan with the work already in progress. Move ideas, scripts, recordings, and finished posts through a calendar built around production.",
    promise: "A posting plan connected to the content itself.",
    accent: "#fb7185",
    number: "08",
    highlights: [
      "Month and week planning views",
      "Production status at a glance",
      "Posts linked to source projects",
      "A single view across platforms",
    ],
    steps: [
      {
        title: "See what is ready",
        description: "Filter the library by where each piece is in production.",
      },
      {
        title: "Place the post",
        description: "Give finished work a date without duplicating it.",
      },
      {
        title: "Stay balanced",
        description: "See gaps and keep your content pillars represented.",
      },
    ],
    seoTitle: "Content Calendar for Video Creators",
    seoDescription:
      "Plan short-form video with a content calendar connected to your ideas, scripts, recordings, production status, and social posts.",
  },
  {
    slug: "content-library",
    eyebrow: "Organize",
    title: "One home for everything you are making",
    shortTitle: "Content library",
    description:
      "Keep the idea, script, recordings, edits, and publishing status together so a promising concept never gets lost between apps.",
    promise: "Every piece of content carries its own history.",
    accent: "#c084fc",
    number: "09",
    highlights: [
      "Idea-to-post project records",
      "Scripts and takes kept together",
      "Content-pillar organization",
      "Clear production statuses",
    ],
    steps: [
      {
        title: "Curate",
        description:
          "Promote strong ideas into the library when you are ready to make them.",
      },
      {
        title: "Create",
        description:
          "Keep every script, recording, and edit attached to its source.",
      },
      {
        title: "Track",
        description:
          "Know what is an idea, ready to record, edited, scheduled, or posted.",
      },
    ],
    seoTitle: "Content Library for Video Creators",
    seoDescription:
      "Organize content ideas, scripts, video takes, edits, and publishing status in one connected creator content library.",
  },
];

export function getMarketingFeature(slug: string) {
  return marketingFeatures.find((feature) => feature.slug === slug);
}
