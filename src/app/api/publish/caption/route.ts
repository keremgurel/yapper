import { auth } from "@clerk/nextjs/server";
import { getFreshAccessToken } from "@/lib/publish/connection";
import { generateCaption } from "@/lib/publish/caption";
import { listYouTubeVideos } from "@/lib/publish/youtube-list";

export const runtime = "nodejs";

/**
 * Draft a YouTube title + description. `matchStyle` is opt-in: only when it's
 * set do we pull the user's recent video titles as style exemplars, so a plain
 * request writes a clean caption rather than always echoing past formats.
 * 501 when no LLM provider is configured.
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    context?: string;
    matchStyle?: boolean;
  };
  if (!body.title?.trim()) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  let styleSamples: string[] | undefined;
  if (body.matchStyle) {
    try {
      const token = await getFreshAccessToken(userId, "youtube");
      const videos = await listYouTubeVideos(token, 15);
      styleSamples = videos.map((v) => v.title).filter(Boolean);
    } catch {
      // No connection or a listing hiccup just means no style samples — still
      // generate, just without the match.
      styleSamples = undefined;
    }
  }

  try {
    const caption = await generateCaption({
      title: body.title,
      context: body.context,
      styleSamples,
    });
    return Response.json({ caption });
  } catch (e) {
    if (e instanceof Error && e.message === "no_provider") {
      return Response.json({ error: "no_provider" }, { status: 501 });
    }
    console.error("[publish] caption generation failed", e);
    return Response.json({ error: "generate_failed" }, { status: 502 });
  }
}
