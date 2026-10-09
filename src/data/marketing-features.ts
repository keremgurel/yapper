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
    title: "Content ideas that sound like you.",
    shortTitle: "Idea capture",
    description:
      "Brain brings your voice, references and previous videos into the conversation. Capture a thought or ask for a content idea grounded in what you know, then shape it into a video you can shoot.",
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
    seoTitle: "Content ideas generator grounded in your voice",
    seoDescription:
      "Find content ideas rooted in your voice, references and previous videos. Capture thoughts and shape them into hooks and scripts with Yapper Studio’s Brain.",
  },
  {
    slug: "ai-script-writer",
    eyebrow: "Script",
    title: "An AI video script generator that starts with your ideas.",
    shortTitle: "Script writer",
    description:
      "Turn the idea in your notes into a video you can actually record. Generate hooks, outlines and scripts for Reels, Shorts and TikTok, then make every line sound like you.",
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
    seoTitle: "AI video script generator for Reels & Shorts",
    seoDescription:
      "Generate short-form video hooks, outlines, talking points, and teleprompter scripts from your own content ideas with Yapper.",
  },
  {
    slug: "teleprompter-recorder",
    eyebrow: "Record",
    title: "A teleprompter for Mac. Still sound like yourself.",
    shortTitle: "Teleprompter recorder",
    description:
      "Record a talking-head video with your script in view. Set the teleprompter to your pace, choose your camera and microphone, and keep the take with your project.",
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
    seoTitle: "Teleprompter for Mac with video recording",
    seoDescription:
      "Record on your Mac with a scrolling teleprompter, adjustable pace and camera controls. Keep your script, take and edit together in Yapper Studio.",
  },
  {
    slug: "transcript-video-editor",
    eyebrow: "Edit",
    title: "One-click video editing. Keep your best take.",
    shortTitle: "Transcript editor",
    description:
      "Stop cutting out silences, mistakes and retakes by hand. One-click edit cleans up your recording; text-based video editing lets you refine the cut by selecting words in the transcript.",
    promise: "Video editing that feels like editing a document.",
    accent: "#22d3ee",
    number: "04",
    highlights: [
      "One-click removal of silences and retakes",
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
    seoTitle: "Text-based video editing for talking-head videos",
    seoDescription:
      "Edit video by editing text. Cut retakes, filler words and pauses from talking-head videos with Yapper Studio’s transcript video editor for Mac.",
  },
  {
    slug: "automatic-captions",
    eyebrow: "Caption",
    title: "A video caption generator with timing built in.",
    shortTitle: "Automatic captions",
    description:
      "Make your video easy to follow with the sound off. Generate timed captions and subtitles from the transcript, style them for the frame, and save the spellings of names you use.",
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
    seoTitle: "Video caption generator & automatic captions",
    seoDescription:
      "Create word-synced, styled captions for short-form videos and improve spelling with a personal transcription dictionary.",
  },
  {
    slug: "social-publishing",
    eyebrow: "Publish",
    title: "Your video is ready. Get it out into the world.",
    shortTitle: "Social publishing",
    description:
      "Cross-post and schedule a video to multiple connected channels in one go. Set each caption and thumbnail, choose your destinations, and publish now or schedule for later with Poster.",
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
    seoTitle: "Cross-post and schedule videos to multiple channels",
    seoDescription:
      "Prepare and publish short-form video across social platforms with per-platform captions, thumbnails, and connected accounts.",
  },
  {
    slug: "content-calendar",
    eyebrow: "Plan",
    title: "A content calendar for the videos you’re making.",
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
    seoTitle: "Content calendar & planning tool for creators",
    seoDescription:
      "Plan short-form video with a content calendar connected to your ideas, scripts, recordings, production status, and social posts.",
  },
  {
    slug: "content-library",
    eyebrow: "Organize",
    title: "A content library for ideas, scripts, and videos.",
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
    seoTitle: "Content library for video projects & scripts",
    seoDescription:
      "Organize content ideas, scripts, video takes, edits, and publishing status in one connected creator content library.",
  },
];

export function getMarketingFeature(slug: string) {
  return marketingFeatures.find((feature) => feature.slug === slug);
}
