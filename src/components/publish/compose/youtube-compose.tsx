"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { crossPostToYouTube, generateCaption } from "@/lib/publish/client";
import { Button } from "@/components/ui/button";
import { useCrossPost } from "@/hooks/use-cross-post";
import { useThumbnailUpload } from "@/hooks/use-thumbnail-upload";
import ComposeActions from "./compose-actions";
import ThumbnailPicker from "./thumbnail-picker";
import type { CrossPostTarget } from "./types";

/** Compose a YouTube post: title + description, with an opt-in AI draft that can
 * match the user's past captions. Uploads private until the API audit clears. */
export default function YouTubeCompose({
  item,
  onDone,
}: {
  item: CrossPostTarget;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState("");
  const [matchStyle, setMatchStyle] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const { state, error, result, post } = useCrossPost();
  const busy = state === "posting";
  const thumb = useThumbnailUpload();

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const caption = await generateCaption({
        title: title.trim() || item.title,
        matchStyle,
      });
      setTitle(caption.title || title);
      setDescription(caption.description);
    } catch (e) {
      setGenError(
        e instanceof Error && e.message === "no_provider"
          ? "AI captions aren't set up yet."
          : "Couldn't generate. Try again.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const onPost = () => {
    if (!title.trim() || busy) return;
    void post(() =>
      crossPostToYouTube({
        submissionId: item.submissionId,
        mediaKey: item.mediaKey,
        title: title.trim(),
        description: description.trim() || undefined,
        contentItemId: item.contentItemId,
        thumbnailKey: thumb.thumbnailKey ?? undefined,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">
        Uploads to your channel. It stays private until your YouTube API audit
        clears.
      </p>

      <div className="border-border flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-foreground/70 text-xs font-bold">
            Draft with AI
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => void generate()}
            disabled={generating || busy}
            style={{ background: "var(--sg-accent-gradient)" }}
            className="text-white"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate
          </Button>
        </div>
        <label className="text-foreground/70 flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={matchStyle}
            onChange={(e) => setMatchStyle(e.target.checked)}
            className="accent-[color:var(--sg-accent)]"
          />
          Match my past captions
        </label>
        {genError && (
          <p className="text-[11px] font-bold text-[color:var(--sg-pink-500)]">
            {genError}
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-foreground/70 text-xs font-bold">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          disabled={busy}
          className="border-border bg-card rounded-lg border px-3 py-2 text-sm outline-none focus:border-[color:var(--sg-accent)]"
        />
        <span className="text-muted-foreground text-[11px]">
          {title.length}/100
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-foreground/70 text-xs font-bold">
          Description
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          rows={5}
          disabled={busy}
          placeholder="Optional"
          className="border-border bg-card placeholder:text-foreground/30 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-[color:var(--sg-accent)]"
        />
      </label>

      <ThumbnailPicker
        previewUrl={thumb.previewUrl}
        uploading={thumb.uploading}
        error={thumb.error}
        onPick={thumb.pick}
        onClear={thumb.clear}
      />

      <ComposeActions
        platform="youtube"
        state={state}
        error={error}
        result={result}
        postLabel="Post to YouTube"
        postedSuffix="(private)"
        onPost={onPost}
        onDone={onDone}
        disabled={!title.trim()}
      />
    </div>
  );
}
