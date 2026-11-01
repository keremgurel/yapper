"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChirpyConfirmation as Confirmation } from "@/components/studio-shell/chirpy-message";

/** Chirpy's question before a change it cannot undo, with the two answers.
 * Once answered it keeps the question and says which way it went.
 * Render-only. */
export default function ChirpyConfirmation({
  confirm,
  onAnswer,
}: {
  confirm: Confirmation;
  onAnswer: (decision: "confirm" | "cancel") => void;
}) {
  const open = confirm.state === "open";
  return (
    <div className="border-border bg-card mt-2 rounded-lg border p-2.5">
      <p className="text-foreground text-sm">{confirm.question}</p>
      {confirm.state === "confirmed" || confirm.state === "canceled" ? (
        <p className="text-muted-foreground mt-1.5 text-[11px]">
          {confirm.state === "confirmed" ? "Confirmed" : "Kept"}
        </p>
      ) : (
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!open}
            onClick={() => onAnswer("confirm")}
          >
            {confirm.state === "working" ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            {confirm.confirmLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!open}
            onClick={() => onAnswer("cancel")}
          >
            Keep it
          </Button>
        </div>
      )}
    </div>
  );
}
