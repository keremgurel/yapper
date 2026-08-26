"use client";

import Link from "next/link";
import { CalendarDays, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AddVideoState } from "@/hooks/use-add-video";

/** The Poster's header actions. Neither is the page's primary action: that is
 * Publish, at the end of the rail. */
export default function PosterActions({
  uploadState,
  progress,
  onAdd,
}: {
  uploadState: AddVideoState;
  progress: number;
  onAdd: () => void;
}) {
  const uploading = uploadState === "uploading";
  const preparing = uploadState === "preparing";

  return (
    <>
      <Button asChild variant="outline">
        <Link href="/studio/calendar">
          <CalendarDays aria-hidden />
          Open calendar
        </Link>
      </Button>
      <Button
        type="button"
        variant="contrast"
        disabled={uploading || preparing}
        onClick={onAdd}
      >
        {uploading || preparing ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <Upload aria-hidden />
        )}
        {uploading
          ? `Uploading ${Math.round(progress * 100)}%`
          : preparing
            ? "Reading video…"
            : "Add videos"}
      </Button>
    </>
  );
}
