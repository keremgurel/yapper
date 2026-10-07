"use client";

import { hookTexts } from "@/lib/content/normalize";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
 * show a recoverable error so recording cannot silently lose its item link.
 */
export default function RecordClient({
  requestedItem,
  requestedFormat,
  legacyIdeaId,
}: {
  requestedItem?: string;
  requestedFormat?: string;
  legacyIdeaId?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [setup, setSetup] = useState(!requestedItem && !legacyIdeaId);
  const [pastedScript, setPastedScript] = useState("");
  const [loadError, setLoadError] = useState<
    "missing" | "version" | "load" | null
  >(null);
  const [attempt, setAttempt] = useState(0);
  const [source, setSource] = useState<PromptSource | null>(null);
  // The library item id this take is for (enables Save to library). Legacy
  // localStorage ideas don't get one.
  const [itemId, setItemId] = useState<string | null>(null);
  const [view, setView] = useState<TeleprompterView>("off");
  const [phase, setPhase] = useState<"picker" | "recording">("recording");

  useEffect(() => {
    let active = true;

    const adopt = (src: PromptSource | null, id: string | null = null) => {
      if (!active) return;
      setSource(src);
      setItemId(id);
      if (src) {
        setView(defaultView(src));
        setPhase("picker");
      }
      setLoaded(true);
    };

    if (requestedItem) {
      getContent(requestedItem).then(
        (detail) => {
          const version = detail.versions?.find(
            (entry) => entry.format === requestedFormat,
          );
          if (
            requestedFormat &&
            requestedFormat !== (detail.leadFormat ?? "short") &&
            !version
          ) {
            if (active) {
              setLoadError("version");
              setLoaded(true);
            }
            return;
          }
          const selected = version
            ? { ...detail, ...version, title: version.title ?? detail.title }
            : detail;
          adopt({ ...selected, hooks: hookTexts(selected.hooks) }, detail.id);
        },
        (cause: unknown) => {
          if (!active) return;
          setLoadError(
            cause instanceof Error && cause.message === "content_api_404"
              ? "missing"
              : "load",
          );
          setLoaded(true);
        },
      );
    } else if (legacyIdeaId) {
      adopt(loadIdeas().find((i) => i.id === legacyIdeaId) ?? null);
    } else {
      adopt(null);
    }
    return () => {
      active = false;
    };
  }, [requestedItem, requestedFormat, legacyIdeaId, attempt]);

  if (!loaded)
    return (
      <div role="status" className="py-12">
        Loading recorder…
      </div>
    );
  if (setup)
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-6">
        <h1 className="text-[22px] font-semibold">Recorder</h1>
        <p className="text-muted-foreground">
          Choose an idea or paste a script to rehearse with the teleprompter.
        </p>
        <label className="flex flex-col gap-2 text-sm">
          Your script
          <textarea
            value={pastedScript}
            onChange={(event) => setPastedScript(event.target.value)}
            rows={8}
            className="border-border bg-background rounded-lg border p-3"
            placeholder="What do you want to say?"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={!pastedScript.trim()}
            onClick={() => {
              setSource({
                title: "Pasted script",
                script: pastedScript,
                hooks: [],
              });
              setView("script");
              setPhase("picker");
              setSetup(false);
            }}
          >
            Use this script
          </Button>
          <Button asChild variant="outline">
            <Link href="/studio/ideas">Choose an idea</Link>
          </Button>
          <Button variant="ghost" onClick={() => setSetup(false)}>
            Record without a script
          </Button>
        </div>
      </section>
    );
  if (loadError)
    return (
      <div
        role="alert"
        className="mx-auto max-w-lg space-y-4 py-16 text-center"
      >
        <h1 className="font-display text-2xl font-bold">
          {loadError === "version"
            ? "This version has not been written yet"
            : loadError === "missing"
              ? "This content item is unavailable"
              : "Your recording script couldn’t be loaded"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {loadError === "version"
            ? "Return to the idea and write this version, or choose a saved version to record."
            : loadError === "missing"
              ? "It may have been removed, or belong to a different account. Choose an item from Ideas."
              : "Try again to load the script and keep this take linked to its content item."}
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/studio/ideas">Open ideas</Link>
          </Button>
          <Button
            onClick={() => {
              setLoadError(null);
              setLoaded(false);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );

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
      previewText={text}
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
