import { auth } from "@clerk/nextjs/server";
import { createPublishWorkflow } from "@/lib/publish/workflow";
import { publishTikTok } from "@/lib/publish/server/tiktok";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  const workflow = createPublishWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return publishTikTok(req, userId, workflow);
}
