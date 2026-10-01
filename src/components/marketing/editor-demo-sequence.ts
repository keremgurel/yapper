/** Deterministic sample edit: source positions never change when gaps close. */
export const editSegments = [
  {
    duration: 12,
    text: "I spent weeks choosing a camera before I made my first video. Every review gave me another reason to wait.",
    kind: "keep",
  },
  {
    duration: 7,
    text: "The thing about making videos is, the thing about—sorry, let me start that again.",
    kind: "retake",
    removeAt: 5,
  },
  {
    duration: 12,
    text: "I thought better equipment would make me feel ready. But the camera was never the part I was afraid of.",
    kind: "keep",
  },
  { duration: 5, text: "5.0s pause", kind: "pause", removeAt: 9 },
  {
    duration: 15,
    text: "So I put my phone on a stack of books, faced the window, and picked one idea I could explain to a friend.",
    kind: "keep",
  },
  {
    duration: 6,
    text: "I recorded it in one—no, that’s not right. It took a few tries.",
    kind: "retake",
    removeAt: 5,
  },
  {
    duration: 13,
    text: "The first take was awkward. I talked too fast, lost my point halfway through, and nearly deleted the whole thing.",
    kind: "keep",
  },
  { duration: 4, text: "4.0s pause", kind: "pause", removeAt: 9 },
  {
    duration: 12,
    text: "But listening back gave me something another camera review never could: one specific thing to improve in the next take.",
    kind: "keep",
  },
  {
    duration: 5,
    text: "You don’t need to be perfect. You don’t need to be—let me say that differently.",
    kind: "retake",
    removeAt: 5,
  },
  {
    duration: 14,
    text: "You learn by making the video. Keep the useful parts, cut the detours, and make it easier for someone to follow your idea.",
    kind: "keep",
  },
  { duration: 6, text: "6.0s pause", kind: "pause", removeAt: 9 },
  {
    duration: 12,
    text: "Start with what you have. Pick the idea you keep thinking about and record it today. You can make the next one better.",
    kind: "keep",
  },
].map((segment, index, all) => ({
  ...segment,
  start: all.slice(0, index).reduce((sum, item) => sum + item.duration, 0),
}));
export const sourceDuration = editSegments.reduce(
  (sum, segment) => sum + segment.duration,
  0,
);
export const editorFrameCount = 17;
export const formatDemoTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function getEditState(frame: number) {
  const clips = editSegments.map((segment, index) => ({
    ...segment,
    deleted: segment.removeAt !== undefined && frame >= segment.removeAt,
    selected: segment.removeAt !== undefined && frame === segment.removeAt - 1,
    offset:
      segment.start -
      editSegments
        .slice(0, index)
        .reduce(
          (removed, previous) =>
            removed +
            (previous.removeAt !== undefined && frame > previous.removeAt
              ? previous.duration
              : 0),
          0,
        ),
  }));
  const duration = clips.reduce(
    (sum, clip) => sum + (clip.deleted ? 0 : clip.duration),
    0,
  );
  const target =
    clips.find((clip) => clip.selected) ??
    clips.find(
      (clip) =>
        clip.removeAt !== undefined &&
        (frame === clip.removeAt || frame === clip.removeAt + 1),
    );
  const playhead = target
    ? (target.offset / sourceDuration) * 100
    : frame < 4
      ? 3 + frame * 7
      : (duration / sourceDuration) * 90;
  return {
    clips,
    duration,
    playhead,
    split: frame >= 3,
    captions: frame >= 12,
    processing: frame > 0 && frame < 14,
    stage:
      frame === 1
        ? 0
        : frame < 3
          ? 1
          : frame < 7
            ? 2
            : frame < 10
              ? 3
              : frame < 12
                ? 4
                : 5,
  };
}
