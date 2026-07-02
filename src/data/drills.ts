import type { Topic } from "@/data/topics";
import {
  conflictPrompts,
  creatorCameraPrompts,
  datingSocialPrompts,
  interviewPrepPrompts,
  readAloudPassages,
} from "@/data/drill-prompts";

export type DrillStep = { title: string; body: string };
export type DrillBenefit = { title: string; body: string };
export type DrillFaq = { q: string; a: string };

export type DrillContent = {
  slug: string;
  heroEyebrow: string;
  heroTitleTop: string;
  heroTitleBottom: string;
  heroDescription: string;
  pool: Topic[];
  howItWorks: DrillStep[];
  benefits: DrillBenefit[];
  faq: DrillFaq[];
};

const explainAfterReadingPool: Topic[] = [
  {
    id: "ear-1",
    category: "Business",
    difficulty: "Medium",
    text: "When a team leaves a meeting with three different versions of what was decided, the meeting did not really end. It just stopped. A strong close does three things before anyone stands up: it restates the actual decision in one sentence, it names the single person who owns the next move, and it makes the very next step impossible to misread. This takes about thirty seconds and prevents days of quiet confusion. Most meetings fail not because people disagree, but because everyone assumes the ending was as obvious to others as it felt to them.",
  },
  {
    id: "ear-2",
    category: "Society",
    difficulty: "Medium",
    text: "Confidence is easier to trust when it leaves a little room for being wrong. The person who says 'here is what I think, and here is exactly what would change my mind' often sounds more credible than the person who never bends. It seems backwards, but certainty and honesty can pull in different directions. Someone who cannot name a single thing that would update their view is not showing strength; they are showing that evidence stopped mattering to them a while ago. Real confidence is not the absence of doubt. It is being steady enough to hold your view and your doubt at the same time.",
  },
  {
    id: "ear-3",
    category: "General",
    difficulty: "Medium",
    text: "Listening is not waiting politely for your turn to talk. Most people, while someone else is speaking, are quietly loading their own response, scanning for the gap where they can jump in. Real listening is harder. It means tracking what the other person actually means closely enough that your next sentence proves you understood them, not just heard them. You can feel the difference instantly as a listener. When someone reflects your point back before adding their own, you relax. When they reply to a version of you they invented, you brace. The whole conversation changes based on which one you offer.",
  },
  {
    id: "ear-4",
    category: "Technology",
    difficulty: "Hard",
    text: "We tend to treat attention as free, but it is the one resource you spend every waking minute whether you notice or not. Every notification, open tab, and unfinished thought takes a small cut. The real cost is not the interruption itself; it is the time your brain needs afterward to find its way back to what it was doing. Deep work is less about trying harder and more about protecting long, unbroken stretches where your attention can stay pointed at one thing. Guard those stretches like they are expensive, because in the only currency that actually matters, they are.",
  },
];

export const drills: Record<string, DrillContent> = {
  "explain-after-reading": {
    slug: "explain-after-reading",
    heroEyebrow: "Comprehension into speech",
    heroTitleTop: "Explain After",
    heroTitleBottom: "Reading Practice",
    heroDescription:
      "Read a short passage, look away, and explain the main idea in your own words. Pull the lever for a new passage, set the timer, and turn on your camera or mic to review how clearly you summarized.",
    pool: explainAfterReadingPool,
    howItWorks: [
      {
        title: "Read the passage once",
        body: "A short passage appears in the recorder. Read it once slowly. Do not try to memorize the wording, just understand the point.",
      },
      {
        title: "Look away and start",
        body: "Set your time with the knob, turn the passage face down in your mind, and start the timer. Pull the lever any time you want a fresh passage.",
      },
      {
        title: "Explain it like a human",
        body: "Say the main idea, two supporting details, and the takeaway in 60-90 seconds. Record with camera or mic on to hear whether you summarized or just recited.",
      },
    ],
    benefits: [
      {
        title: "Trains real comprehension",
        body: "Explaining from memory forces you to compress information into your own words, the same skill you use in meetings, interviews, and teaching.",
      },
      {
        title: "Kills the rambling habit",
        body: "A 60-second limit makes you find the one point that matters instead of replaying every sentence you read.",
      },
      {
        title: "Builds calm recall under pressure",
        body: "Repeating read-then-explain reps makes it normal to speak clearly about something you only just learned.",
      },
    ],
    faq: [
      {
        q: "What is the explain-after-reading drill?",
        a: "It is a speaking exercise where you read a short passage, hide it, and explain the main idea out loud from memory. It trains comprehension and clear summarizing.",
      },
      {
        q: "How long should my explanation be?",
        a: "Aim for 60 to 90 seconds: one main idea, two details, and a takeaway. Use the knob to set the timer before you start.",
      },
      {
        q: "Do I need a camera or microphone?",
        a: "No. The drill works without recording, but turning on your mic or camera lets you rewatch and hear whether you summarized clearly or just repeated the text.",
      },
      {
        q: "Is it free?",
        a: "Yes. Every passage and the recorder are free, with no sign-up. Nothing leaves your browser.",
      },
    ],
  },
  "read-aloud": {
    slug: "read-aloud",
    heroEyebrow: "Articulation, pacing, and vocal control",
    heroTitleTop: "Read Aloud",
    heroTitleBottom: "Speaking Practice",
    heroDescription:
      "Turn written words into clean on-camera delivery. Pull the lever for a passage, set the timer, and read it twice: once for clarity, once for emphasis. Record to catch rushed endings and flat tone.",
    pool: readAloudPassages,
    howItWorks: [
      {
        title: "Preview the passage",
        body: "A passage appears in the recorder. Scan it once for punctuation, pauses, and any tricky words before you speak.",
      },
      {
        title: "Read for clarity",
        body: "Start the timer and read out loud. Finish every word ending and pause at commas and full stops instead of racing to the end.",
      },
      {
        title: "Read again for emphasis",
        body: "Pull the lever for a fresh passage or repeat the same one, this time choosing one deliberate emphasis per sentence. Record to hear the difference.",
      },
    ],
    benefits: [
      {
        title: "Sharper articulation",
        body: "Reading known words out loud lets you focus entirely on delivery, so your mouth learns to finish sounds instead of swallowing them.",
      },
      {
        title: "Better pacing and pauses",
        body: "Punctuation gives you a built-in map for where to breathe, training the pauses that make spontaneous speech easier to follow.",
      },
      {
        title: "A warmer, steadier voice",
        body: "Practicing emphasis on purpose keeps your voice from flattening into one nervous note when the pressure is real.",
      },
    ],
    faq: [
      {
        q: "What is a read-aloud speaking drill?",
        a: "It is reading a written passage out loud to train articulation, pacing, and emphasis without having to invent the content yourself.",
      },
      {
        q: "How many times should I read each passage?",
        a: "At least twice: once for accuracy and clarity, once for natural flow and emphasis. Pull the lever whenever you want a new passage.",
      },
      {
        q: "Does reading aloud actually improve speaking?",
        a: "Yes. It isolates delivery from idea generation, so you can drill clarity, pace, and tone, which all transfer to impromptu speaking.",
      },
      {
        q: "Is it free?",
        a: "Yes, completely free with no account. Recording stays in your browser.",
      },
    ],
  },
  "interview-prep": {
    slug: "interview-prep",
    heroEyebrow: "Structured answers under pressure",
    heroTitleTop: "Interview",
    heroTitleBottom: "Answer Practice",
    heroDescription:
      "Practice concise interview answers without sounding rehearsed. Pull the lever for a question, set the timer, and answer with a clear situation, action, and result. Record to review your structure and pace.",
    pool: interviewPrepPrompts,
    howItWorks: [
      {
        title: "Pull an interview question",
        body: "A common behavioral question appears in the recorder. Take about 15 seconds to choose one real example before you start.",
      },
      {
        title: "Answer with shape, not script",
        body: "Set the timer and open with the headline. Use situation, action, result, and lesson as a loose spine so the answer stays structured but natural.",
      },
      {
        title: "Review the recording",
        body: "Turn on camera or mic and rewatch. Listen for filler, rambling, and whether you actually answered the question that was asked.",
      },
    ],
    benefits: [
      {
        title: "Structured answers on demand",
        body: "Reps with situation-action-result wiring make a clean structure feel automatic instead of something you scramble for live.",
      },
      {
        title: "Less rehearsed, more real",
        body: "Practicing the shape rather than memorizing a script keeps your answers flexible when the interviewer asks something slightly different.",
      },
      {
        title: "Calmer under pressure",
        body: "A running timer and optional camera recreate interview pressure, so the real thing feels familiar instead of frightening.",
      },
    ],
    faq: [
      {
        q: "How does this interview practice work?",
        a: "You get a behavioral interview question, set a timer, and record a concise spoken answer using a situation-action-result structure, then review it.",
      },
      {
        q: "What is the STAR-style structure?",
        a: "Situation, action, result, and lesson. Open with the headline, give the relevant context, what you did, and what it proves about how you work now.",
      },
      {
        q: "How long should an interview answer be?",
        a: "Usually 90 to 120 seconds. Long enough to show structure, short enough to stay engaging. Set the timer with the knob before you begin.",
      },
      {
        q: "Is it free?",
        a: "Yes. Free interview question practice with an optional recorder, no sign-up required.",
      },
    ],
  },
  dating: {
    slug: "dating",
    heroEyebrow: "Warmth, stories, and playful answers",
    heroTitleTop: "Dating & Social",
    heroTitleBottom: "Conversation Practice",
    heroDescription:
      "Get smoother at the small moments where people actually connect. Pull the lever for a prompt, set a short timer, and practice warm, specific, playful answers. Record to hear if you sound natural or over-rehearsed.",
    pool: datingSocialPrompts,
    howItWorks: [
      {
        title: "Pull a social prompt",
        body: "A low-stakes dating or social prompt appears in the recorder. These are the real moments where connection happens, not interview questions.",
      },
      {
        title: "Answer warm and specific",
        body: "Set a short timer and reply with one concrete detail instead of a generic personality claim. Add a natural follow-up question when it fits.",
      },
      {
        title: "Keep it light, then review",
        body: "Stop while it still feels easy. Record with mic or camera on and check that you sound conversational, not auditioned.",
      },
    ],
    benefits: [
      {
        title: "More natural storytelling",
        body: "Short, specific story reps make it easy to share something real quickly, which is what actually makes you memorable.",
      },
      {
        title: "Playful without trying too hard",
        body: "Practicing light answers in private builds the timing and ease that feel forced when you only ever improvise on the spot.",
      },
      {
        title: "Comfortable follow-up questions",
        body: "Drilling the back-and-forth trains you to keep a conversation moving instead of freezing after your first answer.",
      },
    ],
    faq: [
      {
        q: "Can you really practice dating conversation?",
        a: "Yes. Low-stakes solo reps build the same muscles as real conversation: warm specifics, short stories, and easy follow-up questions.",
      },
      {
        q: "What makes an answer sound natural?",
        a: "One concrete detail beats a generic claim, and stopping while it still feels light beats over-explaining the bit. The recorder helps you hear the difference.",
      },
      {
        q: "Should I record myself?",
        a: "It helps. Turning on mic or camera lets you catch whether you sound relaxed and warm or stiff and rehearsed.",
      },
      {
        q: "Is it free?",
        a: "Yes, free with no account. Everything stays on your device.",
      },
    ],
  },
  conflict: {
    slug: "conflict",
    heroEyebrow: "Calm disagreement",
    heroTitleTop: "Conflict",
    heroTitleBottom: "Handling Practice",
    heroDescription:
      "Say the hard thing clearly without spiraling or over-explaining. Pull the lever for a tense scenario, set the timer, and rehearse a direct, calm response. Record to hear whether you stayed steady.",
    pool: conflictPrompts,
    howItWorks: [
      {
        title: "Pull a tense scenario",
        body: "A realistic conflict prompt appears in the recorder. Read what happened and decide what you actually want from the conversation.",
      },
      {
        title: "Name it, then state your view",
        body: "Start the timer. Begin by naming what you heard or what happened, then state your view in one plain sentence without piling on extra evidence.",
      },
      {
        title: "Ask and leave space",
        body: "Ask for the next behavior or decision you want, keep your pace slower than normal, and leave space after the hard sentence. Record to review your tone.",
      },
    ],
    benefits: [
      {
        title: "Direct without spiraling",
        body: "Rehearsing the hard sentence in advance means you can say it calmly instead of over-explaining or backing down when it counts.",
      },
      {
        title: "Steady tone under tension",
        body: "Practicing with a timer and recording trains a slower, calmer pace that keeps disagreements from escalating.",
      },
      {
        title: "Boundaries that hold",
        body: "Saying boundaries out loud beforehand makes them feel normal to deliver, so they land as clear rather than aggressive.",
      },
    ],
    faq: [
      {
        q: "How do you practice handling conflict?",
        a: "You rehearse calm, direct responses to realistic tense scenarios out loud, with a timer, before you need them in a real conversation.",
      },
      {
        q: "What is a good structure for hard conversations?",
        a: "Name what happened, state your view in one plain sentence, then ask for the next behavior or decision you want. Keep it brief and leave space.",
      },
      {
        q: "Why record myself?",
        a: "Tone matters as much as words in conflict. Recording lets you hear whether you sounded calm and direct or defensive and rushed.",
      },
      {
        q: "Is it free?",
        a: "Yes. Free conflict and disagreement practice with an optional recorder, no sign-up.",
      },
    ],
  },
  "creator-camera-drills": {
    slug: "creator-camera-drills",
    heroEyebrow: "Hooks, framing, and take energy",
    heroTitleTop: "Creator Camera",
    heroTitleBottom: "Drills",
    heroDescription:
      "Practice the on-camera moves that make short-form ideas land. Pull the lever for a prompt, set the timer, and deliver a hook, a payoff, and one crisp example straight to camera.",
    pool: creatorCameraPrompts,
    howItWorks: [
      {
        title: "Pull a creator prompt",
        body: "A short-form content prompt appears in the recorder. Turn on your camera so you are practicing the way you will actually publish.",
      },
      {
        title: "Hook, payoff, example",
        body: "Start the timer and open with the hook in one sentence. Give the payoff before the background, then land one concrete example.",
      },
      {
        title: "Rewatch the take",
        body: "End cleanly with the takeaway, then rewatch the recording for energy, eye contact, and whether the first three seconds actually grab.",
      },
    ],
    benefits: [
      {
        title: "Stronger hooks",
        body: "Reps that force a one-sentence opening train you to grab attention in the first three seconds, where short-form videos are won or lost.",
      },
      {
        title: "Tighter, punchier takes",
        body: "Leading with the payoff and one example kills the slow rambling intros that make viewers scroll away.",
      },
      {
        title: "Natural camera presence",
        body: "Recording yourself repeatedly removes the stiffness, so your on-camera energy starts to match how you talk in real life.",
      },
    ],
    faq: [
      {
        q: "What are creator camera drills?",
        a: "Short on-camera speaking reps that train the moves behind good short-form video: a strong hook, a fast payoff, and a concrete example.",
      },
      {
        q: "How do I make a stronger hook?",
        a: "Open with one sentence that creates curiosity or stakes, and deliver the payoff before the background context instead of after it.",
      },
      {
        q: "Should I keep the camera on?",
        a: "Yes. Recording is the point here. Rewatching your takes is how you fix energy, pacing, and eye contact.",
      },
      {
        q: "Is it free?",
        a: "Yes, free with no account, and your recordings never leave your browser.",
      },
    ],
  },
};

export function getDrill(slug: string): DrillContent | undefined {
  return drills[slug];
}
