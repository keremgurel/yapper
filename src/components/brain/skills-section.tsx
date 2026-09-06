"use client";

import { Loader2, Plus, Search } from "lucide-react";
import SkillCard from "@/components/brain/skills/skill-card";
import { EmptyState, Section } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import type { BrainSkill } from "@/lib/brain/skills-client";

/** How Yapper works: the skills, with a way to find more and a way to write one. */
export default function SkillsSection({
  skills,
  loading,
  available,
  saveFailed,
  onBrowse,
  onCreate,
  onToggle,
  onOpen,
  onRemove,
}: {
  skills: BrainSkill[];
  loading: boolean;
  available: boolean;
  saveFailed: boolean;
  onBrowse: () => void;
  onCreate: () => void;
  onToggle: (skill: BrainSkill, enabled: boolean) => void;
  onOpen: (skill: BrainSkill) => void;
  onRemove: (skill: BrainSkill) => void;
}) {
  const active = skills.filter((skill) => skill.enabled).length;
  return (
    <Section
      title="Skills"
      meta={skills.length ? `${active} of ${skills.length} on` : undefined}
      action={
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBrowse}>
            <Search className="size-4" aria-hidden="true" /> Browse
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!available}
            onClick={onCreate}
          >
            <Plus className="size-4" aria-hidden="true" /> New
          </Button>
        </div>
      }
    >
      {saveFailed ? (
        <p className="text-destructive mb-3 text-xs" role="alert">
          A skill could not be saved. Your next edit retries it.
        </p>
      ) : null}
      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading…
        </p>
      ) : !available ? (
        <p className="text-muted-foreground py-6 text-sm">
          Your Skills will appear once they load.
        </p>
      ) : skills.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={(enabled) => onToggle(skill, enabled)}
              onOpen={() => onOpen(skill)}
              onRemove={() => onRemove(skill)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No skills yet"
          description="Browse the catalog, or write down a process that works for you."
          action={
            <Button variant="outline" onClick={onBrowse}>
              Browse skills
            </Button>
          }
        />
      )}
    </Section>
  );
}
