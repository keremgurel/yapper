import type { Metadata } from "next";
import PosterWorkspace from "@/components/publish/poster-workspace";

export const metadata: Metadata = {
  title: "Poster",
  description: "Prepare, schedule, and publish finished videos.",
  robots: { index: false }, // personal dashboard surface
};

export default function Page() {
  return <PosterWorkspace />;
}
