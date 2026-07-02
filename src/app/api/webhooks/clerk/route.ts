import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { deleteUser, ensureUser } from "@/lib/db/users";

// Clerk -> our DB sync. Verifies the Svix signature (CLERK_WEBHOOK_SIGNING_SECRET),
// then on user.created/updated upserts the user (granting welcome credits once),
// and on user.deleted removes them. Runs on the Node runtime for `pg`.
export const runtime = "nodejs";

function primaryEmail(data: {
  email_addresses?: { id: string; email_address: string }[];
  primary_email_address_id?: string | null;
}): string | undefined {
  const list = data.email_addresses ?? [];
  return (
    list.find((e) => e.id === data.primary_email_address_id)?.email_address ??
    list[0]?.email_address
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (evt.type === "user.created" || evt.type === "user.updated") {
      await ensureUser(evt.data.id, primaryEmail(evt.data));
    } else if (evt.type === "user.deleted" && evt.data.id) {
      await deleteUser(evt.data.id);
    }
  } catch {
    // Return 500 so Clerk retries the delivery.
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
