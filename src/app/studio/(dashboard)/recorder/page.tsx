import type { Metadata } from "next";
import RecordClient from "@/components/teleprompter/record-client";

export const metadata: Metadata = {
  title: "Record with teleprompter",
  description:
    "Record your take with a scrolling teleprompter, then download it or save it to your content library.",
  alternates: { canonical: "https://ypr.app/studio/recorder" },
};

export default function Page() {
  return <RecordClient />;
}
