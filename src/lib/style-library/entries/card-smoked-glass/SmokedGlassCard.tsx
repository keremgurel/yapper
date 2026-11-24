import type { StyleProps } from "../../format/style-definition";
import { FloatTop } from "../../shared/FloatTop";
import type { GlassContentSpecs } from "./content";
import { GlassSurface } from "./GlassSurface";
import type { GlassOptionSpecs } from "./options";
import { StatBody } from "./StatBody";

/**
 * The smoked-glass card with a stat on it. On the full frame it floats near
 * the top with its own entrance. In a slot it leaves position and entrance to
 * the layout it sits in.
 */
export function SmokedGlassCard({
  options,
  content,
  placement,
}: StyleProps<GlassOptionSpecs, GlassContentSpecs>) {
  const inSlot = placement === "slot";
  const card = (
    <GlassSurface
      look={options}
      style={{
        padding: "30px 44px",
        transform: `scale(${options.scale})`,
        transformOrigin: inSlot ? "center" : "top center",
      }}
    >
      <StatBody {...content} />
    </GlassSurface>
  );
  return inSlot ? card : <FloatTop top={options.top}>{card}</FloatTop>;
}
