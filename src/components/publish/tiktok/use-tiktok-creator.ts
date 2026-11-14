"use client";

import { useEffect, useState } from "react";
import type { TikTokCreator } from "@/lib/publish/tiktok-direct-settings";

export interface TikTokCreatorContext {
  creator: TikTokCreator;
  audited: boolean;
  accountId: string;
}

/**
 * Who is posting and what their TikTok account allows right now. TikTok wants
 * this read fresh whenever posting options are shown, so it is never cached.
 */
export function useTikTokCreator(): {
  context: TikTokCreatorContext | null;
  error: string;
} {
  const [state, setState] = useState<{
    context: TikTokCreatorContext | null;
    error: string;
  }>({ context: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/publish/tiktok/creator", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "tiktok_creator_unavailable");
        return data as TikTokCreatorContext;
      })
      .then((context) => setState({ context, error: "" }))
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setState({
          context: null,
          error:
            (cause instanceof Error && cause.message) ||
            "tiktok_creator_unavailable",
        });
      });
    return () => controller.abort();
  }, []);

  return state;
}
