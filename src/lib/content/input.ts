import { contentStatuses, type ContentStatus } from "@/lib/db/schema";
import type { ContentItemInput } from "@/lib/db/content";

// Clamps: generous for real scripts, tight enough that a client can't stuff
// megabytes into jsonb fields.
const TITLE_MAX = 300;
const LINE_MAX = 300; // one hook / one point / cta
const EXAMPLE_MAX = 2000;
const SCRIPT_MAX = 20_000;
const ARRAY_MAX = 20;

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" ? v.slice(0, max) : undefined;

const strArr = (v: unknown): string[] | undefined =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string")
        .slice(0, ARRAY_MAX)
        .map((x) => x.slice(0, LINE_MAX))
    : undefined;

const isStatus = (v: unknown): v is ContentStatus =>
  typeof v === "string" && (contentStatuses as readonly string[]).includes(v);

const date = (v: unknown): Date | null | undefined => {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/**
 * Parse a client payload into a safe partial ContentItemInput. Unknown keys are
 * dropped; present-but-invalid values are ignored (except `status`, which
 * throws so a bad status can't silently no-op). `submissionId` is NOT parsed
 * here; it has its own ownership check in the route.
 */
export function parseContentInput(body: Record<string, unknown>): {
  input: ContentItemInput;
  badStatus: boolean;
} {
  const input: ContentItemInput = {};
  let badStatus = false;

  const title = str(body.title, TITLE_MAX);
  if (title !== undefined) input.title = title;
  const hooks = strArr(body.hooks);
  if (hooks !== undefined) input.hooks = hooks;
  const points = strArr(body.points);
  if (points !== undefined) input.points = points;
  const example = str(body.example, EXAMPLE_MAX);
  if (example !== undefined) input.example = example;
  const cta = str(body.cta, LINE_MAX);
  if (cta !== undefined) input.cta = cta;

  if (body.script === null) input.script = null;
  else {
    const script = str(body.script, SCRIPT_MAX);
    if (script !== undefined) input.script = script;
  }

  if (body.status !== undefined) {
    if (isStatus(body.status)) input.status = body.status;
    else badStatus = true;
  }

  if (body.pillar === null) input.pillar = null;
  else {
    const pillar = str(body.pillar, 80);
    if (pillar !== undefined) input.pillar = pillar;
  }

  const scheduledFor = date(body.scheduledFor);
  if (scheduledFor !== undefined) input.scheduledFor = scheduledFor;

  const sourceUrl = str(body.sourceUrl, 600);
  if (sourceUrl !== undefined) input.sourceUrl = sourceUrl;
  const sourceTitle = str(body.sourceTitle, TITLE_MAX);
  if (sourceTitle !== undefined) input.sourceTitle = sourceTitle;

  return { input, badStatus };
}

/** Max items accepted by one import call. */
export const IMPORT_MAX = 200;
