"use client";

import { useEffect, useRef, useState } from "react";
import { Section } from "@/components/studio-ui";
import {
  DEFAULT_THUMBNAIL_PROMPT,
  type CoverDraft,
} from "@/components/publish/poster/cover-draft";
import CoverPreview from "./cover-preview";
import Disclosure from "./disclosure";
import FramePicker from "./frame-picker";
import RemixPanel from "./remix-panel";
import TextOverlayPanel from "./text-overlay-panel";
import { useCoverMedia, type CoverMediaRef } from "./use-cover-media";
import { useFilmstrip } from "./use-filmstrip";
import { useFramePicker } from "./use-frame-picker";
import { useReferenceImage } from "./use-reference-image";
import { useThumbnailGeneration } from "./use-thumbnail-generation";

const CAPTURE_SETTLE_MS = 220;

/**
 * The thumbnail. The frame under the playhead is the cover, live: scrubbing
 * changes it, and there is no button to press. The source video and the cover
 * sit side by side at the same size so the creator sees what they picked next
 * to what will ship. Remixing with AI and adding text are folded steps below.
 */
export default function CoverStudio({
  draft,
  media,
  onChange,
  onDownload,
}: {
  draft: CoverDraft;
  media: CoverMediaRef;
  onChange: (draft: CoverDraft) => void;
  onDownload: () => void;
}) {
  const source = useCoverMedia(media);
  const picker = useFramePicker(draft.frameTime);
  const filmstrip = useFilmstrip(source.url, picker.duration);
  const reference = useReferenceImage();
  const generation = useThumbnailGeneration();
  const [prompt, setPrompt] = useState(DEFAULT_THUMBNAIL_PROMPT);
  const [useFrame, setUseFrame] = useState(true);

  // The draft the capture should build on, read at capture time rather than
  // at the time the debounce was scheduled.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const adoptFrame = async (at: number) => {
    const image = await picker.capture(at);
    if (!image) return;
    const current = draftRef.current;
    const keepRemix = current.source === "generated";
    onChange({
      ...current,
      frameImage: image,
      image: keepRemix ? current.image : image,
      source: keepRemix ? "generated" : "frame",
      frameTime: at,
    });
  };

  // Live capture: a moment after the playhead stops moving, the frame under
  // it becomes the cover (or, while an AI remix is showing, the frame the next
  // remix will start from).
  useEffect(() => {
    if (!source.url || !picker.duration) return;
    if (
      Math.abs(draftRef.current.frameTime - picker.time) < 0.001 &&
      draftRef.current.frameImage
    ) {
      return;
    }
    const handle = setTimeout(
      () => void adoptFrame(picker.time),
      CAPTURE_SETTLE_MS,
    );
    return () => clearTimeout(handle);
    // adoptFrame reads through refs; picker.time is the only real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker.time, picker.duration, source.url]);

  const generate = async () => {
    const image = await generation.generate({
      prompt,
      frame: useFrame && draft.frameImage ? draft.frameImage : undefined,
      reference: reference.reference ?? undefined,
    });
    if (image) onChange({ ...draft, image, source: "generated" });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Pick the frame" rank="quiet">
          <FramePicker
            videoRef={picker.videoRef}
            mediaUrl={source.url}
            duration={picker.duration}
            time={picker.time}
            tiles={filmstrip.tiles}
            tilesLoading={filmstrip.loading}
            capturing={picker.busy}
            error={source.error || picker.error}
            onLoadedMetadata={(duration) => {
              picker.setDuration(duration);
              // Land a little past the start so the default is not the black
              // lead in; the live capture takes it from there.
              picker.seek(
                draft.image ? draft.frameTime : Math.min(1, duration * 0.08),
                duration,
              );
            }}
            onSeek={(time) => picker.seek(time)}
            onStep={picker.step}
          />
        </Section>
        <Section title="Your thumbnail" rank="quiet">
          <CoverPreview
            draft={draft}
            onDownload={onDownload}
            onUseFrame={() =>
              onChange({
                ...draft,
                image: draft.frameImage,
                source: "frame",
              })
            }
          />
        </Section>
      </div>

      <Disclosure
        title="Remix with AI"
        meta={draft.source === "generated" ? "in use" : "2 credits"}
      >
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
          onGenerate={() => void generate()}
        />
      </Disclosure>

      <Disclosure
        title="Text on the thumbnail"
        meta={draft.showHeadline && draft.headline.trim() ? "on" : "off"}
      >
        <TextOverlayPanel draft={draft} onChange={onChange} />
      </Disclosure>
    </div>
  );
}
