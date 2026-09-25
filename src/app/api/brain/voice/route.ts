import { auth } from "@clerk/nextjs/server";
import { getActiveProject } from "@/lib/db/projects";
import { listVoiceSamples } from "@/lib/db/voice-samples";
import { withServerTiming } from "@/lib/http/server-timing";
import { sampleView } from "@/lib/voice/sample-view";

export const runtime = "nodejs";

/** The creator's own videos the brain has listened to. */
export const GET = withServerTiming(async (): Promise<Response> => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const project = await getActiveProject(userId);
  const samples = await listVoiceSamples(project.id);
  return Response.json({ samples: samples.map(sampleView) });
});
