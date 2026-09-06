"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { Section } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import type { useProject } from "@/hooks/use-project";

/**
 * The four facts Yapper reads on every call, as one card with four cells.
 * Every cell opens the same sheet; a blank one says what to put there.
 */
export default function EssentialsCard({
  project,
  pillars,
  loading,
  onEdit,
}: {
  project: ReturnType<typeof useProject>["project"];
  pillars: ReturnType<typeof useProject>["pillars"];
  loading: boolean;
  onEdit: () => void;
}) {
  const cells: { label: string; value: string | null; prompt: string }[] = [
    {
      label: "You make",
      value: project?.whatIMake ?? null,
      prompt: "Describe what you create",
    },
    {
      label: "Your audience",
      value: project?.audience ?? null,
      prompt: "Describe who it is for",
    },
    {
      label: "Your voice",
      value: project?.voice ?? null,
      prompt: "Describe how you sound",
    },
    {
      label: "Pillars",
      value: pillars.length
        ? pillars.map((pillar) => pillar.name).join(" · ")
        : null,
      prompt: "Add your recurring themes",
    },
  ];

  return (
    <Section
      title="Essentials"
      action={
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
      }
    >
      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading…
        </p>
      ) : (
        <div className="border-border bg-card grid overflow-hidden rounded-xl border sm:grid-cols-2">
          {cells.map((cell, index) => (
            <button
              key={cell.label}
              type="button"
              onClick={onEdit}
              className={`group hover:bg-muted min-h-24 p-4 text-left transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
                index > 0 ? "border-border/60 border-t sm:border-t-0" : ""
              } ${index % 2 === 1 ? "sm:border-border/60 sm:border-l" : ""} ${
                index >= 2 ? "sm:border-border/60 sm:border-t" : ""
              }`}
            >
              <span className="text-muted-foreground mb-1.5 block text-[11px] font-bold tracking-[0.1em] uppercase">
                {cell.label}
              </span>
              {cell.value?.trim() ? (
                <span className="text-foreground line-clamp-3 block text-sm leading-relaxed">
                  {cell.value}
                </span>
              ) : (
                <span className="text-muted-foreground group-hover:text-foreground block text-sm transition-colors">
                  {cell.prompt}
                  <ChevronRight
                    className="ml-1 inline size-3.5"
                    aria-hidden="true"
                  />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}
