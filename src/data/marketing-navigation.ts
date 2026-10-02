/** Studio features grouped by the job they do. Used by the header menu, the
 * features directory and the workflow links. */
export const featureGroups = [
  {
    id: "write",
    title: "Capture and write",
    description: "Save ideas and references. Turn them into a script.",
    slugs: ["idea-capture", "ai-script-writer", "content-library"],
  },
  {
    id: "record",
    title: "Record",
    description: "Read your script while you record to camera.",
    slugs: ["teleprompter-recorder"],
  },
  {
    id: "edit",
    title: "Edit",
    description: "Remove retakes and pauses. Add timed captions.",
    slugs: ["transcript-video-editor", "automatic-captions"],
  },
  {
    id: "publish",
    title: "Plan and publish",
    description: "Prepare captions and organize your publishing calendar.",
    slugs: ["social-publishing", "content-calendar"],
  },
];
