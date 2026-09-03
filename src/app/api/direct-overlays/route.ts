import { handleSceneRequest } from "@/lib/studio/scene/route-handler";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(req: Request) {
  return handleSceneRequest(req, "direct");
}
