import { CHIRPY_SYSTEM } from "../system-prompt";

/** The planner's instructions plus how to read a project it was not handed
 * whole. Static, so it stays inside the cached prefix. */
export const CHIRPY_READING_SYSTEM = `${CHIRPY_SYSTEM}
Reading the project: the user message holds the conversation and an overview of the project under "project". Sections listed in withheldSections are not included, and selectedFromWithheld holds the currently selected items from them. Before you use an ID, a time, a word number or a current value that lives in a withheld section, read it with read_section or read_transcript; never guess one you have not read. To find where something is said, call read_transcript with the phrase and check how many occurrences come back. Call view_overlay_image before choosing a region in the selected overlay's picture. Read only what this request needs, then answer with the JSON plan.`;
