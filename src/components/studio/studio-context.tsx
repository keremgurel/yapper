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
  splitAtSource,
  timelineToSource,
  trimClipEnd,
  trimClipStart,
} from "@/lib/studio/clips";
import {
  analyzeForTrim,
  detectSpeechSegments,
  speechBoundsInRange,
} from "@/lib/studio/silence";
import {
  findEarlierTakeRanges,
  pauseRanges,
  refineWordTimings,
  selectionToRanges,
} from "@/lib/studio/transcript-edit";
import {
  DEFAULT_CAPTION_STYLE,
  generateCaptions,
  type CaptionCase,
  type CaptionStyle,
} from "@/lib/studio/captions";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import { transcribeAudio } from "@/lib/studio/transcribe";
import { transcribeRemote } from "@/lib/studio/transcribe-remote";
import { cleanTranscriptRemote } from "@/lib/studio/clean-transcript";
import { consumePendingVideo } from "@/lib/studio/handoff";
import { loadVideoSource } from "@/lib/studio/load-source";
import { useClipHistory } from "@/hooks/use-clip-history";
import {
  newAudioId,
  newCaptionId,
  newClipId,
  newMediaId,
  newOverlayId,
  newWordId,
  type AudioTrack,
  type Caption,
  type Clip,
  type MediaAsset,
  type Overlay,
  type OverlayRect,
  type StudioSource,
  type Word,
} from "@/lib/studio/types";

interface CaptionLayout {
  x?: number;
  y?: number;
  w?: number;
  scale?: number;
}

export type TranscribeStatus =
  | "idle"
  | "loading"
  | "transcribing"
  | "done"
  | "error";

interface StudioContextValue {
  source: StudioSource | null;
  clips: Clip[];
  selectedClipId: string | null;
  selectedClipIds: string[];
  detecting: boolean;
  words: Word[];
  audioTracks: AudioTrack[];
  transcribeStatus: TranscribeStatus;
  transcribeProgress: number;
  loadSource: (source: StudioSource) => void;
  clearSource: () => void;
  selectClip: (id: string | null) => void;
  toggleClipSelection: (id: string) => void;
  selectClips: (ids: string[]) => void;
  splitAt: (sourceTime: number) => void;
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
  autoEdit: () => Promise<void>;
  autoEditing: boolean;
  addAudio: (file: File) => Promise<void>;
  moveAudio: (id: string, start: number) => void;
  toggleAudioMuted: (id: string) => void;
  removeAudio: (id: string) => void;
  mediaAssets: MediaAsset[];
  overlays: Overlay[];
  addMediaAsset: (file: File) => Promise<void>;
  removeMediaAsset: (id: string) => void;
  addOverlayFromAsset: (assetId: string, start?: number) => void;
  addAssetToTimeline: (assetId: string, start?: number) => void;
  liftClipToTrack: (clipId: string, timelineStart: number) => void;
  moveOverlay: (id: string, start: number) => void;
  setOverlayRect: (id: string, rect: OverlayRect) => void;
  toggleOverlayHidden: (id: string) => void;
  toggleOverlayMuted: (id: string) => void;
  removeOverlay: (id: string) => void;
  captions: Caption[];
  captionStyle: CaptionStyle;
  selectedCaptionId: string | null;
  captionApplyAll: boolean;
  captionLines: number;
  captionWords: number;
  generateCaptionsFromTranscript: () => void;
  autoBreakCaptions: (lines: number) => void;
  setCaptionWords: (n: number) => void;
  selectCaption: (id: string | null) => void;
  setCaptionText: (id: string, text: string) => void;
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
  const { clips, setClips, resetClips, undo, redo, canUndo, canRedo } =
    useClipHistory();
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  // Single selection (for trim, which only makes sense on one clip).
  const selectedClipId =
    selectedClipIds.length === 1 ? selectedClipIds[0] : null;
  const selectClip = useCallback(
    (id: string | null) => setSelectedClipIds(id ? [id] : []),
    [],
  );
  const toggleClipSelection = useCallback((id: string) => {
    setSelectedClipIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);
  const selectClips = useCallback(
    (ids: string[]) => setSelectedClipIds(ids),
    [],
  );
  const [words, setWords] = useState<Word[]>([]);
  const [transcribeStatus, setTranscribeStatus] =
    useState<TranscribeStatus>("idle");
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const [aiCleaning, setAiCleaning] = useState(false);
  const [autoEditing, setAutoEditing] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(
    DEFAULT_CAPTION_STYLE,
  );
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(
    null,
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
  }, [words, clips, captionLines, captionWords]);

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
    [words, clips, captionWords],
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
    [words, clips, captionLines],
  );

  const setCaptionText = useCallback((id: string, text: string) => {
    setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
  }, []);

  const removeCaption = useCallback((id: string) => {
    setCaptions((prev) => prev.filter((c) => c.id !== id));
    setSelectedCaptionId((cur) => (cur === id ? null : cur));
  }, []);

  const clearCaptions = useCallback(() => {
    setCaptions([]);
    setSelectedCaptionId(null);
  }, []);

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
    [clips],
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
    [clips],
  );

  // Break a caption at a word boundary (Enter in the editor). `wordsBefore` is
  // how many words stay in the first caption; source time is split by word count.
  const splitCaptionAtWord = useCallback((id: string, wordsBefore: number) => {
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
  }, []);

  const setCaptionFont = useCallback((fontFamily: string) => {
    setCaptionStyle((s) => ({ ...s, fontFamily }));
  }, []);

  const setCaptionScale = useCallback((fontScale: number) => {
    setCaptionStyle((s) => ({ ...s, fontScale }));
    setCaptions((prev) => prev.map((c) => ({ ...c, scale: undefined })));
  }, []);

  // Casing is a non-destructive display style (rendered via CSS text-transform),
  // so it's fully revertible — "Original" leaves the transcribed text untouched.
  const setCaptionCase = useCallback((mode: CaptionCase) => {
    setCaptionStyle((s) => ({ ...s, textCase: mode }));
  }, []);

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
    [captionApplyAll],
  );

  const addMediaAsset = useCallback(async (file: File) => {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      const dims = await new Promise<{ w: number; h: number }>((res) => {
        const im = new Image();
        im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
        im.onerror = () => res({ w: 0, h: 0 });
        im.src = url;
      });
      setMediaAssets((prev) => [
        ...prev,
        {
          id: newMediaId(),
          kind: "image",
          url,
          name: file.name,
          duration: 5,
          width: dims.w || undefined,
          height: dims.h || undefined,
        },
      ]);
      return;
    }
    if (file.type.startsWith("video/")) {
      const media = await loadVideoSource(file, file.name);
      setMediaAssets((prev) => [
        ...prev,
        {
          id: newMediaId(),
          kind: "video",
          url: media.url,
          name: media.name,
          duration: media.duration,
          width: media.width,
          height: media.height,
        },
      ]);
    }
  }, []);

  const removeMediaAsset = useCallback((id: string) => {
    setMediaAssets((prev) => prev.filter((m) => m.id !== id));
  }, []);

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
    [mediaAssets],
  );

  // Move a base-track clip up onto a new upper video track (full-frame cutaway).
  // The clip leaves the base (which stays non-empty since it drives the clock).
  const liftClipToTrack = useCallback(
    (clipId: string, timelineStart: number) => {
      if (!source) return;
      const clip = clips.find((c) => c.id === clipId);
      if (!clip || clips.length <= 1) return;
      setOverlays((prev) => [
        ...prev,
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
      ]);
      setClips((prev) => removeClip(prev, clipId));
      setSelectedClipIds((prev) => prev.filter((x) => x !== clipId));
    },
    [source, clips, setClips],
  );

  const moveOverlay = useCallback((id: string, start: number) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, start: Math.max(0, start) } : o)),
    );
  }, []);

  const setOverlayRect = useCallback((id: string, rect: OverlayRect) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...rect } : o)),
    );
  }, []);

  const toggleOverlayHidden = useCallback((id: string) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, hidden: !o.hidden } : o)),
    );
  }, []);

  const toggleOverlayMuted = useCallback((id: string) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, muted: !(o.muted ?? true) } : o)),
    );
  }, []);

  const removeOverlay = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const addAudio = useCallback(async (file: File) => {
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
  }, []);

  const moveAudio = useCallback((id: string, start: number) => {
    setAudioTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, start: Math.max(0, start) } : t)),
    );
  }, []);

  const toggleAudioMuted = useCallback((id: string) => {
    setAudioTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)),
    );
  }, []);

  const removeAudio = useCallback((id: string) => {
    setAudioTracks((prev) => {
      const found = prev.find((t) => t.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const resetTranscript = useCallback(() => {
    setWords([]);
    setTranscribeStatus("idle");
    setTranscribeProgress(0);
    setCaptions([]);
    setSelectedCaptionId(null);
  }, []);

  const loadSource = useCallback(
    (next: StudioSource) => {
      setSource((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return next;
      });
      resetClips(fullClip(next.duration));
      setSelectedClipIds([]);
      resetTranscript();
      setAudioTracks((prev) => {
        prev.forEach((t) => URL.revokeObjectURL(t.url));
        return [];
      });
      setOverlays([]);
      // Keep the media library — it's a library, not part of the edit state.
    },
    [resetClips, resetTranscript],
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

  const clearSource = useCallback(() => {
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    resetClips([]);
    setSelectedClipIds([]);
    resetTranscript();
    setAudioTracks((prev) => {
      prev.forEach((t) => URL.revokeObjectURL(t.url));
      return [];
    });
  }, [resetClips, resetTranscript]);

  // Pick up a recording handed over from the practice flow (Record -> Edit).
  useEffect(() => {
    const blob = consumePendingVideo();
    if (!blob) return;
    loadVideoSource(blob, "Practice take")
      .then(loadSource)
      .catch(() => {});
  }, [loadSource]);

  const splitAt = useCallback(
    (sourceTime: number) => {
      setClips((prev) => splitAtSource(prev, sourceTime));
    },
    [setClips],
  );

  const deleteSelected = useCallback(() => {
    setClips((prev) =>
      selectedClipId ? removeClip(prev, selectedClipId) : prev,
    );
    setSelectedClipIds([]);
  }, [setClips, selectedClipId]);

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
      const next = clips.map((c) => {
        const b = speechBoundsInRange(analysis, c.start, c.end);
        if (!b) return c; // no speech in this clip -> leave it
        const start = Math.max(c.start, b.start - 0.05);
        const end = Math.min(c.end, b.end + 0.08);
        return end - start < 0.1 || (start === c.start && end === c.end)
          ? c
          : { ...c, start, end };
      });
      const changed = next.reduce((n, c, i) => (c !== clips[i] ? n + 1 : n), 0);
      if (changed > 0) setClips(() => next);
      return changed;
    } finally {
      setDetecting(false);
    }
  }, [source, clips, setClips]);

  // Decoded audio -> words. Prefers the hosted backend (best accuracy) and falls
  // back to on-device Whisper when no key is configured or the request fails.
  const wordsFromAudio = useCallback(
    async (audio: Float32Array): Promise<Word[]> => {
      let raw = null as Awaited<ReturnType<typeof transcribeRemote>>;
      try {
        raw = await transcribeRemote(audio);
      } catch {
        raw = null;
      }
      if (!raw) {
        raw = await transcribeAudio(audio, (p) => {
          if (p.status === "loading" && typeof p.progress === "number") {
            setTranscribeStatus("loading");
            setTranscribeProgress(Math.round(p.progress));
          } else if (p.status === "transcribing") {
            setTranscribeStatus("transcribing");
          }
        });
      }
      // Correct approximate word times against the precise VAD edges.
      const segments = detectSpeechSegments(audio);
      return refineWordTimings(
        raw.map((w, i) => ({ id: newWordId(i), ...w })),
        segments,
      );
    },
    [],
  );

  const transcribe = useCallback(async (): Promise<void> => {
    if (!source || source.kind === "image") return;
    // Neutral "Transcribing…" up front; "Downloading speech model" is only for
    // the on-device fallback, and only while it actually downloads.
    setTranscribeStatus("transcribing");
    setTranscribeProgress(0);
    try {
      const audio = await decodeToMono16k(source.url);
      setWords(await wordsFromAudio(audio));
      setTranscribeStatus("done");
    } catch {
      setTranscribeStatus("error");
    }
  }, [source, wordsFromAudio]);

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

  // Clean up retakes: an LLM marks earlier attempts of restarted lines (and
  // stumbles/self-corrections) as struck-through for review — not removed.
  // Returns count, or -1 (no AI key) / -2 (request failed).
  const aiRemoveMistakes = useCallback(async (): Promise<number> => {
    if (words.length === 0) return 0;
    setAiCleaning(true);
    try {
      const cuts = await cleanTranscriptRemote(words);
      if (cuts === null) return -1;
      const ranges = cuts
        .map(([i, j]) => [words[i].start, words[j].end] as [number, number])
        .filter(([a, b]) => b > a);
      applyCuts(ranges);
      return ranges.length;
    } catch {
      return -2;
    } finally {
      setAiCleaning(false);
    }
  }, [words, applyCuts]);

  // One-click clean up: transcribe (if needed), trim each clip's silence, remove
  // AI-flagged mistakes/retakes and pauses, then generate captions with sensible
  // defaults. Everything is computed into local variables so each step sees the
  // result of the previous one without waiting on React state to flush.
  const autoEdit = useCallback(async (): Promise<void> => {
    if (!source || source.kind === "image") return;
    setAutoEditing(true);
    try {
      const audio = await decodeToMono16k(source.url);

      // 1. Ensure we have a transcript.
      let w = words;
      if (w.length === 0) {
        setTranscribeStatus("transcribing");
        setTranscribeProgress(0);
        try {
          w = await wordsFromAudio(audio);
          setWords(w);
          setTranscribeStatus("done");
        } catch {
          setTranscribeStatus("error");
        }
      }

      // 2. Trim each clip's start/end down to speech.
      let next = clips;
      try {
        const analysis = analyzeForTrim(audio);
        next = next.map((c) => {
          const b = speechBoundsInRange(analysis, c.start, c.end);
          if (!b) return c;
          const start = Math.max(c.start, b.start - 0.05);
          const end = Math.min(c.end, b.end + 0.08);
          return end - start < 0.1 ? c : { ...c, start, end };
        });
      } catch {
        // leave clips as-is if the waveform can't be analysed
      }

      if (w.length > 0) {
        // 3. Remove AI-flagged mistakes/retakes.
        try {
          const cuts = await cleanTranscriptRemote(w);
          if (cuts) {
            for (const [i, j] of cuts) {
              const a = w[i]?.start;
              const b = w[j]?.end;
              if (a != null && b != null && b > a) {
                next = removeSourceRange(next, a, b);
              }
            }
          }
        } catch {
          // skip mistake removal if the service is unavailable
        }

        // 4. Cut pauses (plus leading/trailing dead air).
        const ranges = pauseRanges(w);
        const first = w[0];
        const last = w[w.length - 1];
        if (first.start >= 0.5) ranges.unshift([0, first.start - 0.05]);
        if (source.duration - last.end >= 0.5) {
          ranges.push([last.end + 0.1, source.duration]);
        }
        for (const [from, to] of ranges) {
          next = removeSourceRange(next, from, to);
        }
      }

      setClips(() => next);

      // 5. Caption defaults: normal case, 3 words per caption, nudged left.
      setCaptionStyle((s) => ({
        ...s,
        textCase: "none",
        x: 0.35,
        width: 0.6,
      }));
      setCaptionWordsState(3);
      if (w.length > 0) {
        setCaptions(
          generateCaptions(w, next, {
            maxChars: captionLines * 30,
            maxWords: 3,
          }),
        );
      }
    } finally {
      setAutoEditing(false);
    }
  }, [source, words, clips, setClips, wordsFromAudio, captionLines]);

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

  const reset = useCallback(() => {
    resetClips(source ? fullClip(source.duration) : []);
    setSelectedClipIds([]);
  }, [resetClips, source]);

  const value = useMemo<StudioContextValue>(
    () => ({
      source,
      clips,
      selectedClipId,
      detecting,
      words,
      audioTracks,
      transcribeStatus,
      transcribeProgress,
      loadSource,
      clearSource,
      selectClip,
      selectedClipIds,
      toggleClipSelection,
      selectClips,
      splitAt,
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
      liftClipToTrack,
      moveOverlay,
      setOverlayRect,
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
      selectCaption: setSelectedCaptionId,
      setCaptionText,
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
      selectedClipId,
      detecting,
      words,
      audioTracks,
      transcribeStatus,
      transcribeProgress,
      loadSource,
      clearSource,
      selectClip,
      selectedClipIds,
      toggleClipSelection,
      selectClips,
      splitAt,
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
      liftClipToTrack,
      moveOverlay,
      setOverlayRect,
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
      setCaptionText,
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
    ],
  );

  return <StudioContext value={value}>{children}</StudioContext>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
