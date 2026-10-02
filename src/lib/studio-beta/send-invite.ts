import { Resend } from "resend";
import { buildInviteEmail } from "./invite-email";

export type InviteResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "failed" };

/**
 * Email a tester their invitation. Sending needs a verified domain in Resend
 * and `STUDIO_BETA_FROM_EMAIL` (for example "Kerem at Yapper
 * <kerem@ypr.app>"). Until both exist this reports `not_configured`, and the
 * admin panel shows the code so it can be sent by hand.
 */
export async function sendBetaInvite(invite: {
  email: string;
  name: string;
  code: string;
}): Promise<InviteResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.STUDIO_BETA_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };
  try {
    const message = buildInviteEmail(invite);
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: invite.email,
      replyTo: process.env.STUDIO_BETA_REPLY_TO?.trim() || undefined,
      ...message,
    });
    if (error) {
      console.error("studio beta invite failed", error.name);
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (error) {
    console.error("studio beta invite failed", error);
    return { sent: false, reason: "failed" };
  }
}
