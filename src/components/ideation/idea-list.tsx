"use client";

import { Plus } from "lucide-react";
import { useIdeas } from "@/components/ideation/ideas-context";

export default function IdeaList({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const { ideas, addBlank } = useIdeas();

  return (
    <aside className="flex w-full shrink-0 flex-col gap-1 lg:w-64">
      <button
        type="button"
        onClick={() => onSelect(addBlank())}
        className="bg-foreground text-background mb-2 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        New idea
      </button>

      {ideas.map((idea) => {
        const active = idea.id === activeId;
        return (
          <button
            key={idea.id}
            type="button"
            onClick={() => onSelect(idea.id)}
            className={`flex flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
              active
                ? "bg-foreground text-background"
                : "text-foreground/70 hover:bg-muted"
            }`}
          >
            <span className="truncate text-sm font-bold">{idea.title}</span>
            {idea.sourceTitle && (
              <span className="truncate text-xs opacity-60">
                {idea.sourceTitle}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
