import type { Metadata } from "next";

import FreestyleSpeechClient from "@/app/freestyle-speech/client";
import { getRandomTopic } from "@/lib/practice-helpers";

export const metadata: Metadata = {
  title: "Freestyle Speech Training",
  description:
    "Practice freestyle speaking with a timer and optional recording. No topic, no prompt, just a clean speaking rep.",
  alternates: {
    canonical: "https://ypr.app/training/freestyle-speech",
  },
};

export default function TrainingFreestyleSpeechPage() {
  const dummyTopic = getRandomTopic(null, "All", "All");

  return <FreestyleSpeechClient initialTopic={dummyTopic} />;
}
