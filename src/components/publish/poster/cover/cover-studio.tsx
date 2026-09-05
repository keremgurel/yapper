"use client";

import { useEffect, useRef, useState } from "react";
import { Section } from "@/components/studio-ui";
import {
  DEFAULT_THUMBNAIL_PROMPT,
  type CoverDraft,
} from "@/components/publish/poster/cover-draft";
import CoverPreview from "./cover-preview";
import Disclosure from "./disclosure";
import FramePicker, { FramePreview } from "./frame-picker";
import RemixPanel from "./remix-panel";
import TextOverlayPanel from "./text-overlay-panel";
import { useCoverMedia, type CoverMediaRef } from "./use-cover-media";
import { useFilmstrip } from "./use-filmstrip";
import { useFramePicker } from "./use-frame-picker";
import { useReferenceImage } from "./use-reference-image";
import { useThumbnailGeneration } from "./use-thumbnail-generation";

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
  onFramePendingChange,
}: {
  draft: CoverDraft;
  media: CoverMediaRef;
  onChange: (draft: CoverDraft) => void;
  onDownload: () => void;
  onFramePendingChange: (pending: boolean) => void;
}) {
  const source = useCoverMedia(media);
  const picker = useFramePicker(source.url, draft.image ? draft.frameTime : 1);
  const filmstrip = useFilmstrip(source.url, picker.duration);
  const reference = useReferenceImage();
  const generation = useThumbnailGeneration();
  const [prompt, setPrompt] = useState(DEFAULT_THUMBNAIL_PROMPT);
  const [useFrame, setUseFrame] = useState(true);

  useEffect(() => {
    onFramePendingChange(draft.source !== "generated" && picker.busy);
    return () => onFramePendingChange(false);
  }, [draft.source, picker.busy, onFramePendingChange]);

  const draftRef = useRef(draft);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    draftRef.current = draft;
    onChangeRef.current = onChange;
  }, [draft, onChange]);

  useEffect(() => {
    if (!picker.frame) return;
    const current = draftRef.current;
    const keepRemix = current.source === "generated";
    onChangeRef.current({
      ...current,
      frameImage: picker.frame.image,
      image: keepRemix ? current.image : picker.frame.image,
      source: keepRemix ? "generated" : "frame",
      frameTime: picker.frame.time,
    });
  }, [picker.frame]);

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
          <FramePreview
            image={picker.frame?.image ?? null}
            capturing={picker.busy}
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

      <FramePicker
        duration={picker.duration}
        time={picker.time}
        index={picker.index}
        frameCount={picker.frameCount}
        tiles={filmstrip.tiles}
        tilesLoading={filmstrip.loading}
        capturing={picker.busy}
        error={source.error || picker.error}
        onSeek={picker.seek}
        onSelect={picker.select}
        onStep={picker.step}
        onJump={picker.jump}
        onRetry={picker.retry}
      />

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
