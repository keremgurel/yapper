import { auth } from "@clerk/nextjs/server";
import { createPublishWorkflow } from "@/lib/publish/workflow";
import { publishFacebook } from "@/lib/publish/server/facebook";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  const workflow = createPublishWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return publishFacebook(req, userId, workflow);
}
