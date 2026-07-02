"use client";

import { useState } from "react";
import TrainingHeader from "@/components/training/training-header";
import { Chirpy } from "@/components/brand/chirpy";
import IdeaEditor from "@/components/ideation/idea-editor";
import IdeaList from "@/components/ideation/idea-list";
import { IdeasProvider, useIdeas } from "@/components/ideation/ideas-context";

function IdeationWorkspace() {
  const { ready, ideas, addBlank } = useIdeas();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Derive the active idea with a fallback to the first one. This avoids an
  // effect to "fix up" selection when the list loads or the active idea is
  // deleted (a stale or null activeId simply falls back).
  const active = ideas.find((i) => i.id === activeId) ?? ideas[0] ?? null;

  return (
    <div className="bg-background min-h-screen">
      <TrainingHeader />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:px-8">
        <IdeaList activeId={active?.id ?? null} onSelect={setActiveId} />
        {!ready ? (
          <div className="flex-1" />
        ) : active ? (
          <IdeaEditor idea={active} onDeleted={() => setActiveId(null)} />
        ) : (
          <div className="border-border text-foreground/55 flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed px-6 py-20 text-center">
            <Chirpy expression="curious" size={92} />
            <p className="text-foreground text-base font-bold">No ideas yet</p>
            <p className="max-w-sm text-sm">
              Start a draft from scratch, or open the Inspiration library and
              turn a saved clip into an idea.
            </p>
            <button
              type="button"
              onClick={() => setActiveId(addBlank())}
              className="bg-foreground text-background mt-2 rounded-full px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
            >
              New idea
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IdeationPage() {
  return (
    <IdeasProvider>
      <IdeationWorkspace />
    </IdeasProvider>
  );
}
