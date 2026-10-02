/** Copy for the Train AI feedback page. Every claim here matches what
 * /api/training/feedback returns: a transcript, measured delivery, five
 * scores, corrections and a coaching focus. It reviews audio, not video. */
export const feedbackSteps = [
  {
    title: "Record an attempt",
    description:
      "Do any exercise with your microphone on. A minute is enough to score.",
  },
  {
    title: "Ask for feedback",
    description:
      "Your recording is transcribed, then scored against the prompt you were answering. It takes about half a minute.",
  },
  {
    title: "Try it again",
    description:
      "Read the corrections, take the one suggested focus, and record the same prompt again to hear the difference.",
  },
];

export const feedbackQuestions = [
  {
    question: "What does the feedback look at?",
    answer:
      "The words you said and how you said them: structure, grammar, word choice, pace, pauses and filler words. It works from audio, so it does not judge eye contact or body language.",
  },
  {
    question: "Is it free?",
    answer:
      "Practice is free. A new account gets one feedback session at no cost. After that, Train Plus gives you unlimited feedback.",
  },
  {
    question: "Do I need to speak for a long time?",
    answer:
      "No. A recording needs at least a few sentences to be scored. If it is too short, you are told so and no session is used.",
  },
  {
    question: "Will it make me a better speaker?",
    answer:
      "It tells you what happened in one attempt and gives you one thing to change. Improvement comes from repeating the exercise. It is not a guarantee of any result.",
  },
  {
    question: "Are my recordings kept?",
    answer:
      "Your transcript, scores and coaching are saved to your account so you can see progress over time.",
  },
];
