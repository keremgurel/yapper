import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  clearContentMessages,
  listContentMessages,
} from "@/lib/db/content-messages";

export const runtime = "nodejs";

/** The conversation on one idea, oldest first. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const messages = await listContentMessages(userId, id);
  return Response.json({
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      actions: message.actions,
      createdAt: message.createdAt,
    })),
  });
}

/** Start over. The canvas itself is untouched; only the thread is cleared. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await clearContentMessages(userId, id);
  return Response.json({ ok: true });
}
