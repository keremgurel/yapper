"use client";

import { ArrowUpRight, Trash2 } from "lucide-react";
import CopyScriptButton from "@/components/ideation/copy-script-button";
import EditableList from "@/components/ideation/editable-list";
import { useIdeas } from "@/components/ideation/ideas-context";
import type { Idea } from "@/lib/inspiration/ideas";

export default function IdeaEditor({
  idea,
  onDeleted,
}: {
  idea: Idea;
  onDeleted: () => void;
}) {
  const { updateIdea, deleteIdea } = useIdeas();

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-5 flex items-start justify-between gap-3">
        <input
          value={idea.title}
          onChange={(e) => updateIdea(idea.id, { title: e.target.value })}
          placeholder="Idea title"
          className="text-foreground w-full bg-transparent text-2xl font-black tracking-tight outline-none"
        />
        <div className="flex shrink-0 items-center gap-2">
          <CopyScriptButton idea={idea} />
          <button
            type="button"
            onClick={() => {
              deleteIdea(idea.id);
              onDeleted();
            }}
            className="text-foreground/40 rounded-lg p-2 hover:text-red-500"
            aria-label="Delete idea"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {idea.sourceTitle && (
        <a
          href={idea.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/55 hover:text-foreground mb-6 inline-flex max-w-full items-center gap-1.5 text-xs font-bold"
        >
          <span className="truncate">From: {idea.sourceTitle}</span>
          {idea.sourceUrl && <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />}
        </a>
      )}

      <div className="space-y-7">
        <EditableList
          label="Hook options"
          items={idea.hooks}
          onChange={(hooks) => updateIdea(idea.id, { hooks })}
          addLabel="Add hook"
          placeholder="An opening line that stops the scroll"
        />
        <EditableList
          label="Key points"
          items={idea.points}
          onChange={(points) => updateIdea(idea.id, { points })}
          addLabel="Add point"
          placeholder="One idea per line"
        />
        <div>
          <p className="text-foreground/45 mb-2 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
            Example / story
          </p>
          <textarea
            value={idea.example}
            rows={3}
            onChange={(e) => updateIdea(idea.id, { example: e.target.value })}
            placeholder="A concrete moment that proves the point"
            className="border-border bg-background text-foreground focus:border-foreground/40 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <p className="text-foreground/45 mb-2 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
            Call to action
          </p>
          <input
            value={idea.cta}
            onChange={(e) => updateIdea(idea.id, { cta: e.target.value })}
            placeholder="What should the viewer do next?"
            className="border-border bg-background text-foreground focus:border-foreground/40 w-full rounded-lg border px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>
    </div>
  );
}
