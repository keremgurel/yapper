import type { Category, Difficulty, Topic } from "@/data/topics";

export type DrillPrompt = {
  id: string;
  title: string;
  text: string;
  category?: Category;
  difficulty?: Difficulty;
  context?: string;
  focus?: string;
};

export const readAloudPassages: Topic[] = [
  {
    id: "ra-1",
    category: "General",
    difficulty: "Easy",
    text: "The best speakers do not rush every sentence. They let important words breathe, pause at natural turns, and make the listener feel carried instead of chased.",
  },
  {
    id: "ra-2",
    category: "Business",
    difficulty: "Medium",
    text: "A useful update answers three questions quickly: what changed, why it matters, and what happens next. If one of those pieces is missing, people invent their own version of the story.",
  },
  {
    id: "ra-3",
    category: "Technology",
    difficulty: "Medium",
    text: "New tools rarely replace judgment. They shift where judgment is needed: choosing the right problem, checking the output, and knowing when a faster answer is not a better answer.",
  },
  {
    id: "ra-4",
    category: "Society",
    difficulty: "Hard",
    text: "Trust is built when words, timing, and behavior point in the same direction. When they do not, even accurate information can sound like damage control.",
  },
];

export const explainAfterReadingPrompts: DrillPrompt[] = [
  {
    id: "ear-1",
    title: "The useful summary",
    context: "Workplace communication",
    text: "When a team leaves a meeting with different versions of the decision, the meeting did not really end. A strong close restates the decision, names the owner, and makes the next visible step impossible to miss.",
    focus:
      "Explain the main idea, why it matters, and one example of how you would apply it.",
  },
  {
    id: "ear-2",
    title: "Confidence and evidence",
    context: "Persuasion",
    text: "Confidence is easier to trust when it leaves room for new evidence. The person who can say 'here is what I think, and here is what would change my mind' often sounds more credible than the person who never bends.",
    focus:
      "Explain the difference between confidence and stubbornness in your own words.",
  },
  {
    id: "ear-3",
    title: "Attention as respect",
    context: "Social skill",
    text: "Listening is not waiting politely for your turn. It is tracking what the other person means closely enough that your next sentence proves you understood them.",
    focus:
      "Summarize the point, then describe what good listening would sound like in a real conversation.",
  },
];

export const interviewPrepPrompts: Topic[] = [
  {
    id: "int-1",
    category: "Business",
    difficulty: "Easy",
    text: "Tell me about yourself. Keep it relevant to the role and end with why this opportunity makes sense now.",
  },
  {
    id: "int-2",
    category: "Business",
    difficulty: "Medium",
    text: "Tell me about a time you received difficult feedback. What changed in your behavior afterward?",
  },
  {
    id: "int-3",
    category: "Business",
    difficulty: "Medium",
    text: "Describe a project where the goal was unclear. How did you create clarity and move the work forward?",
  },
  {
    id: "int-4",
    category: "Business",
    difficulty: "Hard",
    text: "Tell me about a time you disagreed with a strong stakeholder. How did you handle it without damaging trust?",
  },
];

export const datingSocialPrompts: Topic[] = [
  {
    id: "date-1",
    category: "Fun",
    difficulty: "Easy",
    text: "Answer warmly: 'What have you been into lately?' Include one specific detail and one easy follow-up question.",
  },
  {
    id: "date-2",
    category: "Fun",
    difficulty: "Medium",
    text: "Tell a 45-second story about a tiny inconvenience that reveals something charming or funny about you.",
  },
  {
    id: "date-3",
    category: "General",
    difficulty: "Medium",
    text: "Respond playfully when someone says, 'I am terrible at making plans.' Keep it light, not needy.",
  },
  {
    id: "date-4",
    category: "General",
    difficulty: "Hard",
    text: "Practice saying you are interested in seeing someone again without over-explaining or performing confidence.",
  },
];

export const conflictPrompts: Topic[] = [
  {
    id: "con-1",
    category: "Society",
    difficulty: "Easy",
    text: "Respond calmly: 'I felt ignored when you changed the plan without telling me.' Start by acknowledging, then state your view.",
  },
  {
    id: "con-2",
    category: "Business",
    difficulty: "Medium",
    text: "A coworker says your update made them look bad. Practice taking responsibility for your part without accepting a false accusation.",
  },
  {
    id: "con-3",
    category: "General",
    difficulty: "Medium",
    text: "Set a boundary with someone who keeps interrupting you. Be direct, respectful, and brief.",
  },
  {
    id: "con-4",
    category: "Business",
    difficulty: "Hard",
    text: "Tell a manager you disagree with a decision because it creates a real risk. Use evidence, not attitude.",
  },
];

export const creatorCameraPrompts: Topic[] = [
  {
    id: "creator-1",
    category: "Technology",
    difficulty: "Easy",
    text: "Pitch one saved content idea with a hook, one useful payoff, and a concrete example.",
  },
  {
    id: "creator-2",
    category: "Business",
    difficulty: "Medium",
    text: "Explain a mistake beginners make in your niche. Open with the mistake, then give the better move.",
  },
  {
    id: "creator-3",
    category: "General",
    difficulty: "Medium",
    text: "Turn a belief you have changed into a 60-second camera take: old view, new evidence, new view.",
  },
  {
    id: "creator-4",
    category: "Hot Takes",
    difficulty: "Hard",
    text: "Give a respectful contrarian take. State the common advice, your disagreement, and the nuance people miss.",
  },
];
