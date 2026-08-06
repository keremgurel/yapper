/** One content pillar as the client sees it. */
export interface Pillar {
  id: string;
  name: string;
  description: string;
  examples: string[];
  sortOrder: number;
}

/** The project brain. Every field is free text the creator wrote. */
export interface Project {
  id: string;
  name: string;
  whatIMake: string;
  audience: string;
  voice: string;
  offers: string;
  doNots: string;
  links: string[];
  contextVersion: number;
}

/** A pillar being edited. New rows have no id until the server assigns one. */
export interface PillarDraft {
  id?: string;
  name: string;
  description: string;
  examples: string[];
}

export interface ProjectPatch {
  name?: string;
  whatIMake?: string;
  audience?: string;
  voice?: string;
  offers?: string;
  doNots?: string;
  links?: string[];
  pillars?: PillarDraft[];
}

export interface ProjectPayload {
  project: Project;
  pillars: Pillar[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`project_api_${res.status}`);
  return (await res.json()) as T;
}

export async function getProject(): Promise<ProjectPayload> {
  return json<ProjectPayload>(await fetch("/api/project"));
}

/** `keepalive` lets a final autosave flush survive a hard navigation. */
export async function patchProject(
  patch: ProjectPatch,
  opts: { keepalive?: boolean } = {},
): Promise<ProjectPayload> {
  return json<ProjectPayload>(
    await fetch("/api/project", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      keepalive: opts.keepalive,
    }),
  );
}

/** The free-text fields the sheet renders as textareas. Deliberately excludes
 * `name` (a single-line input), `links` and `pillars` (not strings), so a field
 * added here can only ever be a plain text one. */
export type ProjectTextFieldKey =
  | "whatIMake"
  | "audience"
  | "voice"
  | "offers"
  | "doNots";

/** The editable fields, in the order the sheet shows them. Colocated with the
 * types so the form and the payload can never drift apart. */
export const PROJECT_FIELDS = [
  {
    key: "whatIMake",
    label: "What I make",
    placeholder:
      "Short-form video helping people pass the CELPIP speaking exam.",
    rows: 3,
  },
  {
    key: "audience",
    label: "Who it's for",
    placeholder:
      "Newcomers to Canada, 20-40, already studying, anxious about speaking.",
    rows: 3,
  },
  {
    key: "voice",
    label: "How I sound",
    placeholder: "Direct and warm. Second person. Fast cold opens. No filler.",
    rows: 3,
  },
  {
    key: "offers",
    label: "What I'm promoting",
    placeholder: "The practice app (free tier) and the referral program.",
    rows: 2,
  },
  {
    key: "doNots",
    label: "Never say",
    placeholder:
      "No guaranteed-score claims. No 'unlock your potential'. Never mock the test-taker.",
    rows: 2,
  },
] as const satisfies readonly {
  key: ProjectTextFieldKey;
  label: string;
  placeholder: string;
  rows: number;
}[];
