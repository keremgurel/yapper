import type { StyleProps } from "../../format/style-definition";
import { DesignFrame } from "../../runtime/design-frame";
import { useStyleMedia } from "../../runtime/style-runtime";
import { dotGridBackground } from "../../shared/DotGrid";
import { interStack } from "../../shared/ink";
import type { CoverContentSpecs } from "./content";
import { COVER } from "./cover-layout";
import type { CoverOptionSpecs } from "./options";
import { TitleBlock } from "./TitleBlock";

/** The cover every episode of a series shares: title block on a dot grid, the speaker in a big rounded card. */
export function SeriesCover({
  options,
  content,
}: StyleProps<CoverOptionSpecs, CoverContentSpecs>) {
  const { Image } = useStyleMedia();
  return (
    <DesignFrame
      style={{
        fontFamily: interStack,
        color: "#FFFFFF",
        ...dotGridBackground({
          base: options.background,
          spacing: options.dotSpacing,
          dot: 1.2,
          edge: 0.4,
          opacity: options.dotOpacity,
        }),
      }}
    >
      <div
        style={{
          position: "absolute",
          ...COVER.photo,
          borderRadius: options.frameRadius,
          overflow: "hidden",
          backgroundColor: "#111111",
        }}
      >
        {content.frame ? (
          <Image
            src={content.frame}
            alt=""
            style={{
              position: "absolute",
              left: content.frameX,
              top: content.frameY,
              width: content.frameWidth,
              maxWidth: "none",
            }}
          />
        ) : null}
      </div>
      <TitleBlock
        lead={content.lead}
        title={content.title}
        episode={content.episode}
        accent={options.accent}
        boxFill={options.boxFill}
      />
    </DesignFrame>
  );
}
