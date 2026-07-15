"use client";

import { useState } from "react";
import { CalendarDays, Send } from "lucide-react";
import ContentCalendar from "@/components/calendar/content-calendar";
import PlatformVideos from "@/components/publish/platform-videos";

export type PosterTab = "posts" | "calendar";

const TABS: { id: PosterTab; label: string; icon: typeof Send }[] = [
  { id: "posts", label: "Posts", icon: Send },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

/**
 * The Poster hub: the last step of the workflow, where a finished cut goes out.
 * "Posts" is your videos across platforms with the gaps to cross-post;
 * "Calendar" is everything you have scheduled. Connecting accounts lives apart,
 * under Connections, because it is one-time plumbing rather than a step here.
 */
export default function PosterHub({
  initialTab = "posts",
}: {
  initialTab?: PosterTab;
}) {
  const [tab, setTab] = useState<PosterTab>(initialTab);

  return (
    <div>
      <div className="border-border bg-muted/40 mb-6 inline-flex gap-1 rounded-full border p-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "posts" ? <PlatformVideos /> : <ContentCalendar />}
    </div>
  );
}
