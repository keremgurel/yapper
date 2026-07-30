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
/** How far ahead the hidden decoder runs before an edited cut. */
const HANDOFF_PREROLL_SEC = 0.35;

type VideoBankRef = React.RefObject<
  [HTMLVideoElement | null, HTMLVideoElement | null]
>;

export interface PlaybackInput {
  /** Bottom-track clips. May be empty — overlays and audio still play. */
  clips: Clip[];
  /** Length of the whole project (longest layer), not just the bottom track. */
  total: number;
  /** Can the bottom track drive a <video> clock (it exists and isn't a still)? */
  hasVideo: boolean;
  /** Media for clips that don't carry their own `src`. */
  baseUrl: string;
  /** Whether the bottom track's own audio is muted. */
  baseMuted: boolean;
  /**
   * Desktop-only, already-concatenated base-track preview. Its media time is
   * edited-timeline time, so playback crosses cuts without decoder handoffs.
   */
  continuousPreviewUrl?: string | null;
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
  videoRefs: VideoBankRef,
  {
    clips,
    total,
    hasVideo,
    baseUrl,
    baseMuted,
    continuousPreviewUrl,
  }: PlaybackInput,
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
  // The transport button's intent is distinct from the media element's
  // momentary paused state: WebKit may pause internally while changing source
  // or seeking, but that must not turn a playing session into a user pause.
  const playIntentRef = useRef(false);
  const activeSlotRef = useRef<0 | 1>(0);
  const primingIndexRef = useRef<number | null>(null);
  const primedReadyRef = useRef(false);
  const primedPlayingRef = useRef(false);
  const primedStartRef = useRef(0);
  const primeGenerationRef = useRef(0);
  const baseTotal = totalDuration(clips);
  // WKWebView gives one HTML media element playback ownership at a time.
  // Starting the hidden pre-roll decoder pauses the visible one, so desktop
  // must stay single-decoder until its continuous edit preview is ready.
  const allowStandbyDecoder = !isNative();

  const activeVideo = useCallback(
    () => videoRefs.current[activeSlotRef.current],
    [videoRefs],
  );

  const standbyVideo = useCallback(
    () => videoRefs.current[activeSlotRef.current === 0 ? 1 : 0],
    [videoRefs],
  );

  useEffect(() => {
    const active = activeVideo();
    const standby = standbyVideo();
    if (active) active.muted = baseMuted;
    if (standby) standby.muted = true;
  }, [activeVideo, standbyVideo, baseMuted]);

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
    const v = activeVideo();
    if (!v || v.paused) return;
    silentPauseRef.current = true;
    v.pause();
  }, [activeVideo]);

  // Seeking is async: `currentTime` reads back the TARGET synchronously the
  // instant it's set, even though the decoded frame lands a beat later
  // (longer still on a sparse-keyframe source) — so comparing currentTime to
  // the target cannot tell you whether a seek is still in flight. That's what
  // made an earlier fix incomplete: it only waited when THIS call was the one
  // setting currentTime, but a seek from an earlier call (a scrub, say) can
  // still be unresolved when a separate, later `play()` comes in and finds
  // currentTime already "correct."
  //
  // `seeked` is the usable resume signal in WKWebView. Waiting for
  // requestVideoFrameCallback while the element is paused creates a deadlock:
  // WebKit often won't present another frame until playback starts, so the
  // callback never arrives and the timeout makes every resume feel stuck.
  // The important guard is to never beat `seeked` (the old 400ms fallback did);
  // once it fires, start immediately.
  const seekThenPlay = useCallback(
    (v: HTMLVideoElement, generation = seekGenerationRef.current) => {
      if (!seekPendingRef.current && !v.seeking) {
        void v.play().catch(() => {});
        return;
      }
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
        resumePlaying();
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
    const videos = videoRefs.current.filter(
      (video): video is HTMLVideoElement => video != null,
    );
    const onSeeked = () => {
      seekPendingRef.current = false;
    };
    videos.forEach((video) => video.addEventListener("seeked", onSeeked));
    return () =>
      videos.forEach((video) => video.removeEventListener("seeked", onSeeked));
  }, [videoRefs]);

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
      const v = activeVideo();
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
    [activeVideo, clipUrl, pauseVideoSilently, beginSeek, seekThenPlay],
  );

  const seekContinuousVideo = useCallback(
    (timeline: number, resume: boolean) => {
      const v = activeVideo();
      if (!v || !continuousPreviewUrl) return;
      const target = Math.max(0, Math.min(timeline, baseTotal));
      if (v.getAttribute("src") !== continuousPreviewUrl) {
        if (resume && !v.paused) pauseVideoSilently();
        const generation = ++seekGenerationRef.current;
        seekPendingRef.current = true;
        v.setAttribute("src", continuousPreviewUrl);
        v.load();
        const onLoaded = () => {
          if (generation !== seekGenerationRef.current) return;
          v.currentTime = target;
          if (resume) seekThenPlay(v, generation);
        };
        v.addEventListener("loadeddata", onLoaded, { once: true });
        return;
      }
      if (Math.abs(v.currentTime - target) > 0.05) {
        beginSeek(v, target, resume);
      } else if (resume) {
        seekThenPlay(v);
      }
    },
    [
      activeVideo,
      baseTotal,
      beginSeek,
      continuousPreviewUrl,
      pauseVideoSilently,
      seekThenPlay,
    ],
  );

  const clearStandby = useCallback(() => {
    primeGenerationRef.current += 1;
    primingIndexRef.current = null;
    primedReadyRef.current = false;
    primedPlayingRef.current = false;
    const standby = standbyVideo();
    if (!standby) return;
    standby.pause();
    standby.muted = true;
    standby.style.opacity = "0";
  }, [standbyVideo]);

  /**
   * Decode the next clip on the hidden media element while the current clip is
   * still playing. Once seeked, it is ready to pre-roll without presenting or
   * sounding; the boundary step only swaps visibility/audio ownership.
   */
  const prepareStandby = useCallback(
    (index: number) => {
      if (!allowStandbyDecoder) return;
      if (primingIndexRef.current === index) return;
      const standby = standbyVideo();
      if (!standby || !clips[index]) return;

      const generation = ++primeGenerationRef.current;
      primingIndexRef.current = index;
      primedReadyRef.current = false;
      primedPlayingRef.current = false;
      standby.pause();
      standby.muted = true;
      standby.style.opacity = "0";

      const target = Math.max(0, clips[index].start - HANDOFF_PREROLL_SEC);
      primedStartRef.current = target;
      const markReady = () => {
        if (generation !== primeGenerationRef.current) return;
        primedReadyRef.current = true;
      };
      const seek = () => {
        if (generation !== primeGenerationRef.current) return;
        if (Math.abs(standby.currentTime - target) <= 0.02) {
          markReady();
          return;
        }
        standby.addEventListener("seeked", markReady, { once: true });
        standby.currentTime = target;
      };

      const url = clipUrl(index);
      if (standby.getAttribute("src") === url && standby.readyState >= 1) {
        seek();
      } else {
        standby.setAttribute("src", url);
        standby.load();
        standby.addEventListener("loadedmetadata", seek, { once: true });
      }
    },
    [allowStandbyDecoder, clips, clipUrl, standbyVideo],
  );

  /** Swap to an already-decoding clip without seeking the visible player. */
  const commitStandby = useCallback(
    (nextIndex: number): boolean => {
      if (!allowStandbyDecoder) return false;
      if (primingIndexRef.current !== nextIndex || !primedReadyRef.current) {
        return false;
      }
      const current = activeVideo();
      const next = standbyVideo();
      if (!current || !next) return false;

      // If the clip was too short to pre-roll, start its decoded first frame
      // now. Otherwise it is already running in lockstep, hidden and muted.
      if (next.paused) void next.play().catch(() => {});
      current.muted = true;
      next.muted = baseMuted;
      next.style.opacity = "1";
      current.style.opacity = "0";

      // Change ownership before pausing the outgoing decoder. Its asynchronous
      // pause event must be recognized as belonging to the hidden slot.
      activeSlotRef.current = activeSlotRef.current === 0 ? 1 : 0;
      current.pause();
      primingIndexRef.current = null;
      primedReadyRef.current = false;
      primedPlayingRef.current = false;
      return true;
    },
    [activeVideo, allowStandbyDecoder, standbyVideo, baseMuted],
  );

  /** Run the synthetic clock from `from` to the project end. */
  const startRaf = useCallback(
    (from: number) => {
      stopRaf();
      clockRef.current = from;
      setTimelineTime(from);
      timelineClock.set(from);
      setPlaying(true);
      playIntentRef.current = true;
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
          playIntentRef.current = false;
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
        clearStandby();
        const hit = timelineToClip(clips, clamped);
        if (hit && activeVideo()) {
          activeIndexRef.current = hit.index;
          if (continuousPreviewUrl) {
            seekContinuousVideo(clamped, wasPlaying);
          } else {
            seekVideo(hit.index, hit.sourceTime, wasPlaying);
          }
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
      activeVideo,
      clips,
      total,
      playing,
      overBaseTrack,
      continuousPreviewUrl,
      seekContinuousVideo,
      seekVideo,
      startRaf,
      stopRaf,
      pauseVideoSilently,
      clearStandby,
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
    playIntentRef.current = true;
    const from = clockRef.current >= total - EPS ? 0 : clockRef.current;
    if (overBaseTrack(from)) {
      const v = activeVideo();
      if (!v) return;
      const hit = timelineToClip(clips, from);
      if (hit) {
        activeIndexRef.current = hit.index;
        setTimelineTime(from);
        clockRef.current = from;
        timelineClock.set(from);
        if (continuousPreviewUrl) {
          seekContinuousVideo(from, true);
          return;
        }
        const url = clipUrl(hit.index);
        if (v.getAttribute("src") === url) {
          // This is an explicit user Play after a paused scrub. Let the media
          // element start immediately; WebKit already serializes play behind
          // any seek still in flight. Waiting for our own seek timeout here
          // added a 2.5s dead period and allowed the old resume callback to
          // race the user's transport controls.
          seekGenerationRef.current += 1;
          seekPendingRef.current = false;
          if (Math.abs(v.currentTime - hit.sourceTime) > 0.05) {
            v.currentTime = hit.sourceTime;
          }
          void v.play().catch(() => {});
        } else {
          seekVideo(hit.index, hit.sourceTime, true);
        }
      }
      return;
    }
    startRaf(from);
  }, [
    activeVideo,
    clips,
    total,
    overBaseTrack,
    continuousPreviewUrl,
    seekContinuousVideo,
    clipUrl,
    seekVideo,
    startRaf,
    timelineClock,
  ]);

  const pause = useCallback(() => {
    // Cancel every delayed seek-resume belonging to the previous play request.
    // Without this, pressing Pause after a scrub could be undone later by the
    // old seek's timeout, producing a ghost restart / apparent fast-forward.
    seekGenerationRef.current += 1;
    seekPendingRef.current = false;
    playIntentRef.current = false;
    stopRaf();
    videoRefs.current.forEach((video) => video?.pause());
    clearStandby();
    setPlaying(false);
  }, [videoRefs, stopRaf, clearStandby]);

  useEffect(() => stopRaf, [stopRaf]);

  // Clearing a project (or replacing it with a shorter source) must not leave
  // the old playhead beyond the new duration. Besides the incorrect readout,
  // that stale clock made the next Play start from an unrelated source time.
  useEffect(() => {
    if (clockRef.current <= total + EPS) return;
    const next = total <= EPS ? 0 : total;
    seekGenerationRef.current += 1;
    seekPendingRef.current = false;
    stopRaf();
    videoRefs.current.forEach((video) => video?.pause());
    clearStandby();
    clockRef.current = next;
    timelineClock.set(next);
    setTimelineTime(next);
    setSourceTime(next);
    setPlaying(false);
    playIntentRef.current = false;
  }, [total, stopRaf, timelineClock, videoRefs, clearStandby]);

  // The clock source changed (the bottom track was deleted, added, or swapped
  // between video and still). Stop, rather than leave `playing` true with the
  // old clock gone and nothing ticking in its place.
  useEffect(() => {
    stopRaf();
    videoRefs.current.forEach((video) => video?.pause());
    clearStandby();
    setPlaying(false);
    playIntentRef.current = false;
  }, [hasVideo, stopRaf, videoRefs, clearStandby]);

  // Keep the video pointed at the clip under the playhead when the edit or the
  // desktop's continuous derivative changes. Continuous playback owns slot 0;
  // the second decoder stays paused so WKWebView never has two competing media
  // sessions.
  useEffect(() => {
    if (!hasVideo) return;
    const shouldResume = playIntentRef.current;
    if (continuousPreviewUrl && activeSlotRef.current !== 0) {
      videoRefs.current.forEach((video, index) => {
        video?.pause();
        if (video) video.style.opacity = index === 0 ? "1" : "0";
      });
      activeSlotRef.current = 0;
    }
    clearStandby();
    const v = activeVideo();
    if (!v) return;
    const hit = timelineToClip(clips, clockRef.current);
    if (hit) {
      activeIndexRef.current = hit.index;
      if (continuousPreviewUrl) {
        seekContinuousVideo(clockRef.current, shouldResume);
      } else {
        seekVideo(hit.index, hit.sourceTime, shouldResume);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, hasVideo, continuousPreviewUrl]);

  // Drive the clock and clip-boundary jumps per PRESENTED FRAME
  // (requestVideoFrameCallback), not the ~4Hz `timeupdate` event. At 4Hz the
  // playhead overshoots each cut by up to ~250ms, so the removed region (a
  // retake, a pause) leaks on screen and captions lag; per-frame detection cuts
  // that to a single frame. rAF is the fallback when rVFC is unavailable.
  useEffect(() => {
    if (!hasVideo) return;
    const videos = videoRefs.current.filter(
      (video): video is HTMLVideoElement => video != null,
    );
    if (videos.length === 0) return;

    type FrameVideo = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (h: number) => void;
    };
    let handle: number | null = null;
    let handleVideo: FrameVideo | null = null;
    let handleIsVfc = false;
    // True between initiating a boundary jump and its 'seeked' landing. Guards
    // against re-evaluating the boundary while currentTime is still the old
    // value — which, when the next clip is reordered EARLIER in the source,
    // would look "past clip.end" again and skip that clip.
    let seeking = false;
    // Throttles the playhead/caption STATE updates (not the video, not the cut
    // detection) so playback does not re-render the whole timeline 60x/second.
    let lastUi = 0;
    const onSeeked = (event: Event) => {
      if (event.currentTarget !== activeVideo()) return;
      seeking = false;
      const active = activeVideo();
      if (playIntentRef.current && active?.paused) {
        void active.play().catch(() => {});
      }
    };
    videos.forEach((video) => video.addEventListener("seeked", onSeeked));

    const cancel = () => {
      if (handle == null) return;
      if (handleIsVfc) handleVideo?.cancelVideoFrameCallback?.(handle);
      else cancelAnimationFrame(handle);
      handle = null;
      handleVideo = null;
    };
    const schedule = () => {
      const active = activeVideo() as FrameVideo | null;
      if (!active || active.paused) return;
      handleVideo = active;
      handleIsVfc = typeof active.requestVideoFrameCallback === "function";
      handle = handleIsVfc
        ? (active.requestVideoFrameCallback?.(step) ?? null)
        : requestAnimationFrame(step);
    };

    const startPrimedIfDue = (
      active: HTMLVideoElement,
      clip: Clip,
      nextIndex: number,
    ) => {
      prepareStandby(nextIndex);
      if (
        primingIndexRef.current !== nextIndex ||
        !primedReadyRef.current ||
        primedPlayingRef.current
      ) {
        return;
      }
      const lead = clips[nextIndex].start - primedStartRef.current;
      if (active.currentTime < clip.end - lead) return;
      const standby = standbyVideo();
      if (!standby) return;
      standby.muted = true;
      primedPlayingRef.current = true;
      void standby.play().catch(() => {
        primedPlayingRef.current = false;
      });
    };

    /** The bottom track just ran out. Either the project ends here, or the rAF
     * clock carries the overlays and audio that outlast it. */
    function endOfBaseTrack(active: HTMLVideoElement) {
      clearStandby();
      setSourceTime(clips[clips.length - 1].end);
      if (total > baseTotal + EPS) {
        silentPauseRef.current = true;
        active.pause();
        startRaf(baseTotal);
        return;
      }
      playIntentRef.current = false;
      active.pause();
      setTimelineTime(total);
      clockRef.current = total;
      timelineClock.set(total);
    }

    function step() {
      const active = activeVideo();
      if (!active) return;
      if (seeking) {
        // `currentTime` reports the target before the decoder has presented it,
        // so only the active element's `seeked` event may release this guard.
        schedule();
        return;
      }
      if (continuousPreviewUrl) {
        const t = Math.min(active.currentTime, baseTotal);
        if (t >= baseTotal - EPS) {
          endOfBaseTrack(active);
          return;
        }
        clockRef.current = t;
        timelineClock.set(t);
        const now = performance.now();
        if (now - lastUi >= COARSE_UI_INTERVAL_MS) {
          lastUi = now;
          setTimelineTime(t);
          const hit = timelineToClip(clips, t);
          if (hit) setSourceTime(hit.sourceTime);
        }
        schedule();
        return;
      }
      const i = activeIndexRef.current;
      const clip = clips[i];
      if (clip) {
        const next = i + 1;
        if (next < clips.length) startPrimedIfDue(active, clip, next);

        if (active.currentTime >= clip.end) {
          if (next >= clips.length) {
            endOfBaseTrack(active);
            return;
          }

          activeIndexRef.current = next;
          if (!commitStandby(next)) {
            // The bank normally prepares at the start of the current clip. If
            // an unusually short clip ended before that seek landed, retain a
            // correct fallback instead of playing removed source seconds.
            seeking = true;
            const seekTarget = clips[next].start;
            const nextUrl = clipUrl(next);
            if (active.getAttribute("src") === nextUrl) {
              seekGenerationRef.current += 1;
              seekPendingRef.current = true;
              active.currentTime = seekTarget;
            } else {
              seekVideo(next, seekTarget, !active.paused);
            }
          } else {
            seeking = false;
            prepareStandby(next + 1);
          }

          const t = clipTimelineStart(clips, next);
          setTimelineTime(t);
          clockRef.current = t;
          timelineClock.set(t);
          setSourceTime(clips[next].start);
          lastUi = performance.now();
        } else if (active.currentTime < clip.start - EPS) {
          active.currentTime = clip.start;
        } else {
          const t =
            clipTimelineStart(clips, i) + (active.currentTime - clip.start);
          clockRef.current = t;
          timelineClock.set(t);
          const now = performance.now();
          if (now - lastUi >= COARSE_UI_INTERVAL_MS) {
            lastUi = now;
            setTimelineTime(t);
            setSourceTime(active.currentTime);
          }
        }
      }
      schedule();
    }

    const onPlay = (event: Event) => {
      // The hidden standby pre-rolls muted; it must not seize clock ownership
      // or re-run the user-facing Play transition.
      if (event.currentTarget !== activeVideo()) return;
      playIntentRef.current = true;
      stopRaf();
      setPlaying(true);
      cancel();
      schedule();
    };
    const onPause = (event: Event) => {
      if (event.currentTarget !== activeVideo()) return;
      cancel();
      if (silentPauseRef.current) {
        silentPauseRef.current = false;
        return;
      }
      if (playIntentRef.current) return;
      setPlaying(false);
    };
    const onEnded = (event: Event) => {
      if (event.currentTarget !== activeVideo()) return;
      cancel();
      if (silentPauseRef.current) return;
      playIntentRef.current = false;
      setPlaying(false);
      setTimelineTime(total);
      clockRef.current = total;
    };

    videos.forEach((video) => {
      video.addEventListener("play", onPlay);
      video.addEventListener("pause", onPause);
      video.addEventListener("ended", onEnded);
    });
    const active = activeVideo();
    if (active && !active.paused) schedule();
    return () => {
      videos.forEach((video) => {
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("seeked", onSeeked);
      });
      cancel();
    };
  }, [
    videoRefs,
    clips,
    total,
    baseTotal,
    hasVideo,
    continuousPreviewUrl,
    activeVideo,
    standbyVideo,
    clipUrl,
    seekVideo,
    prepareStandby,
    commitStandby,
    clearStandby,
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
