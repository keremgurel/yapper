import type { Metadata } from "next";
import PostableTakes from "@/components/publish/postable-takes";
import PlatformVideos from "@/components/publish/platform-videos";

export const metadata: Metadata = {
  title: "Poster",
  description: "Send a finished video out to your connected platforms.",
  robots: { index: false }, // personal dashboard surface
};

/** The Poster does one thing: send a finished video out to your platforms.
 * Scheduling and the month view live on their own Calendar page now, so this
 * surface stays a single, obvious job. */
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
        Poster
      </h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">
        Pick a finished video and send it out to your connected platforms. To
        see what you have scheduled, open the Calendar.
      </p>
      <div className="flex flex-col gap-10">
        <PostableTakes />
        <PlatformVideos />
      </div>
    </div>
  );
}
