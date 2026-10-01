import { marketingMetadata } from "@/lib/marketing-metadata";

import TrainingHub from "@/components/training/training-hub";

export const metadata = marketingMetadata(
  "Free public speaking practice & exercises online",
  "Practice public speaking online with random topics, interview prompts, a timer, and recording. Start free without an account; add AI coaching with credits.",
  "/training",
);

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <TrainingHub initialMode={mode} />;
}
