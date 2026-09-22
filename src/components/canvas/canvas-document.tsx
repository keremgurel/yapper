"use client";

import { Sparkles } from "lucide-react";
import CanvasBlock from "@/components/canvas/canvas-block";
import CanvasDetails from "@/components/canvas/canvas-details";
import CanvasHooks from "@/components/canvas/canvas-hooks";
import CanvasSectionTitle from "@/components/canvas/canvas-section-title";
import { Button } from "@/components/ui/button";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";
import {
  changeKind,
  moveBlock,
  removeBlock,
  updateBlock,
  type CanvasBlock as Block,
} from "@/lib/content/canvas-doc";

type SetBlocks = (next: Block[] | ((current: Block[]) => Block[])) => void;

/**
 * The document itself, in a fixed order: the hook, the alternatives, the key
 * points, the full script, then anything else the creator or Chirpy added.
 * One reading column; no cards, the titles are the structure.
 */
export default function CanvasDocument({
  item,
  update,
  blocks,
  setBlocks,
  hooks,
  setHooks,
  onAsk,
  onAskBlock,
}: {
  item: ContentDetail;
  update: (patch: ContentPatch) => void;
  blocks: Block[];
  setBlocks: SetBlocks;
  hooks: string[];
  setHooks: (hooks: string[]) => void;
  /** Sends one instruction to Chirpy. */
  onAsk: (instruction: string) => void;
  /** Aims the chat at one block. */
  onAskBlock: (id: string) => void;
}) {
  const scriptBlock = blocks.find((block) => block.kind === "script") ?? null;
  const pointsBlock =
    blocks.find(
      (block) =>
        block !== scriptBlock &&
        (block.kind === "bullets" || block.kind === "steps"),
    ) ?? null;
  const otherBlocks = blocks.filter(
    (block) => block !== scriptBlock && block !== pointsBlock,
  );

  const renderBlock = (block: Block, fixedTitle?: string) => {
    const index = blocks.indexOf(block);
    return (
      <CanvasBlock
        key={block.id}
        block={block}
        index={index}
        isFirst={fixedTitle ? true : index === 0}
        isLast={fixedTitle ? true : index === blocks.length - 1}
        fixedTitle={fixedTitle}
        onChange={(patch) =>
          setBlocks((current) => updateBlock(current, block.id, patch))
        }
        onKind={(kind) =>
          setBlocks((current) => changeKind(current, block.id, kind))
        }
        onMove={(direction) =>
          setBlocks((current) => moveBlock(current, block.id, direction))
        }
        onRemove={() => setBlocks((current) => removeBlock(current, block.id))}
        onAsk={() => onAskBlock(block.id)}
      />
    );
  };

  return (
    <div className="mx-auto w-full max-w-[78ch] px-6 pt-8 pb-24 lg:px-10">
      <CanvasDetails item={item} update={update} />
      <div className="mt-10 space-y-12">
        <CanvasHooks
          hooks={hooks}
          onChange={setHooks}
          onAskForHooks={() => onAsk("Give me five hooks")}
        />

        {pointsBlock ? (
          renderBlock(pointsBlock, "Key points")
        ) : (
          <EmptySlot
            title="Key points"
            label="Give me the key points"
            onAsk={() => onAsk("Give me the key points as bullets")}
          />
        )}

        {scriptBlock ? (
          renderBlock(scriptBlock, "Script")
        ) : (
          <EmptySlot
            title="Script"
            label="Write the script"
            onAsk={() => onAsk("Write the script")}
          />
        )}

        {otherBlocks.map((block) => renderBlock(block))}
      </div>
    </div>
  );
}

/** A part with nothing in it yet: its name, and the one ask that fills it. */
function EmptySlot({
  title,
  label,
  onAsk,
}: {
  title: string;
  label: string;
  onAsk: () => void;
}) {
  return (
    <section>
      <CanvasSectionTitle title={title} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAsk}
        className="text-muted-foreground -ml-2"
      >
        <Sparkles className="h-4 w-4" /> {label}
      </Button>
    </section>
  );
}
