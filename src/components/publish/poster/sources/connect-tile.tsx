"use client";

import { Button } from "@/components/ui/button";
import PlatformIcon from "@/components/publish/platform-icon";
import type { PublishPlatform } from "@/lib/db/schema";
import { beginConnect } from "@/lib/publish/begin-connect";
import { PLATFORMS } from "@/lib/publish/platforms";

/** A channel that is not linked yet, where its videos would be. */
export default function ConnectTile({
  platform,
}: {
  platform: PublishPlatform;
}) {
  const label = PLATFORMS[platform].label;
  return (
    <div className="bg-muted flex flex-col items-center px-6 py-14 text-center">
      <span className="bg-card mb-3 grid h-10 w-10 place-items-center rounded-full">
        <PlatformIcon platform={platform} className="h-5 w-5" />
      </span>
      <p className="text-foreground text-sm font-semibold">
        Connect {label} to repost from it
      </p>
      <p className="text-muted-foreground mt-1 max-w-[36ch] text-[13px] leading-relaxed">
        Your published videos show up here, and {label} becomes a place this
        Poster can send to.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={() => beginConnect(platform)}
      >
        Connect {label}
      </Button>
    </div>
  );
}
