import type { Metadata } from "next";
import RecordClient from "@/components/teleprompter/record-client";

export const metadata: Metadata = {
  title: "Record with teleprompter",
  description:
    "Record your take with a scrolling teleprompter of your script or key points, then edit and get AI feedback.",
  alternates: { canonical: "https://ypr.app/record" },
};

export default function Page() {
  return <RecordClient />;
}
