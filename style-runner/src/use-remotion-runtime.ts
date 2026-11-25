import { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { StyleRuntime } from "../../src/lib/style-library/runtime/style-runtime";
import { remotionMedia } from "./remotion-media";

/** The library's clock and media, driven by the Remotion composition it is drawn in. */
export function useRemotionRuntime(): StyleRuntime {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  return useMemo(
    () => ({
      clock: {
        time: frame / fps,
        fps,
        width,
        height,
        durationS: durationInFrames / fps,
      },
      media: remotionMedia,
    }),
    [frame, fps, width, height, durationInFrames],
  );
}
