import type { ReactNode } from "react";
import { DESIGN_FRAME } from "../../runtime/design-frame";
import { interStack } from "../../shared/ink";

/** Everything above the camera. Whatever is put here is centred, or fills it when it asks to. */
export function TopArea({
  height,
  inset,
  children,
}: {
  height: number;
  inset: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: inset,
        top: inset,
        width: DESIGN_FRAME.width - inset * 2,
        height: Math.max(0, height - inset * 2),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        fontFamily: interStack,
        color: "#FFFFFF",
      }}
    >
      {children}
    </div>
  );
}
