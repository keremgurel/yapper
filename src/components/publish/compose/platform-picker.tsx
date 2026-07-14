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
  active: PublishPlatform;
  onChange: (p: PublishPlatform) => void;
}) {
  return (
    <div className="bg-muted/60 flex rounded-lg p-0.5">
      {platforms.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
            active === p
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {PLATFORMS[p].label}
        </button>
      ))}
    </div>
  );
}
