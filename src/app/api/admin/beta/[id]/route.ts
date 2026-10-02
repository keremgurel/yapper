import { auth } from "@clerk/nextjs/server";
import { isAdmin, notFound } from "@/lib/auth/admin";
import {
  approveBetaApplication,
  closeBetaApplication,
  findBetaApplication,
  markBetaInvited,
} from "@/lib/db/studio-beta";
import {
  generateAccessCode,
  hashAccessCode,
} from "@/lib/studio-beta/access-code";
import { sendBetaInvite } from "@/lib/studio-beta/send-invite";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = ["approve", "reject", "revoke"] as const;
type Action = (typeof ACTIONS)[number];

/**
 * Decide an application. Approving issues a fresh access code and emails the
 * invitation; approving again reissues the code, which is how an invitation is
 * resent. The code is returned once, so the admin can pass it on by hand when
 * email is not set up. Rejecting or revoking removes the code.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) return notFound();
  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  const action = ACTIONS.find((candidate) => candidate === body.action) as
    | Action
    | undefined;
  if (!action) return Response.json({ error: "bad_request" }, { status: 400 });

  const application = await findBetaApplication(id);
  if (!application) return notFound();

  if (action !== "approve") {
    await closeBetaApplication(
      id,
      userId,
      action === "reject" ? "rejected" : "revoked",
    );
    return Response.json({ ok: true });
  }

  const code = generateAccessCode();
  await approveBetaApplication(
    id,
    userId,
    await hashAccessCode(application.email, code),
  );
  const invite = await sendBetaInvite({
    email: application.email,
    name: application.name,
    code,
  });
  if (invite.sent) await markBetaInvited(id);
  return Response.json({
    ok: true,
    code,
    emailed: invite.sent,
    emailProblem: invite.sent ? null : invite.reason,
  });
}
