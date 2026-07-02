import type { Metadata } from "next";
import ContentLibrary from "@/components/library/content-library";

export const metadata: Metadata = {
  title: "Content Library",
  description:
    "Your content pipeline: shape ideas into scripts with AI and track them from drafted to posted.",
  robots: { index: false }, // personal dashboard surface
};

export default function Page() {
  return <ContentLibrary />;
}
