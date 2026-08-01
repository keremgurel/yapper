"use client";

import { useState } from "react";
import { Archive, Layers, Trash2 } from "lucide-react";
import { useIdeaBank } from "@/hooks/use-idea-bank";
import IdeaCapture from "@/components/ideas/idea-capture";
import IdeaCard from "@/components/ideas/idea-card";
import InstagramImportSheet from "@/components/ideas/instagram-import-sheet";

/**
 * The Idea bank surface: capture at the top, a live list below (a working
 * database from the first visit, never an empty marketing wall), and a
 * multi-select bar to send chosen ideas to the Content Library.
 */
export default function IdeaBank({ pillars = [] }: { pillars?: string[] }) {
  const {
    bank,
    sourceUrls,
    expanding,
    capture,
    importInstagramSaves,
    retry,
    remove,
    curate,
  } = useIdeaBank(pillars);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [curating, setCurating] = useState(false);
  const [instagramImportOpen, setInstagramImportOpen] = useState(false);

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
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-foreground text-2xl font-black">
            Idea bank
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Save the original reference, understand why it works, and adapt it
            without flattening every idea into the same format.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInstagramImportOpen(true)}
          className="border-border text-foreground hover:bg-muted flex shrink-0 items-center gap-2 self-start rounded-full border px-3.5 py-2 text-xs font-bold transition-colors sm:self-auto"
          title="Step-by-step Instagram saved-post import"
        >
          <Archive className="h-3.5 w-3.5 text-[color:var(--sg-accent)]" />
          Import Instagram saves
        </button>
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

      <InstagramImportSheet
        open={instagramImportOpen}
        onOpenChange={setInstagramImportOpen}
        existingUrls={sourceUrls}
        onImport={importInstagramSaves}
      />
    </div>
  );
}
