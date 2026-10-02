import type { Metadata } from "next";
import TrainingHub from "@/components/training/training-hub";
import { getTrainingMode } from "@/data/training-modes";
import { marketingMetadata } from "@/lib/marketing-metadata";
import { trainingModeCanonical } from "@/lib/seo/training-mode-canonical";

type Props = { searchParams: Promise<{ mode?: string }> };

const hub = marketingMetadata(
  "Free speaking practice: exercises you can start now",
  "Practice speaking online with a random topic generator, interview questions, read-aloud passages and conversation scenarios. Timed, free, and no account needed.",
  "/training",
);

/**
 * The hub is the indexed page. `?mode=` opens an exercise in place, which
 * duplicates that exercise's own page, so each mode canonicalizes there. A
 * mode with no page of its own, or an unknown value, is kept out of the index.
 */
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { mode } = await searchParams;
  if (!mode) return hub;
  const selected = getTrainingMode(mode);
  const canonical = selected && trainingModeCanonical(selected.slug);
  if (!selected || !canonical)
    return { ...hub, alternates: {}, robots: { index: false, follow: true } };
  return marketingMetadata(
    `${selected.title} practice`,
    selected.description,
    canonical,
  );
}

export default async function TrainingPage({ searchParams }: Props) {
  const { mode } = await searchParams;
  return <TrainingHub initialMode={mode} />;
}
