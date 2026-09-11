import { readTikTokMediaGrant } from "@/lib/publish/media-grant";
import { streamPublishMedia } from "@/lib/r2";
export const runtime = "nodejs";
export const maxDuration = 300;
/** Public only via an expiring, signed object grant issued by the publish route. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const key = readTikTokMediaGrant(token);
  if (!key) return new Response(null, { status: 404 });
  try {
    return await streamPublishMedia(key, req.headers.get("range"), req.signal);
  } catch {
    return new Response(null, { status: 502 });
  }
}
