"use client";

import { Check, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** The one accent-filled action in the sheet, labelled with exactly what it is
 * about to do rather than with the word "Publish" alone. */
export default function PublishButton({
  videos,
  platforms,
  postedSoFar,
  posting,
  done,
  disabled,
  onPublish,
  label,
}: {
  label?: string;
  videos: number;
  platforms: number;
  postedSoFar: number;
  posting: boolean;
  done: boolean;
  disabled: boolean;
  onPublish: () => void;
}) {
  return (
    <Button type="button" onClick={onPublish} disabled={disabled}>
      {posting ? (
        <Loader2 aria-hidden className="animate-spin" />
      ) : done ? (
        <Check aria-hidden />
      ) : (
        <Send aria-hidden />
      )}
      {posting
        ? `Publishing ${Math.min(postedSoFar + 1, videos * platforms)} of ${videos * platforms}…`
        : done
          ? "Check publish status"
          : (label ??
            `Publish ${plural(videos, "video")} to ${plural(platforms, "platform")}`)}
    </Button>
  );
}
