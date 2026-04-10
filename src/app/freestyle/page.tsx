import type { Metadata } from "next";
import FreestyleClient from "./client";
import { getRandomTopic } from "@/lib/practice-helpers";

export const metadata: Metadata = {
  title: "Freestyle Speech Practice",
  description:
    "Practice freestyle impromptu speaking with a timer. No topic, no prompts — just set your time and start talking. Free, no sign-up.",
  alternates: {
    canonical: "https://ypr.app/freestyle",
  },
};

export default function FreestylePage() {
  // Provide a dummy topic — it won't be displayed in freestyle mode
  const dummyTopic = getRandomTopic(null, "All", "All");

  return <FreestyleClient initialTopic={dummyTopic} />;
}
