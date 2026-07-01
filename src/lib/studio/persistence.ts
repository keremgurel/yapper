/**
 * Lightweight, refresh-safe persistence for the studio. Only the *edit state*
 * is saved — clips, transcript words, captions, and caption settings — as small
 * JSON in localStorage. The video itself is NOT stored (no giant Blobs in the
 * browser); on restore we re-prompt the user to re-select the same file, then
 * re-apply the saved edits (which are source-time anchored, so they line up).
 */
import type { Caption, Clip, StudioSource, Word } from "@/lib/studio/types";
import type { CaptionStyle } from "@/lib/studio/captions";

const KEY = "yapper-studio-project";

export interface SourceMeta {
  name: string;
  duration: number;
  width?: number;
  height?: number;
  kind?: "video" | "image";
}

export interface ProjectSnapshot {
  v: 2;
  source: SourceMeta;
  clips: Clip[]; // base clips only (appended foreign clips can't be rehydrated)
  words: Word[];
  captions: Caption[];
  captionStyle: CaptionStyle;
  captionLines: number;
  captionWords: number;
  captionApplyAll: boolean;
}

export interface SaveInput {
  source: StudioSource;
  clips: Clip[];
  words: Word[];
  captions: Caption[];
  captionStyle: CaptionStyle;
  captionLines: number;
  captionWords: number;
  captionApplyAll: boolean;
}

export function saveProject(s: SaveInput): void {
  try {
    const snap: ProjectSnapshot = {
      v: 2,
      source: {
        name: s.source.name,
        duration: s.source.duration,
        width: s.source.width,
        height: s.source.height,
        kind: s.source.kind,
      },
      clips: s.clips.filter((c) => !c.src),
      words: s.words,
      captions: s.captions,
      captionStyle: s.captionStyle,
      captionLines: s.captionLines,
      captionWords: s.captionWords,
      captionApplyAll: s.captionApplyAll,
    };
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    // storage unavailable/full — ignore, editing continues
  }
}

export function loadProject(): ProjectSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as ProjectSnapshot;
    if (snap.v !== 2 || !snap.source) return null;
    return snap;
  } catch {
    return null;
  }
}

export function clearProject(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
