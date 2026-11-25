import { ensureUser } from "@/lib/db/users";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { mcpEnabled, mcpUserId } from "@/lib/mcp/access";
import { handleMcpMessage } from "@/lib/mcp/json-rpc";

export const runtime = "nodejs";

const notFound = () => Response.json({ error: "not_found" }, { status: 404 });

/**
 * The connector's door: Model Context Protocol over HTTP for Claude and
 * ChatGPT. It offers the server actions Chirpy runs, through the same
 * executors, to the signed-in creator.
 */
export async function POST(req: Request): Promise<Response> {
  if (!mcpEnabled()) return notFound();
  const userId = await mcpUserId();
  if (!userId) {
    const metadata = new URL("/.well-known/oauth-protected-resource", req.url);
    return Response.json(
      { error: "unauthorized" },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer resource_metadata="${metadata.href}"`,
        },
      },
    );
  }
  let message: unknown;
  try {
    message = await readBoundedJson(req, { maxBytes: 64 * 1024 });
  } catch (error) {
    return (
      requestBodyErrorResponse(error) ??
      Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        { status: 400 },
      )
    );
  }
  await ensureUser(userId);
  const reply = await handleMcpMessage({ userId, request: req }, message);
  // A notification has no reply; the transport acknowledges it and nothing more.
  return reply ? Response.json(reply) : new Response(null, { status: 202 });
}

/** This server answers each request in full and keeps no stream open. */
export function GET(): Response {
  return mcpEnabled()
    ? new Response(null, { status: 405, headers: { Allow: "POST" } })
    : notFound();
}
