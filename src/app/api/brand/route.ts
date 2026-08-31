import { auth } from "@clerk/nextjs/server";
import { listBrandAssets } from "@/lib/db/brand";
import { getActiveProject, updateProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { parseProjectInput } from "@/lib/project/input";
import { presignView } from "@/lib/r2";

export const runtime = "nodejs";

async function payload(userId: string) {
  const [project, assets] = await Promise.all([
    getActiveProject(userId),
    listBrandAssets(userId),
  ]);
  const logos = await Promise.all(
    assets.map(async (asset) => ({
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      mediaBytes: asset.mediaBytes,
      isPrimary: asset.isPrimary,
      url: await presignView(asset.mediaKey),
    })),
  );
  return { colors: project.brandColors, logos };
}

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  await ensureUser(userId);
  return Response.json(await payload(userId));
}

export async function PATCH(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await readBoundedJson(req, { maxBytes: 8 * 1024 });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  await ensureUser(userId);
  const input = parseProjectInput(
    body && typeof body === "object" ? (body as Record<string, unknown>) : {},
  );
  if (!input.brandColors) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  await getActiveProject(userId);
  await updateProject(userId, { brandColors: input.brandColors });
  return Response.json(await payload(userId));
}
