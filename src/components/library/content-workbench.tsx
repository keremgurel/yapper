"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import ScriptSection from "@/components/library/script-section";
import ReadLine from "@/components/brain/recall/read-line";
import HookList from "@/components/workbench/hook-list";
import PlanningNotes from "@/components/workbench/planning-notes";
import ShootRail from "@/components/workbench/shoot-rail";
import { Button } from "@/components/ui/button";
import { useContentItem } from "@/hooks/use-content-item";
import { useHookGeneration } from "@/hooks/use-hook-generation";
import { useIdeaGeneration } from "@/hooks/use-idea-generation";
import { deleteContent } from "@/lib/content/client";
import { hookTexts, mergeHookTexts } from "@/lib/content/normalize";
import {
  mutateClientResource,
  readClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";
import type { ContentSummary } from "@/lib/content/client";

/**
 * The Lab: one item's shoot sheet.
 *
 * Two columns. The main one holds the words you will actually say — the hook
 * you picked, then the script — because that is the thing you came here to get
 * right. The rail holds everything about the shoot that is not the words:
 * status and pillar (the two axes the library organises by, so they belong in
 * front of you, not at the bottom of a long page), the reference, how long the
 * script runs, and Record.
 *
 * Each section owns its own generate control. There is no single "Generate with
 * AI" button, because it was never clear which part of the page it would
 * rewrite.
 *
 * Composition only: every section owns its behaviour, this file decides what
 * appears and holds the one autosave queue they all write through.
 */
export default function ContentWorkbench({ id }: { id: string }) {
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const navigate = async (href: string) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await flush();
      router.push(href);
    } catch {
      setActionError(
        "Your latest edits couldn’t be saved. Try again before opening the next step.",
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const { generating, error, used, runIdea, runScript } = useIdeaGeneration(
    {
      title: item?.title ?? "",
      hooks: hookTexts(item?.hooks),
      blocks: item?.blocks ?? [],
      originalNote: item?.originalNote,
      sourceTitle: item?.sourceTitle,
      sourceUrl: item?.sourceUrl,
    },
    (fields) =>
      update({
        ...(fields.hooks
          ? { hooks: mergeHookTexts(item?.hooks, fields.hooks) }
          : {}),
        ...(fields.blocks ? { blocks: fields.blocks } : {}),
        ...(fields.script !== undefined ? { script: fields.script } : {}),
      }),
  );

  const hookGen = useHookGeneration(
    {
      title: item?.title ?? "",
      blocks: item?.blocks ?? [],
      originalNote: item?.originalNote,
    },
    // Appended, not replaced: a fresh batch must not throw away the line the
    // creator was already weighing up.
    (fresh) => update({ hooks: [...(item?.hooks ?? []), ...fresh] }),
  );

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (loadError)
    return (
      <div role="alert" className="space-y-3 py-12 text-sm">
        <p>This Library item couldn’t be loaded.</p>
        <Button variant="outline" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  if (missing || !item) {
    return (
      <div className="py-12">
        <p className="text-muted-foreground text-sm">
          This item doesn&apos;t exist (or isn&apos;t yours).
        </p>
        <Button asChild variant="link" className="mt-2 px-0">
          <Link href="/studio/library">
            <ArrowLeft className="h-4 w-4" /> Back to the library
          </Link>
        </Button>
      </div>
    );
  }

  const remove = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setActionError(null);
    try {
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
      router.push("/studio/library");
    } catch {
      setActionError(
        "The delete couldn’t be confirmed. Your item is kept here; try again.",
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const canGenerate = Boolean(item.title.trim());

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
          onClick={() => {
            void flush().catch(() =>
              setActionError(
                "Your edits still couldn’t be saved. Please try again.",
              ),
            );
          }}
        >
          Retry saving
        </Button>
      )}
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="text-muted-foreground mb-3 -ml-2"
      >
        <Link href="/studio/library">
          <ArrowLeft className="h-4 w-4" /> Library
        </Link>
      </Button>

      <input
        value={item.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Idea title"
        aria-label="Idea title"
        className="text-foreground placeholder:text-muted-foreground/60 mb-7 w-full max-w-[24ch] bg-transparent text-[34px] leading-tight font-black tracking-[-0.02em] outline-none sm:text-[40px]"
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_296px] lg:gap-10">
        <div className="min-w-0 space-y-9">
          <HookList
            hooks={item.hooks}
            onChange={(hooks) => update({ hooks })}
            generating={hookGen.running}
            canGenerate={canGenerate}
            genError={hookGen.error}
            onGenerate={(pattern) => void hookGen.run(pattern)}
          />

          <ScriptSection
            idea={item}
            generating={generating === "script"}
            disabled={generating !== null}
            error={error?.action === "script" ? error.kind : null}
            onGenerate={() => void runScript()}
            onChange={(script) => update({ script })}
          />
          {used?.action === "script" && <ReadLine used={used.used} />}

          <PlanningNotes
            blocks={item.blocks}
            originalNote={item.originalNote}
            hasScript={Boolean(item.script?.trim())}
            onChange={(blocks) => update({ blocks })}
            generating={generating === "idea"}
            canGenerate={canGenerate}
            onGenerate={() => void runIdea()}
          />
          {used?.action === "idea" && <ReadLine used={used.used} />}
        </div>

        <ShootRail
          busy={busy}
          onNavigate={(href) => void navigate(href)}
          beforePhone={flush}
          item={item}
          saveState={saveState}
          update={update}
          onDelete={() => void remove()}
        />
      </div>
    </div>
  );
}
