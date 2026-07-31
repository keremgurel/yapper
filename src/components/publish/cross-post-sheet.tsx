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
  const [active, setActive] = useState<PublishPlatform | null>(null);
  const { connections } = useConnections(open);

  const close = (o: boolean) => {
    setOpen(o);
    if (!o) onClose();
  };

  // Canonical order keeps the chooser stable. Crucially, no platform is picked
  // automatically: publishing is an explicit user decision.
  const connected = connectedInOrder(connections?.map((c) => c.platform) ?? []);
  const selected = active && connected.includes(active) ? active : null;

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Publish video</SheetTitle>
          <SheetDescription>
            Pick the destination yourself. Yapper never chooses one for you.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {connections === null ? (
            <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your
              connections…
            </div>
          ) : connected.length === 0 ? (
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
              <div>
                <p className="text-foreground/70 mb-2 text-xs font-black tracking-wide uppercase">
                  Destination
                </p>
                <PlatformPicker
                  platforms={connected}
                  active={selected}
                  onChange={setActive}
                />
                {!selected && (
                  <p className="text-muted-foreground mt-3 text-xs">
                    Nothing is selected or published automatically.
                  </p>
                )}
              </div>
              {selected === "youtube" && (
                <YouTubeCompose
                  key={item.id}
                  item={item}
                  onDone={() => close(false)}
                />
              )}
              {selected === "instagram" && (
                <InstagramCompose
                  key={item.id}
                  item={item}
                  onDone={() => close(false)}
                />
              )}
              {selected === "tiktok" && (
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
