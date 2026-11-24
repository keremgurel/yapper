import { eraseStyle, type AnyStyleDefinition } from "./format/style-definition";
import { plainWhiteCaptions } from "./entries/captions-plain-white";
import { smokedGlassCard } from "./entries/card-smoked-glass";
import { seriesCover } from "./entries/cover-series";
import { fullFrame } from "./entries/layout-full-frame";
import { mediaBlock } from "./entries/overlay-media";
import { splitHalfAndHalf } from "./entries/split-half-and-half";
import { splitSpeakerBelow } from "./entries/split-speaker-below";

/** Every first-party building block. Adding one is a folder and a line here. */
export const STYLES: readonly AnyStyleDefinition[] = [
  eraseStyle(plainWhiteCaptions),
  eraseStyle(fullFrame),
  eraseStyle(splitSpeakerBelow),
  eraseStyle(splitHalfAndHalf),
  eraseStyle(smokedGlassCard),
  eraseStyle(mediaBlock),
  eraseStyle(seriesCover),
];

const BY_ID = new Map(STYLES.map((style) => [style.id, style]));

export const getStyle = (id: string): AnyStyleDefinition | undefined =>
  BY_ID.get(id);
