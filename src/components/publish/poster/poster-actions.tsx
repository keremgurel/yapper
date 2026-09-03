"use client";

import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AddVideoState } from "@/hooks/use-add-video";

/** The Poster's one header action. Publish, the page's primary action, sits
 * at the end of the destinations column. */
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
    <Button
      type="button"
      variant="contrast"
      disabled={uploading || preparing}
      onClick={onAdd}
    >
      {uploading || preparing ? (
        <Loader2
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        <Upload aria-hidden />
      )}
      {uploading
        ? `Uploading ${Math.round(progress * 100)}%`
        : preparing
          ? "Reading video…"
          : "Add video"}
    </Button>
  );
}
