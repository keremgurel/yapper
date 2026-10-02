import { computeMetrics, type FeedbackWord } from "@/lib/feedback/metrics";
import type { PronunciationReport } from "@/lib/pronunciation/types";
import type {
  TrainingCoaching,
  TrainingContext,
  TranscriptWord,
} from "@/lib/training-feedback/types";

/**
 * A made-up practice answer and its feedback, for the sample report page.
 * The delivery numbers are computed from the sample words by the same code
 * that measures a real recording; the scores and coaching are written by
 * hand to show what a report contains.
 */
const SPOKEN =
  "Um, so I think the thing I changed my mind about is, like, working from home. | Before I was thinking it is more lazy, you know, people just stay in pajamas. | But when I start doing it, I realized I am getting more things done. || I mean, there is less interruptions, and, um, I can plan my day better. | So basically now I think it depends of the person.";

/** Lay the words on a timeline: "|" is a pause, "||" a long one. */
function timeline(text: string): FeedbackWord[] {
  const words: FeedbackWord[] = [];
  let at = 0.4;
  for (const token of text.split(/\s+/)) {
    if (token === "|") at += 0.7;
    else if (token === "||") at += 1.8;
    else {
      const length = 0.16 + token.length * 0.035;
      words.push({ text: token, start: at, end: at + length });
      // Two hesitations inside a sentence, after words with no punctuation.
      at += length + (token === "thing" || token === "am" ? 0.65 : 0.08);
    }
  }
  return words;
}

const words = timeline(SPOKEN);
const at = (phrase: string) => {
  const first = phrase.split(" ")[0];
  const word = words.find((w) => w.text.replace(/[.,]/g, "") === first);
  return { start: word?.start ?? null, end: word ? word.end + 1 : null };
};

export const sampleTranscript: TranscriptWord[] = words;
export const sampleMetrics = computeMetrics(words);

export const sampleContext: TrainingContext = {
  drillSlug: "random-topic-generator",
  drillTitle: "Random topic generator",
  prompt: "What’s something you changed your mind about recently?",
  targetSeconds: 60,
  goals: [],
};

export const sampleCoaching: TrainingCoaching = {
  overview:
    "You answered the question and gave a real reason, which is the hard part. The point arrives late, after two filler-heavy openers, and a few grammar slips make the middle harder to follow than it needs to be.",
  scores: {
    overall: 64,
    clarity: 68,
    language: 58,
    vocabulary: 61,
    delivery: 60,
    impact: 66,
  },
  rationales: {
    clarity:
      "The answer has a before, a change and a conclusion. It would land sooner if the first sentence named the change.",
    language:
      "Tense slips (“when I start doing it”) and “less interruptions” are small but repeated.",
    vocabulary:
      "Plain and understandable. “More lazy” and “getting more things done” could be tighter.",
    delivery:
      "Six fillers in under a minute, and two pauses fall in the middle of a sentence.",
    impact:
      "The pajamas detail is memorable. The ending trails off instead of closing the thought.",
  },
  strengths: [
    "You gave a concrete reason for the change: fewer interruptions and a day you can plan.",
    "The pajamas line is specific and easy to picture.",
  ],
  improvements: [
    "Say the change in your first sentence: “I used to think working from home was lazy. I don’t anymore.”",
    "Replace “um” and “like” with a short silent pause.",
    "End on your conclusion, then stop.",
  ],
  corrections: [
    {
      type: "filler",
      original: "Um, so",
      fix: null,
      note: "Start on the first real word.",
      ...at("Um"),
    },
    {
      type: "grammar",
      original: "it is more lazy",
      fix: "it was lazier",
      note: "Past tense for an old belief, and “lazier” for the comparative.",
      ...at("it"),
    },
    {
      type: "grammar",
      original: "when I start doing it",
      fix: "when I started doing it",
      note: "Keep the story in the past tense.",
      ...at("when"),
    },
    {
      type: "grammar",
      original: "there is less interruptions",
      fix: "there are fewer interruptions",
      note: "“Fewer” for things you can count.",
      ...at("there"),
    },
    {
      type: "phrasing",
      original: "it depends of the person",
      fix: "it depends on the person",
      note: "“Depend on”, not “depend of”.",
      ...at("depends"),
    },
  ],
  upgradeLines: [
    {
      before:
        "Before I was thinking it is more lazy, you know, people just stay in pajamas.",
      after:
        "I used to think it was the lazy option: people at home in pajamas.",
    },
    {
      before: "So basically now I think it depends of the person.",
      after: "Now I think it depends on the person, and it works for me.",
    },
  ],
  polishedTranscript:
    "I changed my mind about working from home. I used to think it was the lazy option: people at home in pajamas. But when I started doing it, I realized I was getting more done. There are fewer interruptions, and I can plan my day better. Now I think it depends on the person, and it works for me.",
  structuralGaps: [
    {
      kind: "missing_close",
      severity: "medium",
      note: "The answer ends on a hedge. Close by restating where you landed.",
    },
  ],
};

/** An earlier attempt at the same prompt, to show the comparison. */
export const samplePrevious = {
  scores: { ...sampleCoaching.scores, overall: 55 },
  metrics: {
    ...sampleMetrics,
    fillerPerMin: Math.round(sampleMetrics.fillerPerMin * 1.6 * 10) / 10,
    midSentencePauseCount: (sampleMetrics.midSentencePauseCount ?? 0) + 3,
    longPauseCount: sampleMetrics.longPauseCount + 1,
  },
};

export const samplePronunciation: PronunciationReport = {
  accuracy: 84,
  fluency: 71,
  prosody: 63,
  monotoneShare: 41,
  assessedSeconds: 31,
  words: [
    { text: "particularly", accuracy: 48, start: 6.2, sound: "l" },
    { text: "thoroughly", accuracy: 55, start: 14.8, sound: "th" },
    { text: "comfortable", accuracy: 62, start: 21.4, sound: "er" },
    { text: "schedule", accuracy: 67, start: 26.1, sound: "jh" },
  ],
};
