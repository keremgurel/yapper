"use client";

import { useMemo, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { CAPTION_FONTS, type CaptionCase } from "@/lib/studio/captions";
import type { TextAlign, TextHookPreset } from "@/lib/studio/types";

const PRESETS: Array<{
  name: string;
  preset: TextHookPreset;
  textColor: string;
  backgroundColor: string;
}> = [
  {
    name: "Clean",
    preset: "white-text",
    textColor: "#ffffff",
    backgroundColor: "transparent",
  },
  {
    name: "White card",
    preset: "white-card",
    textColor: "#090909",
    backgroundColor: "#ffffff",
  },
  {
    name: "Black card",
    preset: "black-card",
    textColor: "#ffffff",
    backgroundColor: "#090909",
  },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-foreground/45 text-[9px] font-black tracking-[0.09em] uppercase">
      {children}
    </span>
  );
}

export default function TextTab({
  currentTimelineTime,
}: {
  currentTimelineTime: number;
}) {
  const {
    captions,
    captionStyle,
    selectedCaptionId,
    selectCaption,
    addTextHook,
    updateTextHook,
    setCaptionText,
    removeCaption,
  } = useStudio();
  const [draft, setDraft] = useState("");
  const textLayers = useMemo(
    () => captions.filter((caption) => caption.kind === "hook"),
    [captions],
  );
  const selected =
    textLayers.find((caption) => caption.id === selectedCaptionId) ?? null;

  const add = (preset = PRESETS[0]) => {
    const id = addTextHook(
      draft.trim() || "Add text",
      preset.preset,
      currentTimelineTime,
    );
    if (!id) return;
    updateTextHook(id, {
      fontFamily: captionStyle.fontFamily,
      textColor: preset.textColor,
      backgroundColor: preset.backgroundColor,
      y: preset.preset === "white-text" ? 0.5 : 0.16,
    });
    setDraft("");
  };

  const duration = selected
    ? Math.max(
        0.1,
        (selected.timelineEnd ?? currentTimelineTime + 4) -
          (selected.timelineStart ?? currentTimelineTime),
      )
    : 4;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border shrink-0 space-y-2 border-b p-3">
        <textarea
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type text to place on the video…"
          className="border-border bg-background text-foreground placeholder:text-foreground/30 w-full resize-none rounded-lg border px-3 py-2 text-xs font-bold outline-none focus:border-[color:var(--sg-accent)]"
        />
        <button
          type="button"
          onClick={() => add()}
          className="bg-foreground text-background flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-black hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Add text at playhead
        </button>
        <p className="text-foreground/40 text-center text-[10px]">
          Drag it anywhere on the video; trim it on the timeline.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!selected ? (
          <div className="space-y-4">
            <section>
              <p className="text-foreground mb-2 text-xs font-black">
                Quick styles
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => add(preset)}
                    className="border-border hover:border-foreground/30 rounded-xl border p-1.5 text-left"
                  >
                    <span
                      className="flex h-10 items-center justify-center rounded-lg text-[10px] font-black"
                      style={{
                        color: preset.textColor,
                        backgroundColor:
                          preset.backgroundColor === "transparent"
                            ? "#3f3f46"
                            : preset.backgroundColor,
                      }}
                    >
                      Aa
                    </span>
                    <span className="text-foreground/55 mt-1 block truncate text-[9px] font-bold">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {textLayers.length > 0 && (
              <section>
                <p className="text-foreground mb-2 text-xs font-black">
                  Text layers
                </p>
                <div className="space-y-1.5">
                  {textLayers.map((layer) => (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => selectCaption(layer.id)}
                      className="border-border hover:bg-muted flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left"
                    >
                      <Type className="h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
                      <span className="text-foreground/75 min-w-0 flex-1 truncate text-[11px] font-bold">
                        {layer.text}
                      </span>
                      <span className="text-foreground/30 text-[9px]">
                        {(layer.timelineStart ?? 0).toFixed(1)}s
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground text-xs font-black">
                  Selected text
                </p>
                <p className="text-foreground/40 text-[10px]">
                  Changes update live
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeCaption(selected.id)}
                aria-label="Delete text layer"
                className="text-foreground/35 rounded-lg p-2 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <textarea
              rows={2}
              value={selected.text}
              onChange={(event) =>
                setCaptionText(selected.id, event.target.value)
              }
              className="border-border bg-background text-foreground w-full resize-none rounded-lg border px-3 py-2 text-xs font-bold outline-none focus:border-[color:var(--sg-accent)]"
            />

            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((preset) => {
                const active =
                  (selected.backgroundColor ??
                    (selected.hookPreset === "white-text"
                      ? "transparent"
                      : selected.hookPreset === "black-card"
                        ? "#090909"
                        : "#ffffff")) === preset.backgroundColor;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      updateTextHook(selected.id, {
                        hookPreset: preset.preset,
                        textColor: preset.textColor,
                        backgroundColor: preset.backgroundColor,
                      })
                    }
                    className={`rounded-lg border px-2 py-1.5 text-[9px] font-black ${active ? "border-[color:var(--sg-accent)] text-[color:var(--sg-accent)]" : "border-border text-foreground/55"}`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1.5">
                <Label>Font</Label>
                <select
                  value={selected.fontFamily ?? captionStyle.fontFamily}
                  onChange={(event) =>
                    updateTextHook(selected.id, {
                      fontFamily: event.target.value,
                    })
                  }
                  className="border-border bg-background text-foreground h-9 w-full rounded-lg border px-2 text-[11px] font-bold"
                >
                  {CAPTION_FONTS.map((font) => (
                    <option key={font.stack} value={font.stack}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <Label>Weight</Label>
                <select
                  value={selected.fontWeight ?? 900}
                  onChange={(event) =>
                    updateTextHook(selected.id, {
                      fontWeight: Number(event.target.value),
                    })
                  }
                  className="border-border bg-background text-foreground h-9 w-full rounded-lg border px-2 text-[11px] font-bold"
                >
                  <option value={600}>Semibold</option>
                  <option value={700}>Bold</option>
                  <option value={800}>Extra bold</option>
                  <option value={900}>Black</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="flex items-center justify-between">
                <Label>Size</Label>
                <span className="text-foreground/45 text-[10px] tabular-nums">
                  {Math.round((selected.scale ?? 0.056) * 1000)}
                </span>
              </span>
              <input
                type="range"
                min={20}
                max={140}
                value={Math.round((selected.scale ?? 0.056) * 1000)}
                onChange={(event) =>
                  updateTextHook(selected.id, {
                    scale: Number(event.target.value) / 1000,
                  })
                }
                className="w-full accent-[color:var(--sg-accent)]"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Align</Label>
                <div className="flex gap-1">
                  {(
                    [
                      ["left", AlignLeft],
                      ["center", AlignCenter],
                      ["right", AlignRight],
                    ] as const
                  ).map(([align, Icon]) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() =>
                        updateTextHook(selected.id, {
                          textAlign: align as TextAlign,
                        })
                      }
                      className={`grid h-8 flex-1 place-items-center rounded-lg border ${(selected.textAlign ?? "center") === align ? "border-[color:var(--sg-accent)] text-[color:var(--sg-accent)]" : "border-border text-foreground/50"}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Case</Label>
                <div className="flex gap-1">
                  {(
                    [
                      ["none", "Aa"],
                      ["upper", "AA"],
                      ["lower", "aa"],
                    ] as Array<[CaptionCase, string]>
                  ).map(([textCase, label]) => (
                    <button
                      key={textCase}
                      type="button"
                      onClick={() => updateTextHook(selected.id, { textCase })}
                      className={`h-8 flex-1 rounded-lg border text-[9px] font-black ${(selected.textCase ?? "none") === textCase ? "border-[color:var(--sg-accent)] text-[color:var(--sg-accent)]" : "border-border text-foreground/50"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1.5">
                <Label>Text</Label>
                <span className="border-border flex h-9 items-center gap-2 rounded-lg border px-2">
                  <input
                    type="color"
                    value={selected.textColor ?? "#ffffff"}
                    onChange={(event) =>
                      updateTextHook(selected.id, {
                        textColor: event.target.value,
                      })
                    }
                    className="h-5 w-6 bg-transparent p-0"
                  />
                  <span className="text-foreground/45 truncate text-[9px]">
                    {selected.textColor ?? "#ffffff"}
                  </span>
                </span>
              </label>
              <label className="space-y-1.5">
                <Label>Background</Label>
                <span className="border-border flex h-9 items-center gap-2 rounded-lg border px-2">
                  <input
                    type="color"
                    value={
                      selected.backgroundColor === "transparent"
                        ? "#000000"
                        : (selected.backgroundColor ?? "#000000")
                    }
                    onChange={(event) =>
                      updateTextHook(selected.id, {
                        backgroundColor: event.target.value,
                      })
                    }
                    className="h-5 w-6 bg-transparent p-0"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateTextHook(selected.id, {
                        backgroundColor: "transparent",
                      })
                    }
                    className="text-foreground/45 text-[9px] font-bold"
                  >
                    None
                  </button>
                </span>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="flex items-center justify-between">
                <Label>Duration</Label>
                <span className="text-foreground/45 text-[10px]">
                  {duration.toFixed(1)}s
                </span>
              </span>
              <input
                type="range"
                min={0.1}
                max={Math.max(4, Math.min(30, duration + 10))}
                step={0.1}
                value={duration}
                onChange={(event) =>
                  updateTextHook(selected.id, {
                    timelineEnd:
                      (selected.timelineStart ?? currentTimelineTime) +
                      Number(event.target.value),
                  })
                }
                className="w-full accent-[color:var(--sg-accent)]"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
