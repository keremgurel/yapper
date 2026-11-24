"use client";

import { useMemo, type ReactNode } from "react";
import { DESIGN_FRAME } from "@/lib/style-library/runtime/design-frame";
import {
  StyleRuntimeProvider,
  type StyleRuntime,
} from "@/lib/style-library/runtime/style-runtime";
import { stageMedia } from "./stage-media";
import { useElementWidth } from "./use-element-width";

const FPS = 30;

/**
 * A 9:16 frame that draws library blocks live in the page. It is the browser
 * counterpart of the Remotion runner: it hands blocks the same clock and
 * media elements, so what plays here is what a render produces.
 */
export default function StyleStage({
  time,
  durationS,
  children,
}: {
  time: number;
  durationS: number;
  children: ReactNode;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const runtime = useMemo<StyleRuntime>(
    () => ({
      clock: {
        time,
        fps: FPS,
        width,
        height: (width * DESIGN_FRAME.height) / DESIGN_FRAME.width,
        durationS,
      },
      media: stageMedia,
    }),
    [time, width, durationS],
  );
  return (
    <div
      ref={ref}
      className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black"
    >
      {width > 0 ? (
        <StyleRuntimeProvider value={runtime}>{children}</StyleRuntimeProvider>
      ) : null}
    </div>
  );
}
