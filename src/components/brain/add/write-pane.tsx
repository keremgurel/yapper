"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NewBrainBlock } from "@/lib/brain/client";

/**
 * Sections most creators end up wanting, offered as a starting point rather
 * than shipped as a fixed form. Anything already on the page drops off the
 * list, so the suggestions thin out as the brain fills in.
 */
const STARTERS: NewBrainBlock[] = [
  { title: "Why I post", kind: "note", usage: "core" },
  { title: "What I want out of this", kind: "note" },
  { title: "Who I am talking to, really", kind: "note", usage: "core" },
  { title: "Hooks that work", kind: "list" },
  { title: "Formats that work", kind: "list" },
  { title: "Rules I keep", kind: "list", usage: "core" },
];

/**
 * Naming it first is deliberate: a section called "Why I post" is a question
 * the creator can answer, and an untitled empty box is one they close.
 */
export default function WritePane({
  existingTitles,
  onAdd,
}: {
  existingTitles: string[];
  onAdd: (block: NewBrainBlock) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const taken = new Set(
    existingTitles.map((value) => value.trim().toLowerCase()),
  );
  const starters = STARTERS.filter(
    (starter) => !taken.has(starter.title.toLowerCase()),
  );

  const add = async (next: NewBrainBlock) => {
    if (busy || !next.title.trim()) return;
    setBusy(true);
    try {
      await onAdd(next);
      setTitle("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void add({ title, kind: "note" });
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={title}
          placeholder="Call it whatever you call it"
          aria-label="New section title"
          onChange={(event) => setTitle(event.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={busy || !title.trim()}>
          Add
        </Button>
      </form>

      {starters.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Or start from one of these
          </p>
          <div className="flex flex-wrap gap-1.5">
            {starters.map((starter) => (
              <button
                key={starter.title}
                type="button"
                disabled={busy}
                onClick={() => void add(starter)}
                className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50"
              >
                {starter.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
