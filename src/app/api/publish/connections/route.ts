import { auth } from "@clerk/nextjs/server";
import { listConnections } from "@/lib/db/publish";
import { configuredPlatforms } from "@/lib/publish/platforms";
import { tokenCryptoConfigured } from "@/lib/publish/tokens";

export const runtime = "nodejs";

/**
 * The user's platform connections plus which platforms are even connectable
 * (configured with an OAuth app + token key), so the UI can show "Connect"
 * only where it can actually work.
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const connections = await listConnections(userId);
  const available = tokenCryptoConfigured() ? configuredPlatforms() : [];
  return Response.json({ connections, available });
}
