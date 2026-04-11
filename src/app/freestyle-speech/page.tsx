import type { Metadata } from "next";
import FreestyleSpeechClient from "./client";
import { getRandomTopic } from "@/lib/practice-helpers";

export const metadata: Metadata = {
  title: "Freestyle Speech Practice",
  description:
    "Practice freestyle impromptu speaking with a timer. No topic, no prompts. Just set your time and start talking. Free, no sign-up.",
  alternates: {
    canonical: "https://ypr.app/freestyle-speech",
  },
};

export default function FreestyleSpeechPage() {
  const dummyTopic = getRandomTopic(null, "All", "All");

  return <FreestyleSpeechClient initialTopic={dummyTopic} />;
}
