"use client";

import { useEffect, useState } from "react";
import TeleprompterRecorder from "@/components/teleprompter/teleprompter-recorder";
import TeleprompterViewPicker from "@/components/teleprompter/teleprompter-view-picker";
import { getContent } from "@/lib/content/client";
import { loadIdeas } from "@/lib/inspiration/ideas";
import {
  hasTeleprompterText,
  teleprompterText,
  type PromptSource,
  type TeleprompterView,
} from "@/lib/teleprompter/script-view";

function defaultView(source: PromptSource): TeleprompterView {
  if (source.script?.trim()) return "script";
  if (hasTeleprompterText(source, "notes")) return "notes";
  return "off";
}

/**
 * Orchestrates the recording flow. With no source it is a plain recorder
 * (straight to camera, no picker). `?item=<id>` loads a Content Library item
 * via the API; the legacy `?idea=<id>` resolves from localStorage. Unknown ids
 * degrade to the plain recorder.
 */
export default function RecordClient() {
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<PromptSource | null>(null);
  // The library item id this take is for (enables Save to library). Legacy
  // localStorage ideas don't get one.
  const [itemId, setItemId] = useState<string | null>(null);
  const [view, setView] = useState<TeleprompterView>("off");
  const [phase, setPhase] = useState<"picker" | "recording">("recording");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const item = params.get("item");
    const legacyIdea = params.get("idea");

    const adopt = (src: PromptSource | null, id: string | null = null) => {
      if (!active) return;
      setSource(src);
      setItemId(id);
      if (src && hasTeleprompterText(src, "notes")) {
        setView(defaultView(src));
        setPhase("picker");
      }
      setLoaded(true);
    };

    if (item) {
      getContent(item).then(
        (detail) => adopt(detail, detail.id),
        () => adopt(null), // not found / signed out -> plain recorder
      );
    } else if (legacyIdea) {
      adopt(loadIdeas().find((i) => i.id === legacyIdea) ?? null);
    } else {
      adopt(null);
    }
    return () => {
      active = false;
    };
    // One-time read of the URL on mount.
  }, []);

  if (!loaded) return <div className="min-h-[50vh]" />;

  const available = (v: TeleprompterView) => {
    if (v === "off") return true;
    if (!source) return false;
    if (v === "script") return !!source.script?.trim();
    return hasTeleprompterText(source, "notes");
  };
  const text = source ? teleprompterText(source, view) : "";

  return phase === "picker" && source ? (
    <TeleprompterViewPicker
      title={source.title ?? ""}
      value={view}
      available={available}
      onSelect={setView}
      onStart={() => setPhase("recording")}
    />
  ) : (
    <TeleprompterRecorder
      text={text}
      itemId={itemId}
      itemTitle={source?.title || undefined}
      onExit={source ? () => setPhase("picker") : undefined}
    />
  );
}
