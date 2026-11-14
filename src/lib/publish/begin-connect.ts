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
export function beginConnect(
  platform: PublishPlatform,
  from?: "poster-source" | "poster-draft",
): void {
  if (!isNative()) {
    const url = connectUrl(platform);
    if (from === "poster-draft") {
      // The current draft stays open while the account is authorized.
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href =
      from === "poster-source" ? url + "?from=poster" : url;
    return;
  }
  void invoke("open_oauth_flow", {
    url: `${window.location.origin}${connectUrl(platform)}`,
  });
}
