import { auth, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { invalidateBrainContext } from "@/lib/brain/context/server";
import { listPillars, replacePillars } from "@/lib/db/project-pillars";
import { seedPillarsIfEmpty } from "@/lib/db/project-seed";
import { getActiveProject, updateProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import { parsePillarInput, parseProjectInput } from "@/lib/project/input";

export const runtime = "nodejs";

/** Pillar names the creator typed during Studio onboarding, before this table
 * existed. Read straight off the Clerk user so a returning creator's first load
 * is already populated. */
function onboardingPillars(
  metadata: Record<string, unknown> | undefined,
): string[] {
  const onboarding = (metadata?.studioOnboarding ?? {}) as {
    pillars?: unknown;
  };
  return Array.isArray(onboarding.pillars)
    ? onboarding.pillars.filter((p): p is string => typeof p === "string")
    : [];
}

/**
 * The caller's project brain. Creates the row on first sight and, only while it
 * has no pillars at all, seeds them from onboarding plus whatever pillars their
 * existing library items were already classified under.
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  // The project FK requires the user row; a creator can reach Studio before any
  // other path has called ensureUser.
  await ensureUser(userId);
  const project = await getActiveProject(userId);

  const user = await currentUser();
  await seedPillarsIfEmpty(
    userId,
    project.id,
    onboardingPillars(user?.unsafeMetadata as Record<string, unknown>),
  );

  const pillars = await listPillars(project.id);
  return Response.json({ project, pillars });
}

/**
 * Save edits to the brain. Fields and pillars can arrive together or apart; a
 * key that is absent is left untouched, so the sheet's autosave can send only
 * what changed.
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureUser(userId);
  const existing = await getActiveProject(userId);

  const input = parseProjectInput(body);
  let project = Object.keys(input).length
    ? ((await updateProject(userId, input)) ?? existing)
    : existing;

  const pillarInput = parsePillarInput(body.pillars);
  let pillars;
  if (pillarInput) {
    pillars = await replacePillars(project.id, pillarInput);
    // replacePillars bumps contextVersion too, so the row read above is now one
    // behind. Re-read rather than hand the client a version that never existed.
    project = await getActiveProject(userId);
  } else {
    pillars = await listPillars(project.id);
  }

  // Both writes bump contextVersion, which already invalidates on read. This
  // drops the entry outright so the very next prompt on this warm instance
  // cannot serve the block the creator just edited away.
  invalidateBrainContext(project.id);

  return Response.json({ project, pillars });
}
