import { authorizationServer, mcpEnabled } from "@/lib/mcp/access";

/**
 * Tells a connector where to sign the creator in before it calls /api/mcp
 * (OAuth 2.0 Protected Resource Metadata, RFC 9728).
 */
export function GET(req: Request): Response {
  const server = authorizationServer();
  if (!mcpEnabled() || !server) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({
    resource: new URL("/api/mcp", req.url).href,
    authorization_servers: [server],
    bearer_methods_supported: ["header"],
  });
}
