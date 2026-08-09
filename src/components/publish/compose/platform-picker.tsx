"use client";

import { PLATFORMS } from "@/lib/publish/platforms";
import type { PublishPlatform } from "@/lib/db/schema";

/** Segmented control to choose which connected platform to post to. Only shown
 * when more than one platform is connected. */
export default function PlatformPicker({
  platforms,
  active,
  onChange,
}: {
  platforms: PublishPlatform[];
  active: PublishPlatform | null;
  onChange: (p: PublishPlatform) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {platforms.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md border px-3 py-3 text-left text-xs font-black transition-all ${
            active === p
              ? "text-foreground border-[color:var(--sg-accent)] bg-[color:color-mix(in_srgb,var(--sg-accent)_10%,transparent)] shadow-sm"
              : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground"
          }`}
        >
          <span className="block">{PLATFORMS[p].label}</span>
          <span className="mt-1 block text-[11px] leading-4 font-medium opacity-70">
            {PLATFORMS[p].postMeaning}
          </span>
        </button>
      ))}
    </div>
  );
}
