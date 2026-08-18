import type { Metadata } from "next";

import TrainingLayout from "@/app/training-layout";
import SessionReport from "@/app/progress/[id]/report-client";

export const metadata: Metadata = {
  title: "Session feedback",
  // Someone's practice answers are theirs. Never index them.
  robots: { index: false, follow: false },
};

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <TrainingLayout>
      <SessionReport id={id} />
    </TrainingLayout>
  );
}
