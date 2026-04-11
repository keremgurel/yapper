import type { Metadata } from "next";
import HomeJsonLd from "../home-json-ld";
import RandomTopicClient from "./client";
import { getRandomTopic } from "@/lib/practice-helpers";

export const metadata: Metadata = {
  title: "Free Random Topic Generator for Speech Practice",
  description:
    "Free random topic generator for impromptu speaking practice, table topics, and speech prompts. Built-in timer, optional recording, and no sign-up.",
  alternates: {
    canonical: "https://ypr.app/random-topic-generator",
  },
};

export default function RandomTopicGeneratorPage() {
  const initialTopic = getRandomTopic(null, "All", "All");

  return (
    <>
      <HomeJsonLd />
      <RandomTopicClient initialTopic={initialTopic} />
    </>
  );
}
