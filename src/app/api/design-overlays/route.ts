import { handleSceneRequest } from "@/lib/studio/scene/route-handler";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  return handleSceneRequest(req, "design");
}
