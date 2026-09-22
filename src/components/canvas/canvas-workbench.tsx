"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import CanvasDocument from "@/components/canvas/canvas-document";
import CanvasHeader from "@/components/canvas/canvas-header";
import CanvasMenu from "@/components/canvas/canvas-menu";
import CanvasReference from "@/components/canvas/canvas-reference";
import CanvasThread from "@/components/canvas/canvas-thread";
import { useCanvasMaximized } from "@/components/canvas/use-canvas-maximized";
import {
  useStudioChirpy,
  type ChirpyCanvasTools,
} from "@/components/studio-shell/studio-chirpy";
import { DeleteButton } from "@/components/ui/delete-button";
import CanvasPhoneSheet from "@/components/canvas/canvas-phone-sheet";
import { Button } from "@/components/ui/button";
import { useCanvasAsk } from "@/hooks/use-canvas-ask";
import { useCanvasDoc } from "@/hooks/use-canvas-doc";
import { useCanvasThread, type CanvasMessage } from "@/hooks/use-canvas-thread";
import { useContentItem } from "@/hooks/use-content-item";
import {
  applyCanvasActions,
  describeCanvasActions,
} from "@/lib/content/canvas-actions";
import {
  blockFrom,
  type CanvasBlock as CanvasBlockDoc,
} from "@/lib/content/canvas-doc";
import { noteToBlock } from "@/lib/content/note-to-block";
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
  const studioChirpy = useStudioChirpy();
  const thread = useCanvasThread(item?.id ?? null);
  const [target, setTarget] = useState<string | null>(null);
  // Replies already placed on the page, and the one change that can still be
  // taken back: the newest reply's, with the canvas as it was before it.
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [undoable, setUndoable] = useState<{
    messageId: string;
    blocks: CanvasBlockDoc[];
    hooks: string[];
    title: string;
  } | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { maximized, toggle: toggleMaximized } = useCanvasMaximized();
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

  /** One ask about this piece, from the Chirpy panel. Applies what came back
   * and tells Chirpy what changed, so the panel can say it. */
  const askFromChirpy = useCallback(
    async (instruction: string) => {
      if (!item) return null;
      const targetIndex = target
        ? blocks.findIndex((block) => block.id === target)
        : -1;
      const pendingId = thread.pendingAsk(instruction);
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
        targetIndex >= 0 ? targetIndex : null,
        item.id,
      );
      setTarget(null);
      if (!reply) {
        thread.settle(pendingId, null);
        return null;
      }
      const before = { blocks, hooks, title: item.title };
      const next = applyCanvasActions(
        { title: item.title, blocks, hooks },
        reply.actions,
      );
      if (next.blocks !== blocks) setBlocks(next.blocks);
      if (next.hooks !== hooks) setHooks(next.hooks);
      if (next.title !== item.title) update({ title: next.title });
      thread.settle(pendingId, reply.messages);
      const said = (reply.messages ?? [])
        .map((m) => m as { id?: unknown; role?: unknown; text?: unknown })
        .find((m) => m.role === "chirpy");
      setUndoable(
        reply.actions.length > 0 && typeof said?.id === "string"
          ? { messageId: said.id, ...before }
          : null,
      );
      const changed = reply.actions.length
        ? describeCanvasActions(reply.actions)
        : null;
      return {
        text:
          (typeof said?.text === "string" && said.text) ||
          changed ||
          reply.note ||
          "Done.",
        notes: changed ? [changed] : undefined,
        tone: reply.actions.length ? ("done" as const) : undefined,
      };
    },
    [blocks, chirpy, hooks, item, setBlocks, setHooks, target, thread, update],
  );

  const addToPage = (message: CanvasMessage, asked: string) => {
    setBlocks((current) => [
      ...current,
      blockFrom(noteToBlock(message.text, asked)),
    ]);
    setAddedIds((current) => new Set(current).add(message.id));
  };

  const undoLast = () => {
    if (!undoable || !item) return;
    setBlocks(undoable.blocks);
    setHooks(undoable.hooks);
    if (undoable.title !== item.title) update({ title: undoable.title });
    setUndoable(null);
  };

  const canvasTools = useMemo<ChirpyCanvasTools>(
    () => ({ ask: askFromChirpy }),
    [askFromChirpy],
  );
  useEffect(() => {
    studioChirpy.registerCanvasTools(canvasTools);
    return () => studioChirpy.registerCanvasTools(null);
  }, [canvasTools, studioChirpy]);

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

  const hasOrigin = Boolean(
    item.sourceTitle ||
    item.sourceUrl ||
    item.sourceTranscript ||
    item.sourceSummary ||
    item.recordedTranscript ||
    item.originalNote.trim(),
  );

  return (
    <div
      data-fluid-page
      className={
        maximized
          ? "bg-background fixed inset-0 z-[60] flex flex-col"
          : "-mx-4 -my-6 flex flex-col sm:-mx-6 lg:-mx-8 lg:-my-8 lg:h-[calc(100svh-var(--site-header,3.5rem)-3rem)]"
      }
    >
      {(actionError || saveState === "error") && (
        <div className="border-border flex items-center gap-3 border-b px-4 py-2 text-sm">
          {actionError && (
            <p role="alert" className="text-destructive">
              {actionError}
            </p>
          )}
          {saveState === "error" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void flush().catch(() =>
                  setActionError(
                    "Your edits still couldn’t be saved. Try again.",
                  ),
                )
              }
            >
              Retry saving
            </Button>
          )}
        </div>
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
        onAskChirpy={() => studioChirpy.open()}
        maximized={maximized}
        onToggleMaximized={toggleMaximized}
        menu={
          <>
            <DeleteButton
              size="sm"
              label={`Delete ${item.title || "this piece"}`}
              disabled={busy}
              onConfirm={() => void remove()}
            />
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
              onCrossPost={() =>
                void navigate(`/studio/poster?item=${item.id}`)
              }
            />
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CanvasDocument
          item={item}
          update={update}
          blocks={blocks}
          setBlocks={setBlocks}
          hooks={hooks}
          setHooks={setHooks}
          onAsk={(instruction) => studioChirpy.run(instruction)}
          onAskBlock={(id) => {
            const block = blocks.find((entry) => entry.id === id);
            setTarget(id);
            studioChirpy.open(`Change the ${block?.label?.trim() || "part"}: `);
          }}
        >
          <CanvasThread
            messages={thread.messages}
            failed={thread.failed}
            onClear={() => void thread.clear()}
            addedIds={addedIds}
            undoableId={undoable?.messageId ?? null}
            onAddToPage={addToPage}
            onUndo={undoLast}
          />
          {hasOrigin && (
            <details className="group">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-[13px] font-medium select-none">
                Where this came from
              </summary>
              <div className="mt-4">
                <CanvasReference item={item} update={update} />
              </div>
            </details>
          )}
        </CanvasDocument>
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
