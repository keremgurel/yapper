import type { StudioActionInputs } from "../registry.generated";
import type { StudioActionDefinition } from "../executor";
import { cancelAction, rescheduleAction } from "./schedules";

type CalendarActionID = Extract<
  keyof StudioActionInputs,
  `studio.calendar.${string}`
>;

/** Every studio.calendar.* action in the contract, by id. */
export const CALENDAR_ACTIONS: {
  [ID in CalendarActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  "studio.calendar.reschedule": rescheduleAction,
  "studio.calendar.cancel": cancelAction,
};
