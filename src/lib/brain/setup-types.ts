import type { ProjectTextFieldKey } from "@/lib/project/client";

export type SetupEssentialKey = "name" | ProjectTextFieldKey;

export const SETUP_ESSENTIAL_KEYS: SetupEssentialKey[] = [
  "name",
  "whatIMake",
  "audience",
  "voice",
  "scriptingPatterns",
  "offers",
  "doNots",
];

export interface SetupPillar {
  name: string;
  description: string;
  examples: string[];
}

export interface SetupBlock {
  title: string;
  digest: string;
  body: string;
  tags: string[];
  /** Always "auto": a section setup writes is read when a task needs it. The
   * creator can promote one to Always by hand; setup never does, because an
   * always-on section spends the same budget the Essentials need. */
  usage: "auto";
}

export interface BrainSetupProposal {
  essentials: Partial<Record<SetupEssentialKey, string>>;
  pillars: SetupPillar[];
  blocks: SetupBlock[];
  /** What the document did not cover, so the creator knows what to fill by hand. */
  notes: string;
}

export interface BrainSetupInput {
  document: string;
  current: {
    essentials: Partial<Record<SetupEssentialKey, string>>;
    pillars: { name: string; description: string }[];
  };
}
