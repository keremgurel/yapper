"use client";

import { useState } from "react";
import { StickyNote } from "lucide-react";
import { useInspiration } from "@/components/inspiration/inspiration-context";

export default function ItemNote({ id, note }: { id: string; note?: string }) {
  const { setItemNote } = useInspiration();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");

  const commit = () => {
    setItemNote(id, draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        value={draft}
        autoFocus
        rows={2}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
          if (e.key === "Escape") {
            setDraft(note ?? "");
            setEditing(false);
          }
        }}
        placeholder="Why you saved this, or an idea it sparks..."
        className="border-border bg-background text-foreground mt-2 w-full resize-none rounded-lg border px-2 py-1.5 text-xs outline-none"
      />
    );
  }

  if (note) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(note);
          setEditing(true);
        }}
        className="bg-muted text-foreground/75 hover:text-foreground mt-2 w-full rounded-lg px-2 py-1.5 text-left text-xs leading-5"
      >
        {note}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft("");
        setEditing(true);
      }}
      className="text-foreground/50 hover:text-foreground mt-2 inline-flex w-fit items-center gap-1.5 text-xs font-bold"
    >
      <StickyNote className="h-3.5 w-3.5" />
      Add note
    </button>
  );
}
