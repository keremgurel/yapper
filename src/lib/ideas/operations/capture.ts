import { parseContentInput } from "@/lib/content/input";
import { createContentItem } from "@/lib/db/content";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import { parseIdeaFields } from "@/lib/ideas/input";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

type ContentRow = Awaited<ReturnType<typeof createContentItem>>;

/**
 * Bank an idea: the creator's exact words are stored at once, with nothing
 * slow or fallible in the way. The Ideas composer and Chirpy both land here;
 * the first draft is a separate, paid step that patches the same row.
 */
export async function captureIdea(
  userId: string,
  body: Record<string, unknown>,
): Promise<OperationResult<ContentRow>> {
  const { input: base } = parseContentInput(body);
  const idea = parseIdeaFields(body);

  const hasMaterial = Boolean(
    idea.originalNote?.trim() || base.sourceUrl?.trim(),
  );
  if (!hasMaterial) return refused(400, "no_input");

  await ensureUser(userId);
  const project = await getActiveProject(userId);

  return succeeded(
    await createContentItem(userId, {
      ...base,
      ...idea,
      projectId: project.id,
      // A capture is always a capture; a client cannot claim otherwise.
      status: "captured",
    }),
  );
}
