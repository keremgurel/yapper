import type {
  BrainEssentialsInput,
  BrainPillarInput,
} from "../../../../../protocol/app-actions.generated";
import { saveProjectBrain } from "@/lib/brain/operations/project";
import { listPillars, type PillarInput } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";
import { parsePillarInput, parseProjectInput } from "@/lib/project/input";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";
import { brainFailure } from "./failure";
import { ESSENTIAL_LABELS, joined, quoted } from "./labels";

const FIELD_MAX = 2000;
const TEXT_FIELDS = [
  "whatIMake",
  "audience",
  "voice",
  "scriptingPatterns",
  "offers",
  "doNots",
] as const;

/** Through the same project patch as the Essentials card's autosave. With
 * append, each text goes on a new line after what the field already says. */
export const essentialsAction: StudioActionDefinition<BrainEssentialsInput> = {
  async run(input, { userId }) {
    const current = await getActiveProject(userId);
    const fields: Record<string, unknown> = {};
    if (input.name?.trim()) fields.name = input.name.trim();
    if (input.defaultFormat) fields.defaultFormat = input.defaultFormat;
    for (const key of TEXT_FIELDS) {
      const text = input[key]?.trim();
      if (text === undefined) continue;
      const before = current[key].trim();
      const next = input.append && before ? `${before}\n${text}` : text;
      if (next.length > FIELD_MAX)
        throw new StudioActionFailure(
          "too_long",
          `${ESSENTIAL_LABELS[key]} would pass ${FIELD_MAX.toLocaleString("en")} characters, so I left your Essentials alone.`,
        );
      fields[key] = next;
    }
    const changed = Object.keys(fields);
    if (!changed.length)
      throw new StudioActionFailure(
        "no_fields",
        "Tell me what to change in your Essentials.",
      );
    const saved = await saveProjectBrain(
      userId,
      parseProjectInput(fields),
      null,
    );
    if (!saved.ok) throw brainFailure(saved, "your Essentials");
    const names = changed.map((key) => ESSENTIAL_LABELS[key]);
    return {
      summary: `${input.append ? "Added to" : "Updated"} ${joined(names)} in your Essentials.`,
      effects: ["brain"],
    };
  },
};

/** The pillar editor's save: the whole list goes through the project patch
 * with this one pillar added or changed, so the others keep their ids and
 * their ideas. */
export const pillarSaveAction: StudioActionDefinition<BrainPillarInput> = {
  async run(input, { userId }) {
    const project = await getActiveProject(userId);
    const pillars = await listPillars(project.id);
    const name = input.name?.trim();
    const taken = (id?: string) =>
      name &&
      pillars.find(
        (pillar) =>
          pillar.id !== id && pillar.name.toLowerCase() === name.toLowerCase(),
      );
    const list: PillarInput[] = pillars.map((pillar) => ({
      id: pillar.id,
      name: pillar.name,
      description: pillar.description,
      examples: pillar.examples,
    }));

    let summary: string;
    let renamed = false;
    if (input.pillarID) {
      const pillar = list.find((item) => item.id === input.pillarID);
      if (!pillar)
        throw new StudioActionFailure(
          "not_found",
          "That pillar isn’t one of yours anymore.",
        );
      if (taken(pillar.id))
        throw new StudioActionFailure(
          "duplicate",
          `You already have a pillar called ${quoted(name!)}.`,
        );
      const before = pillar.name;
      if (name) pillar.name = name;
      if (input.description !== undefined)
        pillar.description = input.description.trim();
      if (input.examples) pillar.examples = input.examples;
      renamed = Boolean(name && name !== before);
      summary = renamed
        ? `Renamed the ${quoted(before)} pillar to ${quoted(pillar.name)}.`
        : `Updated the ${quoted(pillar.name)} pillar.`;
    } else {
      if (!name)
        throw new StudioActionFailure("no_name", "A new pillar needs a name.");
      if (taken())
        throw new StudioActionFailure(
          "duplicate",
          `You already have a pillar called ${quoted(name)}.`,
        );
      if (list.length >= 24)
        throw new StudioActionFailure(
          "too_many",
          "You already have 24 pillars. Delete one first.",
        );
      list.push({
        name,
        description: input.description?.trim() ?? "",
        examples: input.examples ?? [],
      });
      summary = `Added the ${quoted(name)} pillar.`;
    }

    const saved = await saveProjectBrain(userId, {}, parsePillarInput(list));
    if (!saved.ok) throw brainFailure(saved, "that pillar");
    return { summary, effects: renamed ? ["brain", "ideas"] : ["brain"] };
  },
};
