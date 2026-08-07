"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import ScriptSection from "@/components/library/script-section";
import BlockList from "@/components/workbench/block-list";
import GenerateBar from "@/components/workbench/generate-bar";
import HookList from "@/components/workbench/hook-list";
import PipelineBar from "@/components/workbench/pipeline-bar";
import SourceCard from "@/components/workbench/source-card";
import VerbatimNote from "@/components/workbench/verbatim-note";
import WorkbenchHeader from "@/components/workbench/workbench-header";
import { Button } from "@/components/ui/button";
import { useContentItem } from "@/hooks/use-content-item";
import { useHookGeneration } from "@/hooks/use-hook-generation";
import { useIdeaGeneration } from "@/hooks/use-idea-generation";
import { deleteContent } from "@/lib/content/client";
import { hookTexts, mergeHookTexts } from "@/lib/content/normalize";

/**
 * The Lab: one item's workbench, for a bank idea or a library item alike.
 *
 * Ordered by what is most yours: your exact words, then the hooks, then the
 * script, then the body the model chose for this idea, then the pipeline
 * controls. There are no fixed "key points / example / CTA" fields — those
 * columns still exist for old rows and are folded into blocks on read, but
 * nothing writes them any more.
 *
 * Composition only. Every section owns its own behaviour; this file decides
 * what appears and in what order, and holds the one autosave queue they all
 * write through.
 */
export default function ContentWorkbench({ id }: { id: string }) {
  const router = useRouter();
  const { item, loading, missing, saveState, update } = useContentItem(id);

  const { generating, error, runIdea, runScript } = useIdeaGeneration(
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
    (fresh) => update({ hooks: [...(item?.hooks ?? []), ...fresh] }),
  );

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
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
    try {
      await deleteContent(id);
      router.push("/studio/library");
    } catch {
      // row stays; a failed delete is visible by the item still being here
    }
  };

  return (
    <div className="w-full">
      <WorkbenchHeader
        item={item}
        onTitleChange={(title) => update({ title })}
        onDelete={() => void remove()}
      />

      <div className="mt-5 space-y-5">
        <SourceCard
          title={item.sourceTitle}
          url={item.sourceUrl}
          transcript={item.sourceTranscript}
          summary={item.sourceSummary}
          status={item.transcriptStatus}
        />

        <VerbatimNote note={item.originalNote} />

        <GenerateBar
          title={item.title}
          running={generating === "idea"}
          disabled={generating !== null}
          error={error}
          onGenerate={() => void runIdea()}
        />

        <HookList
          hooks={item.hooks}
          onChange={(hooks) => update({ hooks })}
          generating={hookGen.running}
          canGenerate={Boolean(item.title.trim())}
          genError={hookGen.error}
          // Appended, not replaced: a fresh batch must not throw away the line
          // the creator was already weighing up.
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

        <BlockList
          blocks={item.blocks}
          onChange={(blocks) => update({ blocks })}
        />

        <PipelineBar item={item} saveState={saveState} update={update} />
      </div>
    </div>
  );
}
