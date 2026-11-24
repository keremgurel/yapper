import type { CSSProperties, ReactNode } from "react";
import { useStyleClock } from "./style-runtime";

/** Every measured value in the library is a pixel on this vertical frame. */
export const DESIGN_FRAME = { width: 1080, height: 1920 } as const;

const fill: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
};

/**
 * Draws its children on the 1080 x 1920 design frame and scales the result to
 * the real output, so a style keeps its measured pixels at any render size.
 */
export function DesignFrame({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { width } = useStyleClock();
  return (
    <div style={fill}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: DESIGN_FRAME.width,
          height: DESIGN_FRAME.height,
          transform: `scale(${width / DESIGN_FRAME.width})`,
          transformOrigin: "0 0",
          overflow: "hidden",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
