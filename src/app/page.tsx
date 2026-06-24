import type { Metadata } from "next";
import HomeJsonLd from "./home-json-ld";
import LandingClient from "./landing-client";
import { getRandomTopic } from "@/lib/practice-helpers";

export const metadata: Metadata = {
  title: "Camera Speaking Practice | Yapper",
  description:
    "Practice speaking on camera with free random-topic and freestyle reps. Future Yapper training programs will cover interviews, creator drills, read-aloud, and more.",
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
