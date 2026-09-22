"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import CanvasBlock from "@/components/canvas/canvas-block";
import CanvasDetails from "@/components/canvas/canvas-details";
import CanvasSectionTitle from "@/components/canvas/canvas-section-title";
import HookAlternatives from "@/components/canvas/hooks/hook-alternatives";
import HookChosen from "@/components/canvas/hooks/hook-chosen";
import { hookKeys } from "@/components/canvas/hooks/hook-keys";
import ScriptEditor from "@/components/canvas/script-editor";
import { Button } from "@/components/ui/button";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";
import {
  blockFrom,
  changeKind,
  moveBlock,
  removeBlock,
  SCRIPT_LABEL,
  updateBlock,
  type CanvasBlock as Block,
} from "@/lib/content/canvas-doc";

type SetBlocks = (next: Block[] | ((current: Block[]) => Block[])) => void;

/**
 * The document, using the width it has. The script is the main column, with
 * the hook in use above it; beside it, what feeds the script: the facts, the
 * other openers, the key points, and anything else added. One column on a
 * narrow window.
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
  children,
}: {
  item: ContentDetail;
  update: (patch: ContentPatch) => void;
  blocks: Block[];
  setBlocks: SetBlocks;
  hooks: string[];
  setHooks: (hooks: string[]) => void;
  /** Sends one instruction to Chirpy. */
  onAsk: (instruction: string) => void;
  /** Aims Chirpy at one block. */
  onAskBlock: (id: string) => void;
  /** What sits under the writing: where the piece came from, the talk so far. */
  children?: ReactNode;
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
  const keys = hookKeys(hooks);

  const setScript = (text: string) =>
    setBlocks((current) => {
      const existing = current.find((block) => block.kind === "script");
      if (existing) return updateBlock(current, existing.id, { text });
      return [
        blockFrom({ label: SCRIPT_LABEL, kind: "script", text }),
        ...current,
      ];
    });

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
    <div className="mx-auto w-full max-w-[1440px] px-6 pt-8 pb-24 lg:px-10">
      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="min-w-0 space-y-12">
          <HookChosen
            hook={hooks[0] ?? null}
            hookKey={keys[0] ?? null}
            onChange={(text) => setHooks([text, ...hooks.slice(1)])}
            onAskForHooks={() => onAsk("Give me five hooks")}
          />
          <ScriptEditor
            text={scriptBlock?.text ?? ""}
            onChange={setScript}
            onWrite={() => onAsk("Write the script")}
            onAsk={() => {
              if (scriptBlock) onAskBlock(scriptBlock.id);
              else onAsk("Write the script");
            }}
          />
          {children ? <div className="space-y-6 pt-4">{children}</div> : null}
        </div>

        <aside className="min-w-0 space-y-10 lg:sticky lg:top-8 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <CanvasDetails item={item} update={update} />
          <HookAlternatives
            hooks={hooks.slice(1)}
            keys={keys.slice(1)}
            onUse={(offset) => {
              const index = offset + 1;
              setHooks([hooks[index], ...hooks.filter((_, i) => i !== index)]);
            }}
            onEdit={(offset, text) =>
              setHooks(hooks.map((h, i) => (i === offset + 1 ? text : h)))
            }
            onRemove={(offset) =>
              setHooks(hooks.filter((_, i) => i !== offset + 1))
            }
            onMore={() =>
              onAsk(
                hooks.length
                  ? "Give me three more hook alternatives with different angles"
                  : "Give me five hooks",
              )
            }
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
          {otherBlocks.map((block) => renderBlock(block))}
        </aside>
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
