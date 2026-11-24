import { useStyleMedia } from "../../runtime/style-runtime";
import type { SplitGeometry } from "./split-geometry";

/**
 * The take, scaled whole into a card at the bottom of the frame. Hard edges
 * and rounded top corners: no feathering on any backdrop.
 */
export function SpeakerCard({
  take,
  geometry,
  radius,
  edgeLine,
}: {
  take: string;
  geometry: Pick<SplitGeometry, "speaker" | "take">;
  radius: number;
  edgeLine: boolean;
}) {
  const { Video } = useStyleMedia();
  return (
    <div
      style={{
        position: "absolute",
        ...geometry.speaker,
        overflow: "hidden",
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
      }}
    >
      <Video src={take} style={{ position: "absolute", ...geometry.take }} />
      {edgeLine ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.16)",
          }}
        />
      ) : null}
    </div>
  );
}
