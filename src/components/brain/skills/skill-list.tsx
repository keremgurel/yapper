"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import CatalogSheet from "@/components/brain/skills/catalog-sheet";
import SkillCard from "@/components/brain/skills/skill-card";
import SkillEditorSheet from "@/components/brain/skills/skill-editor-sheet";
import { EmptyState, Section } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { useBrainSkills } from "@/hooks/use-brain-skills";

/**
 * The skills half of the brain.
 *
 * A section states a fact; a skill states a procedure. Keeping them visually
 * separate is not tidiness, it is the distinction that makes the whole thing
 * legible: one changes what the AI knows, the other changes what it does.
 */
export default function SkillList({ onChanged }: { onChanged: () => void }) {
  const { skills, loading, saveState, edit, add, remove, refresh } =
    useBrainSkills();
  const [browsing, setBrowsing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = skills.find((skill) => skill.id === editingId) ?? null;

  const change = (id: string, patch: Parameters<typeof edit>[1]) => {
    edit(id, patch);
    onChanged();
  };

  return (
    <Section
      title="Skills"
      meta={
        skills.length
          ? `${skills.filter((s) => s.enabled).length} on`
          : undefined
      }
      action={
        <div className="flex items-center gap-2">
          {saveState === "error" && (
            <span className="text-destructive text-xs" role="alert">
              Save failed
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              const skill = await add({ name: "New skill" });
              setEditingId(skill.id);
              onChanged();
            }}
          >
            Write one
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBrowsing(true)}
          >
            Browse skills
          </Button>
        </div>
      }
    >
      {loading ? null : skills.length === 0 ? (
        <EmptyState
          icon={Wand2}
          title="No skills yet"
          description="A skill is a way of writing you hand to the AI: a script structure, a hook menu, a rule about captions."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBrowsing(true)}
            >
              Browse skills
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={(enabled) => change(skill.id, { enabled })}
              onOpen={() => setEditingId(skill.id)}
              onRemove={async () => {
                await remove(skill.id);
                onChanged();
              }}
            />
          ))}
        </div>
      )}

      <CatalogSheet
        open={browsing}
        onOpenChange={setBrowsing}
        onInstalled={async () => {
          await refresh();
          onChanged();
        }}
      />
      <SkillEditorSheet
        skill={editing}
        onClose={() => setEditingId(null)}
        onEdit={(patch) => editing && change(editing.id, patch)}
      />
    </Section>
  );
}
