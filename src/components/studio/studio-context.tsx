"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fullClip,
  moveClipTo,
  removeClip,
  removeSourceRange,
  restoreSourceRange,
  splitClipAt,
  timelineToSource,
  trimClipEnd,
  trimClipStart,
} from "@/lib/studio/clips";
import { analyzeForTrim } from "@/lib/studio/silence";
import {
  combineRetakeCuts,
  findEarlierTakeRanges,
  findFillerIds,
  pauseRanges,
  selectionToRanges,
} from "@/lib/studio/transcript-edit";
import {
  DEFAULT_CAPTION_STYLE,
  generateCaptions,
  type CaptionCase,
  type CaptionStyle,
} from "@/lib/studio/captions";
import { trimClipsToSpeech as trimToSpeech } from "@/lib/studio/auto-edit";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import { cleanTranscriptRemote } from "@/lib/studio/clean-transcript";
import { consumePendingVideo } from "@/lib/studio/handoff";
import { loadLinkedRecording } from "@/lib/studio/load-linked-recording";
import { loadVideoSource } from "@/lib/studio/load-source";
import { useEditorHistory } from "@/hooks/use-editor-history";
import { useTranscript, type TranscribeStatus } from "@/hooks/use-transcript";
import { useEditorSelection } from "@/hooks/use-editor-selection";
import { useMediaLibrary } from "@/hooks/use-media-library";
import { useProjectAspect } from "@/hooks/use-project-aspect";
import { projectDuration } from "@/lib/studio/project-duration";
import type { AspectId } from "@/lib/studio/aspect";
import {
  newAudioId,
  newCaptionId,
  newClipId,
  newOverlayId,
  type AudioTrack,
  type Caption,
  type Clip,
  type MediaAsset,
  type Overlay,
  type OverlayRect,
  type StudioSource,
  type Word,
} from "@/lib/studio/types";

// Clips shorter than this are dropped after auto-edit — they're the leftover
// slivers of retakes/pauses that make playback stutter instead of cut cleanly.
const MIN_CLIP_SEC = 0.08;

interface CaptionLayout {
  x?: number;
  y?: number;
  w?: number;
  scale?: number;
}

export type { TranscribeStatus } from "@/hooks/use-transcript";

interface StudioContextValue {
  source: StudioSource | null;
  clips: Clip[];
  /** Length of the longest layer — what the transport and export run to. */
  duration: number;
  /** The bottom video track's own flags, identical to any upper track's. */
  baseHidden: boolean;
  baseMuted: boolean;
  toggleBaseHidden: () => void;
  toggleBaseMuted: () => void;
  removeBaseTrack: () => void;
  /** Project frame shape, independent of any track. */
  aspectId: AspectId;
  aspect: number;
  setAspectId: (id: AspectId) => void;
  selectedClipId: string | null;
  selectedClipIds: string[];
  detecting: boolean;
  words: Word[];
  audioTracks: AudioTrack[];
  transcribeStatus: TranscribeStatus;
  loadSource: (source: StudioSource) => void;
  clearSource: () => void;
  selectClip: (id: string | null) => void;
  toggleClipSelection: (id: string) => void;
  selectClips: (ids: string[]) => void;
  selectedOverlayIds: string[];
  selectOverlay: (id: string | null) => void;
  toggleOverlaySelection: (id: string) => void;
  /** Split the selected element (or the clip under the playhead) at `timelineTime`. */
  splitSelected: (timelineTime: number) => void;
  deleteSelected: () => void;
  trimStart: (sourceTime: number) => void;
  trimEnd: (sourceTime: number) => void;
  setClipRange: (id: string, start: number, end: number) => void;
  moveClip: (id: string, toIndex: number) => void;
  removePauses: () => number;
  trimClipsToSpeech: () => Promise<number>;
  transcribe: () => Promise<void>;
  deleteWords: (ids: string[]) => void;
  restoreWords: (ids: string[]) => void;
  cutRange: (from: number, to: number) => void;
  removeEarlierTakes: () => number;
  aiRemoveMistakes: () => Promise<number>;
  aiCleaning: boolean;
  autoEdit: (withCaptions?: boolean) => Promise<void>;
  autoEditing: boolean;
  autoEditStep: number;
  autoEditCaptions: boolean;
  addAudio: (file: File) => Promise<void>;
  /** `gesture`: one key per drag, so the whole drag is a single undo step. */
  moveAudio: (id: string, start: number, gesture?: string) => void;
  toggleAudioMuted: (id: string) => void;
  removeAudio: (id: string) => void;
  mediaAssets: MediaAsset[];
  overlays: Overlay[];
  addMediaAsset: (file: File) => Promise<void>;
  removeMediaAsset: (id: string) => void;
  addOverlayFromAsset: (assetId: string, start?: number) => void;
  addAssetToTimeline: (assetId: string, start?: number) => void;
  addAssetToMainTrack: (assetId: string) => void;
  liftClipToTrack: (clipId: string, timelineStart: number) => void;
  dropOverlayToBase: (overlayId: string) => void;
  moveOverlay: (id: string, start: number, gesture?: string) => void;
  setOverlayRect: (id: string, rect: OverlayRect) => void;
  setOverlayRange: (
    id: string,
    start: number,
    duration: number,
    sourceStart: number,
    gesture?: string,
  ) => void;
  toggleOverlayHidden: (id: string) => void;
  toggleOverlayMuted: (id: string) => void;
  removeOverlay: (id: string) => void;
  captions: Caption[];
  captionStyle: CaptionStyle;
  selectedCaptionId: string | null;
  selectedCaptionIds: string[];
  captionApplyAll: boolean;
  captionLines: number;
  captionWords: number;
  generateCaptionsFromTranscript: () => void;
  autoBreakCaptions: (lines: number) => void;
  setCaptionWords: (n: number) => void;
  selectCaption: (id: string | null) => void;
  toggleCaptionSelection: (id: string) => void;
  selectCaptions: (ids: string[]) => void;
  removeSelectedCaptions: () => void;
  setCaptionText: (id: string, text: string) => void;
  cycleCaptionCase: (id: string) => void;
  addCaption: (atSource: number) => void;
  mergeCaptions: (ids: string[]) => void;
  removeCaption: (id: string) => void;
  clearCaptions: () => void;
  updateCaptionLayout: (id: string, layout: CaptionLayout) => void;
  setCaptionRange: (id: string, start: number, end: number) => void;
  splitCaption: (id: string, at: number) => void;
  splitCaptionAtWord: (id: string, wordsBefore: number) => void;
  setCaptionFont: (fontFamily: string) => void;
  setCaptionScale: (fontScale: number) => void;
  setCaptionCase: (mode: CaptionCase) => void;
  toggleCaptionApplyAll: () => void;
  snapping: boolean;
  toggleSnapping: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<StudioSource | null>(null);
  const {
    clips,
    captions,
    overlays,
    audioTracks,
    baseHidden,
    baseMuted,
    setClips,
    setCaptions,
    setOverlays,
    setAudioTracks,
    setBaseHidden,
    setBaseMuted,
    updateEditor,
    resetEditor,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorHistory();
  const toggleBaseHidden = useCallback(
    () => setBaseHidden((v) => !v),
    [setBaseHidden],
  );
  const toggleBaseMuted = useCallback(
    () => setBaseMuted((v) => !v),
    [setBaseMuted],
  );
  const { aspectId, aspect, setAspectId } = useProjectAspect(source);
  const {
    clipIds: selectedClipIds,
    overlayIds: selectedOverlayIds,
    captionIds: selectedCaptionIds,
    selectedClipId,
    selectedCaptionId,
    actions: sel,
  } = useEditorSelection();
  const {
    words,
    status: transcribeStatus,
    run: runTranscribe,
    runOn: transcribeAudio,
    reset: resetWords,
  } = useTranscript();
  const [detecting, setDetecting] = useState(false);
  const [aiCleaning, setAiCleaning] = useState(false);
  const [autoEditing, setAutoEditing] = useState(false);
  const [autoEditStep, setAutoEditStep] = useState(-1); // -1 = not running
  const [autoEditCaptions, setAutoEditCaptions] = useState(true); // does the running pass add captions?
  const { mediaAssets, addMediaAsset, registerSource, dropAsset } =
    useMediaLibrary();
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(
    DEFAULT_CAPTION_STYLE,
  );
  const [captionApplyAll, setCaptionApplyAll] = useState(true);
  const [captionLines, setCaptionLines] = useState(2);
  const [captionWords, setCaptionWordsState] = useState(0); // 0 = phrase mode
  const [snapping, setSnapping] = useState(true);

  const toggleSnapping = useCallback(() => setSnapping((s) => !s), []);

  const generateCaptionsFromTranscript = useCallback(() => {
    setCaptions(
      generateCaptions(words, clips, {
        maxChars: captionLines * 30,
        maxWords: captionWords || undefined,
      }),
    );
  }, [words, clips, captionLines, captionWords, setCaptions]);

  const autoBreakCaptions = useCallback(
    (lines: number) => {
      setCaptionLines(lines);
      setCaptions(
        generateCaptions(words, clips, {
          maxChars: lines * 30,
          maxWords: captionWords || undefined,
        }),
      );
    },
    [words, clips, captionWords, setCaptions],
  );

  const setCaptionWords = useCallback(
    (n: number) => {
      setCaptionWordsState(n);
      setCaptions(
        generateCaptions(words, clips, {
          maxChars: captionLines * 30,
          maxWords: n || undefined,
        }),
      );
    },
    [words, clips, captionLines, setCaptions],
  );

  const setCaptionText = useCallback(
    (id: string, text: string) => {
      // Coalesce keystrokes on one caption into a single undo step.
      setCaptions(
        (prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)),
        `text:${id}`,
      );
    },
    [setCaptions],
  );

  // Per-caption case, cycled Original -> lower -> UPPER, independent of the
  // global case — so one caption can be recased even when "lower" is applied to
  // all. Uses the effective case (its own override, else the global) as the
  // starting point so the first click always visibly changes it.
  const cycleCaptionCase = useCallback(
    (id: string) => {
      setCaptions((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const current = c.textCase ?? captionStyle.textCase;
          const next: CaptionCase =
            current === "none"
              ? "lower"
              : current === "lower"
                ? "upper"
                : "none";
          return { ...c, textCase: next };
        }),
      );
    },
    [setCaptions, captionStyle.textCase],
  );

  const removeCaption = useCallback(
    (id: string) => {
      setCaptions((prev) => prev.filter((c) => c.id !== id));
      sel.dropCaption(id);
    },
    [setCaptions, sel],
  );

  const removeSelectedCaptions = useCallback(() => {
    const ids = new Set(selectedCaptionIds);
    if (ids.size === 0) return;
    setCaptions((prev) => prev.filter((c) => !ids.has(c.id)));
    sel.clearCaptions();
  }, [setCaptions, sel, selectedCaptionIds]);

  const clearCaptions = useCallback(() => {
    setCaptions([]);
    sel.clearCaptions();
  }, [setCaptions, sel]);

  // Edges come in as edited-timeline seconds; store them as source anchors so
  // the caption keeps following the clips.
  const setCaptionRange = useCallback(
    (id: string, start: number, end: number) => {
      const ss = timelineToSource(clips, start);
      const se = timelineToSource(clips, end);
      if (se - ss < 0.05) return;
      setCaptions((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, sourceStart: Math.max(0, ss), sourceEnd: se }
            : c,
        ),
      );
    },
    [clips, setCaptions],
  );

  // Break a caption into two at timeline time `at` (converted to source),
  // splitting the words proportionally.
  const splitCaption = useCallback(
    (id: string, at: number) => {
      const atSrc = timelineToSource(clips, at);
      setCaptions((prev) =>
        prev.flatMap((c) => {
          if (
            c.id !== id ||
            atSrc <= c.sourceStart + 0.05 ||
            atSrc >= c.sourceEnd - 0.05
          ) {
            return [c];
          }
          const parts = c.text.split(/\s+/).filter(Boolean);
          const frac = (atSrc - c.sourceStart) / (c.sourceEnd - c.sourceStart);
          const k = Math.max(
            1,
            Math.min(parts.length - 1, Math.round(frac * parts.length)),
          );
          return [
            {
              ...c,
              id: newCaptionId(),
              sourceEnd: atSrc,
              text: parts.slice(0, k).join(" "),
            },
            {
              ...c,
              id: newCaptionId(),
              sourceStart: atSrc,
              text: parts.slice(k).join(" "),
            },
          ];
        }),
      );
    },
    [clips, setCaptions],
  );

  // Break a caption at a word boundary (Enter in the editor). `wordsBefore` is
  // how many words stay in the first caption; source time is split by word count.
  const splitCaptionAtWord = useCallback(
    (id: string, wordsBefore: number) => {
      setCaptions((prev) =>
        prev.flatMap((c) => {
          if (c.id !== id) return [c];
          const parts = c.text.split(/\s+/).filter(Boolean);
          if (parts.length < 2) return [c];
          const k = Math.max(1, Math.min(parts.length - 1, wordsBefore));
          const atSrc =
            c.sourceStart + (k / parts.length) * (c.sourceEnd - c.sourceStart);
          return [
            {
              ...c,
              id: newCaptionId(),
              sourceEnd: atSrc,
              text: parts.slice(0, k).join(" "),
            },
            {
              ...c,
              id: newCaptionId(),
              sourceStart: atSrc,
              text: parts.slice(k).join(" "),
            },
          ];
        }),
      );
    },
    [setCaptions],
  );

  // Add a caption at the playhead (source seconds). It gets a short default
  // span, trimmed so it doesn't overrun the next caption, and is inserted in
  // temporal order so the list and timeline stay ordered. Selected so the user
  // can immediately type; anchored in source time so it tracks the clips.
  const addCaption = useCallback(
    (atSource: number) => {
      const id = newCaptionId();
      const start = Math.max(0, atSource);
      setCaptions((prev) => {
        let end = start + 1.8;
        const nextStart = prev
          .map((c) => c.sourceStart)
          .filter((s) => s > start)
          .sort((a, b) => a - b)[0];
        if (nextStart !== undefined && nextStart < end) {
          end = Math.max(start + 0.3, nextStart - 0.02);
        }
        const created: Caption = {
          id,
          text: "New caption",
          sourceStart: start,
          sourceEnd: end,
        };
        return [...prev, created].sort((a, b) => a.sourceStart - b.sourceStart);
      });
      sel.selectCaption(id);
    },
    [setCaptions, sel],
  );

  // Merge two or more captions into one spanning their full source range, with
  // their text joined in temporal order. Timing stays anchored in source time,
  // so the merged line keeps matching the speech.
  const mergeCaptions = useCallback(
    (ids: string[]) => {
      if (ids.length < 2) return;
      const set = new Set(ids);
      setCaptions((prev) => {
        const targets = prev
          .filter((c) => set.has(c.id))
          .sort((a, b) => a.sourceStart - b.sourceStart);
        if (targets.length < 2) return prev;
        const merged: Caption = {
          ...targets[0],
          id: newCaptionId(),
          sourceStart: Math.min(...targets.map((c) => c.sourceStart)),
          sourceEnd: Math.max(...targets.map((c) => c.sourceEnd)),
          text: targets
            .map((c) => c.text.trim())
            .filter(Boolean)
            .join(" "),
        };
        return [...prev.filter((c) => !set.has(c.id)), merged].sort(
          (a, b) => a.sourceStart - b.sourceStart,
        );
      });
      sel.clearCaptions();
    },
    [setCaptions, sel],
  );

  // Apply a style change either to every caption (update the global style and
  // clear the matching per-caption overrides) or, when Apply-to-all is off, to
  // just the selected caption(s). `global` patches the shared style; `perCaption`
  // is the same change expressed as a per-caption override.
  const applyCaptionStyle = useCallback(
    (global: Partial<CaptionStyle>, perCaption: Partial<Caption>) => {
      if (captionApplyAll) {
        setCaptionStyle((s) => ({ ...s, ...global }));
        const keys = Object.keys(perCaption) as (keyof Caption)[];
        setCaptions((prev) =>
          prev.map((c) => {
            const next = { ...c };
            for (const k of keys) delete next[k];
            return next;
          }),
        );
      } else if (selectedCaptionIds.length > 0) {
        const target = new Set(selectedCaptionIds);
        setCaptions((prev) =>
          prev.map((c) => (target.has(c.id) ? { ...c, ...perCaption } : c)),
        );
      }
    },
    [captionApplyAll, selectedCaptionIds, setCaptions],
  );

  const setCaptionFont = useCallback(
    (fontFamily: string) => applyCaptionStyle({ fontFamily }, { fontFamily }),
    [applyCaptionStyle],
  );

  const setCaptionScale = useCallback(
    (fontScale: number) =>
      applyCaptionStyle({ fontScale }, { scale: fontScale }),
    [applyCaptionStyle],
  );

  // Casing is a non-destructive display style (rendered via CSS text-transform),
  // so it's fully revertible — "Original" leaves the transcribed text untouched.
  const setCaptionCase = useCallback(
    (mode: CaptionCase) =>
      applyCaptionStyle({ textCase: mode }, { textCase: mode }),
    [applyCaptionStyle],
  );

  const toggleCaptionApplyAll = useCallback(
    () => setCaptionApplyAll((v) => !v),
    [],
  );

  // Move/resize: apply to the global style (and clear per-caption overrides) or
  // to just this caption, per the Apply-to-all toggle.
  const updateCaptionLayout = useCallback(
    (id: string, layout: CaptionLayout) => {
      if (captionApplyAll) {
        setCaptionStyle((s) => ({
          ...s,
          x: layout.x ?? s.x,
          y: layout.y ?? s.y,
          width: layout.w ?? s.width,
          fontScale: layout.scale ?? s.fontScale,
        }));
        setCaptions((prev) =>
          prev.map((c) => ({
            ...c,
            x: layout.x != null ? undefined : c.x,
            y: layout.y != null ? undefined : c.y,
            w: layout.w != null ? undefined : c.w,
            scale: layout.scale != null ? undefined : c.scale,
          })),
        );
      } else {
        setCaptions((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...layout } : c)),
        );
      }
    },
    [captionApplyAll, setCaptions],
  );

  const addOverlayFromAsset = useCallback(
    (assetId: string, start = 0) => {
      const asset = mediaAssets.find((m) => m.id === assetId);
      if (!asset) return;
      setOverlays((prev) => [
        ...prev,
        {
          id: newOverlayId(),
          kind: asset.kind,
          url: asset.url,
          name: asset.name,
          start: Math.max(0, start),
          duration: asset.duration,
          sourceStart: 0,
          muted: true,
        },
      ]);
    },
    [mediaAssets, setOverlays],
  );

  // Move a base-track clip up onto a new upper video track (full-frame cutaway).
  // Lifting the last one is fine — an empty bottom track is a valid project.
  const liftClipToTrack = useCallback(
    (clipId: string, timelineStart: number) => {
      if (!source) return;
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;
      // Leaving the base and joining an upper track is one edit, so it undoes in
      // one step rather than stranding the clip on neither track.
      updateEditor((s) => ({
        ...s,
        clips: removeClip(s.clips, clipId),
        overlays: [
          ...s.overlays,
          {
            id: newOverlayId(),
            kind: "video",
            url: source.url,
            name: source.name,
            start: Math.max(0, timelineStart),
            duration: Math.max(0.1, clip.end - clip.start),
            sourceStart: clip.start,
            muted: true,
          },
        ],
      }));
      sel.dropClip(clipId);
    },
    [source, clips, updateEditor, sel],
  );

  // Mirror of liftClipToTrack: drag an overlay DOWN onto the base to fold it into
  // the bottom-layer sequence as another clip (appended). A base-referencing
  // overlay becomes a plain source slice; any other asset becomes a clip that
  // carries its own media. Images can't drive the base clock, so they're left as
  // overlays.
  const dropOverlayToBase = useCallback(
    (overlayId: string) => {
      const o = overlays.find((x) => x.id === overlayId);
      if (!o || o.kind !== "video") return;
      const carriesOwnMedia = !source || o.url !== source.url;
      const assetDuration =
        mediaAssets.find((m) => m.url === o.url)?.duration ??
        o.sourceStart + o.duration;
      updateEditor((s) => ({
        ...s,
        clips: [
          ...s.clips,
          {
            id: newClipId(),
            start: o.sourceStart,
            end: o.sourceStart + o.duration,
            src: carriesOwnMedia
              ? {
                  url: o.url,
                  kind: "video",
                  name: o.name,
                  duration: assetDuration,
                }
              : undefined,
          },
        ],
        overlays: s.overlays.filter((x) => x.id !== overlayId),
      }));
      sel.dropOverlay(overlayId);
    },
    [overlays, source, mediaAssets, updateEditor, sel],
  );

  // `gesture` collapses a whole drag into one undo step: these fire on every
  // pointermove, and without it a single drag would stack hundreds of steps.
  const moveOverlay = useCallback(
    (id: string, start: number, gesture?: string) => {
      setOverlays(
        (prev) =>
          prev.map((o) =>
            o.id === id ? { ...o, start: Math.max(0, start) } : o,
          ),
        gesture,
      );
    },
    [setOverlays],
  );

  const setOverlayRect = useCallback(
    (id: string, rect: OverlayRect) => {
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...rect } : o)),
      );
    },
    [setOverlays],
  );

  // Trim an upper-track clip's timeline range and in-point (edge drag). The
  // lane clamps against the media length; this just stores the result.
  const setOverlayRange = useCallback(
    (
      id: string,
      start: number,
      duration: number,
      sourceStart: number,
      gesture?: string,
    ) => {
      setOverlays(
        (prev) =>
          prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  start: Math.max(0, start),
                  duration: Math.max(0.1, duration),
                  sourceStart: Math.max(0, sourceStart),
                }
              : o,
          ),
        gesture,
      );
    },
    [setOverlays],
  );

  const toggleOverlayHidden = useCallback(
    (id: string) => {
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, hidden: !o.hidden } : o)),
      );
    },
    [setOverlays],
  );

  const toggleOverlayMuted = useCallback(
    (id: string) => {
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, muted: !(o.muted ?? true) } : o,
        ),
      );
    },
    [setOverlays],
  );

  const removeOverlay = useCallback(
    (id: string) => {
      setOverlays((prev) => prev.filter((o) => o.id !== id));
    },
    [setOverlays],
  );

  // Delete the bottom track, exactly like deleting an upper one: its clips go,
  // everything stacked above or beside it stays where it is and keeps playing.
  // The recording itself survives in the media library, so it can be re-added.
  const removeBaseTrack = useCallback(() => {
    updateEditor((s) => ({
      ...s,
      clips: [],
      baseHidden: false,
      baseMuted: false,
    }));
    sel.clearClips();
  }, [updateEditor, sel]);

  const addAudio = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
        return;
      }
      const media = await loadVideoSource(file, file.name);
      setAudioTracks((prev) => [
        ...prev,
        {
          id: newAudioId(),
          name: media.name,
          url: media.url,
          duration: media.duration,
          start: 0,
          muted: false,
        },
      ]);
    },
    [setAudioTracks],
  );

  const moveAudio = useCallback(
    (id: string, start: number, gesture?: string) => {
      setAudioTracks(
        (prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, start: Math.max(0, start) } : t,
          ),
        gesture,
      );
    },
    [setAudioTracks],
  );

  const toggleAudioMuted = useCallback(
    (id: string) => {
      setAudioTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)),
      );
    },
    [setAudioTracks],
  );

  // The object URL is deliberately NOT revoked: undo brings this track back, and
  // a revoked URL would restore a track that can never play. Object URLs are
  // released when the project is replaced or cleared.
  const removeAudio = useCallback(
    (id: string) => {
      setAudioTracks((prev) => prev.filter((t) => t.id !== id));
    },
    [setAudioTracks],
  );

  // Captions are anchored in the transcript's seconds, so they go with it.
  const resetTranscript = useCallback(() => {
    resetWords();
    setCaptions([]);
    sel.clearCaptions();
  }, [resetWords, setCaptions, sel]);

  const loadSource = useCallback(
    (next: StudioSource) => {
      setSource((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return next;
      });
      // One reset clears every layer and its history: clips, captions, overlays,
      // audio, and the bottom track's flags.
      resetEditor({ clips: fullClip(next.duration) });
      sel.clearClips();
      sel.clearOverlays();
      resetTranscript();
      // Warm the audio decode now (it's the slow first step and dedupes by URL),
      // so by the time the user hits 1-Click or Transcribe it's already cached.
      if (next.kind !== "image") void decodeToMono16k(next.url).catch(() => {});
      registerSource(next);
    },
    [resetEditor, resetTranscript, registerSource, sel],
  );

  // Removing a library asset removes every placement of it, at any level of the
  // stack — no asset is pinned to the library just because a track uses it.
  const removeMediaAsset = useCallback(
    (id: string) => {
      const asset = dropAsset(id);
      if (!asset) return;
      const { url } = asset;
      const isRecording = source?.url === url;
      const dropsClip = (c: Clip) => (c.src?.url ?? source?.url) === url;

      sel.clearClips();
      sel.clearOverlays();

      if (isRecording) {
        // Dropping the recording takes the transcript and captions with it, both
        // being anchored in its seconds. Undo can't resurrect the source itself,
        // so this clears history rather than leaving a stack that restores clips
        // pointing at media the project no longer has.
        setSource(null);
        resetTranscript();
        resetEditor({
          clips: clips.filter((c) => !dropsClip(c)),
          overlays: overlays.filter((o) => o.url !== url),
          audioTracks,
        });
        return;
      }
      // Every placement of the asset goes at once, as a single undo step.
      updateEditor((s) => ({
        ...s,
        clips: s.clips.filter((c) => !dropsClip(c)),
        overlays: s.overlays.filter((o) => o.url !== url),
      }));
      // The object URL outlives the library entry on purpose: undo brings those
      // clips back, and a revoked URL would restore footage that cannot play.
    },
    [
      dropAsset,
      source,
      clips,
      overlays,
      audioTracks,
      updateEditor,
      resetEditor,
      resetTranscript,
      sel,
    ],
  );

  // Add a library asset to the timeline: the first video becomes the base
  // (main track); anything added afterward becomes a new upper track.
  const addAssetToTimeline = useCallback(
    (assetId: string, start = 0) => {
      const asset = mediaAssets.find((m) => m.id === assetId);
      if (!asset) return;
      if (!source) {
        loadSource({
          url: asset.url,
          name: asset.name,
          // Images get a default 3s duration; they play on a synthetic clock.
          duration: asset.kind === "image" ? 3 : asset.duration,
          width: asset.width,
          height: asset.height,
          kind: asset.kind,
        });
        return;
      }
      if (asset.kind === "video") {
        // Append to the main track as a clip carrying its own source.
        setClips((prev) => [
          ...prev,
          {
            id: newClipId(),
            start: 0,
            end: asset.duration,
            src: {
              url: asset.url,
              kind: "video",
              name: asset.name,
              duration: asset.duration,
              width: asset.width,
              height: asset.height,
            },
          },
        ]);
        return;
      }
      // Images layer onto a non-main track at the drop position.
      addOverlayFromAsset(assetId, start);
    },
    [mediaAssets, source, loadSource, addOverlayFromAsset, setClips],
  );

  // Append an asset to the MAIN (base) track as another clip — the main track is
  // just "the layer shown behind everything", not a single fixed thing, so the
  // same media (or any other) can be added to it as many times as wanted. With
  // no base yet, the asset becomes the base. Images can't drive the base clock,
  // so they fall back to an overlay.
  const addAssetToMainTrack = useCallback(
    (assetId: string) => {
      const asset = mediaAssets.find((m) => m.id === assetId);
      if (!asset) return;
      if (!source) {
        addAssetToTimeline(assetId);
        return;
      }
      if (asset.kind !== "video") {
        addOverlayFromAsset(assetId, 0);
        return;
      }
      setClips((prev) => [
        ...prev,
        {
          id: newClipId(),
          start: 0,
          end: asset.duration,
          src: {
            url: asset.url,
            kind: "video",
            name: asset.name,
            duration: asset.duration,
            width: asset.width,
            height: asset.height,
          },
        },
      ]);
    },
    [mediaAssets, source, addAssetToTimeline, addOverlayFromAsset, setClips],
  );

  const clearSource = useCallback(() => {
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    // Empties every layer and drops the undo stack along with them.
    resetEditor({});
    sel.clearClips();
    sel.clearOverlays();
    resetTranscript();
  }, [resetEditor, resetTranscript, sel]);

  // Pick up a recording handed over from the practice flow (Record -> Edit),
  // or load a Content Library item's saved recording via ?item=<id>.
  useEffect(() => {
    const blob = consumePendingVideo();
    if (blob) {
      loadVideoSource(blob, "Practice take")
        .then(loadSource)
        .catch(() => {});
      return;
    }
    const itemId = new URLSearchParams(window.location.search).get("item");
    if (!itemId) return;
    loadLinkedRecording(itemId)
      .then((rec) => {
        if (!rec) return; // no recording linked / signed out -> empty editor
        return loadVideoSource(rec.blob, rec.name).then(loadSource);
      })
      .catch((e) => {
        // Likely missing R2 GET CORS or a deleted object; leave the uploader
        // visible instead of a broken editor.
        console.warn("Could not load the linked recording", e);
      });
  }, [loadSource]);

  // Warn before leaving/refreshing while there's a video loaded, since edits
  // are not saved anywhere.
  useEffect(() => {
    if (!source) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [source]);

  // Cut an upper-track clip in two at the playhead. The right half keeps playing
  // from where the left half stopped; a still image has no in-point to advance.
  const splitOverlays = useCallback(
    (ids: string[], timelineTime: number) => {
      const targets = new Set(ids);
      setOverlays((prev) =>
        prev.flatMap((o) => {
          if (!targets.has(o.id)) return [o];
          const local = timelineTime - o.start;
          if (local <= 0.05 || local >= o.duration - 0.05) return [o];
          return [
            { ...o, id: newOverlayId(), duration: local },
            {
              ...o,
              id: newOverlayId(),
              start: timelineTime,
              duration: o.duration - local,
              sourceStart:
                o.kind === "image" ? o.sourceStart : o.sourceStart + local,
            },
          ];
        }),
      );
      sel.clearOverlays();
    },
    [setOverlays, sel],
  );

  /**
   * Split whatever is selected at the playhead. Every timeline element splits —
   * an upper-track clip, a caption, or a bottom-track clip — and with nothing
   * selected it falls back to the bottom-track clip under the playhead.
   */
  const splitSelected = useCallback(
    (timelineTime: number) => {
      if (selectedOverlayIds.length) {
        splitOverlays(selectedOverlayIds, timelineTime);
        return;
      }
      if (selectedCaptionIds.length) {
        for (const id of selectedCaptionIds) splitCaption(id, timelineTime);
        return;
      }
      setClips((prev) => splitClipAt(prev, timelineTime));
    },
    [
      selectedOverlayIds,
      selectedCaptionIds,
      splitOverlays,
      splitCaption,
      setClips,
    ],
  );

  // Delete whatever is selected, across all three kinds at once: base clips,
  // upper-track overlays, and captions. Emptying the bottom track is allowed —
  // the clock comes from the longest layer, not from the base. One delete is one
  // undo step even when it spans every layer.
  const deleteSelected = useCallback(() => {
    const clipIds = new Set(selectedClipIds);
    const overlayIds = new Set(selectedOverlayIds);
    const captionIds = new Set(selectedCaptionIds);
    if (!clipIds.size && !overlayIds.size && !captionIds.size) return;
    updateEditor((s) => ({
      ...s,
      clips: clipIds.size ? s.clips.filter((c) => !clipIds.has(c.id)) : s.clips,
      overlays: overlayIds.size
        ? s.overlays.filter((o) => !overlayIds.has(o.id))
        : s.overlays,
      captions: captionIds.size
        ? s.captions.filter((c) => !captionIds.has(c.id))
        : s.captions,
    }));
    sel.clearSelection();
  }, [
    updateEditor,
    selectedClipIds,
    selectedOverlayIds,
    selectedCaptionIds,
    sel,
  ]);

  const trimStart = useCallback(
    (sourceTime: number) => {
      setClips((prev) =>
        selectedClipId ? trimClipStart(prev, selectedClipId, sourceTime) : prev,
      );
    },
    [setClips, selectedClipId],
  );

  const trimEnd = useCallback(
    (sourceTime: number) => {
      setClips((prev) =>
        selectedClipId ? trimClipEnd(prev, selectedClipId, sourceTime) : prev,
      );
    },
    [setClips, selectedClipId],
  );

  const setClipRange = useCallback(
    (id: string, start: number, end: number) => {
      if (end - start < 0.1) return;
      setClips((prev) =>
        prev.map((c) => (c.id === id ? { ...c, start, end } : c)),
      );
    },
    [setClips],
  );

  const moveClip = useCallback(
    (id: string, toIndex: number) => {
      setClips((prev) => moveClipTo(prev, id, toIndex));
    },
    [setClips],
  );

  const cutAll = useCallback(
    (ranges: [number, number][]) => {
      if (ranges.length === 0) return;
      setClips((prev) =>
        ranges.reduce(
          (next, [from, to]) => removeSourceRange(next, from, to),
          prev,
        ),
      );
    },
    [setClips],
  );

  // Remove pauses = cut the gaps between words (transcript required, so we know
  // exactly where there's no speech), plus silence before the first / after the
  // last word. Never removes speech.
  const removePauses = useCallback((): number => {
    if (words.length === 0) return 0;
    const ranges = pauseRanges(words);
    const first = words[0];
    const last = words[words.length - 1];
    if (first.start >= 0.5) ranges.unshift([0, first.start - 0.05]);
    if (source && source.duration - last.end >= 0.5) {
      ranges.push([last.end + 0.1, source.duration]);
    }
    cutAll(ranges);
    return ranges.length;
  }, [words, source, cutAll]);

  // Trim each clip's START and END down to speech from the audio waveform (no
  // transcript needed), so combined clips begin and end on words, not silence.
  // The threshold is anchored to the average speaking volume, so flat leading /
  // trailing regions get trimmed decisively.
  const trimClipsToSpeech = useCallback(async (): Promise<number> => {
    if (!source || source.kind === "image") return 0;
    setDetecting(true);
    try {
      const analysis = analyzeForTrim(await decodeToMono16k(source.url));
      const next = trimToSpeech(clips, analysis);
      const changed = next.reduce((n, c, i) => (c !== clips[i] ? n + 1 : n), 0);
      if (changed > 0) setClips(() => next);
      return changed;
    } finally {
      setDetecting(false);
    }
  }, [source, clips, setClips]);

  // The decoded audio is the source of truth for length. A video element often
  // under-reports duration (MediaRecorder WebM especially), which would leave
  // words spoken past that point outside the only clip — treated as cut, so they
  // vanish from the transcript/captions/export. Extend an untouched timeline to
  // the true audio length so the whole recording, including the end, is kept.
  const coverFullAudio = useCallback(
    (audioSamples: number) => {
      if (!source) return;
      const audioDur = audioSamples / 16000; // decode target rate
      if (audioDur <= source.duration + 0.1) return;
      setSource((s) => (s ? { ...s, duration: audioDur } : s));
      setClips((prev) => {
        const pristine =
          prev.length === 1 &&
          prev[0].start <= 0.001 &&
          prev[0].end >= source.duration - 0.1;
        return pristine ? fullClip(audioDur) : prev;
      });
    },
    [source, setClips],
  );

  const transcribe = useCallback(async (): Promise<void> => {
    if (!source || source.kind === "image") return;
    await runTranscribe(source.url, (audio) => coverFullAudio(audio.length));
  }, [source, runTranscribe, coverFullAudio]);

  const applyCuts = useCallback(
    (ranges: [number, number][]) => {
      if (ranges.length === 0) return;
      setClips((prev) => {
        let next = prev;
        for (const [from, to] of ranges) {
          next = removeSourceRange(next, from, to);
        }
        return next;
      });
    },
    [setClips],
  );

  const deleteWords = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      applyCuts(selectionToRanges(words, new Set(ids)));
    },
    [words, applyCuts],
  );

  const cutRange = useCallback(
    (from: number, to: number) => applyCuts([[from, to]]),
    [applyCuts],
  );

  const removeEarlierTakes = useCallback((): number => {
    const ranges = findEarlierTakeRanges(words);
    applyCuts(ranges);
    return ranges.length;
  }, [words, applyCuts]);

  // Clean up retakes: the AI flags earlier attempts of restarted lines and
  // stumbles; those cuts are validated (a line that isn't restated later is
  // never removed) and unioned with a deterministic exact-repeat detector that
  // catches obvious restarts the AI misses. Works even without an AI key
  // (deterministic only). Returns the number of ranges marked to cut.
  const aiRemoveMistakes = useCallback(async (): Promise<number> => {
    if (words.length === 0) return 0;
    setAiCleaning(true);
    try {
      let aiCuts: [number, number][] | null = null;
      try {
        aiCuts = await cleanTranscriptRemote(words);
      } catch (e) {
        console.error("[studio] AI retake cleanup failed", e);
      }
      const ranges = combineRetakeCuts(words, aiCuts);
      applyCuts(ranges);
      return ranges.length;
    } finally {
      setAiCleaning(false);
    }
  }, [words, applyCuts]);

  // One-click clean up: transcribe (if needed), trim each clip's silence, remove
  // AI-flagged mistakes/retakes and pauses, and (when withCaptions) generate
  // captions with sensible defaults. Everything is computed into local variables
  // so each step sees the result of the previous one without waiting on React
  // state to flush.
  const autoEdit = useCallback(
    async (withCaptions = true): Promise<void> => {
      if (!source || source.kind === "image") return;
      setAutoEditCaptions(withCaptions);
      setAutoEditing(true);
      try {
        // Step 0 — prepare: decode the audio (the slow part for a long/4K clip;
        // the video's audio must be pulled out in-browser before anything else).
        setAutoEditStep(0);
        const audio = await decodeToMono16k(source.url);
        const audioDur = audio.length / 16000;

        // Step 1 — transcript (reuse existing words when present).
        setAutoEditStep(1);
        let w = words;
        // A failed transcription is not fatal here: the rest of the pass still
        // trims silence, so keep going with no words rather than bailing out.
        if (w.length === 0)
          w = (await transcribeAudio(audio, source.url)) ?? [];

        // Extend an untouched timeline to the full audio length so speech past the
        // video element's reported duration (the end of the take) isn't dropped.
        const pristine =
          clips.length === 1 &&
          clips[0].start <= 0.001 &&
          clips[0].end >= source.duration - 0.1;
        const effDuration = Math.max(source.duration, audioDur);
        const extend = pristine && audioDur > source.duration + 0.1;
        if (audioDur > source.duration + 0.1) {
          setSource((s) => (s ? { ...s, duration: effDuration } : s));
        }
        let next = extend ? fullClip(effDuration) : clips;

        // The waveform trim analysis is pure CPU and independent of the AI clean
        // pass — kick it off now so it overlaps the network round-trip.
        const analysisPromise = Promise.resolve().then(() =>
          analyzeForTrim(audio),
        );

        if (w.length > 0) {
          // Step 2 — remove retakes/mistakes: validated AI cuts unioned with the
          // deterministic exact-repeat detector (never cuts a one-off line, and
          // still catches restarts without an AI key).
          setAutoEditStep(2);
          let aiCuts: [number, number][] | null = null;
          try {
            aiCuts = await cleanTranscriptRemote(w);
          } catch {
            aiCuts = null; // fall back to deterministic-only inside combine
          }
          for (const [from, to] of combineRetakeCuts(w, aiCuts)) {
            next = removeSourceRange(next, from, to);
          }

          // Step 3 — cut filler words, then pauses, then leading/trailing dead air.
          setAutoEditStep(3);
          const ranges: [number, number][] = [
            ...selectionToRanges(w, new Set(findFillerIds(w))),
            ...pauseRanges(w, 0.25),
          ];
          const first = w[0];
          const last = w[w.length - 1];
          if (first.start >= 0.4) ranges.push([0, first.start - 0.04]);
          // Use the raw last-word end with a safe margin so a soft-decay final
          // word isn't clipped by the trailing-silence cut.
          if (effDuration - last.end >= 0.4) {
            ranges.push([last.end + 0.15, effDuration]);
          }
          for (const [from, to] of ranges) {
            next = removeSourceRange(next, from, to);
          }
        }

        // Step 4 — trim each remaining clip down to speech, then drop the tiny
        // slivers the cuts leave behind so playback is clean, not stuttery.
        setAutoEditStep(4);
        try {
          next = trimToSpeech(next, await analysisPromise);
        } catch {
          // leave clips as-is if the waveform can't be analysed
        }
        next = next.filter((c) => c.end - c.start >= MIN_CLIP_SEC);
        if (next.length === 0) next = extend ? fullClip(effDuration) : clips;

        setClips(() => next);

        // Step 5 — captions (only when asked): normal case, 3 words per caption,
        // centered and one third of the frame height up from the bottom.
        if (withCaptions && w.length > 0) {
          setAutoEditStep(5);
          setCaptionStyle((s) => ({
            ...s,
            textCase: "none",
            x: 0.5,
            y: 2 / 3,
            width: 0.8,
            fontScale: 0.032,
          }));
          setCaptionWordsState(3);
          setCaptions(
            generateCaptions(w, next, {
              maxChars: captionLines * 30,
              maxWords: 3,
            }),
          );
        }
      } finally {
        setAutoEditing(false);
        setAutoEditStep(-1);
      }
    },
    [
      source,
      words,
      clips,
      setClips,
      setCaptions,
      transcribeAudio,
      captionLines,
    ],
  );

  // Undelete: add cut words' source ranges back into the timeline.
  const restoreWords = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const ranges = selectionToRanges(words, new Set(ids));
      if (ranges.length === 0) return;
      setClips((prev) =>
        ranges.reduce(
          (next, [from, to]) => restoreSourceRange(next, from, to),
          prev,
        ),
      );
    },
    [words, setClips],
  );

  // Reset the bottom track's cuts. The layers stacked on it, and the captions,
  // are the user's work and survive.
  const reset = useCallback(() => {
    resetEditor({
      clips: source ? fullClip(source.duration) : [],
      captions,
      overlays,
      audioTracks,
      baseHidden,
      baseMuted,
    });
    sel.clearClips();
  }, [
    resetEditor,
    source,
    captions,
    overlays,
    audioTracks,
    baseHidden,
    baseMuted,
    sel,
  ]);

  const duration = useMemo(
    () => projectDuration(clips, overlays, audioTracks),
    [clips, overlays, audioTracks],
  );

  const value = useMemo<StudioContextValue>(
    () => ({
      source,
      clips,
      duration,
      baseHidden,
      baseMuted,
      toggleBaseHidden,
      toggleBaseMuted,
      removeBaseTrack,
      aspectId,
      aspect,
      setAspectId,
      selectedClipId,
      detecting,
      words,
      audioTracks,
      transcribeStatus,
      loadSource,
      clearSource,
      selectClip: sel.selectClip,
      selectedClipIds: selectedClipIds,
      toggleClipSelection: sel.toggleClip,
      selectClips: sel.replaceClips,
      selectedOverlayIds: selectedOverlayIds,
      selectOverlay: sel.selectOverlay,
      toggleOverlaySelection: sel.toggleOverlay,
      splitSelected,
      deleteSelected,
      trimStart,
      trimEnd,
      setClipRange,
      moveClip,
      removePauses,
      trimClipsToSpeech,
      transcribe,
      deleteWords,
      restoreWords,
      cutRange,
      removeEarlierTakes,
      aiRemoveMistakes,
      aiCleaning,
      autoEdit,
      autoEditing,
      autoEditStep,
      autoEditCaptions,
      addAudio,
      moveAudio,
      toggleAudioMuted,
      removeAudio,
      mediaAssets,
      overlays,
      addMediaAsset,
      removeMediaAsset,
      addOverlayFromAsset,
      addAssetToTimeline,
      addAssetToMainTrack,
      liftClipToTrack,
      dropOverlayToBase,
      moveOverlay,
      setOverlayRect,
      setOverlayRange,
      toggleOverlayHidden,
      toggleOverlayMuted,
      removeOverlay,
      captions,
      captionStyle,
      selectedCaptionId,
      selectedCaptionIds: selectedCaptionIds,
      captionApplyAll,
      captionLines,
      captionWords,
      generateCaptionsFromTranscript,
      autoBreakCaptions,
      setCaptionWords,
      selectCaption: sel.selectCaption,
      toggleCaptionSelection: sel.toggleCaption,
      selectCaptions: sel.replaceCaptions,
      removeSelectedCaptions,
      setCaptionText,
      cycleCaptionCase,
      addCaption,
      mergeCaptions,
      removeCaption,
      clearCaptions,
      updateCaptionLayout,
      setCaptionRange,
      splitCaption,
      splitCaptionAtWord,
      setCaptionFont,
      setCaptionScale,
      setCaptionCase,
      toggleCaptionApplyAll,
      snapping,
      toggleSnapping,
      undo,
      redo,
      canUndo,
      canRedo,
      reset,
    }),
    [
      source,
      clips,
      duration,
      baseHidden,
      baseMuted,
      toggleBaseHidden,
      toggleBaseMuted,
      removeBaseTrack,
      aspectId,
      aspect,
      setAspectId,
      selectedClipId,
      detecting,
      words,
      audioTracks,
      transcribeStatus,
      loadSource,
      clearSource,
      sel,
      splitSelected,
      deleteSelected,
      trimStart,
      trimEnd,
      setClipRange,
      moveClip,
      removePauses,
      trimClipsToSpeech,
      transcribe,
      deleteWords,
      restoreWords,
      cutRange,
      removeEarlierTakes,
      aiRemoveMistakes,
      aiCleaning,
      autoEdit,
      autoEditing,
      autoEditStep,
      autoEditCaptions,
      addAudio,
      moveAudio,
      toggleAudioMuted,
      removeAudio,
      mediaAssets,
      overlays,
      addMediaAsset,
      removeMediaAsset,
      addOverlayFromAsset,
      addAssetToTimeline,
      addAssetToMainTrack,
      liftClipToTrack,
      dropOverlayToBase,
      moveOverlay,
      setOverlayRect,
      setOverlayRange,
      toggleOverlayHidden,
      toggleOverlayMuted,
      removeOverlay,
      captions,
      captionStyle,
      selectedCaptionId,
      captionApplyAll,
      captionLines,
      captionWords,
      generateCaptionsFromTranscript,
      autoBreakCaptions,
      setCaptionWords,
      removeSelectedCaptions,
      setCaptionText,
      cycleCaptionCase,
      addCaption,
      mergeCaptions,
      removeCaption,
      clearCaptions,
      updateCaptionLayout,
      setCaptionRange,
      splitCaption,
      splitCaptionAtWord,
      setCaptionFont,
      setCaptionScale,
      setCaptionCase,
      toggleCaptionApplyAll,
      snapping,
      toggleSnapping,
      undo,
      redo,
      canUndo,
      canRedo,
      reset,
      selectedCaptionIds,
      selectedClipIds,
      selectedOverlayIds,
    ],
  );

  return <StudioContext value={value}>{children}</StudioContext>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
