import { budgetFor } from "./budgets";
import { buildCore } from "./core";
import { buildIndex, type BrainIndex } from "./digest";
import { renderSelection } from "./render";
import { brainSection } from "./section";
import { selectContext } from "./select";
import type {
  BrainSelection,
  BrainSnapshot,
  BrainSurface,
  BrainUsed,
} from "./types";

/**
 * One creator's brain, compiled for one prompt.
 *
 * The whole folder converges here. Core is who they are and is paid for every
 * time. The index is one line for everything else they have, which is what
 * makes a brain that holds a 5000 row export still fit in a prompt. The loaded
 * part is what this particular task selected, and it is the only part that
 * changes between two calls with the same brain.
 */

export interface CompiledBrain {
  core: string;
  index: string;
  loaded: string;
  /** The three parts, wrapped and ready to append to a system prompt. */
  section: string;
  /** What was actually read, in names the creator recognises. */
  used: BrainUsed;
  selection: BrainSelection;
  entries: BrainIndex["entries"];
}

export interface CompileOptions {
  surface: BrainSurface;
  /** What is being written: the topic, the title, the transcript, the message.
   * Empty is fine, and means selection falls back to the creator's own order. */
  task?: string;
  projectId: string;
  contextVersion: number;
  signal?: AbortSignal;
  useModel?: boolean;
  allow?: () => Promise<boolean>;
}

/** The stable half: everything that depends only on the brain, not the task.
 * Split out because the server caches it per `contextVersion` and recomputes
 * only the part below on each request. */
export function compileStable(
  snapshot: BrainSnapshot,
  surface: BrainSurface,
): { core: string; index: BrainIndex } {
  const budget = budgetFor(surface);
  const core = buildCore(
    snapshot.project,
    snapshot.pillars,
    snapshot.blocks.filter((block) => block.usage === "core"),
    { maxChars: budget.core, includeProject: surface !== "capture" },
  );
  const index =
    budget.index > 0
      ? buildIndex(snapshot.blocks, snapshot.skills, budget.index)
      : { entries: [], text: "" };
  return { core, index };
}

export async function compileBrain(
  snapshot: BrainSnapshot,
  options: CompileOptions,
): Promise<CompiledBrain> {
  const budget = budgetFor(options.surface);
  const { core, index } = compileStable(snapshot, options.surface);
  const task = options.task ?? "";

  if (budget.loaded <= 0 || !index.entries.length) {
    const selection: BrainSelection = {
      skillRefs: [],
      contextRefs: [],
      by: "all",
    };
    return {
      core,
      index: index.text,
      loaded: "",
      section: brainSection({ core, index: index.text, loaded: "" }),
      used: { skills: [], context: [] },
      selection,
      entries: index.entries,
    };
  }

  const blocks = new Map(snapshot.blocks.map((block) => [block.id, block]));
  const skills = new Map(snapshot.skills.map((skill) => [skill.id, skill]));

  const selection = await selectContext({
    projectId: options.projectId,
    contextVersion: options.contextVersion,
    index,
    blocks,
    skills,
    surface: options.surface,
    task,
    signal: options.signal,
    useModel: options.useModel,
    allow: options.allow,
  });

  const rendered = renderSelection(
    selection,
    index,
    blocks,
    skills,
    task,
    budget.loaded,
  );

  // What was loaded is not listed again as something the model has not read.
  const loadedRefs = new Set([
    ...selection.skillRefs,
    ...selection.contextRefs,
  ]);
  const indexText = index.entries
    .filter((entry) => !loadedRefs.has(entry.ref))
    .map((entry) => entry.line)
    .join("\n");

  return {
    core,
    index: indexText,
    loaded: rendered.text,
    section: brainSection({
      core,
      index: indexText,
      loaded: rendered.text,
    }),
    used: rendered.used,
    selection,
    entries: index.entries,
  };
}
