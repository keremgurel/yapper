"use client";

import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/studio-ui";
import CaptionPanel from "@/components/publish/captions/caption-panel";
import DestinationPicker from "@/components/publish/captions/destination-picker";
import {
  captionFor,
  hasCaptionText,
  type CaptionSet,
} from "@/components/publish/captions/caption-draft";
import CoverCanvas from "@/components/publish/poster/cover-canvas";
import ScheduleFields from "@/components/publish/poster/schedule-fields";
import type { CoverDraft } from "@/components/publish/poster/cover-draft";
import type { ScheduleSpacing } from "@/components/publish/poster/use-schedule";
import type { PublishPlatform } from "@/lib/db/schema";
import { captionFits, type PlatformCaption } from "@/lib/publish/caption";
import type { PostableVideo } from "@/lib/publish/postable-videos";

interface DestinationsProps {
  selected: Set<PublishPlatform>;
  connected: PublishPlatform[];
  onToggle: (platform: PublishPlatform) => void;
}

interface CaptionsProps {
  set: CaptionSet | undefined;
  generating: boolean;
  error: string;
  matchStyle: boolean;
  onMatchStyle: (matchStyle: boolean) => void;
  onGenerate: () => void;
  onChange: (caption: PlatformCaption) => void;
}

interface CoverProps {
  draft: CoverDraft;
  onChange: (draft: CoverDraft) => void;
  onDownload: () => void;
}

interface ScheduleProps {
  at: string;
  spacing: ScheduleSpacing;
  state: "idle" | "saving" | "done";
  onAt: (at: string) => void;
  onSpacing: (spacing: ScheduleSpacing) => void;
  onSchedule: () => void;
}

interface PublishProps {
  preparing: boolean;
  warning: string;
  onPublish: () => void;
}

/** Everything that happens to one video before it goes out, in the order it
 * happens: where it is going, what it says there, what it looks like, when. */
export default function PrepareRail({
  video,
  selectedCount,
  destinations,
  captions,
  cover,
  schedule,
  publish,
}: {
  video: PostableVideo;
  selectedCount: number;
  destinations: DestinationsProps;
  captions: CaptionsProps;
  cover: CoverProps;
  schedule: ScheduleProps;
  publish: PublishProps;
}) {
  const chosen = [...destinations.selected];
  const rejected = chosen.filter((platform) => {
    const caption = captionFor(captions.set, platform);
    return hasCaptionText(caption) && !captionFits(caption);
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground text-xs">Preparing</p>
        <h2 className="text-foreground mt-0.5 truncate text-base font-semibold">
          {video.title}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          {selectedCount} selected. Captions are drafted for every selected
          video at once.
        </p>
      </div>

      <Section title="Destinations">
        <DestinationPicker
          selected={destinations.selected}
          connected={destinations.connected}
          disabled={captions.generating}
          onToggle={destinations.onToggle}
        />
      </Section>

      <Section title="Captions">
        <CaptionPanel
          platforms={chosen}
          captions={captions.set}
          videoCount={selectedCount}
          generating={captions.generating}
          error={captions.error}
          matchStyle={captions.matchStyle}
          onMatchStyle={captions.onMatchStyle}
          onGenerate={captions.onGenerate}
          onChange={captions.onChange}
        />
      </Section>

      <Section title="Cover">
        <CoverCanvas
          draft={cover.draft}
          onChange={cover.onChange}
          onDownload={cover.onDownload}
        />
      </Section>

      <Section title="Schedule">
        <ScheduleFields
          at={schedule.at}
          spacing={schedule.spacing}
          state={schedule.state}
          count={selectedCount}
          onAt={schedule.onAt}
          onSpacing={schedule.onSpacing}
          onSchedule={schedule.onSchedule}
        />
      </Section>

      <div className="flex flex-col gap-2">
        {publish.warning && (
          <p className="text-xs font-semibold text-[color:var(--sg-yellow-500)]">
            {publish.warning}
          </p>
        )}
        {rejected.length > 0 && (
          <p className="text-xs font-semibold text-[color:var(--sg-yellow-500)]">
            {rejected.length} caption{rejected.length === 1 ? " is" : "s are"}{" "}
            over the platform limit and will be rejected at upload.
          </p>
        )}
        <Button
          type="button"
          disabled={publish.preparing}
          onClick={publish.onPublish}
        >
          {publish.preparing ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            <Send aria-hidden />
          )}
          {publish.preparing
            ? "Preparing captions and cover…"
            : "Review and publish"}
        </Button>
      </div>
    </div>
  );
}
