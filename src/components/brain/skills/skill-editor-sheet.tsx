"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Chip } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brainSurfaces, type BrainSurface } from "@/lib/db/schema";
import { isStarterSkill } from "@/lib/brain/default-skills";
import type { BrainSkill, BrainSkillPatch } from "@/lib/brain/skills-client";

const SURFACE_LABELS: Record<BrainSurface, string> = {
  ideate: "Ideas",
  hooks: "Hooks",
  script: "Scripts",
  caption: "Captions",
  expand: "References",
  chat: "The coach",
  capture: "Quick capture",
};

/**
 * A skill, open for editing.
 *
 * Three fields, and the middle one does the most work. "When to use" is what
 * the router reads before deciding whether to load the instructions at all, so
 * a skill with a vague one gets loaded for the wrong things and a skill with no
 * one at all only ever loads on the surfaces it declares.
 */
export default function SkillEditorSheet({
  skill,
  onClose,
  onEdit,
  onReset,
}: {
  skill: BrainSkill | null;
  onClose: () => void;
  onEdit: (patch: BrainSkillPatch) => void;
  onReset: (skill: BrainSkill) => Promise<void>;
}) {
  const [resetting, setResetting] = useState(false);
  if (!skill) return null;

  const resetToDefault = async () => {
    if (
      !window.confirm(
        `Reset “${skill.name}” to Yapper’s current default? Your edits to this skill will be replaced.`,
      )
    )
      return;
    setResetting(true);
    try {
      await onReset(skill);
    } finally {
      setResetting(false);
    }
  };

  const toggleSurface = (surface: BrainSurface) =>
    onEdit({
      surfaces: skill.surfaces.includes(surface)
        ? skill.surfaces.filter((value) => value !== surface)
        : [...skill.surfaces, surface],
    });

  return (
    <Sheet open onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit skill</SheetTitle>
          <SheetDescription>
            {skill.catalogSlug
              ? "Your editable copy. You can always restore Yapper’s original."
              : "Yours, written from scratch."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="skill-name" className="sg-field-label">
              Name
            </Label>
            <Input
              id="skill-name"
              value={skill.name}
              onChange={(event) => onEdit({ name: event.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-when" className="sg-field-label">
              When to use it
            </Label>
            <Input
              id="skill-when"
              value={skill.whenToUse}
              placeholder="The idea is a personal story or a case study"
              onChange={(event) => onEdit({ whenToUse: event.target.value })}
            />
            <p className="text-muted-foreground text-xs">
              This line decides whether the skill gets pulled into a piece of
              writing. Say what has to be true, not what the skill does.
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="sg-field-label">Where it applies</span>
            <div className="flex flex-wrap gap-1.5">
              {brainSurfaces.map((surface) => (
                <button
                  key={surface}
                  type="button"
                  aria-pressed={skill.surfaces.includes(surface)}
                  onClick={() => toggleSurface(surface)}
                  className="focus-visible:ring-ring/50 rounded-md focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Chip
                    tone={skill.surfaces.includes(surface) ? "cyan" : "neutral"}
                  >
                    {SURFACE_LABELS[surface]}
                  </Chip>
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {skill.surfaces.length
                ? "Only considered on these."
                : "Nothing picked, so it is considered everywhere."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-instructions" className="sg-field-label">
              Instructions
            </Label>
            <Textarea
              id="skill-instructions"
              value={skill.instructions}
              rows={16}
              placeholder="Write it as instructions to whoever is doing the writing."
              onChange={(event) => onEdit({ instructions: event.target.value })}
              className="font-mono text-[13px] leading-relaxed"
            />
          </div>

          {skill.catalogSlug ? (
            <div className="border-border bg-muted/35 rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {isStarterSkill(skill.catalogSlug)
                      ? "Included by Yapper"
                      : "Installed from Skills"}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {skill.customized
                      ? "You’ve customized this copy. Reset restores the latest official version."
                      : "This matches the official version. You can edit it freely."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resetting}
                  onClick={() => void resetToDefault()}
                  className="shrink-0"
                >
                  {resetting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3.5" />
                  )}
                  Reset to default
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
