import { auth } from "@clerk/nextjs/server";
import { deleteConnection } from "@/lib/db/publish";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";

export const runtime = "nodejs";

type Params = { params: Promise<{ platform: string }> };

/** Disconnect a platform (drops the stored tokens). */
export async function DELETE(
  _req: Request,
  { params }: Params,
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { platform } = await params;
  if (!publishPlatforms.includes(platform as PublishPlatform)) {
    return Response.json({ error: "unknown_platform" }, { status: 404 });
  }
  const removed = await deleteConnection(userId, platform as PublishPlatform);
  return Response.json({ removed });
}
