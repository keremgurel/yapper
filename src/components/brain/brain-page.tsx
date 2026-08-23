"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import AddContextSheet from "@/components/brain/add/add-context-sheet";
import AskPanel from "@/components/brain/ask/ask-panel";
import BlockList from "@/components/brain/blocks/block-list";
import IdentitySection from "@/components/brain/identity/identity-section";
import PromptPreview from "@/components/brain/recall/prompt-preview";
import SkillList from "@/components/brain/skills/skill-list";
import InspirationCard from "@/components/brain/spin/inspiration-card";
import SlotMachine from "@/components/brain/spin/slot-machine";
import { PageHeader, Section } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { useBrainBlocks } from "@/hooks/use-brain-blocks";
import { usePillars } from "@/hooks/use-pillars";

/**
 * The Brain: everything a coach who knew this creator would know.
 *
 * Two columns, and the split is the point. The left is what the creator owns:
 * who they are, everything they have written or imported, and the skills they
 * have installed. The right is what the brain does back, and it opens with the
 * one thing that makes the rest trustworthy, which is a plain view of what the
 * AI actually reads.
 *
 * Nothing here is a fixed form. A creator can add a section called anything,
 * paste a spreadsheet into it, and decide for themselves whether it is read
 * always, when relevant, on request, or never. That freedom is only usable
 * because of the compiler underneath: a one-line digest of everything is always
 * in the prompt, and the contents are paid for only by the task that needs
 * them.
 */
export default function BrainPage() {
  const { blocks, loading, saveState, edit, add, remove, reorder } =
    useBrainBlocks();
  const { pillars } = usePillars();
  const [adding, setAdding] = useState(false);

  // Bumped by anything that changes what a prompt would read, which is what the
  // preview watches. A counter rather than the sections themselves, because the
  // preview compiles server-side and a half-typed digest has not changed
  // anything yet.
  const [version, setVersion] = useState(0);
  const changed = useCallback(() => setVersion((n) => n + 1), []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Brain"
        description="What you are making, who it is for, and everything you know that should shape it. Every AI feature in Studio reads this first."
        actions={
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add context
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] lg:items-start">
        <div className="space-y-8">
          <IdentitySection onChanged={changed} />

          <Section
            title="Your context"
            meta={blocks.length ? `${blocks.length}` : undefined}
            action={
              saveState === "error" ? (
                <span className="text-destructive text-xs" role="alert">
                  A section could not be saved. Your next edit retries it.
                </span>
              ) : undefined
            }
          >
            {loading ? null : (
              <BlockList
                blocks={blocks}
                onEdit={(id, patch) => {
                  edit(id, patch);
                  changed();
                }}
                onRemove={async (id) => {
                  await remove(id);
                  changed();
                }}
                onReorder={async (ids) => {
                  await reorder(ids);
                  changed();
                }}
              />
            )}
          </Section>

          <SkillList onChanged={changed} />
        </div>

        <div className="space-y-8 lg:sticky lg:top-4">
          <PromptPreview version={version} />
          <SlotMachine pillars={pillars.map((pillar) => pillar.name)} />
          <AskPanel
            onSave={async (block) => {
              const saved = await add(block);
              changed();
              return saved;
            }}
          />
          <InspirationCard />
        </div>
      </div>

      <AddContextSheet
        open={adding}
        onOpenChange={setAdding}
        existingTitles={blocks.map((block) => block.title)}
        onAdd={async (block) => {
          const saved = await add(block);
          changed();
          return saved;
        }}
      />
    </div>
  );
}
