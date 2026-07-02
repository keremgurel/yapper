"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Film, Lightbulb, Loader2, Plus } from "lucide-react";
import StatusSelect from "@/components/library/status-select";
import { useContentImport } from "@/hooks/use-content-import";
import { useContentList } from "@/hooks/use-content-list";
import {
  createContent,
  patchContent,
  type ContentSummary,
} from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

/** Default a newly scheduled item to tomorrow morning; refined in the
 * workbench. The API (and DB) require scheduled items to carry a date. */
function defaultScheduleDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/** The Content Library: the user's pipeline of ideas/scripts as a status
 * table. Rows open the script workbench. */
export default function ContentLibrary() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { items, refresh, patchRow } = useContentList(!!isSignedIn);
  const { importing } = useContentImport(!!isSignedIn, refresh);
  const [creating, setCreating] = useState(false);

  const newIdea = async () => {
    setCreating(true);
    try {
      const item = await createContent({ title: "" });
      router.push(`/studio/library/${item.id}`);
    } catch {
      setCreating(false);
    }
  };

  const changeStatus = (row: ContentSummary, status: ContentStatus) => {
    const scheduledFor =
      status === "scheduled"
        ? (row.scheduledFor ?? defaultScheduleDate())
        : row.scheduledFor;
    patchRow(row.id, { status, scheduledFor });
    patchContent(row.id, { status, scheduledFor }).catch(() => {
      patchRow(row.id, {
        status: row.status,
        scheduledFor: row.scheduledFor,
      });
    });
  };

  if (isLoaded && !isSignedIn) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-foreground text-lg font-black">Content Library</p>
        <p className="text-foreground/55 mt-1 mb-5 text-sm">
          Sign in to build your content pipeline: shape ideas into scripts and
          track them from drafted to posted.
        </p>
        <SignInButton mode="modal" withSignUp>
          <button className="rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-600">
            Sign in
          </button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-black">
            Content Library
          </h1>
          <p className="text-foreground/55 mt-0.5 text-sm">
            Your pipeline from idea to posted.
            {importing && " Importing your saved ideas…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void newIdea()}
          disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          New idea
        </button>
      </div>

      {items === null ? (
        <div className="text-foreground/50 flex items-center gap-2 py-12 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="border-border text-foreground/55 flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-16 text-center">
          <Lightbulb className="h-6 w-6" />
          <p className="text-foreground text-base font-bold">
            Nothing in the pipeline yet
          </p>
          <p className="max-w-sm text-sm">
            Start a blank idea, or save clips in Inspiration and turn them into
            ideas from there.
          </p>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-2xl border">
          {/* Header row */}
          <div className="text-foreground/45 border-border bg-muted/40 hidden grid-cols-[1fr_130px_150px_40px] gap-3 border-b px-4 py-2 font-mono text-[10px] font-black tracking-[0.14em] uppercase sm:grid">
            <span>Title</span>
            <span>Status</span>
            <span>Updated</span>
            <span />
          </div>
          {items.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => router.push(`/studio/library/${row.id}`)}
              className="border-border hover:bg-muted/40 grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 sm:grid-cols-[1fr_130px_150px_40px]"
            >
              <span className="text-foreground min-w-0 truncate text-[14px] font-bold">
                {row.title.trim() || "Untitled idea"}
              </span>
              <span>
                <StatusSelect
                  value={row.status}
                  onChange={(status) => changeStatus(row, status)}
                />
              </span>
              <span className="text-foreground/50 hidden text-[12px] sm:block">
                {when(row.updatedAt)}
              </span>
              <span className="hidden justify-self-end sm:block">
                {row.submissionId && (
                  <Film
                    className="text-foreground/45 h-4 w-4"
                    aria-label="Has a recording"
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
