import { Suspense } from "react";
import type { Metadata } from "next";
import ConnectionsPanel from "@/components/publish/connections-panel";
import YouTubeVideos from "@/components/publish/youtube-videos";

export const metadata: Metadata = {
  title: "Connections",
  description:
    "Your videos across platforms — connect accounts and cross-post.",
  robots: { index: false }, // personal dashboard surface
};

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
        Connections
      </h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">
        Connect an account once, see everything you&apos;ve posted, and
        cross-post the gaps.
      </p>
      <Suspense>
        <ConnectionsPanel />
      </Suspense>
      <YouTubeVideos />
    </div>
  );
}
