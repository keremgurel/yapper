import type { Metadata } from "next";
import HomeJsonLd from "./home-json-ld";
import LandingClient from "./landing-client";
import { getRandomTopic } from "@/lib/practice-helpers";

export const metadata: Metadata = {
  title: "Free Random Topic Generator for Speech Practice",
  description:
    "Free random topic generator for speech practice, impromptu speech topics, table topics questions, and public speaking practice online. Practice on camera with Yapper's timer, optional recording, and future training drills.",
  alternates: {
    canonical: "https://ypr.app",
  },
};

export default function Page() {
  const initialTopic = getRandomTopic(null, "All", "All");

  return (
    <>
      <HomeJsonLd />
      <LandingClient initialTopic={initialTopic} />
    </>
  );
}
