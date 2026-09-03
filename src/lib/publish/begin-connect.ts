import { connectUrl } from "@/lib/publish/client";
import { invoke, isNative } from "@/lib/studio/native/bridge";
import type { PublishPlatform } from "@/lib/db/schema";

/**
 * Start the OAuth flow for a platform. On the web this is a real navigation to
 * the connect route, same as any other link. Natively, a plain link would let
 * the main window navigate through that same-origin route before the redirect
 * chain reaches an external host, tearing the page down just to connect one
 * platform. Invoking the popup directly leaves the page alone until the flow
 * actually finishes.
 */
export function beginConnect(platform: PublishPlatform): void {
  if (!isNative()) {
    window.location.href = connectUrl(platform);
    return;
  }
  void invoke("open_oauth_flow", {
    url: `${window.location.origin}${connectUrl(platform)}`,
  });
}
