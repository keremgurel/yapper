"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The done screen of the import sheet. Green, because the work is finished;
 * orange stays reserved for the next action the creator takes.
 */
export default function InstagramImportResult({
  imported,
  skipped,
  onDone,
}: {
  imported: number;
  skipped: number;
  onDone: () => void;
}) {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_oklab,var(--sg-green-500)_16%,transparent)] text-[color-mix(in_oklab,var(--sg-green-500)_62%,var(--sg-text))]">
        <Check className="h-6 w-6" />
      </span>
      <h3 className="font-display text-foreground mt-4 text-xl font-bold">
        {imported} saved {imported === 1 ? "post" : "posts"} imported
      </h3>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
        They are now in Idea Bank as original references. Expand only the ones
        you want Chirpy to analyze.
      </p>
      {skipped > 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          {skipped} existing {skipped === 1 ? "item was" : "items were"}{" "}
          skipped.
        </p>
      )}
      <Button className="mt-6" onClick={onDone}>
        View Idea Bank
      </Button>
    </div>
  );
}
