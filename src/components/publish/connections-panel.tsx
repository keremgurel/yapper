"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Camera, Check, Music2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConnections } from "@/hooks/use-connections";
import { connectUrl } from "@/lib/publish/client";
import TikTokInsightsRow from "@/components/publish/tiktok-insights-row";
import { PLATFORMS } from "@/lib/publish/platforms";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { invoke, isNative } from "@/lib/studio/native/bridge";

/**
 * Start the OAuth flow. On the web this is a real navigation to the connect
 * route, same as any other link. Natively, a plain link would still let the
 * MAIN window navigate through that same-origin route before the redirect
 * chain ever reaches an external host — tearing the whole page (and every
 * OTHER connection's already-settled state) down and rebuilding it, just to
 * connect one platform. Invoking the popup directly means the main window's
 * page is never touched until the flow actually finishes.
 */
function beginConnect(platform: PublishPlatform): void {
  if (!isNative()) {
    window.location.href = connectUrl(platform);
    return;
  }
  void invoke("open_oauth_flow", {
    url: `${window.location.origin}${connectUrl(platform)}`,
  });
}

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
  const { connections, available, disconnect, loading } =
    useConnections(!!isSignedIn);
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
                {connected && p === "tiktok" && <TikTokInsightsRow />}
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
              ) : loading ? (
                // `available` starts empty before the fetch resolves — without
                // this, every platform reads as unconfigured and flashes
                // "Coming soon" on every load, configured or not.
                <span className="bg-muted h-7 w-20 animate-pulse rounded-lg" />
              ) : canConnect ? (
                <button
                  type="button"
                  onClick={() => beginConnect(p)}
                  style={{ background: "var(--sg-accent-gradient)" }}
                  className="rounded-lg px-4 py-1.5 text-sm font-black text-white transition-opacity hover:opacity-90"
                >
                  Connect
                </button>
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
