"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clipTimelineStart,
  sourceToTimeline,
  sourceToTimelineSeq,
  timelineToClip,
  totalDuration,
} from "@/lib/studio/clips";
import { createTimelineClock } from "@/lib/studio/timeline-clock";
import { assetUrl, isNative } from "@/lib/studio/native/bridge";
import { nativeMediaForUrl } from "@/lib/studio/native/path-registry";
import type { Clip } from "@/lib/studio/types";

const EPS = 0.03;
// How often the COARSE `timelineTime`/`sourceTime` React state updates during
// continuous playback. This is what re-renders the whole timeline tree (and
// everything under the workspace root), so it stays far below frame rate —
// captions and the transcript highlight are word-level (100s of ms), so this
// is still fluid for them. The playhead line itself doesn't wait on this: it
// reads the per-frame `timelineClock` store directly (see timeline-clock.ts).
const COARSE_UI_INTERVAL_MS = 125;

export interface PlaybackInput {
  /** Bottom-track clips. May be empty — overlays and audio still play. */
  clips: Clip[];
  /** Length of the whole project (longest layer), not just the bottom track. */
  total: number;
  /** Can the bottom track drive a <video> clock (it exists and isn't a still)? */
  hasVideo: boolean;
  /** Media for clips that don't carry their own `src`. */
  baseUrl: string;
}

/**
 * Drives playback with the *edited timeline* as the master clock.
 *
 * While the playhead is over the bottom track, the <video> element is the clock:
 * its own audio and frames stay in sync for free, and each clip can carry its
 * own `src` (that's how appended videos play). Everywhere else — an empty bottom
 * track, a still-image base, or the stretch of timeline where overlays or audio
 * outlast the bottom track — a rAF clock takes over. The two hand off to each
 * other at the bottom track's end.
 */
export function useStudioPlayback(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  { clips, total, hasVideo, baseUrl }: PlaybackInput,
) {
  const [timelineTime, setTimelineTime] = useState(0);
  const [sourceTime, setSourceTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Per-frame time, for the playhead line only — see timeline-clock.ts.
  const [timelineClock] = useState(() => createTimelineClock(0));
  const activeIndexRef = useRef(0);
  const clockRef = useRef(0);
  const lastRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // Set while we pause the <video> on purpose (a clock handoff or a seek out of
  // the bottom track). Its async 'pause' event must not clear `playing`.
  const silentPauseRef = useRef(false);
  // `currentTime` changes asynchronously. Keep an explicit generation instead
  // of trusting `video.seeking`, which WebKit may not flip until the task after
  // the assignment (allowing an immediate play to leak a stale frame).
  const seekGenerationRef = useRef(0);
  const seekPendingRef = useRef(false);
  const baseTotal = totalDuration(clips);

  // The identity url (used for export, snapping, etc.) always stays the
  // original file. Playback alone swaps in the low-res dense-keyframe proxy
  // once it's ready — cheap to decode, so scrubbing doesn't hop to the
  // nearest sparse keyframe on the source HEVC. Falls back to the original
  // until the proxy lands, or forever if one was never built (the web path).
  const playbackUrl = useCallback((url: string): string => {
    if (!isNative()) return url;
    const proxyPath = nativeMediaForUrl(url)?.proxyPath;
    return proxyPath ? assetUrl(proxyPath) : url;
  }, []);

  const clipUrl = useCallback(
    (i: number) => playbackUrl(clips[i]?.src?.url ?? baseUrl),
    [clips, baseUrl, playbackUrl],
  );

  /** Is `t` over the bottom track, so the <video> should be the clock? */
  const overBaseTrack = useCallback(
    (t: number) => hasVideo && t < baseTotal - EPS,
    [hasVideo, baseTotal],
  );

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const pauseVideoSilently = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.paused) return;
    silentPauseRef.current = true;
    v.pause();
  }, [videoRef]);

  // Seeking is async: `currentTime` reads back the TARGET synchronously the
  // instant it's set, even though the decoded frame lands a beat later
  // (longer still on a sparse-keyframe source) — so comparing currentTime to
  // the target cannot tell you whether a seek is still in flight. That's what
  // made an earlier fix incomplete: it only waited when THIS call was the one
  // setting currentTime, but a seek from an earlier call (a scrub, say) can
  // still be unresolved when a separate, later `play()` comes in and finds
  // currentTime already "correct."
  //
  // Waiting for `v.seeking` to clear (checked here, and via the `seeked`
  // event below) is still not quite enough on its own: `seeking`/`seeked`
  // reflect the DECODE finishing, not the resulting frame actually being
  // PAINTED — those can be a beat apart, and playing the instant `seeked`
  // fires can still show one stale frame before the correct one composites,
  // which is the residual hop. `requestVideoFrameCallback` fires once a
  // frame has genuinely been presented, so waiting for ONE more of those
  // after `seeked` is the real "it's safe to resume now" signal. Every cut
  // boundary during normal playback of an edited clip runs through this
  // same path, not just an explicit scrub, so this is what was making a
  // heavily-cut video feel continuously choppy.
  const seekThenPlay = useCallback(
    (v: HTMLVideoElement, generation = seekGenerationRef.current) => {
      if (!seekPendingRef.current && !v.seeking) {
        void v.play().catch(() => {});
        return;
      }
      const vfc = v as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      };
      let settled = false;
      const resumePlaying = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        v.removeEventListener("seeked", onSeeked);
        // A newer scrub superseded this one. Its own completion is the only
        // event allowed to restart playback.
        if (generation !== seekGenerationRef.current) return;
        seekPendingRef.current = false;
        void v.play().catch(() => {});
      };
      const onSeeked = () => {
        if (generation !== seekGenerationRef.current) {
          resumePlaying();
          return;
        }
        if (typeof vfc.requestVideoFrameCallback === "function") {
          vfc.requestVideoFrameCallback(resumePlaying);
        } else {
          resumePlaying();
        }
      };
      // Broken media can omit `seeked`/rVFC. The timeout is deliberately long
      // enough for a sparse-keyframe 4K HEVC seek; the previous 400ms fallback
      // was the source of the visible "boosted frame" hop.
      const timer = setTimeout(resumePlaying, 2500);
      v.addEventListener("seeked", onSeeked, { once: true });
    },
    [],
  );

  // A paused scrub may finish before the user presses Play. Remember that
  // completion so Play can start immediately instead of waiting for an event
  // that already happened.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onSeeked = () => {
      seekPendingRef.current = false;
    };
    v.addEventListener("seeked", onSeeked);
    return () => v.removeEventListener("seeked", onSeeked);
  }, [videoRef]);

  const beginSeek = useCallback(
    (v: HTMLVideoElement, srcTime: number, resume: boolean) => {
      if (resume && !v.paused) pauseVideoSilently();
      const generation = ++seekGenerationRef.current;
      seekPendingRef.current = true;
      v.currentTime = srcTime;
      if (resume) seekThenPlay(v, generation);
    },
    [pauseVideoSilently, seekThenPlay],
  );

  // Point the <video> at clip `index` and seek to `srcTime`, switching the media
  // source first if this clip uses a different one. Resumes play if `resume`.
  const seekVideo = useCallback(
    (index: number, srcTime: number, resume: boolean) => {
      const v = videoRef.current;
      if (!v) return;
      const url = clipUrl(index);
      if (v.getAttribute("src") !== url) {
        if (resume && !v.paused) pauseVideoSilently();
        const generation = ++seekGenerationRef.current;
        seekPendingRef.current = true;
        v.setAttribute("src", url);
        v.load();
        const onLoaded = () => {
          if (generation !== seekGenerationRef.current) return;
          v.currentTime = srcTime;
          if (resume) seekThenPlay(v, generation);
        };
        v.addEventListener("loadeddata", onLoaded, { once: true });
        return;
      }
      // Re-seeking to (almost) the current spot makes the decoder re-decode
      // from the previous keyframe, so resuming from a pause visibly replays
      // the last second. Only seek when we are actually somewhere else.
      if (Math.abs(v.currentTime - srcTime) > 0.05) {
        beginSeek(v, srcTime, resume);
      } else if (resume) {
        seekThenPlay(v);
      }
    },
    [videoRef, clipUrl, pauseVideoSilently, beginSeek, seekThenPlay],
  );

  /** Run the synthetic clock from `from` to the project end. */
  const startRaf = useCallback(
    (from: number) => {
      stopRaf();
      clockRef.current = from;
      setTimelineTime(from);
      timelineClock.set(from);
      setPlaying(true);
      lastRef.current = performance.now();
      let rafLastUi = 0;
      const tick = () => {
        const now = performance.now();
        clockRef.current = Math.min(
          total,
          clockRef.current + (now - lastRef.current) / 1000,
        );
        lastRef.current = now;
        // Every frame: the playhead line's own subscription, not React state.
        timelineClock.set(clockRef.current);
        const done = clockRef.current >= total - EPS;
        if (done || now - rafLastUi >= COARSE_UI_INTERVAL_MS) {
          rafLastUi = now;
          setTimelineTime(clockRef.current);
          if (!hasVideo) setSourceTime(clockRef.current);
        }
        if (done) {
          setPlaying(false);
          rafRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [total, hasVideo, stopRaf, timelineClock],
  );

  const applyTimeline = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, total));
      const wasPlaying = playing;
      setTimelineTime(clamped);
      clockRef.current = clamped;
      timelineClock.set(clamped);
      if (overBaseTrack(clamped)) {
        stopRaf();
        const hit = timelineToClip(clips, clamped);
        if (hit && videoRef.current) {
          activeIndexRef.current = hit.index;
          seekVideo(hit.index, hit.sourceTime, wasPlaying);
          setSourceTime(hit.sourceTime);
        }
        return;
      }
      // Past the bottom track (or there isn't one): the rAF clock owns this.
      pauseVideoSilently();
      setSourceTime(clamped);
      if (wasPlaying && clamped < total - EPS) startRaf(clamped);
      else stopRaf();
    },
    [
      videoRef,
      clips,
      total,
      playing,
      overBaseTrack,
      seekVideo,
      startRaf,
      stopRaf,
      pauseVideoSilently,
      timelineClock,
    ],
  );

  const seekToTimeline = useCallback(
    (t: number) => applyTimeline(t),
    [applyTimeline],
  );

  const seekToSource = useCallback(
    (s: number) => {
      // Prefer the exact clip containing `s`. When `s` sits just before a clip
      // (e.g. a word whose start rounds into the preceding cut, but whose
      // midpoint is kept), fall back to the mapped timeline position — the start
      // of that clip — NOT 0, which would jump the playhead to the beginning.
      const found = sourceToTimelineSeq(clips, s);
      applyTimeline(found ? found.timeline : sourceToTimeline(clips, s));
    },
    [clips, applyTimeline],
  );

  const play = useCallback(() => {
    if (total <= 0) return;
    const from = clockRef.current >= total - EPS ? 0 : clockRef.current;
    if (overBaseTrack(from)) {
      const v = videoRef.current;
      if (!v) return;
      const hit = timelineToClip(clips, from);
      if (hit) {
        activeIndexRef.current = hit.index;
        setTimelineTime(from);
        clockRef.current = from;
        timelineClock.set(from);
        seekVideo(hit.index, hit.sourceTime, true);
      }
      return;
    }
    startRaf(from);
  }, [
    videoRef,
    clips,
    total,
    overBaseTrack,
    seekVideo,
    startRaf,
    timelineClock,
  ]);

  const pause = useCallback(() => {
    stopRaf();
    videoRef.current?.pause();
    setPlaying(false);
  }, [videoRef, stopRaf]);

  useEffect(() => stopRaf, [stopRaf]);

  // The clock source changed (the bottom track was deleted, added, or swapped
  // between video and still). Stop, rather than leave `playing` true with the
  // old clock gone and nothing ticking in its place.
  useEffect(() => {
    stopRaf();
    videoRef.current?.pause();
    setPlaying(false);
  }, [hasVideo, stopRaf, videoRef]);

  // Keep the video pointed at the clip under the playhead when the edit changes.
  useEffect(() => {
    if (!hasVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const hit = timelineToClip(clips, clockRef.current);
    if (hit) {
      activeIndexRef.current = hit.index;
      seekVideo(hit.index, hit.sourceTime, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, hasVideo]);

  // Drive the clock and clip-boundary jumps per PRESENTED FRAME
  // (requestVideoFrameCallback), not the ~4Hz `timeupdate` event. At 4Hz the
  // playhead overshoots each cut by up to ~250ms, so the removed region (a
  // retake, a pause) leaks on screen and captions lag; per-frame detection cuts
  // that to a single frame. rAF is the fallback when rVFC is unavailable.
  useEffect(() => {
    if (!hasVideo) return;
    const v = videoRef.current;
    if (!v) return;

    const vfc = v as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (h: number) => void;
    };
    const useRvfc = typeof vfc.requestVideoFrameCallback === "function";
    let handle: number | null = null;
    // True between initiating a boundary jump and its 'seeked' landing. Guards
    // against re-evaluating the boundary while currentTime is still the old
    // value — which, when the next clip is reordered EARLIER in the source,
    // would look "past clip.end" again and skip that clip.
    let seeking = false;
    let seekTarget = 0;
    // Throttles the playhead/caption STATE updates (not the video, not the cut
    // detection) so playback does not re-render the whole timeline 60x/second.
    let lastUi = 0;
    const onSeeked = () => {
      seeking = false;
    };
    v.addEventListener("seeked", onSeeked);

    const cancel = () => {
      if (handle == null) return;
      if (useRvfc) vfc.cancelVideoFrameCallback?.(handle);
      else cancelAnimationFrame(handle);
      handle = null;
    };
    const schedule = () => {
      if (v.paused) return;
      handle = useRvfc
        ? (vfc.requestVideoFrameCallback?.(step) ?? null)
        : requestAnimationFrame(step);
    };

    /** The bottom track just ran out. Either the project ends here, or the rAF
     * clock carries the overlays and audio that outlast it. */
    function endOfBaseTrack() {
      setSourceTime(clips[clips.length - 1].end);
      if (total > baseTotal + EPS) {
        silentPauseRef.current = true;
        v!.pause();
        startRaf(baseTotal);
        return;
      }
      v!.pause();
      setTimelineTime(total);
      clockRef.current = total;
      timelineClock.set(total);
    }

    function step() {
      if (seeking) {
        // Clear on the 'seeked' event OR once currentTime actually reaches the
        // target (the event won't fire if the target equalled currentTime).
        if (Math.abs(v!.currentTime - seekTarget) < 0.05) seeking = false;
        else {
          schedule();
          return; // wait for the boundary seek to land before re-evaluating
        }
      }
      const i = activeIndexRef.current;
      const clip = clips[i];
      if (clip) {
        if (v!.currentTime >= clip.end) {
          const next = i + 1;
          if (next >= clips.length) {
            endOfBaseTrack();
            return; // the rAF clock or the end-of-project stop takes it from here
          }
          seeking = true;
          seekTarget = clips[next].start;
          activeIndexRef.current = next;
          seekVideo(next, clips[next].start, !v!.paused);
          const t = clipTimelineStart(clips, next);
          setTimelineTime(t);
          clockRef.current = t;
          timelineClock.set(t);
          setSourceTime(clips[next].start);
          lastUi = performance.now(); // a cut always updates the UI at once
        } else if (v!.currentTime < clip.start - EPS) {
          v!.currentTime = clip.start;
        } else {
          const t = clipTimelineStart(clips, i) + (v!.currentTime - clip.start);
          clockRef.current = t;
          // The <video> paints its own frames at full rate. The playhead line
          // reads this every frame via its own subscription (no re-render);
          // these two calls only move the caption/transcript highlight and the
          // time readout, so they stay coarse — at 60fps they'd re-render the
          // whole timeline tree and starve the audio. Playback and cut
          // detection read the ref, untouched.
          timelineClock.set(t);
          const now = performance.now();
          if (now - lastUi >= COARSE_UI_INTERVAL_MS) {
            lastUi = now;
            setTimelineTime(t);
            setSourceTime(v!.currentTime);
          }
        }
      }
      schedule();
    }

    const onPlay = () => {
      stopRaf(); // the video is the clock again
      setPlaying(true);
      cancel();
      schedule();
    };
    const onPause = () => {
      cancel();
      // A handoff or a seek out of the bottom track paused it deliberately —
      // the rAF clock is (or is about to be) running, so playback continues.
      if (silentPauseRef.current) {
        silentPauseRef.current = false;
        return;
      }
      setPlaying(false);
    };
    const onEnded = () => {
      cancel();
      if (silentPauseRef.current) return;
      setPlaying(false);
      setTimelineTime(total);
      clockRef.current = total;
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    if (!v.paused) schedule();
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("seeked", onSeeked);
      cancel();
    };
  }, [
    videoRef,
    clips,
    total,
    baseTotal,
    hasVideo,
    seekVideo,
    startRaf,
    stopRaf,
    timelineClock,
  ]);

  return {
    timelineTime,
    timelineClock,
    sourceTime,
    playing,
    play,
    pause,
    seekToTimeline,
    seekToSource,
  };
}
