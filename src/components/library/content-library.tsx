"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Loader2, Plus, Upload } from "lucide-react";
import { useAddVideo } from "@/hooks/use-add-video";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import PillarSelect from "@/components/library/pillar-select";
import IdeaCapture from "@/components/library/idea-capture";
import ContentTable from "@/components/library/content-table";
import ContentTableSkeleton from "@/components/library/content-table-skeleton";
import { Button } from "@/components/ui/button";
import { useContentImport } from "@/hooks/use-content-import";
import { useContentList } from "@/hooks/use-content-list";
import { useContentSort } from "@/hooks/use-content-sort";
import {
  createContent,
  defaultScheduleDate,
  patchContent,
  type ContentDetail,
  type ContentSummary,
} from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";

/** The Content Library: the user's pipeline of ideas/scripts as a sortable
 * status table. Orchestrates capture, the pillar filter, and the table; the
 * table, rows, sorting, and loading state each live in their own module. */
export default function ContentLibrary() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { items, refresh, patchRow, prependRow } = useContentList(!!isSignedIn);
  const { importing } = useContentImport(!!isSignedIn, refresh);
  const [creating, setCreating] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [pillarFilter, setPillarFilter] = useState<string | null>(null);

  // Distinct pillars present across the pipeline (sorted), for the filter.
  const pillarOptions = useMemo(() => {
    const set = new Set<string>();
    (items ?? []).forEach((r) => r.pillar && set.add(r.pillar));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visibleItems = useMemo(() => {
    if (!items) return items;
    return pillarFilter
      ? items.filter((r) => r.pillar === pillarFilter)
      : items;
  }, [items, pillarFilter]);

  const { sort, toggle, sorted } = useContentSort(visibleItems);

  const newIdea = async () => {
    setCreating(true);
    try {
      const item = await createContent({ title: "" });
      router.push(`/studio/library/${item.id}`);
    } catch {
      setCreating(false);
    }
  };

  // A captured idea drops straight into the list (with a brief highlight) — no
  // navigation, so the user can keep dumping ideas.
  const onCaptured = (item: ContentDetail) => {
    prependRow(item);
    setFreshId(item.id);
    window.setTimeout(
      () => setFreshId((id) => (id === item.id ? null : id)),
      2200,
    );
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const { state: addState, error: addError, add } = useAddVideo(onCaptured);
  const [postItem, setPostItem] = useState<CrossPostTarget | null>(null);

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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
            Content Library
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your pipeline from idea to posted.
            {importing && " Importing your saved ideas…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void newIdea()}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Blank idea
          </Button>
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={addState === "uploading"}
          >
            {addState === "uploading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Add video
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void add(file);
            }}
          />
        </div>
      </div>
      {addError && (
        <p className="mb-4 text-sm font-bold text-[color:var(--sg-pink-500)]">
          {addError === "storage_full"
            ? "You're out of storage. Free some space and try again."
            : addError === "locked"
              ? "Adding videos needs an upgrade."
              : addError === "not_video"
                ? "That's not a video file."
                : "Couldn't add that video. Try again."}
        </p>
      )}

      {/* Talk-or-type capture: the primary way ideas enter the library. */}
      <div className="mb-6">
        <IdeaCapture onCaptured={onCaptured} />
      </div>

      {items === null ? (
        <ContentTableSkeleton />
      ) : items.length === 0 ? (
        <div className="text-muted-foreground px-6 py-14 text-center">
          <p className="text-foreground text-base font-bold">
            Nothing in the pipeline yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm">
            Drop your first idea above — talk it out or type it. Or save clips
            in Inspiration and turn them into ideas from there.
          </p>
        </div>
      ) : (
        <>
          {pillarOptions.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <PillarSelect
                value={pillarFilter}
                onChange={setPillarFilter}
                options={pillarOptions}
                emptyLabel="All pillars"
                ariaLabel="Filter by pillar"
              />
              {pillarFilter && (
                <span className="text-muted-foreground text-xs">
                  {visibleItems?.length ?? 0} in {pillarFilter}
                </span>
              )}
            </div>
          )}
          <ContentTable
            rows={sorted ?? []}
            sort={sort}
            onToggleSort={toggle}
            onOpen={(id) => router.push(`/studio/library/${id}`)}
            onStatus={changeStatus}
            onPost={(row) =>
              setPostItem({
                id: row.id,
                title: row.title.trim() || "Untitled",
                submissionId: row.submissionId!,
              })
            }
            freshId={freshId}
          />
        </>
      )}

      {postItem && (
        <CrossPostSheet
          key={postItem.id}
          item={postItem}
          onClose={() => setPostItem(null)}
        />
      )}
    </div>
  );
}
