"use client";

import { useMemo } from "react";
import type { StyleProps } from "../../format/style-definition";
import { DesignFrame } from "../../runtime/design-frame";
import { clamp01 } from "../../runtime/easing";
import { useStyleClock } from "../../runtime/style-runtime";
import { faintTextShadow, interStack } from "../../shared/ink";
import { chunkWords } from "./chunk-words";
import type { CaptionContentSpecs } from "./content";
import type { CaptionOptionSpecs } from "./options";

const FADE_FRAMES = 3;
const RISE_FRAMES = 4;
const RISE_PX = 8;
/** `y` is the middle of the first line; the block starts this far above it. */
const FIRST_LINE_OFFSET = 30;

/**
 * Two or three words at a time in heavy white. A short fade and a small rise,
 * nothing else. The height is one number: a split hands over its seam, so the
 * captions change place on a cut and never travel.
 */
export function PlainWhiteCaptions({
  options,
  content,
}: StyleProps<CaptionOptionSpecs, CaptionContentSpecs>) {
  const { time, fps } = useStyleClock();
  const chunks = useMemo(
    () => chunkWords(content.words, options.maxWords),
    [content.words, options.maxWords],
  );
  const chunk = chunks.find((c) => time >= c.start && time < c.end);
  if (!chunk) return null;

  const frames = (time - chunk.start) * fps;

  return (
    <DesignFrame>
      <div
        style={{
          position: "absolute",
          top: options.y - FIRST_LINE_OFFSET,
          left: options.sideMargin,
          right: options.sideMargin,
          textAlign: "center",
          fontFamily: interStack,
          fontWeight: Number(options.weight),
          fontSize: options.fontSize,
          lineHeight: 1.08,
          letterSpacing: -0.5,
          color: options.color,
          opacity: clamp01(frames / FADE_FRAMES),
          transform: `translateY(${RISE_PX * (1 - clamp01(frames / RISE_FRAMES))}px)`,
          textShadow: options.shadow ? faintTextShadow : undefined,
        }}
      >
        {chunk.text}
      </div>
    </DesignFrame>
  );
}
