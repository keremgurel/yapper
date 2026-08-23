"use client";

import { Chip } from "@/components/studio-ui";
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
}: {
  skill: BrainSkill | null;
  onClose: () => void;
  onEdit: (patch: BrainSkillPatch) => void;
}) {
  if (!skill) return null;

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
              ? "Your copy. Editing it here never changes anyone else's."
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
