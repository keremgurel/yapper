import type { Topic } from "./topics";
import { drills } from "./drills";

export type TrainingMode = {
  slug: string;
  title: string;
  description: string;
  instruction: string;
  group: "Everyday practice" | "Real situations";
  kind: "topic" | "freestyle" | "reading" | "recall" | "research";
  seconds: number;
  duration: string;
  pool?: Topic[];
};

const researchTopics: Topic[] = [
  {
    id: "research-1",
    text: "How does spaced repetition help us remember?",
    category: "General",
    difficulty: "Easy",
  },
  {
    id: "research-2",
    text: "What is confirmation bias, and where does it show up?",
    category: "Society",
    difficulty: "Medium",
  },
  {
    id: "research-3",
    text: "Why does switching between tasks have a cost?",
    category: "Technology",
    difficulty: "Medium",
  },
  {
    id: "research-4",
    text: "What makes a habit easier to repeat?",
    category: "General",
    difficulty: "Easy",
  },
  {
    id: "research-5",
    text: "How can incentives create unintended consequences?",
    category: "Business",
    difficulty: "Hard",
  },
  {
    id: "research-6",
    text: "What does a study’s sample size tell us, and what doesn’t it tell us?",
    category: "General",
    difficulty: "Hard",
  },
];

export const trainingModes: TrainingMode[] = [
  {
    slug: "random-topic-generator",
    title: "Random topic",
    description: "Turn a fresh question into a clear answer.",
    instruction:
      "Make a point, give an example, and bring it back to your point.",
    group: "Everyday practice",
    kind: "topic",
    seconds: 60,
    duration: "1 min",
  },
  {
    slug: "freestyle-speech",
    title: "Freestyle",
    description: "Talk through something already on your mind.",
    instruction:
      "Choose one thought. Say it out loud without writing a script first.",
    group: "Everyday practice",
    kind: "freestyle",
    seconds: 90,
    duration: "90 sec",
  },
  {
    slug: "read-aloud",
    title: "Read aloud",
    description: "Practice pace, expression, and clear articulation.",
    instruction:
      "Read the passage out loud. Pause at the end of each thought, then try it again with different emphasis.",
    group: "Everyday practice",
    kind: "reading",
    seconds: 120,
    duration: "2 min",
    pool: drills["read-aloud"].pool,
  },
  {
    slug: "explain-after-reading",
    title: "Explain after reading",
    description: "Read a short passage, hide it, and explain it.",
    instruction:
      "Read until you understand the idea. When you start, the passage will disappear. Explain it in your own words with one example.",
    group: "Everyday practice",
    kind: "recall",
    seconds: 60,
    duration: "Read + 1 min",
    pool: drills["explain-after-reading"].pool,
  },
  {
    slug: "research-and-explain",
    title: "Research and explain",
    description: "Learn something new, then teach it in a minute.",
    instruction:
      "Spend 15 minutes researching this question. Take handwritten notes, check your sources, then close them and explain what you learned in one minute.",
    group: "Everyday practice",
    kind: "research",
    seconds: 60,
    duration: "15 + 1 min",
    pool: researchTopics,
  },
  {
    slug: "interview-prep",
    title: "Interview answers",
    description: "Give a specific answer that gets to the point.",
    instruction:
      "Use a real example. Briefly set the scene, explain what you did, and finish with the result. This is a solo rehearsal, not a simulated interview.",
    group: "Real situations",
    kind: "topic",
    seconds: 120,
    duration: "2 min",
    pool: drills["interview-prep"].pool,
  },
  {
    slug: "dating",
    title: "Everyday conversations",
    description: "Tell a story, show interest, and respond naturally.",
    instruction:
      "Rehearse your side of the conversation. Keep it warm and specific, and leave room for the other person to respond.",
    group: "Real situations",
    kind: "topic",
    seconds: 60,
    duration: "1 min",
    pool: drills.dating.pool,
  },
  {
    slug: "conflict",
    title: "Difficult conversations",
    description: "Say what you mean without losing your composure.",
    instruction:
      "Describe what happened without guessing motives. Say what you need and make one clear request. Practice your response, not winning an argument.",
    group: "Real situations",
    kind: "topic",
    seconds: 90,
    duration: "90 sec",
    pool: drills.conflict.pool,
  },
  {
    slug: "creator-camera-drills",
    title: "On-camera delivery",
    description: "Make a hook, a story, or an explanation land.",
    instruction:
      "Keep one viewer in mind. Lead with a clear idea, deliver the useful part, then stop. Turn on your camera if you want to review your delivery.",
    group: "Real situations",
    kind: "topic",
    seconds: 60,
    duration: "1 min",
    pool: drills["creator-camera-drills"].pool,
  },
];

export function getTrainingMode(slug: string) {
  return trainingModes.find((mode) => mode.slug === slug);
}
