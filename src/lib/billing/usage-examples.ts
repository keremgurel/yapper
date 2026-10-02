import { PAID_ACTIONS } from "./credit-costs";
import { GENERATE_CREDITS } from "@/lib/db/constants";

export const WORKFLOW_EXAMPLE = [
  {
    label: "Capture and categorize an idea",
    cost: PAID_ACTIONS.capture_idea.credits,
  },
  { label: "Generate a script", cost: GENERATE_CREDITS.script },
  {
    label: "Transcribe a 1-minute take",
    cost: PAID_ACTIONS.transcribe.credits,
  },
  {
    label: "Run one-click cleanup",
    cost: PAID_ACTIONS.clean_transcript.credits,
  },
  {
    label: "Generate a thumbnail",
    cost: PAID_ACTIONS.publish_thumbnail.credits,
  },
  {
    label: "Write captions for 3 platforms",
    cost: PAID_ACTIONS.publish_caption.credits,
  },
];
export const WORKFLOW_CREDITS = WORKFLOW_EXAMPLE.reduce(
  (sum, item) => sum + item.cost,
  0,
);
export const USAGE_EXAMPLES = [
  {
    key: "workflow",
    label: "Finished video workflows",
    unit: "video workflows",
    cost: WORKFLOW_CREDITS,
  },
  {
    key: "scripts",
    label: "Script generations",
    unit: "scripts",
    cost: GENERATE_CREDITS.script,
  },
  {
    key: "thumbnails",
    label: "AI thumbnails",
    unit: "thumbnails",
    cost: PAID_ACTIONS.publish_thumbnail.credits,
  },
] as const;
