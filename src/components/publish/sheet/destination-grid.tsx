"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublishPlatform } from "@/lib/db/schema";
import { PLATFORMS } from "@/lib/publish/platforms";

/** Where this publish action sends the video, and what pressing publish
 * actually does on each one. Nothing is ticked that the creator did not tick. */
export default function DestinationGrid({
  connected,
  selected,
  disabled,
  onToggle,
  onToggleAll,
}: {
  connected: PublishPlatform[];
  selected: Set<PublishPlatform>;
  disabled: boolean;
  onToggle: (platform: PublishPlatform) => void;
  onToggleAll: () => void;
}) {
  const chosenCount = connected.filter((platform) =>
    selected.has(platform),
  ).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs font-semibold">
          Destinations
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onToggleAll}>
          {chosenCount === connected.length ? "Clear" : "Select all"}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {connected.map((platform) => {
          const active = selected.has(platform);
          return (
            <button
              key={platform}
              type="button"
              onClick={() => onToggle(platform)}
              aria-pressed={active}
              disabled={disabled}
              className={`relative rounded-lg border px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
                active
                  ? "border-[color:var(--sg-accent)] bg-[color-mix(in_oklab,var(--sg-accent)_10%,var(--sg-bg))]"
                  : "border-border hover:border-foreground/25"
              }`}
            >
              <span className="text-foreground block text-[13px] font-semibold">
                {PLATFORMS[platform].label}
              </span>
              <span className="text-muted-foreground mt-1 block text-xs leading-4">
                {PLATFORMS[platform].postMeaning}
              </span>
              <span
                className={`absolute top-2 right-2 grid h-5 w-5 place-items-center rounded-md ${
                  active
                    ? "bg-[color:var(--sg-accent)] text-black"
                    : "bg-muted text-transparent"
                }`}
              >
                <Check aria-hidden className="h-3 w-3" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
