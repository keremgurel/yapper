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
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <TrainingLayout>
      <StudioAccessForm next={next} />
    </TrainingLayout>
  );
}
