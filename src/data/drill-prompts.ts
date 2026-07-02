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
    text: "Good speakers are not the ones who never pause. They are the ones who pause on purpose. They let the important word land, take a breath the listener can follow, and trust that a clear sentence does not need to be a fast one. When you slow down at the right moment, people lean in. When you rush, they fall behind, and the point you cared about most slips by unnoticed.",
  },
  {
    id: "ra-2",
    category: "Business",
    difficulty: "Medium",
    text: "Here is a simple way to give an update people actually remember. Say what changed. Say why it matters. Say what happens next. Three beats, in that order, with a pause between each one. If you skip the why, it sounds like noise. If you skip the next step, people nod politely and then do nothing. The shortest update that answers all three questions will always beat the longest one that answers none of them.",
  },
  {
    id: "ra-3",
    category: "Technology",
    difficulty: "Medium",
    text: "New tools rarely remove the need for judgment. They just move it somewhere else. Instead of doing the work by hand, you now have to choose the right problem, check the result, and notice when a fast answer is quietly the wrong one. The machine can draft, sort, and summarize in seconds. What it cannot do is care about the outcome. That part is still yours, and it is the part that decides whether any of the speed was worth it.",
  },
  {
    id: "ra-4",
    category: "Society",
    difficulty: "Hard",
    text: "Trust is not built by saying the right words. It is built when your words, your timing, and your behavior all point in the same direction. When they line up, people relax; they stop reading between the lines and simply listen. When they clash, even a true and careful statement can sound like damage control. The uncomfortable part is that you cannot talk your way back into trust you have spent. You can only rebuild it, slowly, one kept promise at a time.",
  },
  {
    id: "ra-5",
    category: "General",
    difficulty: "Medium",
    text: "Think about the last time someone told a story really well. They did not give you every detail. They chose a few, and they made them vivid: a specific smell, a single line of dialogue, one small moment that suddenly felt real. That is the difference between reporting and storytelling. Reporting lists what happened. Storytelling decides what mattered, and then says it slowly enough that you can picture it too.",
  },
  {
    id: "ra-6",
    category: "Fun",
    difficulty: "Easy",
    text: "Nobody is born a confident speaker. The people who look natural on camera were once just as stiff as everyone else. They simply did the boring thing: they practiced out loud, watched themselves back, and let the cringe teach them something. Confidence is not a personality trait you either have or lack. It is a habit you build, one slightly awkward rep at a time, until one day the words just show up when you need them.",
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
