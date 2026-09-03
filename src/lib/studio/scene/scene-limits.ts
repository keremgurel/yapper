/** The caps in docs/overlay-scene-format.md, mirrored by Swift `SceneLimits`. */
export const SCENE_LIMITS = {
  version: 1,
  maxNodes: 64,
  maxAnimations: 96,
  maxTextLength: 120,
  maxPathBytes: 4096,
  maxIdLength: 40,
  maxGroupDepth: 3,
  maxImages: 2,
  minDuration: 0.5,
  maxDuration: 30,
  position: { min: -0.5, max: 1.5 },
  size: { min: 0.001, max: 1.5 },
  textSize: { min: 0.01, max: 1 },
  strokeWidth: { min: 0, max: 0.2 },
  cornerRadius: { min: 0, max: 1 },
  lineHeight: { min: 0.8, max: 2 },
  stagger: { min: 0, max: 2 },
  /** Text shorter than this fraction of the frame height is unreadable. */
  minLegibleFrameFraction: 0.022,
  /** Where the library still is taken when the designer did not say. */
  defaultPosterFraction: 0.6,
} as const;
