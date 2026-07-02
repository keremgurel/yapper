import type { Metadata } from "next";
import StudioPage from "@/components/studio/studio-page";

export const metadata: Metadata = {
  title: "Editor: Free In-Browser Video Editor",
  description:
    "Edit talking-head videos in your browser: trim and split clips, cut silences automatically, and preview the result. Free, local-first, no sign-up.",
  alternates: { canonical: "https://ypr.app/studio/editor" },
};

export default function Page() {
  return <StudioPage />;
}
