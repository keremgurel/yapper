"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import SampleRow from "@/components/brain/voice/sample-row";
import VideoPickerSheet from "@/components/brain/voice/video-picker-sheet";
import { Button } from "@/components/ui/button";
import { useConnections } from "@/hooks/use-connections";
import { useVoiceDerive } from "@/hooks/use-voice-derive";
import { useVoiceSamples } from "@/hooks/use-voice-samples";
import type { PublishPlatform } from "@/lib/db/schema";

/**
 * Where the brain learns how the creator sounds: from their own videos.
 *
 * Pick videos from connected channels, each is transcribed once, and the voice
 * profile and scripting patterns below are written from them. Both stay
 * editable; adding videos or rebuilding rewrites them from the whole set.
 */
export default function VoiceSection({
  onProfileChanged,
}: {
  /** The project fields were rewritten on the server; reload them. */
  onProfileChanged: () => Promise<unknown>;
}) {
  const { connections } = useConnections(true);
  const { samples, loading, failed, remove, add, refresh } =
    useVoiceSamples(true);
  const [picking, setPicking] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const {
    derive,
    deriving,
    error: deriveError,
  } = useVoiceDerive(onProfileChanged);

  const platforms = useMemo(
    () =>
      (connections ?? [])
        .filter(
          (connection) =>
            connection.status === "active" &&
            connection.platform !== "facebook",
        )
        .map((connection) => connection.platform as PublishPlatform),
    [connections],
  );

  const finished = useCallback(
    async (added: number) => {
      if (added > 0) {
        await derive();
        setPicking(false);
      }
    },
    [derive],
  );

  const removeSample = async (id: string) => {
    setRemoveError(false);
    try {
      await remove(id);
    } catch {
      setRemoveError(true);
    }
  };

  return (
    <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold">Your voice, from your videos</h2>
          <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm text-pretty">
            Yapper listens to videos you pick and writes how you sound and how
            your scripts are built. Edit the result below whenever you like.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {samples.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deriving}
              onClick={() => void derive()}
            >
              {deriving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Rebuild from {samples.length} video
              {samples.length === 1 ? "" : "s"}
            </Button>
          ) : null}
          {platforms.length > 0 ? (
            <Button type="button" size="sm" onClick={() => setPicking(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Add videos
            </Button>
          ) : null}
        </div>
      </div>

      {platforms.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Connect Instagram, TikTok or YouTube in{" "}
          <Link
            href="/studio/connections"
            className="text-foreground underline underline-offset-4"
          >
            Connections
          </Link>{" "}
          and your published videos appear here to pick from.
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading your videos…
        </p>
      ) : failed ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Your voice samples could not be loaded.{" "}
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-foreground underline underline-offset-4"
          >
            Try again
          </button>
        </p>
      ) : samples.length > 0 ? (
        <ul className="divide-border mt-3 divide-y">
          {samples.map((sample) => (
            <SampleRow
              key={sample.id}
              sample={sample}
              onRemove={() => void removeSample(sample.id)}
            />
          ))}
        </ul>
      ) : platforms.length > 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No videos yet. Three or four where you talk to camera are enough to
          start.
        </p>
      ) : null}

      {deriving && !picking ? (
        <p
          className="text-muted-foreground mt-3 flex items-center gap-2 text-sm"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Writing your voice profile…
        </p>
      ) : null}
      {deriveError ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {deriveError === "no_samples"
            ? "Add at least one video first."
            : "The voice profile could not be written. Your videos are kept; try rebuilding in a moment."}
        </p>
      ) : null}
      {removeError ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          That video could not be removed. Try again.
        </p>
      ) : null}

      <VideoPickerSheet
        open={picking}
        onOpenChange={setPicking}
        platforms={platforms}
        sampled={samples}
        onSample={add}
        onDone={finished}
        deriving={deriving}
      />
    </section>
  );
}
