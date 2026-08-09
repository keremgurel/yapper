"use client";

import { Loader2 } from "lucide-react";
import BrainAddBlock from "@/components/brain/brain-add-block";
import BrainAskPanel from "@/components/brain/brain-ask-panel";
import BrainBlockCard from "@/components/brain/brain-block-card";
import BrainIdentityCard from "@/components/brain/brain-identity-card";
import BrainInspirationCard from "@/components/brain/brain-inspiration-card";
import BrainSlotMachine from "@/components/brain/brain-slot-machine";
import { useBrainBlocks } from "@/hooks/use-brain-blocks";
import { usePillars } from "@/hooks/use-pillars";

/**
 * The Brain: everything a coach who knew this creator would know.
 *
 * Two columns, and the split is the point. The left is what the creator writes
 * and owns, in whatever sections they decide they need. The right is what the
 * brain does back: deals them an idea, answers a question, and shows what they
 * have been saving. Every AI call in Studio already reads the left column, so
 * filling it in is not admin, it is the thing that makes everything else sound
 * like them.
 */
export default function BrainPage() {
  const { blocks, loading, saveState, edit, add, remove, move } =
    useBrainBlocks();
  const { pillars } = usePillars();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Brain</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          What you are making, who it is for, and why. Everything Yapper writes
          for you reads this first.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)] lg:items-start">
        <div className="space-y-4">
          <BrainIdentityCard />

          {loading ? (
            <div className="sg-card text-muted-foreground flex items-center gap-2 p-5 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your
              sections…
            </div>
          ) : (
            <>
              {blocks.map((block) => (
                <BrainBlockCard
                  key={block.id}
                  block={block}
                  onEdit={(patch) => edit(block.id, patch)}
                  onMove={(direction) => void move(block.id, direction)}
                  onRemove={() => void remove(block.id)}
                />
              ))}
              <BrainAddBlock
                existingTitles={blocks.map((block) => block.title)}
                onAdd={add}
              />
            </>
          )}

          {saveState === "error" && (
            <p className="text-destructive text-sm" role="alert">
              A section could not be saved. Your next edit retries it.
            </p>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4">
          <BrainSlotMachine pillars={pillars.map((pillar) => pillar.name)} />
          <BrainAskPanel onSave={add} />
          <BrainInspirationCard />
        </div>
      </div>
    </div>
  );
}
