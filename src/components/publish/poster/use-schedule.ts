"use client";

import { useCallback, useState } from "react";
import {
  defaultScheduleDate,
  patchContent,
  type ContentSummary,
} from "@/lib/content/client";
import type { PostableVideo } from "@/lib/publish/postable-videos";

export type ScheduleSpacing = "same" | "daily";

function toLocalInput(iso?: string | null): string {
  const date = new Date(iso ?? defaultScheduleDate());
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Putting a batch on the calendar. Optimistic, and rolled back per video on
 * failure: the list is the creator's plan, so it must never show a date the
 * server did not accept.
 */
export function useSchedule(
  patchRow: (id: string, patch: Partial<ContentSummary>) => void,
) {
  const [at, setAt] = useState(toLocalInput());
  const [spacing, setSpacing] = useState<ScheduleSpacing>("daily");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  const schedule = useCallback(
    async (videos: PostableVideo[]) => {
      if (!videos.length || !at) return;
      setState("saving");
      const base = new Date(at);
      const previous = new Map(
        videos.map((video) => [
          video.id,
          { status: video.status, scheduledFor: video.scheduledFor },
        ]),
      );
      const changes = videos.map((video, index) => {
        const date = new Date(base);
        if (spacing === "daily") date.setDate(date.getDate() + index);
        const scheduledFor = date.toISOString();
        patchRow(video.id, { status: "scheduled", scheduledFor });
        return { video, scheduledFor };
      });
      try {
        await Promise.all(
          changes.map(({ video, scheduledFor }) =>
            patchContent(video.id, { status: "scheduled", scheduledFor }),
          ),
        );
        setState("done");
      } catch {
        for (const video of videos) {
          const old = previous.get(video.id);
          if (old) patchRow(video.id, old);
        }
        setState("idle");
      }
    },
    [at, spacing, patchRow],
  );

  return { at, setAt, spacing, setSpacing, state, schedule };
}
