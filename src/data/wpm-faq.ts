/** FAQ for the words-per-minute tool. Shared by the visible on-page FAQ and the
 * FAQPage JSON-LD so the two can never drift (Google requires the answer text to
 * be visible on the page). */
export const WPM_FAQ: { q: string; a: string }[] = [
  {
    q: "How many words per minute is a good speaking pace?",
    a: "Conversational on-camera and presentation delivery usually sits around 130 to 150 words per minute. Slower (around 110) reads clearer; faster (160+) feels energetic but can rush.",
  },
  {
    q: "How long will my script take to say?",
    a: "Paste your script into the calculator and pick a pace. Spoken length is roughly the word count divided by your words-per-minute rate. For example, 200 words at 130 wpm is about 1 minute 32 seconds.",
  },
  {
    q: "How many words fit in a 1-minute video?",
    a: "At a conversational 130 words per minute, about 130 words. Enter your target time in the calculator to get the word count for any length and pace.",
  },
];
