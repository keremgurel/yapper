"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GalleryItem } from "./gallery-item";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "failed"; why: string };

/**
 * Saving, with everything it needs on screen: the name is a field, prefilled,
 * and the button says what it will do. A single block has nothing to save, and
 * says where it goes instead. Remount it (a `key`) when another item is opened.
 */
export default function SaveLook({
  item,
  editCount,
  available,
  onSaveNew,
  onSaveChanges,
}: {
  item: GalleryItem;
  editCount: number;
  available: boolean;
  onSaveNew: (name: string) => Promise<void>;
  onSaveChanges: () => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  if (!item.saveFrom) {
    return (
      <p className="text-muted-foreground text-xs leading-relaxed">
        A block is saved as part of a look. Open a template and put this block
        in it.
      </p>
    );
  }
  if (!available) {
    return (
      <p className="text-muted-foreground text-xs leading-relaxed">
        Saved looks could not be reached, so changes here stay in this window.
      </p>
    );
  }

  const run = async (work: () => Promise<void>) => {
    setStatus({ kind: "saving" });
    try {
      await work();
      setStatus({ kind: "saved" });
    } catch (error) {
      setStatus({
        kind: "failed",
        why: error instanceof Error ? error.message : "It did not save.",
      });
    }
  };
  const saving = status.kind === "saving";

  return (
    <div className="space-y-2">
      {item.lookId ? (
        <Button
          type="button"
          className="w-full"
          disabled={saving || editCount === 0}
          onClick={() => run(onSaveChanges)}
        >
          {saving
            ? "Saving"
            : editCount === 0
              ? "No changes to save"
              : "Save changes"}
        </Button>
      ) : (
        <>
          <Input
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            aria-label="Name for this look"
            className="text-sm"
          />
          <Button
            type="button"
            className="w-full"
            disabled={saving || name.trim() === ""}
            onClick={() => run(() => onSaveNew(name.trim()))}
          >
            {saving ? "Saving" : "Save to my looks"}
          </Button>
        </>
      )}
      <p aria-live="polite" className="text-muted-foreground min-h-4 text-xs">
        {status.kind === "saved" && "Saved."}
        {status.kind === "failed" && status.why}
        {status.kind === "idle" &&
          name.trim() === "" &&
          !item.lookId &&
          "Give the look a name to save it."}
      </p>
    </div>
  );
}
