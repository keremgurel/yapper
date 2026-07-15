"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConnections } from "@/hooks/use-connections";
import { connectedInOrder } from "@/lib/publish/connected-order";
import type { PublishPlatform } from "@/lib/db/schema";
import InstagramCompose from "./compose/instagram-compose";
import PlatformPicker from "./compose/platform-picker";
import TikTokCompose from "./compose/tiktok-compose";
import type { CrossPostTarget } from "./compose/types";
import YouTubeCompose from "./compose/youtube-compose";

export type { CrossPostTarget } from "./compose/types";

/**
 * Post one master video to a connected platform. Mounted per target (keyed by
 * the parent, so fields seed without a set-state-in-effect and reset on close).
 * The sheet only picks the platform and hosts the right compose body; each body
 * owns its own fields and posting.
 */
export default function CrossPostSheet({
  item,
  onClose,
}: {
  item: CrossPostTarget;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [override, setOverride] = useState<PublishPlatform | null>(null);
  const { connections } = useConnections(open);

  const close = (o: boolean) => {
    setOpen(o);
    if (!o) onClose();
  };

  // Canonical order (YouTube, TikTok, Instagram), so the picker and the default
  // selection are stable rather than following whatever order the API returned.
  const connected = connectedInOrder(connections?.map((c) => c.platform) ?? []);
  // Effective platform derived (not seeded via effect): the override if it's
  // still connected, else the first connected platform.
  const active =
    override && connected.includes(override) ? override : connected[0];

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Post your video</SheetTitle>
          <SheetDescription>Choose where to share it.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {connections === null ? (
            <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your
              connections…
            </div>
          ) : connected.length === 0 || !active ? (
            <div className="text-muted-foreground py-6 text-sm">
              <p className="text-foreground font-bold">
                No platforms connected
              </p>
              <p className="mt-1">
                Connect YouTube, TikTok, or Instagram first, then come back to
                post.
              </p>
              <Link
                href="/studio/connections"
                className="mt-3 inline-block font-bold text-[color:var(--sg-accent)] hover:opacity-80"
              >
                Go to Connections
              </Link>
            </div>
          ) : (
            <>
              {connected.length > 1 && (
                <PlatformPicker
                  platforms={connected}
                  active={active}
                  onChange={setOverride}
                />
              )}
              {active === "youtube" && (
                <YouTubeCompose
                  key={item.id}
                  item={item}
                  onDone={() => close(false)}
                />
              )}
              {active === "instagram" && (
                <InstagramCompose
                  key={item.id}
                  item={item}
                  onDone={() => close(false)}
                />
              )}
              {active === "tiktok" && (
                <TikTokCompose
                  key={item.id}
                  item={item}
                  onDone={() => close(false)}
                />
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
