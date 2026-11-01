import type { StudioActionInputs } from "../registry.generated";
import type { StudioActionDefinition } from "../executor";
import { deleteAction } from "./delete";
import { essentialsAction, pillarSaveAction } from "./essentials";
import { importAction } from "./import";
import { knowledgeAddAction, knowledgeUpdateAction } from "./knowledge";
import { setupAction } from "./setup";
import { installAction, skillSaveAction } from "./skills";
import { deriveAction, listenAction } from "./voice";

type BrainActionID = Extract<
  keyof StudioActionInputs,
  `studio.brain.${string}`
>;

/** Every studio.brain.* action in the contract, by id. */
export const BRAIN_ACTIONS: {
  [ID in BrainActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  "studio.brain.essentials.update": essentialsAction,
  "studio.brain.pillars.save": pillarSaveAction,
  "studio.brain.knowledge.add": knowledgeAddAction,
  "studio.brain.knowledge.update": knowledgeUpdateAction,
  "studio.brain.knowledge.import": importAction,
  "studio.brain.skills.save": skillSaveAction,
  "studio.brain.delete": deleteAction,
  "studio.brain.catalog.install": installAction,
  "studio.brain.setup": setupAction,
  "studio.brain.voice.listen": listenAction,
  "studio.brain.voice.derive": deriveAction,
};
