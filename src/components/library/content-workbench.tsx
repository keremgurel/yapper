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
import PillarSelect from "@/components/library/pillar-select";
import ScriptSection from "@/components/library/script-section";
import StatusSelect from "@/components/library/status-select";
import { usePillarNames } from "@/hooks/use-pillar-names";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useContentItem } from "@/hooks/use-content-item";
import { useIdeaGeneration } from "@/hooks/use-idea-generation";
import { defaultScheduleDate, deleteContent } from "@/lib/content/client";
import type { SaveState } from "@/hooks/use-autosave";

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span
      className={`text-xs font-semibold ${
        state === "error" ? "text-destructive" : "text-muted-foreground"
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
  const pillarNames = usePillarNames();
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
    <div className="mx-auto max-w-4xl">
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

      <div className="mb-5 flex items-start justify-between gap-3">
        <input
          value={item.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Idea title"
          className="text-foreground placeholder:text-muted-foreground/60 w-full bg-transparent text-3xl font-black tracking-tight outline-none"
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <Link href={`/studio/recorder?item=${item.id}`}>
              <Video className="h-4 w-4" />
              Record
            </Link>
          </Button>
          <CopyScriptButton idea={item} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void remove()}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete item"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Pipeline status + pillar + save state */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
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
        <PillarSelect
          value={item.pillar}
          onChange={(pillar) => update({ pillar })}
          options={pillarNames}
          emptyLabel="No pillar"
          ariaLabel="Content pillar"
        />
        {item.status === "scheduled" && (
          <Input
            type="datetime-local"
            value={toLocalInput(item.scheduledFor)}
            onChange={(e) => {
              const iso = fromLocalInput(e.target.value);
              if (iso) update({ scheduledFor: iso });
            }}
            className="h-9 w-auto"
            aria-label="Scheduled for"
          />
        )}
        <SaveIndicator state={saveState} />
      </div>

      {/* AI generate, fills hooks/points/example/cta from the title (or source). */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Show when="signed-in">
          <Button
            type="button"
            onClick={() => void runIdea()}
            disabled={generating !== null || !item.title.trim()}
            title={item.title.trim() ? "Generate with AI" : "Add a title first"}
          >
            {generating === "idea" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating === "idea"
              ? "Generating…"
              : "Generate with AI · 1 credit"}
          </Button>
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal" withSignUp>
            <Button type="button">
              <Sparkles className="h-4 w-4" />
              Sign in to generate
            </Button>
          </SignInButton>
        </Show>
        {genError?.action === "idea" && genError.kind === "locked" && (
          <Button asChild variant="link" className="h-auto p-0">
            <Link href="/pricing">Subscribe to unlock AI generation</Link>
          </Button>
        )}
        {genError?.action === "idea" && genError.kind === "insufficient" && (
          <span className="text-sm font-semibold text-amber-500">
            Out of credits. Top up to keep generating.
          </span>
        )}
        {genError?.action === "idea" && genError.kind === "failed" && (
          <span className="text-destructive text-sm font-semibold">
            Generation failed. No credit charged. Try again.
          </span>
        )}
      </div>

      {item.sourceTitle && (
        <a
          href={item.sourceUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground mb-5 inline-flex max-w-full items-center gap-1.5 text-sm font-semibold"
        >
          <span className="truncate">From: {item.sourceTitle}</span>
          {item.sourceUrl && <ArrowUpRight className="h-4 w-4 shrink-0" />}
        </a>
      )}

      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-6">
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
            <div className="space-y-2">
              <Label htmlFor="wb-example" className="sg-field-label">
                Example / story
              </Label>
              <Textarea
                id="wb-example"
                value={item.example}
                rows={3}
                onChange={(e) => update({ example: e.target.value })}
                placeholder="A concrete moment that proves the point"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wb-cta" className="sg-field-label">
                Call to action
              </Label>
              <Input
                id="wb-cta"
                value={item.cta}
                onChange={(e) => update({ cta: e.target.value })}
                placeholder="What should the viewer do next?"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ScriptSection
              idea={item}
              generating={generating === "script"}
              disabled={generating !== null}
              error={genError?.action === "script" ? genError.kind : null}
              onGenerate={() => void runScript()}
              onChange={(script) => update({ script })}
            />
          </CardContent>
        </Card>
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
