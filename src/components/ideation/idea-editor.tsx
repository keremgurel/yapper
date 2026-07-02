"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Show, SignInButton } from "@clerk/nextjs";
import CopyScriptButton from "@/components/ideation/copy-script-button";
import EditableList from "@/components/ideation/editable-list";
import { useIdeas } from "@/components/ideation/ideas-context";
import type { Idea } from "@/lib/inspiration/ideas";

const genBtn =
  "inline-flex items-center gap-1.5 rounded-full bg-cyan-500 px-3.5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-50";

export default function IdeaEditor({
  idea,
  onDeleted,
}: {
  idea: Idea;
  onDeleted: () => void;
}) {
  const { updateIdea, deleteIdea } = useIdeas();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<"insufficient" | "failed" | null>(
    null,
  );

  const generate = async () => {
    if (!idea.title.trim()) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/generate/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: idea.title,
          sourceTitle: idea.sourceTitle,
          sourceUrl: idea.sourceUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setGenError("insufficient");
        return;
      }
      if (!res.ok) {
        setGenError("failed");
        return;
      }
      updateIdea(idea.id, {
        hooks: data.hooks?.length ? data.hooks : idea.hooks,
        points: data.points?.length ? data.points : idea.points,
        example: data.example || idea.example,
        cta: data.cta || idea.cta,
      });
    } catch {
      setGenError("failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-5 flex items-start justify-between gap-3">
        <input
          value={idea.title}
          onChange={(e) => updateIdea(idea.id, { title: e.target.value })}
          placeholder="Idea title"
          className="text-foreground w-full bg-transparent text-2xl font-black tracking-tight outline-none"
        />
        <div className="flex shrink-0 items-center gap-2">
          <CopyScriptButton idea={idea} />
          <button
            type="button"
            onClick={() => {
              deleteIdea(idea.id);
              onDeleted();
            }}
            className="text-foreground/40 rounded-lg p-2 hover:text-red-500"
            aria-label="Delete idea"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* AI generate — fills hooks/points/example/cta from the title (or source). */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Show when="signed-in">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating || !idea.title.trim()}
            className={genBtn}
            title={idea.title.trim() ? "Generate with AI" : "Add a title first"}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {generating ? "Generating…" : "Generate with AI · 1 credit"}
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
        {genError === "insufficient" && (
          <span className="text-[12px] font-bold text-amber-500">
            Out of credits — top up to keep generating.
          </span>
        )}
        {genError === "failed" && (
          <span className="text-[12px] font-bold text-red-500">
            Generation failed — no credit charged. Try again.
          </span>
        )}
      </div>

      {idea.sourceTitle && (
        <a
          href={idea.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/55 hover:text-foreground mb-6 inline-flex max-w-full items-center gap-1.5 text-xs font-bold"
        >
          <span className="truncate">From: {idea.sourceTitle}</span>
          {idea.sourceUrl && <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />}
        </a>
      )}

      <div className="space-y-7">
        <EditableList
          label="Hook options"
          items={idea.hooks}
          onChange={(hooks) => updateIdea(idea.id, { hooks })}
          addLabel="Add hook"
          placeholder="An opening line that stops the scroll"
        />
        <EditableList
          label="Key points"
          items={idea.points}
          onChange={(points) => updateIdea(idea.id, { points })}
          addLabel="Add point"
          placeholder="One idea per line"
        />
        <div>
          <p className="text-foreground/45 mb-2 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
            Example / story
          </p>
          <textarea
            value={idea.example}
            rows={3}
            onChange={(e) => updateIdea(idea.id, { example: e.target.value })}
            placeholder="A concrete moment that proves the point"
            className="border-border bg-background text-foreground focus:border-foreground/40 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <p className="text-foreground/45 mb-2 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
            Call to action
          </p>
          <input
            value={idea.cta}
            onChange={(e) => updateIdea(idea.id, { cta: e.target.value })}
            placeholder="What should the viewer do next?"
            className="border-border bg-background text-foreground focus:border-foreground/40 w-full rounded-lg border px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>
    </div>
  );
}
