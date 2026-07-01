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
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import { transcribeAudio } from "@/lib/studio/transcribe";
import { transcribeRemote } from "@/lib/studio/transcribe-remote";
import { cleanTranscriptRemote } from "@/lib/studio/clean-transcript";
import { consumePendingVideo } from "@/lib/studio/handoff";
import { loadVideoSource } from "@/lib/studio/load-source";
import { useClipHistory } from "@/hooks/use-clip-history";
import {
  newAudioId,
  newClipId,
  newMediaId,
  newOverlayId,
  newWordId,
  type AudioTrack,
  type Clip,
  type MediaAsset,
  type Overlay,
  type OverlayRect,
  type StudioSource,
  type Word,
} from "@/lib/studio/types";

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
  detecting: boolean;
  words: Word[];
  audioTracks: AudioTrack[];
  transcribeStatus: TranscribeStatus;
  transcribeProgress: number;
  loadSource: (source: StudioSource) => void;
  clearSource: () => void;
  selectClip: (id: string | null) => void;
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
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [transcribeStatus, setTranscribeStatus] =
    useState<TranscribeStatus>("idle");
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const [aiCleaning, setAiCleaning] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [snapping, setSnapping] = useState(true);

  const toggleSnapping = useCallback(() => setSnapping((s) => !s), []);

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
      setSelectedClipId((cur) => (cur === clipId ? null : cur));
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
  }, []);

  const loadSource = useCallback(
    (next: StudioSource) => {
      setSource((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return next;
      });
      resetClips(fullClip(next.duration));
      setSelectedClipId(null);
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
    setSelectedClipId(null);
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
    setSelectedClipId(null);
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

  const transcribe = useCallback(async (): Promise<void> => {
    if (!source || source.kind === "image") return;
    // Neutral "Transcribing…" up front; "Downloading speech model" is only for
    // the on-device fallback, and only while it actually downloads.
    setTranscribeStatus("transcribing");
    setTranscribeProgress(0);
    try {
      const audio = await decodeToMono16k(source.url);
      // Prefer the hosted backend (best accuracy); fall back to on-device Whisper
      // when no provider key is configured or the request fails.
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
      const words = refineWordTimings(
        raw.map((w, i) => ({ id: newWordId(i), ...w })),
        segments,
      );
      setWords(words);
      setTranscribeStatus("done");
    } catch {
      setTranscribeStatus("error");
    }
  }, [source]);

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
    setSelectedClipId(null);
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
      selectClip: setSelectedClipId,
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
