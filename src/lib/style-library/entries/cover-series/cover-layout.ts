/** Positions on the 1080 x 1920 frame, measured off the Ep. 9 cover. */
export const COVER = {
  lead: { top: 128, size: 80 },
  box: {
    top: 232,
    left: 46,
    right: 54,
    height: 144,
    border: 3,
    radius: 12,
    padding: 24,
  },
  title: { size: 108 },
  episode: { top: 382, right: 60, size: 84 },
  photo: { left: 46, top: 510, width: 982, height: 1280 },
} as const;
