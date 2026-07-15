"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Camera, Check, Music2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConnections } from "@/hooks/use-connections";
import { connectUrl } from "@/lib/publish/client";
import { PLATFORMS } from "@/lib/publish/platforms";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";

// Lucide dropped its brand marks, so these are neutral stand-ins.
const ICON: Record<PublishPlatform, typeof Video> = {
  youtube: Video,
  tiktok: Music2,
  instagram: Camera,
};

/** The one-time notice after returning from the OAuth redirect, derived from the
 * URL. The URL is then cleaned (without a re-render) so a refresh won't re-show
 * it, but the current render keeps the notice visible. */
function useConnectNotice(): { ok?: PublishPlatform; error?: string } {
  const params = useSearchParams();
  const ok = (params.get("connected") as PublishPlatform | null) ?? undefined;
  const error = params.get("connect_error") ?? undefined;
  useEffect(() => {
    if (ok || error) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [ok, error]);
  return { ok, error };
}

/**
 * Connect the platforms Yapper can post to. The connect action is a full-page
 * redirect to the provider's consent screen; everything else (status,
 * disconnect) is inline. Platforms without a configured OAuth app show as
 * "coming soon" rather than a dead button.
 */
export default function ConnectionsPanel() {
  const { isSignedIn } = useUser();
  const { connections, available, disconnect } = useConnections(!!isSignedIn);
  const notice = useConnectNotice();

  return (
    <div>
      {notice.ok && (
        <p className="mb-4 rounded-lg bg-[color:var(--sg-green-500)]/12 px-4 py-2.5 text-sm font-bold text-[color:var(--sg-green-500)]">
          Connected {PLATFORMS[notice.ok].label}.
        </p>
      )}
      {notice.error && (
        <p className="mb-4 rounded-lg bg-[color:var(--sg-pink-500)]/12 px-4 py-2.5 text-sm font-bold text-[color:var(--sg-pink-500)]">
          Couldn&apos;t connect ({notice.error}). Try again.
        </p>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        {publishPlatforms.map((p) => {
          const spec = PLATFORMS[p];
          const Icon = ICON[p];
          const connected = connections?.find((c) => c.platform === p) ?? null;
          const canConnect = available.includes(p);
          return (
            <div
              key={p}
              className="flex items-center gap-3 border-b px-4 py-4 last:border-b-0"
            >
              <Icon className="text-foreground/70 h-6 w-6 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-[15px] font-bold">
                  {spec.label}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {connected
                    ? (connected.handle ?? "Connected")
                    : spec.postMeaning}
                </p>
              </div>
              {connected ? (
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs font-bold text-[color:var(--sg-green-500)]">
                    <Check className="h-3.5 w-3.5" /> Connected
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void disconnect(p)}
                  >
                    Disconnect
                  </Button>
                </span>
              ) : canConnect ? (
                // A real navigation (not client routing): it hits the OAuth
                // redirect route.
                <a
                  href={connectUrl(p)}
                  style={{ background: "var(--sg-accent-gradient)" }}
                  className="rounded-lg px-4 py-1.5 text-sm font-black text-white no-underline transition-opacity hover:opacity-90"
                >
                  Connect
                </a>
              ) : (
                <span className="text-muted-foreground text-xs font-bold">
                  Coming soon
                </span>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
