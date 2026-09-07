"use client";

import { Loader2 } from "lucide-react";
import EssentialsFields from "@/components/brain/essentials/essentials-fields";
import WhatYapperReads from "@/components/brain/essentials/what-yapper-reads";
import VoiceSection from "@/components/brain/voice/voice-section";
import { Button } from "@/components/ui/button";
import type { SaveState } from "@/hooks/use-autosave";
import type { useProject } from "@/hooks/use-project";
import type { ProjectPatch } from "@/lib/project/client";

/**
 * The Essentials tab: the voice, learned from the creator's own videos, and
 * the fields it writes into, edited in place.
 */
export default function EssentialsView({
  project,
  pillars,
  loading,
  saveState,
  onUpdate,
  onRetry,
  onRefresh,
  version,
}: {
  project: ReturnType<typeof useProject>["project"];
  pillars: ReturnType<typeof useProject>["pillars"];
  loading: boolean;
  saveState: SaveState;
  onUpdate: (patch: ProjectPatch) => void;
  onRetry: () => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
  /** Bumps whenever the brain changes, so the preview refetches. */
  version: number;
}) {
  return (
    <div className="space-y-6">
      <VoiceSection onProfileChanged={onRefresh} />
      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading your Essentials…
        </p>
      ) : project ? (
        <EssentialsFields
          project={project}
          pillars={pillars}
          saveState={saveState}
          onUpdate={onUpdate}
        />
      ) : (
        <div className="text-muted-foreground text-sm">
          <p>Your Essentials could not be loaded.</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => void onRetry().catch(() => {})}
          >
            Try again
          </Button>
        </div>
      )}
      <WhatYapperReads version={version} />
    </div>
  );
}
