import type { Metadata } from "next";

import HomeJsonLd from "@/app/home-json-ld";
import RandomTopicClient from "@/app/random-topic-generator/client";
import { getRandomTopic } from "@/lib/practice-helpers";

export const metadata: Metadata = {
  title: "Random Topic Generator Training",
  description:
    "Practice impromptu speaking with Yapper's free random topic generator, timer, optional recording, and speech prompts.",
  alternates: {
    canonical: "https://ypr.app/training/random-topic-generator",
  },
};

export default function TrainingRandomTopicGeneratorPage() {
  const initialTopic = getRandomTopic(null, "All", "All");

  return (
    <>
      <HomeJsonLd />
      <RandomTopicClient initialTopic={initialTopic} />
    </>
  );
}
