"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import CanvasBlock from "@/components/canvas/canvas-block";
import CanvasDetails from "@/components/canvas/canvas-details";
import CanvasHeader from "@/components/canvas/canvas-header";
import CanvasHooks from "@/components/canvas/canvas-hooks";
import CanvasMenu from "@/components/canvas/canvas-menu";
import CanvasPhoneSheet from "@/components/canvas/canvas-phone-sheet";
import CanvasPromptBar from "@/components/canvas/canvas-prompt-bar";
import CanvasReference from "@/components/canvas/canvas-reference";
import ReadLine from "@/components/brain/recall/read-line";
import { Button } from "@/components/ui/button";
import { useCanvasAsk } from "@/hooks/use-canvas-ask";
import { useCanvasDoc } from "@/hooks/use-canvas-doc";
import { useContentItem } from "@/hooks/use-content-item";
import type { BrainUsed } from "@/lib/brain/context/types";
import { applyCanvasActions } from "@/lib/content/canvas-actions";
import {
  blockFrom,
  changeKind,
  moveBlock,
  removeBlock,
  updateBlock,
} from "@/lib/content/canvas-doc";
import { deleteContent, type ContentSummary } from "@/lib/content/client";
import { hookTexts } from "@/lib/content/normalize";
import { ideaToScript } from "@/lib/inspiration/idea-format";
import {
  mutateClientResource,
  readClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";
import { studioEditorUrl } from "@/lib/studio/editor-handoff";

/**
 * One piece, as a canvas.
 *
 * A title, the hook you are going with, then blocks you name and order
 * yourself: a script, a beat sheet, a list of objections, whatever this piece
 * needs. Chirpy writes into it from one prompt bar, either anywhere or aimed
 * at a block, and never touches what you did not ask about. Record is the one
 * primary action; everything else is in the menu.
 *
 * Composition only. The document lives in `useCanvasDoc`, asks in
 * `useCanvasAsk`, and every write goes through the item's single autosave.
 */
export default function CanvasWorkbench({ id }: { id: string }) {
  const router = useRouter();
  const {
    item,
    loading,
    missing,
    loadError,
    reload,
    saveState,
    update,
    flush,
  } = useContentItem(id);
  const { blocks, setBlocks, hooks, setHooks } = useCanvasDoc(item, update);
  const chirpy = useCanvasAsk();
  const [target, setTarget] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [used, setUsed] = useState<BrainUsed | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const operation = useRef(false);

  const guarded = async (work: () => Promise<void>, failure: string) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await work();
    } catch {
      setActionError(failure);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const navigate = (href: string) =>
    guarded(async () => {
      await flush();
      router.push(href);
    }, "Your latest edits couldn’t be saved. Try again before leaving.");

  const remove = () =>
    guarded(async () => {
      await flush().catch(() => {});
      await deleteContent(id);
      for (const key of [
        STUDIO_RESOURCE_KEYS.content,
        STUDIO_RESOURCE_KEYS.posterContent,
      ]) {
        const rows = readClientResource<ContentSummary[]>(key);
        if (rows)
          mutateClientResource(
            key,
            rows.filter((row) => row.id !== id),
          );
      }
      router.push("/studio/ideas");
    }, "The delete couldn’t be confirmed. Your item is kept; try again.");

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (loadError) {
    return (
      <div role="alert" className="space-y-3 py-12 text-sm">
        <p>This item couldn’t be loaded.</p>
        <Button variant="outline" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (missing || !item) {
    return (
      <div className="py-12">
        <p className="text-muted-foreground text-sm">
          This item doesn’t exist, or isn’t yours.
        </p>
        <Button asChild variant="link" className="mt-2 px-0">
          <Link href="/studio/ideas">
            <ArrowLeft className="h-4 w-4" /> Back to Ideas
          </Link>
        </Button>
      </div>
    );
  }

  const targetBlock = blocks.find((block) => block.id === target) ?? null;
  const targetIndex = targetBlock ? blocks.indexOf(targetBlock) : null;

  const ask = async (instruction: string) => {
    setNote(null);
    const reply = await chirpy.ask(
      instruction,
      {
        title: item.title,
        blocks,
        hooks,
        originalNote: item.originalNote,
        source: {
          title: item.sourceTitle,
          url: item.sourceUrl,
          excerpt: (item.sourceTranscript ?? item.sourceSummary ?? "").slice(
            0,
            3000,
          ),
        },
      },
      targetIndex,
    );
    if (!reply) return;
    const next = applyCanvasActions(
      { title: item.title, blocks, hooks },
      reply.actions,
    );
    if (next.blocks !== blocks) setBlocks(next.blocks);
    if (next.hooks !== hooks) setHooks(next.hooks);
    if (next.title !== item.title) update({ title: next.title });
    setNote(reply.note);
    setUsed(reply.used);
    setTarget(null);
  };

  return (
    <div className="w-full pb-16">
      {actionError && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          {actionError}
        </p>
      )}
      {saveState === "error" && (
        <Button
          variant="outline"
          size="sm"
          className="mb-4"
          onClick={() =>
            void flush().catch(() =>
              setActionError("Your edits still couldn’t be saved. Try again."),
            )
          }
        >
          Retry saving
        </Button>
      )}

      <CanvasHeader
        title={item.title}
        onTitle={(title) => update({ title })}
        status={item.status}
        onStatus={(status) => update({ status })}
        saveState={saveState}
        busy={busy}
        hasRecording={Boolean(item.submissionId)}
        onRecord={() => void navigate(`/studio/recorder?item=${item.id}`)}
        menu={
          <CanvasMenu
            hasRecording={Boolean(item.submissionId)}
            busy={busy}
            onCopyScript={() => {
              void navigator.clipboard
                .writeText(
                  ideaToScript({ ...item, hooks: hookTexts(item.hooks) }),
                )
                .catch(() => {});
            }}
            onSendToPhone={() => setPhoneOpen(true)}
            onEditOnMac={() => void navigate(studioEditorUrl(item.id))}
            onCrossPost={() => void navigate(`/studio/poster?item=${item.id}`)}
            onDelete={() => void remove()}
          />
        }
      />

      <CanvasDetails item={item} update={update} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)] lg:gap-12">
        <div className="min-w-0">
          <div className="space-y-9">
            <CanvasHooks hooks={hooks} onChange={setHooks} />

            {blocks.map((block, index) => (
              <CanvasBlock
                key={block.id}
                block={block}
                index={index}
                isFirst={index === 0}
                isLast={index === blocks.length - 1}
                onChange={(patch) =>
                  setBlocks((current) => updateBlock(current, block.id, patch))
                }
                onKind={(kind) =>
                  setBlocks((current) => changeKind(current, block.id, kind))
                }
                onMove={(direction) =>
                  setBlocks((current) =>
                    moveBlock(current, block.id, direction),
                  )
                }
                onRemove={() =>
                  setBlocks((current) => removeBlock(current, block.id))
                }
                onAsk={() => {
                  setTarget(block.id);
                  setFocusToken((token) => token + 1);
                }}
              />
            ))}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setBlocks((current) => [...current, blockFrom({})])
              }
              className="text-muted-foreground -ml-2"
            >
              <Plus className="h-4 w-4" /> Add a block
            </Button>
          </div>

          <CanvasPromptBar
            busy={chirpy.busy}
            error={chirpy.error}
            note={note}
            target={targetBlock ? { label: targetBlock.label } : null}
            onClearTarget={() => setTarget(null)}
            onAsk={ask}
            focusToken={focusToken}
          />
          {used && <ReadLine used={used} />}
        </div>

        {/* The reference stays in view while you write: adapting a transcript
            means reading it and the draft at the same time. */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          <CanvasReference item={item} update={update} />
        </aside>
      </div>

      <CanvasPhoneSheet
        open={phoneOpen}
        onOpenChange={setPhoneOpen}
        itemId={item.id}
        beforeOpen={flush}
      />
    </div>
  );
}
