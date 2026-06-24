export type TrainingCategory = "Mindset" | "Retrieval" | "Voice" | "Structure";
export type TrainingStatus = "Free now" | "Coming" | "Credits later";

export type TrainingDrill = {
  id: string;
  title: string;
  category: TrainingCategory;
  protocol: string;
  duration: string;
  level: "Starter" | "Intermediate" | "Advanced";
  outcome: string;
  whyItWorks: string;
  steps: string[];
  cue: string;
  avoid: string;
};

export type TrainingProtocol = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  promise: string;
  duration: string;
  cadence: string;
  blogHref: string;
  drills: TrainingDrill[];
};

export type ProgramFamily = {
  slug: string;
  title: string;
  skill: string;
  prompt: string;
  sampleTask: string;
  duration: string;
  status: TrainingStatus;
  accent: "cyan" | "orange" | "emerald" | "fuchsia" | "amber" | "rose";
};

export type InspirationFeature = {
  title: string;
  description: string;
};

export const fluencyProtocol: TrainingProtocol = {
  slug: "fluency-on-steroids",
  title: "Fluency on steroids",
  eyebrow: "Protocol 01",
  description:
    "A four-drill routine for faster word retrieval, smoother vocal control, and cleaner summaries under pressure.",
  promise:
    "Use this before a random topic or freestyle rep when your brain feels slow, your voice gets tight, or your thoughts come out messy.",
  duration: "12 minutes",
  cadence: "3-5x/week",
  blogHref: "/blog/fluency-practice-drills",
  drills: [
    {
      id: "clear-freeze-label",
      title: "Clear the freeze label",
      category: "Mindset",
      protocol: "Fluency on steroids",
      duration: "90 sec",
      level: "Starter",
      outcome:
        "Enter the rep with a behavior you can perform instead of an identity you have to fight.",
      whyItWorks:
        "A hidden label like “I always freeze” adds a second task: speak and disprove the story. This drill narrows the job before you start.",
      steps: [
        "Write the old label in one plain sentence.",
        "Replace it with one observable behavior.",
        "Start the speaking rep immediately after the replacement sentence.",
      ],
      cue: "Swap “I am underconfident” for “I can start with one clear sentence.”",
      avoid:
        "Do not turn this into therapy cosplay. One label, one replacement, then speak.",
    },
    {
      id: "rapid-speed-reading",
      title: "Rapid speed-reading",
      category: "Retrieval",
      protocol: "Fluency on steroids",
      duration: "5 pages",
      level: "Starter",
      outcome:
        "Push word retrieval and articulation above normal conversation speed so regular speech feels less chaotic.",
      whyItWorks:
        "Fast out-loud reading creates a controlled sprint: your eyes, brain, breath, and mouth have to coordinate without inventing the content.",
      steps: [
        "Choose an easy book, article, or note.",
        "Read out loud faster than comfortable while keeping words recognizable.",
        "Repeat one messy sentence cleaner, then keep moving.",
      ],
      cue: "Five pages. Fast enough to stretch you, clear enough that another person could still understand you.",
      avoid:
        "Do not fake speed by mumbling. If endings disappear, slow down one notch and articulate.",
    },
    {
      id: "smooth-pitch-gliding",
      title: "Smooth pitch gliding",
      category: "Voice",
      protocol: "Fluency on steroids",
      duration: "3 min",
      level: "Intermediate",
      outcome:
        "Keep your voice alive under pressure instead of flattening into one nervous note.",
      whyItWorks:
        "Deliberate pitch and volume movement builds control. When pressure rises, your voice has practiced places to go.",
      steps: [
        "Pick one sentence you can repeat without thinking.",
        "Say it slowly while gliding pitch up and down inside the sentence.",
        "Repeat with volume changes, then with emphasis on different words.",
      ],
      cue: "Try: “The point I want to make is simple: clarity beats speed.”",
      avoid:
        "Do not perform a cartoon voice. The glide should be controlled enough to still sound like you.",
    },
    {
      id: "three-step-summary",
      title: "The 3-step summary",
      category: "Structure",
      protocol: "Fluency on steroids",
      duration: "1 paragraph",
      level: "Starter",
      outcome:
        "Compress information into a clean spoken point instead of dragging every thought into the answer.",
      whyItWorks:
        "Rambling is often failed compression. This drill trains the sequence: find the point, explain why it matters, land the takeaway.",
      steps: [
        "Read one paragraph once.",
        "Close the page or turn away from the screen.",
        "Summarize out loud: main idea, context, conclusion.",
      ],
      cue: "Main idea: what it says. Context: why it matters. Conclusion: what to remember.",
      avoid: "Do not recite the paragraph. Compression is the rep.",
    },
  ],
};

export const trainingProtocols: TrainingProtocol[] = [fluencyProtocol];

export const programFamilies: ProgramFamily[] = [
  {
    slug: "freestyle-reps",
    title: "Freestyle reps",
    skill: "Spontaneous camera presence",
    prompt: "Open camera. Pick a lane. Talk without hiding behind a script.",
    sampleTask:
      "Record a 90-second take on what you are thinking about this week.",
    duration: "1-3 min",
    status: "Free now",
    accent: "cyan",
  },
  {
    slug: "explain-after-reading",
    title: "Explain after reading",
    skill: "Comprehension into speech",
    prompt: "Read something short, close it, then explain it like a human.",
    sampleTask:
      "Read one paragraph about creator monetization, then explain the point in 60 seconds.",
    duration: "3-8 min",
    status: "Coming",
    accent: "emerald",
  },
  {
    slug: "read-aloud",
    title: "Read aloud",
    skill: "Articulation, pacing, and vocal control",
    prompt: "Turn written words into clean on-camera delivery.",
    sampleTask:
      "Read a dense paragraph twice: once for clarity, once for emphasis.",
    duration: "2-5 min",
    status: "Coming",
    accent: "amber",
  },
  {
    slug: "interview-prep",
    title: "Interview prep",
    skill: "Structured answers under pressure",
    prompt: "Practice concise answers without sounding rehearsed.",
    sampleTask:
      "Answer: tell me about a time you changed your mind after getting better evidence.",
    duration: "5-12 min",
    status: "Coming",
    accent: "fuchsia",
  },
  {
    slug: "dating-social",
    title: "Dating and social",
    skill: "Warmth, stories, and playful answers",
    prompt: "Get smoother at the small moments where people actually connect.",
    sampleTask:
      "Tell a 45-second story about a tiny inconvenience that says something about you.",
    duration: "2-6 min",
    status: "Coming",
    accent: "rose",
  },
  {
    slug: "conflict-handling",
    title: "Conflict handling",
    skill: "Calm disagreement",
    prompt: "Say the hard thing clearly without spiraling or over-explaining.",
    sampleTask:
      "Respond to: I feel like you ignored what I asked for. Keep it direct and calm.",
    duration: "3-8 min",
    status: "Coming",
    accent: "orange",
  },
  {
    slug: "creator-camera-drills",
    title: "Creator camera drills",
    skill: "Hooks, framing, and take energy",
    prompt: "Practice the on-camera moves that make short-form ideas land.",
    sampleTask:
      "Pitch one saved content idea with a hook, payoff, and one crisp example.",
    duration: "2-10 min",
    status: "Coming",
    accent: "cyan",
  },
  {
    slug: fluencyProtocol.slug,
    title: fluencyProtocol.title,
    skill: "Word retrieval and speech compression",
    prompt: fluencyProtocol.description,
    sampleTask:
      "Run the four-drill warmup, then immediately record a random-topic rep.",
    duration: fluencyProtocol.duration,
    status: "Free now",
    accent: "emerald",
  },
];

export const inspirationFeatures: InspirationFeature[] = [
  {
    title: "Save the source",
    description:
      "Paste TikTok, Instagram, or YouTube Shorts links into content pillars instead of losing them in a notes app.",
  },
  {
    title: "Study the format",
    description:
      "Later, Yapper will transcribe clips, pull hooks, detect repeatable formats, and surface why a video works.",
  },
  {
    title: "Write the yap",
    description:
      "Turn saved inspiration into bullets, scripts, and recording prompts for your next camera rep.",
  },
  {
    title: "Track creators",
    description:
      "Keep favorite creators and top-performing videos close when you want to practice a style on purpose.",
  },
];
