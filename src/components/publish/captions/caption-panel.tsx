"use client";

import { useState } from "react";
import { Loader2, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/studio-ui";
import CaptionEditor from "@/components/publish/captions/caption-editor";
import PlatformCaptionTabs, {
  panelId,
  tabId,
} from "@/components/publish/captions/platform-caption-tabs";
import {
  captionFor,
  type CaptionSet,
} from "@/components/publish/captions/caption-draft";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformCaption } from "@/lib/publish/caption";

/**
 * The caption workspace for one video: one tab per destination, one editor per
 * tab. Which platform is being read is local state; the captions themselves are
 * not, so nothing is lost by switching tabs or videos.
 */
export default function CaptionPanel({
  platforms,
  captions,
  videoCount,
  generating,
  error,
  matchStyle,
  onMatchStyle,
  onGenerate,
  onChange,
}: {
  platforms: PublishPlatform[];
  captions: CaptionSet | undefined;
  videoCount: number;
  generating: boolean;
  error: string;
  matchStyle: boolean;
  onMatchStyle: (matchStyle: boolean) => void;
  onGenerate: () => void;
  onChange: (caption: PlatformCaption) => void;
}) {
  const [tab, setTab] = useState<PublishPlatform>("youtube");

  if (platforms.length === 0) {
    return (
      <EmptyState
        icon={PenLine}
        title="Choose where this is going"
        description="Captions are written per destination, so pick the platforms first."
      />
    );
  }

  const active = platforms.includes(tab) ? tab : platforms[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={matchStyle}
            disabled={generating}
            onChange={(event) => onMatchStyle(event.target.checked)}
            className="accent-[color:var(--sg-accent)]"
          />
          Match my past captions
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={generating || videoCount === 0}
          onClick={onGenerate}
        >
          {generating ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            <Sparkles aria-hidden />
          )}
          {videoCount > 1 ? `Draft ${videoCount} sets` : "Draft captions"}
        </Button>
      </div>

      {error && (
        <p className="text-xs font-semibold text-[color:var(--sg-yellow-500)]">
          {error}
        </p>
      )}

      <div className="border-border/70 border-b">
        <PlatformCaptionTabs
          platforms={platforms}
          active={active}
          captions={captions}
          onSelect={setTab}
        />
      </div>

      <div
        role="tabpanel"
        id={panelId(active)}
        aria-labelledby={tabId(active)}
        // Remount per platform so the hashtag field's in-progress text never
        // carries from one platform's tags to another's.
        key={active}
      >
        <CaptionEditor
          caption={captionFor(captions, active)}
          disabled={generating}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
