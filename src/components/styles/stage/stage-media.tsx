"use client";

import { useEffect, useRef } from "react";
import { isStillSource } from "@/lib/style-library/runtime/still-source";
import {
  useStyleClock,
  type StyleMedia,
  type StyleMediaProps,
} from "@/lib/style-library/runtime/style-runtime";

/** A bare path is a file in the site's public folder; anything else is used as given. */
const resolve = (src: string) =>
  /^(https?:|data:|blob:|\/)/.test(src) ? src : `/${src}`;

/** How far a clip may wander from the clock before it is pulled back. */
const DRIFT_S = 0.3;

/**
 * A clip that plays by itself and is nudged back to the stage clock when it
 * drifts or the loop wraps. Always silent: a gallery should not start talking.
 */
function StageClip({ src, style }: StyleMediaProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const { time } = useStyleClock();
  useEffect(() => {
    const video = ref.current;
    if (!video || video.readyState < 1) return;
    const target = video.duration ? time % video.duration : time;
    if (Math.abs(video.currentTime - target) > DRIFT_S) {
      video.currentTime = target;
    }
    if (video.paused) void video.play().catch(() => {});
  }, [time]);
  return (
    <video
      ref={ref}
      src={resolve(src)}
      style={style}
      muted
      playsInline
      loop
      preload="auto"
    />
  );
}

function StageImage({ src, style, alt = "" }: StyleMediaProps) {
  // Blocks size media with their own measured styles, which next/image would fight.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolve(src)} style={style} alt={alt} />;
}

/** A drawn stand-in or a picture in a clip's place is shown as the image it is. */
function StageVideo(props: StyleMediaProps) {
  return isStillSource(props.src) ? (
    <StageImage {...props} />
  ) : (
    <StageClip {...props} />
  );
}

/** The library's media elements drawn as plain DOM, for a live preview in the page. */
export const stageMedia: StyleMedia = { Video: StageVideo, Image: StageImage };
