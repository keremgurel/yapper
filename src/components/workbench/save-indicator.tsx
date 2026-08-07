"use client";

import type { SaveState } from "@/hooks/use-autosave";

/** Autosave status. Silent when idle, because a workbench that always says
 * something about saving trains you to stop reading it. */
export default function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span
      className={`text-xs font-semibold ${
        state === "error" ? "text-destructive" : "text-muted-foreground"
      }`}
      role={state === "error" ? "alert" : undefined}
    >
      {state === "saving"
        ? "Saving…"
        : state === "saved"
          ? "Saved"
          : "Save failed. Edits retry on your next change."}
    </span>
  );
}
