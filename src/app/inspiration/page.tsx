import type { Metadata } from "next";
import InspirationPage from "@/components/inspiration/inspiration-page";

export const metadata: Metadata = {
  title: "Inspiration Library: Save & Transcribe Speaking Clips",
  description:
    "Build a swipe file for your talks. Paste YouTube, TikTok, or Instagram links into content-pillar folders and capture transcripts automatically. Free, no sign-up.",
  alternates: { canonical: "https://ypr.app/inspiration" },
};

export default function Page() {
  return <InspirationPage />;
}
