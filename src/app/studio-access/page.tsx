import type { Metadata } from "next";

import StudioAccessForm from "@/components/studio-shell/studio-access-form";
import TrainingLayout from "@/app/training-layout";

export const metadata: Metadata = {
  title: "Studio access",
  robots: { index: false, follow: false },
};

export default async function StudioAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; revoked?: string }>;
}) {
  const { next, revoked } = await searchParams;
  return (
    <TrainingLayout>
      <StudioAccessForm next={next} revoked={revoked === "1"} />
    </TrainingLayout>
  );
}
