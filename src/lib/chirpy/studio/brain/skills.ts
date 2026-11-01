import type {
  BrainInstallInput,
  BrainSkillInput,
} from "../../../../../protocol/app-actions.generated";
import { installCatalogEntry } from "@/lib/brain/operations/install";
import {
  createSkill,
  reorderSkills,
  updateSkill,
} from "@/lib/brain/operations/skills";
import { parseSkillInput } from "@/lib/brain/skill-input";
import { listProjectSkillsWithDefaults } from "@/lib/db/project-skills";
import { getActiveProject } from "@/lib/db/projects";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";
import { brainFailure } from "./failure";
import { movedTo, quoted } from "./labels";

/** The skill editor's create and save, its on/off switch and the list's
 * reorder, through the same operations as the Skills tab. */
export const skillSaveAction: StudioActionDefinition<BrainSkillInput> = {
  async run({ skillID, position, ...fields }, { userId }) {
    const input = parseSkillInput(fields);
    if (!skillID) {
      if (!input.name || !input.instructions?.trim())
        throw new StudioActionFailure(
          "no_name",
          "A new skill needs a name and instructions.",
        );
      const created = await createSkill(userId, { ...input, name: input.name });
      if (!created.ok) throw brainFailure(created, "that skill");
      return {
        summary: `Added the ${quoted(created.value.name)} skill.`,
        effects: ["brain"],
      };
    }

    const project = await getActiveProject(userId);
    const skills = await listProjectSkillsWithDefaults(project.id);
    const skill = skills.find((item) => item.id === skillID);
    if (!skill)
      throw new StudioActionFailure(
        "not_found",
        "I couldn’t find that skill. It may have been deleted.",
      );
    if (!Object.keys(input).length && position === undefined)
      throw new StudioActionFailure(
        "no_fields",
        `Tell me what to change in ${quoted(skill.name)}.`,
      );

    let name = skill.name;
    const done: string[] = [];
    if (Object.keys(input).length) {
      const saved = await updateSkill(userId, skill.id, input);
      if (!saved.ok) throw brainFailure(saved, quoted(skill.name));
      name = saved.value.name;
      const onlySwitch = Object.keys(input).every((key) => key === "enabled");
      done.push(
        onlySwitch
          ? `Turned ${input.enabled ? "on" : "off"} ${quoted(name)}.`
          : `Updated the ${quoted(name)} skill.`,
      );
    }
    if (position !== undefined) {
      const order = movedTo(
        skills.map((item) => item.id),
        skill.id,
        position,
      );
      const moved = await reorderSkills(userId, order);
      if (!moved.ok) throw brainFailure(moved, quoted(name));
      done.push(
        `Moved ${quoted(name)} to position ${order.indexOf(skill.id) + 1}.`,
      );
    }
    return { summary: done.join(" "), effects: ["brain"] };
  },
};

/** The catalog sheet's install button, which is also a skill's Reset. */
export const installAction: StudioActionDefinition<BrainInstallInput> = {
  async run({ slug }, { userId }) {
    const project = await getActiveProject(userId);
    const had = (await listProjectSkillsWithDefaults(project.id)).some(
      (skill) => skill.catalogSlug === slug,
    );
    const installed = await installCatalogEntry(userId, slug);
    if (!installed.ok) {
      if (installed.error === "not_found")
        throw new StudioActionFailure(
          "not_found",
          "That isn’t in the catalog. Ask me what the catalog has.",
        );
      throw brainFailure(installed, "that catalog entry");
    }
    const { block, name } = installed.value;
    return {
      summary: block
        ? `Added the ${quoted(name)} worksheet to your Knowledge. Prompts read it only when you attach it, so fill in its answers first.`
        : had
          ? `Reset ${quoted(name)} to the catalog version.`
          : `Installed the ${quoted(name)} skill.`,
      effects: ["brain"],
    };
  },
};
