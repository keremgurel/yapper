"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_THUMBNAIL_PROMPT,
  withCoverFrame,
  type CoverDraft,
} from "../cover-draft";
import { PosterDialog } from "../poster-layout";
import { downloadCover } from "../render-cover";
import CoverArtwork from "./cover-artwork";
import FramePicker from "./frame-picker";
import FramePreview from "./frame-preview";
import RemixPanel from "./remix-panel";
import TextOverlayPanel from "./text-overlay-panel";
import ThumbnailUpload from "./thumbnail-upload";
import { useCoverMedia, type CoverMediaRef } from "./use-cover-media";
import { useFilmstrip } from "./use-filmstrip";
import { useFramePicker } from "./use-frame-picker";
import { useReferenceImage } from "./use-reference-image";
import { useThumbnailGeneration } from "./use-thumbnail-generation";

export default function CoverEditor({
  initial,
  media,
  originalImage,
  onCancel,
  onApply,
}: {
  initial: CoverDraft;
  media: CoverMediaRef;
  originalImage?: string;
  onCancel: () => void;
  onApply: (cover: CoverDraft) => void;
}) {
  const [stored, setDraft] = useState(initial);
  const [tab, setTab] = useState<"Frame" | "Text" | "AI">("Frame");
  const [candidate, setCandidate] = useState<string>();
  const [prompt, setPrompt] = useState(DEFAULT_THUMBNAIL_PROMPT);
  const [useFrame, setUseFrame] = useState(true);
  const [downloadError, setDownloadError] = useState(false);
  const source = useCoverMedia(media);
  const picker = useFramePicker(
    source.url,
    initial.frameImage ? initial.frameTime : 1,
  );
  const filmstrip = useFilmstrip(source.url, picker.duration);
  const reference = useReferenceImage();
  const generation = useThumbnailGeneration();
  const frame = picker.frame;
  const draft = useMemo(
    () => (frame ? withCoverFrame(stored, frame) : stored),
    [stored, frame],
  );
  const pending =
    draft.source === "frame" &&
    (picker.busy ||
      (!picker.error && Boolean(source.url) && frame?.time !== picker.time));
  const error = source.error || picker.error;
  const chooseFrame = (action: () => void) => {
    setDraft((current) =>
      current.source === "frame"
        ? current
        : { ...current, image: current.frameImage, source: "frame" },
    );
    action();
  };

  return (
    <PosterDialog
      open
      onClose={onCancel}
      title="Edit cover"
      wide
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!draft.image || pending}
            onClick={() => onApply(draft)}
          >
            Apply cover
          </Button>
        </>
      }
    >
      <div className="grid min-w-0 gap-5 md:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[216px_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[156px] space-y-2 md:max-w-none">
          <p className="text-sm font-semibold">Cover preview</p>
          <div className="overflow-hidden rounded-lg">
            {tab === "Frame" &&
            draft.source === "frame" &&
            !draft.showHeadline ? (
              <FramePreview
                key={source.url}
                mediaUrl={source.url}
                time={picker.previewTime}
                image={frame?.image ?? null}
                capturing={!error && pending}
                error={error}
              />
            ) : (
              <CoverArtwork draft={draft} />
            )}
          </div>
          <p className="text-muted-foreground text-xs">9:16 · 1080 × 1920</p>
          {downloadError ? (
            <p role="alert" className="text-destructive text-xs">
              The cover couldn’t be downloaded.
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-4">
          <div
            role="group"
            aria-label="Cover tools"
            className="border-border flex flex-wrap gap-2 border-b pb-3"
          >
            {(["Frame", "Text", "AI"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={tab === option ? "secondary" : "ghost"}
                aria-pressed={tab === option}
                onClick={() => setTab(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          {tab === "Frame" && (
            <>
              <FramePicker
                duration={picker.duration}
                time={picker.time}
                index={picker.index}
                frameCount={picker.frameCount}
                tiles={filmstrip.tiles}
                tilesLoading={filmstrip.loading}
                capturing={picker.busy}
                error={error}
                onSeek={(value) => chooseFrame(() => picker.seek(value))}
                onSelect={(value) => chooseFrame(() => picker.select(value))}
                onStep={(value) => chooseFrame(() => picker.step(value))}
                onJump={(value) => chooseFrame(() => picker.jump(value))}
                onRetry={() => {
                  source.retry();
                  picker.retry();
                }}
              />
              <div className="flex flex-wrap gap-2">
                {draft.source !== "frame" && draft.frameImage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        image: current.frameImage,
                        source: "frame",
                      }))
                    }
                  >
                    Use selected frame
                  </Button>
                ) : null}
                {originalImage && draft.source !== "original" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        image: originalImage,
                        source: "original",
                      }))
                    }
                  >
                    Use original cover
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!draft.image || pending}
                  onClick={() => {
                    setDownloadError(false);
                    void downloadCover(draft).catch(() =>
                      setDownloadError(true),
                    );
                  }}
                >
                  Download cover
                </Button>
              </div>
              <ThumbnailUpload
                replacing={draft.source === "uploaded"}
                disabled={generation.generating}
                onImage={(image) =>
                  setDraft((current) => ({
                    ...current,
                    image,
                    source: "uploaded",
                  }))
                }
              />
            </>
          )}
          {tab === "Text" && (
            <TextOverlayPanel draft={draft} onChange={setDraft} />
          )}
          {tab === "AI" && (
            <>
              <RemixPanel
                prompt={prompt}
                hasFrame={Boolean(draft.frameImage)}
                useFrame={useFrame}
                reference={reference.reference}
                referenceName={reference.name}
                referenceError={reference.error}
                generating={generation.generating}
                error={generation.error}
                onPrompt={setPrompt}
                onUseFrame={setUseFrame}
                onReference={(file) => void reference.pick(file)}
                onClearReference={reference.clear}
                onGenerate={async () => {
                  const image = await generation.generate({
                    prompt,
                    frame: useFrame
                      ? (draft.frameImage ?? undefined)
                      : undefined,
                    reference: reference.reference ?? undefined,
                  });
                  if (image) setCandidate(image);
                }}
              />
              {candidate && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Generated cover</p>
                  <div className="max-w-32 overflow-hidden rounded-lg">
                    <CoverArtwork draft={{ ...draft, image: candidate }} />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        image: candidate,
                        source: "generated",
                      }));
                      setCandidate(undefined);
                    }}
                  >
                    Use this image
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PosterDialog>
  );
}
