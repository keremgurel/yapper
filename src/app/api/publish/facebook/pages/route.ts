import { auth } from "@clerk/nextjs/server";
import { getConnectionRow, selectFacebookPage } from "@/lib/db/publish";
import { listFacebookPages } from "@/lib/publish/facebook-api";
import { decryptToken } from "@/lib/publish/tokens";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const row = await getConnectionRow(userId, "facebook");
  if (!row?.refreshTokenEnc)
    return Response.json({ error: "facebook_not_connected" }, { status: 409 });
  try {
    const pages = await listFacebookPages(decryptToken(row.refreshTokenEnc));
    return Response.json(
      {
        pages: pages.map(({ id, name }) => ({ id, name })),
        selectedPageId: row.externalAccountId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "facebook_reauth_required" },
      { status: 409 },
    );
  }
}
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body;
  try {
    body = await readBoundedJson(req, { maxBytes: 4096 });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const pageId = (body as { pageId?: unknown } | null)?.pageId;
  if (typeof pageId !== "string" || !/^\d{1,100}$/.test(pageId))
    return Response.json({ error: "invalid_page" }, { status: 400 });
  const row = await getConnectionRow(userId, "facebook");
  if (!row?.refreshTokenEnc)
    return Response.json({ error: "facebook_not_connected" }, { status: 409 });
  try {
    const page = (
      await listFacebookPages(decryptToken(row.refreshTokenEnc))
    ).find((p) => p.id === pageId);
    if (!page)
      return Response.json(
        { error: "facebook_page_not_authorized" },
        { status: 403 },
      );
    const selected = await selectFacebookPage(
      userId,
      { id: row.id, refreshTokenEnc: row.refreshTokenEnc },
      page,
    );
    return selected
      ? Response.json({ page: { id: page.id, name: page.name } })
      : Response.json({ error: "connection_changed" }, { status: 409 });
  } catch {
    return Response.json(
      { error: "facebook_reauth_required" },
      { status: 409 },
    );
  }
}
