import type { CSSProperties, ReactNode } from "react";
import type { OptionValues } from "../../format/option-spec";
import { interStack } from "../../shared/ink";
import { rgba } from "../../shared/rgba";
import type { GlassOptionSpecs } from "./options";

export type GlassLook = Pick<
  OptionValues<GlassOptionSpecs>,
  "tint" | "tintOpacity" | "cornerRadius" | "borderOpacity" | "sheen" | "shadow"
>;

const SHEEN =
  "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)";
const DROP = "0 24px 60px rgba(0,0,0,0.35)";
const HIGHLIGHT = "inset 0 1px 0 rgba(255,255,255,0.18)";

/** The smoked-glass surface as CSS. Every frame is identical whatever moves behind it. */
export function glassSurface(look: GlassLook): CSSProperties {
  const tint = rgba(look.tint, look.tintOpacity);
  const shadows = [
    look.shadow ? DROP : null,
    look.sheen ? HIGHLIGHT : null,
  ].filter(Boolean);
  return {
    background: look.sheen ? `${SHEEN}, ${tint}` : tint,
    border: `1px solid rgba(255,255,255,${look.borderOpacity})`,
    boxShadow: shadows.length > 0 ? shadows.join(", ") : undefined,
    borderRadius: look.cornerRadius,
    fontFamily: interStack,
    color: "#FFFFFF",
  };
}

/** One card surface for every overlay, so a video never mixes two kinds of card. */
export function GlassSurface({
  look,
  style,
  children,
}: {
  look: GlassLook;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return <div style={{ ...glassSurface(look), ...style }}>{children}</div>;
}
