import { and, eq, inArray } from "drizzle-orm";
import type { BrainDeleteInput } from "../../../../../protocol/app-actions.generated";
import { deleteKnowledge } from "@/lib/brain/operations/knowledge";
import { saveProjectBrain } from "@/lib/brain/operations/project";
import { deleteSkill } from "@/lib/brain/operations/skills";
import { removeVoiceSample } from "@/lib/brain/operations/voice";
import { getDb } from "@/lib/db/client";
import { listBrainBlocks } from "@/lib/db/project-brain";
import { listPillars } from "@/lib/db/project-pillars";
import { listProjectSkills } from "@/lib/db/project-skills";
import { getActiveProject } from "@/lib/db/projects";
import { voiceSamples } from "@/lib/db/schema";
import { parsePillarInput } from "@/lib/project/input";
import {
  StudioActionFailure,
  type StudioActionDefinition,
  type StudioNames,
} from "../executor";
import { plural } from "../ideas/labels";
import type { StudioEffect } from "../wire";
import { brainFailure } from "./failure";
import { joined, quoted } from "./labels";

type Kind = "pillar" | "section" | "skill" | "video";

function targetsOf(input: BrainDeleteInput): [Kind, string][] {
  const of = (kind: Kind, ids: string[] = []) =>
    ids.map((id): [Kind, string] => [kind, id]);
  return [
    ...of("pillar", input.pillarIDs),
    ...of("section", input.blockIDs),
    ...of("skill", input.skillIDs),
    ...of("video", input.sampleIDs),
  ];
}

/** “the “Travel” pillar”, ““Hook bank” from your Knowledge”, and so on. */
function phrase(kind: Kind, name: string): string {
  switch (kind) {
    case "pillar":
      return `the ${quoted(name)} pillar`;
    case "skill":
      return `the ${quoted(name)} skill`;
    case "video":
      return `${quoted(name)} from your voice set`;
    default:
      return `${quoted(name)} from your Knowledge`;
  }
}

/** The creator's own items among the targets, by id, with their names. */
async function namesOf(userId: string, input: BrainDeleteInput) {
  const project = await getActiveProject(userId);
  const sampleIDs = input.sampleIDs ?? [];
  const [pillars, blocks, skills, samples] = await Promise.all([
    input.pillarIDs?.length ? listPillars(project.id) : [],
    input.blockIDs?.length ? listBrainBlocks(project.id) : [],
    input.skillIDs?.length ? listProjectSkills(project.id) : [],
    sampleIDs.length
      ? getDb()
          .select({ id: voiceSamples.id, title: voiceSamples.title })
          .from(voiceSamples)
          .where(
            and(
              eq(voiceSamples.projectId, project.id),
              inArray(voiceSamples.id, sampleIDs),
            ),
          )
      : [],
  ]);
  return {
    pillars,
    names: new Map<string, string>([
      ...pillars.map((row): [string, string] => [row.id, row.name]),
      ...blocks.map((row): [string, string] => [row.id, row.title]),
      ...skills.map((row): [string, string] => [row.id, row.name]),
      ...samples.map((row): [string, string] => [
        row.id,
        row.title || "Untitled video",
      ]),
    ]),
  };
}

/**
 * Runs only after the creator confirms. Each kind goes through its own
 * control's operation: pillars through the pillar editor's list save (their
 * ideas keep everything but the pillar), sections, skills and voice samples
 * through their delete buttons.
 */
export const deleteAction: StudioActionDefinition<BrainDeleteInput> = {
  async run(input, { userId }) {
    const targets = targetsOf(input);
    const { pillars, names } = await namesOf(userId, input);
    const owned = targets.filter(([, id]) => names.has(id));
    if (!owned.length)
      throw new StudioActionFailure(
        "not_found",
        "Those were already gone, so nothing was deleted.",
      );
    const removed: string[] = [];
    const effects: StudioEffect[] = ["brain"];

    const doomed = new Set(
      owned.filter(([kind]) => kind === "pillar").map(([, id]) => id),
    );
    if (doomed.size) {
      const saved = await saveProjectBrain(
        userId,
        {},
        parsePillarInput(pillars.filter((pillar) => !doomed.has(pillar.id))),
      );
      if (!saved.ok) throw brainFailure(saved, "those pillars");
      effects.push("ideas");
    }
    for (const [kind, id] of owned) {
      if (kind !== "pillar") {
        const result =
          kind === "section"
            ? await deleteKnowledge(userId, id)
            : kind === "skill"
              ? await deleteSkill(userId, id)
              : await removeVoiceSample(userId, id);
        if (!result.ok && result.error !== "not_found")
          throw brainFailure(result, quoted(names.get(id)!));
      }
      removed.push(phrase(kind, names.get(id)!));
    }

    const gone = targets.length - owned.length;
    return {
      summary: [
        `Deleted ${joined(removed)}.`,
        doomed.size ? "Any ideas filed there are now unfiled." : "",
        gone
          ? `${plural(gone, "other item")} ${gone === 1 ? "was" : "were"} already gone.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      effects,
    };
  },
  describe(input, names: StudioNames) {
    const targets = targetsOf(input);
    const known = targets.map(([kind, id]) => {
      const name = kind === "pillar" ? names.pillars[id] : names.brain?.[id];
      return name ? phrase(kind, name) : null;
    });
    return known.every(Boolean)
      ? `Delete ${joined(known as string[])}`
      : `Delete ${plural(targets.length, "Brain item")}`;
  },
};
