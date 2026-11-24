import { DESIGN_FRAME } from "../../runtime/design-frame";
import { useStyleMedia } from "../../runtime/style-runtime";

/**
 * The take cropped to fill everything below `top`. Its own shape is not kept:
 * the area is wider than it is tall, so the sides stay and the top and bottom
 * of the take go.
 */
export function CameraArea({
  take,
  top,
  zoom,
  focusY,
}: {
  take: string;
  top: number;
  zoom: number;
  focusY: number;
}) {
  const { Video } = useStyleMedia();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top,
        width: DESIGN_FRAME.width,
        height: DESIGN_FRAME.height - top,
        overflow: "hidden",
      }}
    >
      <Video
        src={take}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `50% ${focusY * 100}%`,
          transform: `scale(${zoom})`,
          transformOrigin: `50% ${focusY * 100}%`,
        }}
      />
    </div>
  );
}
