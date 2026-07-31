"use client";

import { useState } from "react";
import { Layers, Trash2 } from "lucide-react";
import { useIdeaBank } from "@/hooks/use-idea-bank";
import IdeaCapture from "@/components/ideas/idea-capture";
import IdeaCard from "@/components/ideas/idea-card";

/**
 * The Idea bank surface: capture at the top, a live list below (a working
 * database from the first visit, never an empty marketing wall), and a
 * multi-select bar to send chosen ideas to the Content Library.
 */
export default function IdeaBank({ pillars = [] }: { pillars?: string[] }) {
  const { bank, expanding, capture, retry, remove, curate } =
    useIdeaBank(pillars);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [curating, setCurating] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clear = () => setSelected(new Set());

  const doCurate = async () => {
    setCurating(true);
    try {
      await curate(selected);
      clear();
    } finally {
      setCurating(false);
    }
  };
  const doRemove = () => {
    remove(selected);
    clear();
  };

  const count = selected.size;

  return (
    <div className="w-full pb-24">
      <header className="mb-5">
        <h1 className="font-display text-foreground text-2xl font-black">
          Idea bank
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Save the original reference, understand why it works, and adapt it
          without flattening every idea into the same format.
        </p>
      </header>

      <IdeaCapture onCapture={capture} />

      <div className="mt-5 space-y-2.5">
        {bank.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Your ideas show up here. Drop your first one above.
          </p>
        ) : (
          bank.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              selected={selected.has(idea.id)}
              expanding={expanding.has(idea.id)}
              onToggle={() => toggle(idea.id)}
              onRetry={() => retry(idea.id)}
            />
          ))
        )}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="border-border bg-card flex items-center gap-3 rounded-full border px-4 py-2.5 shadow-2xl">
            <span className="text-foreground text-sm font-bold">
              {count} selected
            </span>
            <button
              type="button"
              onClick={doRemove}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-semibold"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            <button
              type="button"
              onClick={doCurate}
              disabled={curating}
              className="flex items-center gap-1.5 rounded-full bg-[color:var(--sg-accent)] px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Layers className="h-4 w-4" />
              {curating ? "Sending" : "Send to library"}
            </button>
            <button
              type="button"
              onClick={clear}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
