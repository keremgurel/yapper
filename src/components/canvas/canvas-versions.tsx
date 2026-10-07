"use client";

import { useEffect, useRef, useState } from "react";
import { useAutosave } from "@/hooks/use-autosave";
import type { ContentPatch } from "@/lib/content/client";
import { Button } from "@/components/ui/button";
import type { ContentDetail, ContentVersionDetail } from "@/lib/content/client";
import { type VersionFormat, VERSION_FORMATS } from "@/lib/content/formats";
import { hookTexts } from "@/lib/content/normalize";

/** Saved versions use the same API as Mac. Each writer owns only its version. */
export default function CanvasVersions({
  item,
  active,
  onSelect,
  children,
  beforeGenerate,
  registerFlush,
  onVersionChange,
}: {
  item: ContentDetail;
  active: VersionFormat;
  onSelect: (format: VersionFormat) => void;
  children: React.ReactNode;
  beforeGenerate: () => Promise<void>;
  registerFlush: (flush: (() => Promise<void>) | null) => void;
  onVersionChange: (version: ContentVersionDetail | null) => void;
}) {
  const lead = item.leadFormat ?? "short";
  const [versions, setVersions] = useState(item.versions ?? []);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const editorFlush = useRef<(() => Promise<void>) | null>(null);
  const abort = useRef<AbortController | null>(null);
  const version = versions.find((entry) => entry.format === active);
  useEffect(() => {
    if (active === lead || !version) onVersionChange(null);
  }, [active, lead, version, onVersionChange]);
  useEffect(() => () => abort.current?.abort(), []);
  const generate = async () => {
    setWorking(true);
    setNotice("Writing your version. Your existing versions are kept.");
    const controller = new AbortController();
    abort.current = controller;
    try {
      await beforeGenerate();
      const response = await fetch(
        `/api/content/${item.id}/versions/${active}/write`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: lead }),
          signal: controller.signal,
        },
      );
      if (!response.ok)
        throw new Error(
          "Generation failed. Refresh to check your credits and try again.",
        );
      const result = (await response.json()) as {
        version: ContentVersionDetail;
      };
      setVersions((current) => [
        ...current.filter((entry) => entry.format !== result.version.format),
        result.version,
      ]);
      setNotice("Version saved.");
    } catch (error) {
      setNotice(
        controller.signal.aborted
          ? "Stopped waiting. Reload this idea to check whether the server saved the version."
          : error instanceof Error
            ? error.message
            : "Could not generate this version.",
      );
    } finally {
      setWorking(false);
      abort.current = null;
    }
  };
  return (
    <>
      <div
        className="border-border flex flex-wrap gap-2 border-b px-4 py-3"
        aria-label="Content versions"
      >
        {VERSION_FORMATS.map((format) => (
          <Button
            key={format}
            size="sm"
            variant={active === format ? "default" : "ghost"}
            aria-pressed={active === format}
            disabled={working}
            onClick={() => {
              void (async () => {
                try {
                  await beforeGenerate();
                  await editorFlush.current?.();
                  onSelect(format);
                } catch {
                  setNotice("Save failed. Retry before switching versions.");
                }
              })();
            }}
          >
            {format === "short"
              ? "Short-form"
              : format === "long"
                ? "Long-form"
                : "Article"}
          </Button>
        ))}
      </div>
      {active === lead ? (
        children
      ) : version ? (
        <VersionEditor
          key={version.format}
          itemId={item.id}
          version={version}
          registerFlush={(flush) => {
            editorFlush.current = flush;
            registerFlush(flush);
          }}
          onDraft={onVersionChange}
          onSaved={(updated) =>
            setVersions((current) =>
              current.map((entry) =>
                entry.format === updated.format ? updated : entry,
              ),
            )
          }
        />
      ) : (
        <section className="flex max-w-2xl flex-col gap-4 p-6">
          <h2 className="text-lg font-semibold">
            Write a {active === "long" ? "long-form" : active} version
          </h2>
          <p className="text-muted-foreground text-sm">
            Uses the original version and source material. 8 credits, refunded
            if generation fails.
          </p>
          <Button disabled={working} onClick={() => void generate()}>
            {working ? "Writing…" : "Write this version"}
          </Button>
          {working && (
            <Button variant="outline" onClick={() => abort.current?.abort()}>
              Stop waiting
            </Button>
          )}
        </section>
      )}
      {notice && (
        <p role="status" className="px-6 py-3 text-sm">
          {notice}
        </p>
      )}
    </>
  );
}

function VersionEditor({
  itemId,
  version,
  onSaved,
  onDraft,
  registerFlush,
}: {
  itemId: string;
  version: ContentVersionDetail;
  onSaved: (version: ContentVersionDetail) => void;
  onDraft: (version: ContentVersionDetail) => void;
  registerFlush: (flush: (() => Promise<void>) | null) => void;
}) {
  const [draft, setDraft] = useState(version);
  useEffect(() => {
    onDraft(draft);
  }, [draft, onDraft]);
  const save = async (
    patch: Partial<ContentPatch>,
    options?: { keepalive?: boolean },
  ) => {
    const response = await fetch(
      `/api/content/${itemId}/versions/${version.format}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        keepalive: options?.keepalive,
      },
    );
    if (!response.ok) throw new Error("Version could not be saved");
    const result = (await response.json()) as { version: ContentVersionDetail };
    onSaved(result.version);
  };
  const autosave = useAutosave<ContentPatch>(save);
  useEffect(() => {
    registerFlush(autosave.flush);
    return () => registerFlush(null);
  }, [registerFlush, autosave.flush]);
  const change = (patch: ContentPatch) => {
    const next = {
      ...draft,
      ...patch,
      hooks:
        patch.hooks === undefined
          ? draft.hooks
          : patch.hooks.map((hook) =>
              typeof hook === "string"
                ? { text: hook, pattern: null, why: null }
                : hook,
            ),
    } as ContentVersionDetail;
    setDraft(next);
    onDraft(next);
    autosave.queue(patch);
  };
  const points =
    draft.blocks
      .find((block) => block.label === "Key points")
      ?.items?.join("\n") ?? "";
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
      <p className="text-muted-foreground text-sm">
        Editing the {version.format === "long" ? "long-form" : version.format}{" "}
        version. Changes save automatically and appear on Mac and web.
      </p>
      <label className="flex flex-col gap-2 text-sm">
        Title
        <input
          className="border-border bg-background rounded-lg border p-3"
          value={draft.title ?? ""}
          onChange={(e) => change({ title: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        {version.format === "article" ? "Article" : "Script"}
        <textarea
          className="border-border bg-background rounded-lg border p-3 leading-relaxed"
          rows={18}
          value={draft.script ?? ""}
          onChange={(e) =>
            change({
              script: e.target.value,
              blocks: draft.blocks.filter((block) => block.kind !== "script"),
            })
          }
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        Alternative openers, one per line
        <textarea
          className="border-border bg-background rounded-lg border p-3"
          rows={4}
          value={hookTexts(draft.hooks).join("\n")}
          onChange={(e) => change({ hooks: e.target.value.split("\n") })}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        Key points, one per line
        <textarea
          className="border-border bg-background rounded-lg border p-3"
          rows={5}
          value={points}
          onChange={(e) =>
            change({
              blocks: [
                ...draft.blocks.filter((block) => block.label !== "Key points"),
                {
                  label: "Key points",
                  kind: "bullets",
                  items: e.target.value.split("\n"),
                },
              ],
            })
          }
        />
      </label>
      <div className="bg-background sticky bottom-0 flex items-center gap-3 py-3">
        <span role="status" className="text-sm">
          {autosave.state === "error"
            ? "Could not save. Your edits are kept here."
            : autosave.state === "saving"
              ? "Saving…"
              : "Saved"}
        </span>
        {autosave.state === "error" && (
          <Button
            variant="outline"
            onClick={() => void autosave.flush().catch(() => {})}
          >
            Retry saving
          </Button>
        )}
      </div>
    </section>
  );
}
