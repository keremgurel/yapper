import { DESIGN_FRAME } from "../../runtime/design-frame";
import { COVER } from "./cover-layout";
import { fitTitleSize } from "./fit-title";

const tight = { fontWeight: 700, letterSpacing: "-0.05em" } as const;

/** The series name: a small lead line, the title in an outlined box, the episode in light italics. */
export function TitleBlock({
  lead,
  title,
  episode,
  accent,
  boxFill,
}: {
  lead: string;
  title: string;
  episode: string;
  accent: string;
  boxFill: string;
}) {
  const { box } = COVER;
  const inner =
    DESIGN_FRAME.width - box.left - box.right - (box.border + box.padding) * 2;
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: COVER.lead.top,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: COVER.lead.size,
          ...tight,
        }}
      >
        {lead}
      </div>
      <div
        style={{
          position: "absolute",
          top: box.top,
          left: box.left,
          right: box.right,
          height: box.height,
          boxSizing: "border-box",
          background: boxFill,
          border: `${box.border}px solid ${accent}`,
          borderRadius: box.radius,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: fitTitleSize(title, inner, COVER.title.size),
          whiteSpace: "nowrap",
          ...tight,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          top: COVER.episode.top,
          right: COVER.episode.right,
          fontSize: COVER.episode.size,
          fontWeight: 400,
          fontStyle: "italic",
          letterSpacing: "-0.04em",
        }}
      >
        {episode}
      </div>
    </>
  );
}
