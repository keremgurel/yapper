"use client";

import { Loader2, Plus, Search, Wand2 } from "lucide-react";
import SkillCard from "@/components/brain/skills/skill-card";
import { Button } from "@/components/ui/button";
import type { useBrainSkills } from "@/hooks/use-brain-skills";

type Skills = ReturnType<typeof useBrainSkills>;

/** The Skills tab: the creative methods Yapper follows, as a card grid. */
export default function SkillsTab({
  skills,
  loading,
  available,
  saveState,
  onDiscover,
  onCreate,
  onToggle,
  onOpen,
  onRemove,
}: {
  skills: Skills["skills"];
  loading: boolean;
  available: boolean;
  saveState: Skills["saveState"];
  onDiscover: () => void;
  onCreate: () => void;
  onToggle: (id: string, enabled: boolean) => void;
  onOpen: (id: string) => void;
  onRemove: (id: string, name: string) => void;
}) {
  const active = skills.filter((skill) => skill.enabled).length;
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-foreground text-[22px] font-semibold tracking-[-0.01em]">
            Skills
          </h2>
          <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm">
            Reusable methods Yapper follows when it writes with you.
            {available && skills.length
              ? ` ${active} of ${skills.length} active.`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onDiscover}>
            <Search className="size-4" aria-hidden="true" /> Discover
          </Button>
          <Button type="button" disabled={!available} onClick={onCreate}>
            <Plus className="size-4" aria-hidden="true" /> Create a skill
          </Button>
        </div>
      </div>
      {saveState === "error" ? (
        <p className="text-destructive mb-3 text-xs" role="alert">
          A skill could not be saved. Your next edit retries it.
        </p>
      ) : null}
      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading Skills…
        </p>
      ) : !available ? (
        <p className="text-muted-foreground py-6 text-sm">
          Your Skills will appear after they load successfully.
        </p>
      ) : skills.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={(enabled) => onToggle(skill.id, enabled)}
              onOpen={() => onOpen(skill.id)}
              onRemove={() => onRemove(skill.id, skill.name)}
            />
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={onDiscover}
          className="bg-muted text-muted-foreground hover:text-foreground flex w-full flex-col items-center rounded-2xl px-6 py-14 text-center transition-colors"
        >
          <Wand2 className="mb-3 size-6" aria-hidden="true" />
          <strong className="text-foreground text-sm font-semibold">
            Give Yapper its first creative method
          </strong>
          <span className="mt-1 text-xs">
            Browse official skills or create your own.
          </span>
        </button>
      )}
    </section>
  );
}
