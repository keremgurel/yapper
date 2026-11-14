"use client";

import { Button } from "@/components/ui/button";
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
    <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t py-4">
      <div>
        <p className="text-sm font-semibold">Bring over your {label} videos</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect your account to reuse posts and publish new ones.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => beginConnect(platform, "poster-source")}
      >
        Connect {label}
      </Button>
    </div>
  );
}
