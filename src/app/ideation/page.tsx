import type { Metadata } from "next";
import IdeationPage from "@/components/ideation/ideation-page";

export const metadata: Metadata = {
  title: "Ideation: Turn Saved Clips into Talk Drafts | Yapper",
  description:
    "Turn inspiration into structured talk drafts: hook options, key points, an example, and a call to action. Free, local-first, no sign-up.",
  alternates: { canonical: "https://ypr.app/ideation" },
};

export default function Page() {
  return <IdeationPage />;
}
