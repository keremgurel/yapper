"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { Show, SignInButton } from "@clerk/nextjs";
import CopyScriptButton from "@/components/library/copy-script-button";
import EditableList from "@/components/library/editable-list";
import ScriptSection from "@/components/library/script-section";
import StatusSelect from "@/components/library/status-select";
import { useContentItem } from "@/hooks/use-content-item";
import { useIdeaGeneration } from "@/hooks/use-idea-generation";
import { defaultScheduleDate, deleteContent } from "@/lib/content/client";
import type { SaveState } from "@/hooks/use-autosave";

const genBtn =
  "inline-flex items-center gap-1.5 rounded-full bg-cyan-500 px-3.5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-50";

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span
      className={`text-[11px] font-bold ${
        state === "error" ? "text-red-500" : "text-foreground/40"
      }`}
      role={state === "error" ? "alert" : undefined}
    >
      {state === "saving"
        ? "Saving…"
        : state === "saved"
          ? "Saved"
          : "Save failed. Edits retry on your next change."}
    </span>
  );
}

/** The Lab: one library item's script workbench. Server-backed with a single
 * autosave queue; AI generation applies through the same update path. */
export default function ContentWorkbench({ id }: { id: string }) {
  const router = useRouter();
  const { item, loading, missing, saveState, update } = useContentItem(id);
  const {
    generating,
    error: genError,
    runIdea,
    runScript,
  } = useIdeaGeneration(
    item ?? {
      title: "",
      hooks: [],
      points: [],
      example: "",
      cta: "",
    },
    update,
  );

  if (loading) {
    return (
      <div className="text-foreground/50 flex items-center gap-2 py-12 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (missing || !item) {
    return (
      <div className="py-12">
        <p className="text-foreground/55 text-sm">
          This item doesn&apos;t exist (or isn&apos;t yours).
        </p>
        <Link
          href="/studio/library"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-cyan-500 no-underline hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the library
        </Link>
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
    <div className="max-w-3xl">
      <Link
        href="/studio/library"
        className="text-foreground/50 hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-xs font-bold no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Library
      </Link>

      <div className="mb-4 flex items-start justify-between gap-3">
        <input
          value={item.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Idea title"
          className="text-foreground w-full bg-transparent text-2xl font-black tracking-tight outline-none"
        />
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/studio/recorder?item=${item.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500 px-3.5 py-2 text-[13px] font-bold text-white no-underline transition-colors hover:bg-cyan-600"
          >
            <Video className="h-3.5 w-3.5" />
            Record
          </Link>
          <CopyScriptButton idea={item} />
          <button
            type="button"
            onClick={() => void remove()}
            className="text-foreground/40 rounded-lg p-2 hover:text-red-500"
            aria-label="Delete item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Pipeline status + save state */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusSelect
          value={item.status}
          onChange={(status) =>
            update(
              status === "scheduled" && !item.scheduledFor
                ? { status, scheduledFor: defaultScheduleDate() }
                : { status },
            )
          }
        />
        {item.status === "scheduled" && (
          <input
            type="datetime-local"
            value={toLocalInput(item.scheduledFor)}
            onChange={(e) => {
              const iso = fromLocalInput(e.target.value);
              if (iso) update({ scheduledFor: iso });
            }}
            className="border-border bg-background text-foreground rounded-lg border px-2 py-1 text-[12px] outline-none"
            aria-label="Scheduled for"
          />
        )}
        <SaveIndicator state={saveState} />
      </div>

      {/* AI generate, fills hooks/points/example/cta from the title (or source). */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Show when="signed-in">
          <button
            type="button"
            onClick={() => void runIdea()}
            disabled={generating !== null || !item.title.trim()}
            className={genBtn}
            title={item.title.trim() ? "Generate with AI" : "Add a title first"}
          >
            {generating === "idea" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {generating === "idea"
              ? "Generating…"
              : "Generate with AI · 1 credit"}
          </button>
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal" withSignUp>
            <button type="button" className={genBtn}>
              <Sparkles className="h-3.5 w-3.5" />
              Sign in to generate
            </button>
          </SignInButton>
        </Show>
        {genError?.action === "idea" && genError.kind === "locked" && (
          <Link
            href="/pricing"
            className="text-[12px] font-bold text-cyan-500 hover:underline"
          >
            Subscribe to unlock AI generation
          </Link>
        )}
        {genError?.action === "idea" && genError.kind === "insufficient" && (
          <span className="text-[12px] font-bold text-amber-500">
            Out of credits. Top up to keep generating.
          </span>
        )}
        {genError?.action === "idea" && genError.kind === "failed" && (
          <span className="text-[12px] font-bold text-red-500">
            Generation failed. No credit charged. Try again.
          </span>
        )}
      </div>

      {item.sourceTitle && (
        <a
          href={item.sourceUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/55 hover:text-foreground mb-6 inline-flex max-w-full items-center gap-1.5 text-xs font-bold"
        >
          <span className="truncate">From: {item.sourceTitle}</span>
          {item.sourceUrl && <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />}
        </a>
      )}

      <div className="space-y-7">
        <EditableList
          label="Hook options"
          items={item.hooks}
          onChange={(hooks) => update({ hooks })}
          addLabel="Add hook"
          placeholder="An opening line that stops the scroll"
        />
        <EditableList
          label="Key points"
          items={item.points}
          onChange={(points) => update({ points })}
          addLabel="Add point"
          placeholder="One idea per line"
        />
        <div>
          <p className="text-foreground/45 mb-2 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
            Example / story
          </p>
          <textarea
            value={item.example}
            rows={3}
            onChange={(e) => update({ example: e.target.value })}
            placeholder="A concrete moment that proves the point"
            className="border-border bg-background text-foreground focus:border-foreground/40 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <p className="text-foreground/45 mb-2 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
            Call to action
          </p>
          <input
            value={item.cta}
            onChange={(e) => update({ cta: e.target.value })}
            placeholder="What should the viewer do next?"
            className="border-border bg-background text-foreground focus:border-foreground/40 w-full rounded-lg border px-3 py-2 text-sm outline-none"
          />
        </div>
        <ScriptSection
          idea={item}
          generating={generating === "script"}
          disabled={generating !== null}
          error={genError?.action === "script" ? genError.kind : null}
          onGenerate={() => void runScript()}
          onChange={(script) => update({ script })}
        />
      </div>
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
