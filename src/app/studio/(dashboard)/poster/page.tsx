import type { Metadata } from "next";
import PosterHub, { type PosterTab } from "@/components/poster/poster-hub";

export const metadata: Metadata = {
  title: "Poster",
  description: "Post a finished cut and see everything on your calendar.",
  robots: { index: false }, // personal dashboard surface
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab: PosterTab = tab === "calendar" ? "calendar" : "posts";

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
        Poster
      </h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">
        Send a finished cut out to your platforms, and see everything you have
        scheduled on the calendar.
      </p>
      <PosterHub initialTab={initialTab} />
    </div>
  );
}
