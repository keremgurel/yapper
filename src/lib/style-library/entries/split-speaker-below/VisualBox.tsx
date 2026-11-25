import type { ReactNode } from "react";
import { presence, reveal } from "../../runtime/presence";
import { useStyleClock } from "../../runtime/style-runtime";
import { interStack } from "../../shared/ink";
import type { Box } from "./split-geometry";

const ENTER_S = 0.15;
const EXIT_S = 0.1;
const RISE_PX = 16;

/** The area above the speaker. Its content rises in quickly and leaves faster. */
export function VisualBox({
  box,
  children,
}: {
  box: Box;
  children: ReactNode;
}) {
  const { time, durationS } = useStyleClock();
  const t = presence(time, durationS, ENTER_S, EXIT_S);
  if (t <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        ...box,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: interStack,
        color: "#FFFFFF",
        ...reveal(t, RISE_PX),
      }}
    >
      {children}
    </div>
  );
}
