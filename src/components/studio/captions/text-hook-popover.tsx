"use client";

import { useMemo, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { CAPTION_FONTS, type CaptionCase } from "@/lib/studio/captions";
import type { Caption, TextAlign, TextHookPreset } from "@/lib/studio/types";

const WEIGHTS = [600, 700, 800, 900];
const POSITIONS = [
  { label: "Top", value: 0.16 },
  { label: "Middle", value: 0.5 },
  { label: "Bottom", value: 0.82 },
];
const APPEARANCES: Array<{
  label: string;
  preset: TextHookPreset;
  text: string;
  background: string;
}> = [
  {
    label: "White card",
    preset: "white-card",
    text: "#090909",
    background: "#ffffff",
  },
  {
    label: "Black card",
    preset: "black-card",
    text: "#ffffff",
    background: "#090909",
  },
  {
    label: "Clean text",
    preset: "white-text",
    text: "#ffffff",
    background: "transparent",
  },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-foreground/55 text-[10px] font-black tracking-[0.08em] uppercase">
      {children}
    </span>
  );
}

function MiniButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-lg border px-2 text-[11px] font-black transition ${
        active
          ? "border-[color:var(--sg-accent)] bg-[color:color-mix(in_srgb,var(--sg-accent)_14%,transparent)] text-[color:var(--sg-accent)]"
          : "border-border text-foreground/65 hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function legacyColors(hook: Caption) {
  if (hook.hookPreset === "black-card") {
    return { text: "#ffffff", background: "#090909" };
  }
  if (hook.hookPreset === "white-text") {
    return { text: "#ffffff", background: "transparent" };
  }
  return { text: "#090909", background: "#ffffff" };
}

export default function TextHookPopover({
  currentTimelineTime,
}: {
  currentTimelineTime: number;
}) {
  const {
    captions,
    selectedCaptionId,
    captionStyle,
    addTextHook,
    updateTextHook,
    setCaptionText,
    removeCaption,
  } = useStudio();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const hook = useMemo(
    () =>
      captions.find(
        (caption) =>
          caption.id === selectedCaptionId && caption.kind === "hook",
      ) ?? null,
    [captions, selectedCaptionId],
  );

  const colors = hook ? legacyColors(hook) : null;
  const textColor = hook?.textColor ?? colors?.text ?? "#090909";
  const backgroundColor =
    hook?.backgroundColor ?? colors?.background ?? "#ffffff";
  const duration = hook
    ? Math.max(
        0.1,
        (hook.timelineEnd ?? currentTimelineTime + 4) -
          (hook.timelineStart ?? currentTimelineTime),
      )
    : 4;

  const add = () => {
    const id = addTextHook(draft, "white-card", currentTimelineTime);
    if (!id) return;
    updateTextHook(id, {
      fontFamily: captionStyle.fontFamily,
      textColor: "#090909",
      backgroundColor: "#ffffff",
    });
    setDraft("");
  };

  const setAppearance = (appearance: (typeof APPEARANCES)[number]) => {
    if (!hook) return;
    updateTextHook(hook.id, {
      hookPreset: appearance.preset,
      textColor: appearance.text,
      backgroundColor: appearance.background,
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-black transition ${
          open
            ? "border-[color:var(--sg-accent)] text-[color:var(--sg-accent)]"
            : "border-border text-foreground hover:bg-muted"
        }`}
      >
        <Type className="h-3.5 w-3.5" />
        Text
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="border-border bg-popover absolute top-10 right-0 z-50 w-[min(370px,calc(100vw-32px))] overflow-hidden rounded-2xl border shadow-2xl">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-foreground text-sm font-black">
                {hook ? "Text layer" : "Add text"}
              </p>
              <p className="text-foreground/45 text-[11px]">
                {hook
                  ? "Style the selected timeline layer"
                  : "Starts at playhead"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close text controls"
              onClick={() => setOpen(false)}
              className="text-foreground/45 hover:bg-muted hover:text-foreground rounded-lg p-1.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[min(600px,calc(100vh-180px))] space-y-4 overflow-y-auto p-4">
            <textarea
              rows={2}
              autoFocus={!hook}
              value={hook ? hook.text : draft}
              onChange={(event) =>
                hook
                  ? setCaptionText(hook.id, event.target.value)
                  : setDraft(event.target.value)
              }
              onKeyDown={(event) => {
                if (
                  !hook &&
                  (event.metaKey || event.ctrlKey) &&
                  event.key === "Enter"
                ) {
                  event.preventDefault();
                  add();
                }
              }}
              placeholder="Type your on-screen hook…"
              className="border-border bg-background text-foreground placeholder:text-foreground/30 w-full resize-none rounded-xl border px-3 py-2.5 text-sm font-bold outline-none focus:border-[color:var(--sg-accent)]"
            />

            {!hook ? (
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={add}
                className="bg-foreground text-background flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black disabled:opacity-35"
              >
                <Plus className="h-4 w-4" />
                Add text at playhead
              </button>
            ) : (
              <>
                <div className="space-y-2">
                  <FieldLabel>Style</FieldLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {APPEARANCES.map((appearance) => {
                      const active =
                        backgroundColor === appearance.background &&
                        textColor === appearance.text;
                      return (
                        <button
                          key={appearance.label}
                          type="button"
                          onClick={() => setAppearance(appearance)}
                          className={`rounded-xl border p-1.5 text-left transition ${
                            active
                              ? "border-[color:var(--sg-accent)]"
                              : "border-border hover:border-foreground/25"
                          }`}
                        >
                          <span
                            className="flex h-9 items-center justify-center rounded-lg text-[10px] font-black"
                            style={{
                              color: appearance.text,
                              background:
                                appearance.background === "transparent"
                                  ? "#3f3f46"
                                  : appearance.background,
                            }}
                          >
                            Aa
                          </span>
                          <span className="text-foreground/55 mt-1 block truncate text-[9px] font-bold">
                            {appearance.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <FieldLabel>Font</FieldLabel>
                    <select
                      value={hook.fontFamily ?? captionStyle.fontFamily}
                      onChange={(event) =>
                        updateTextHook(hook.id, {
                          fontFamily: event.target.value,
                        })
                      }
                      className="border-border bg-background text-foreground h-9 w-full rounded-lg border px-2 text-xs font-bold"
                    >
                      {CAPTION_FONTS.map((font) => (
                        <option key={font.stack} value={font.stack}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <FieldLabel>Weight</FieldLabel>
                    <select
                      value={hook.fontWeight ?? 900}
                      onChange={(event) =>
                        updateTextHook(hook.id, {
                          fontWeight: Number(event.target.value),
                        })
                      }
                      className="border-border bg-background text-foreground h-9 w-full rounded-lg border px-2 text-xs font-bold"
                    >
                      {WEIGHTS.map((weight) => (
                        <option key={weight} value={weight}>
                          {weight === 600
                            ? "Semibold"
                            : weight === 700
                              ? "Bold"
                              : weight === 800
                                ? "Extra bold"
                                : "Black"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FieldLabel>Size</FieldLabel>
                    <span className="text-foreground/55 text-[11px] font-bold tabular-nums">
                      {Math.round((hook.scale ?? 0.056) * 1000)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={24}
                    max={120}
                    value={Math.round((hook.scale ?? 0.056) * 1000)}
                    onChange={(event) =>
                      updateTextHook(hook.id, {
                        scale: Number(event.target.value) / 1000,
                      })
                    }
                    className="w-full accent-[color:var(--sg-accent)]"
                  />
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div className="space-y-2">
                    <FieldLabel>Align</FieldLabel>
                    <div className="flex gap-1.5">
                      {(
                        [
                          ["left", AlignLeft],
                          ["center", AlignCenter],
                          ["right", AlignRight],
                        ] as const
                      ).map(([align, Icon]) => (
                        <MiniButton
                          key={align}
                          label={`Align ${align}`}
                          active={(hook.textAlign ?? "center") === align}
                          onClick={() =>
                            updateTextHook(hook.id, {
                              textAlign: align as TextAlign,
                            })
                          }
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </MiniButton>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Case</FieldLabel>
                    <div className="flex gap-1.5">
                      {(
                        [
                          ["none", "Aa"],
                          ["upper", "AA"],
                          ["lower", "aa"],
                        ] as Array<[CaptionCase, string]>
                      ).map(([mode, label]) => (
                        <MiniButton
                          key={mode}
                          label={`${label} case`}
                          active={(hook.textCase ?? "none") === mode}
                          onClick={() =>
                            updateTextHook(hook.id, { textCase: mode })
                          }
                        >
                          {label}
                        </MiniButton>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <FieldLabel>Text color</FieldLabel>
                    <span className="border-border bg-background flex h-9 items-center gap-2 rounded-lg border px-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(event) =>
                          updateTextHook(hook.id, {
                            textColor: event.target.value,
                          })
                        }
                        className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span className="text-foreground/55 text-[10px] font-bold uppercase">
                        {textColor}
                      </span>
                    </span>
                  </label>
                  <label className="space-y-1.5">
                    <FieldLabel>Background</FieldLabel>
                    <span className="border-border bg-background flex h-9 items-center gap-2 rounded-lg border px-2">
                      <input
                        type="color"
                        value={
                          backgroundColor === "transparent"
                            ? "#000000"
                            : backgroundColor
                        }
                        onChange={(event) =>
                          updateTextHook(hook.id, {
                            backgroundColor: event.target.value,
                          })
                        }
                        className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateTextHook(hook.id, {
                            backgroundColor: "transparent",
                          })
                        }
                        className="text-foreground/55 hover:text-foreground text-[10px] font-bold"
                      >
                        {backgroundColor === "transparent" ? "None" : "Remove"}
                      </button>
                    </span>
                  </label>
                </div>

                {backgroundColor !== "transparent" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FieldLabel>Background opacity</FieldLabel>
                      <span className="text-foreground/55 text-[11px] font-bold">
                        {Math.round((hook.backgroundOpacity ?? 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((hook.backgroundOpacity ?? 1) * 100)}
                      onChange={(event) =>
                        updateTextHook(hook.id, {
                          backgroundOpacity: Number(event.target.value) / 100,
                        })
                      }
                      className="w-full accent-[color:var(--sg-accent)]"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <FieldLabel>Position</FieldLabel>
                    <select
                      value={
                        POSITIONS.reduce(
                          (best, option) =>
                            Math.abs(option.value - (hook.y ?? 0.16)) <
                            Math.abs(best.value - (hook.y ?? 0.16))
                              ? option
                              : best,
                          POSITIONS[0],
                        ).value
                      }
                      onChange={(event) =>
                        updateTextHook(hook.id, {
                          y: Number(event.target.value),
                        })
                      }
                      className="border-border bg-background text-foreground h-9 w-full rounded-lg border px-2 text-xs font-bold"
                    >
                      {POSITIONS.map((position) => (
                        <option key={position.label} value={position.value}>
                          {position.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <FieldLabel>Duration</FieldLabel>
                    <span className="border-border bg-background flex h-9 items-center rounded-lg border px-2">
                      <input
                        type="number"
                        min={0.1}
                        max={Math.max(
                          0.1,
                          (hook.timelineEnd ?? 0) -
                            (hook.timelineStart ?? 0) +
                            60,
                        )}
                        step={0.1}
                        value={Number(duration.toFixed(1))}
                        onChange={(event) =>
                          updateTextHook(hook.id, {
                            timelineEnd:
                              (hook.timelineStart ?? currentTimelineTime) +
                              Math.max(0.1, Number(event.target.value) || 0.1),
                          })
                        }
                        className="text-foreground min-w-0 flex-1 bg-transparent text-xs font-bold outline-none"
                      />
                      <span className="text-foreground/40 text-[10px]">
                        sec
                      </span>
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    removeCaption(hook.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete text layer
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
