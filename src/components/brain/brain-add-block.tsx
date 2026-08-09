"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BrainBlockPatch } from "@/lib/brain/client";

/** Sections most creators end up wanting, offered as a starting point rather
 * than shipped as a fixed form. Anything already on the page drops off the
 * list, so the suggestions thin out as the brain fills in. */
const STARTERS: { title: string; kind: "note" | "list" }[] = [
  { title: "Why I post", kind: "note" },
  { title: "What I want out of this", kind: "note" },
  { title: "Hooks that work", kind: "list" },
  { title: "Formats that work", kind: "list" },
  { title: "Rules I keep", kind: "list" },
  { title: "Who I am talking to, really", kind: "note" },
];

/**
 * How a section gets added.
 *
 * Naming it first is deliberate: a block called "Why I post" is a question the
 * creator can answer, and an untitled empty box is one they close.
 */
export default function BrainAddBlock({
  existingTitles,
  onAdd,
}: {
  existingTitles: string[];
  onAdd: (block: BrainBlockPatch & { title: string }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const taken = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  const starters = STARTERS.filter(
    (starter) => !taken.has(starter.title.toLowerCase()),
  );

  const add = async (next: BrainBlockPatch & { title: string }) => {
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
    <section className="sg-card space-y-3 p-4 sm:p-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void add({ title, kind: "note" });
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={title}
          placeholder="Add a section: call it whatever you call it"
          aria-label="New section title"
          onChange={(event) => setTitle(event.target.value)}
          className="h-9 flex-1"
        />
        <Button type="submit" size="sm" disabled={busy || !title.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {starters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {starters.map((starter) => (
            <button
              key={starter.title}
              type="button"
              disabled={busy}
              onClick={() => void add(starter)}
              className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50"
            >
              + {starter.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
