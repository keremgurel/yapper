import type { ReactNode } from "react";
import { DesignFrame } from "../runtime/design-frame";
import { presence, reveal } from "../runtime/presence";
import { useStyleClock } from "../runtime/style-runtime";

const ENTER_S = 0.2;
const EXIT_S = 0.15;
const RISE_PX = 28;

/** Centres its children near the top of the full-frame talking head, with the shared entrance. */
export function FloatTop({
  top,
  children,
}: {
  top: number;
  children: ReactNode;
}) {
  const { time, durationS } = useStyleClock();
  const t = presence(time, durationS, ENTER_S, EXIT_S);
  if (t <= 0) return null;
  return (
    <DesignFrame>
      <div
        style={{
          position: "absolute",
          top,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          ...reveal(t, RISE_PX),
        }}
      >
        {children}
      </div>
    </DesignFrame>
  );
}
