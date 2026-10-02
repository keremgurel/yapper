const SITE = "https://ypr.app";
export const MAC_APP_DOWNLOAD =
  "https://github.com/keremgurel/yapper/releases/latest";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

/** The invitation an approved tester receives: how to get in, their personal
 * code, and where to download the Mac app. */
export function buildInviteEmail(invite: { name: string; code: string }) {
  const first = invite.name.trim().split(/\s+/)[0] || "there";
  const access = `${SITE}/studio-access`;
  const steps = [
    `Open ${access}`,
    "Enter this email address and your access code",
    "Create your Yapper account, or sign in if you have one",
  ];
  const text = [
    `Hi ${first},`,
    "",
    "You're in. Your application to the Yapper Studio private beta was approved.",
    "",
    `Your access code: ${invite.code}`,
    "",
    "To get started:",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    `Studio also has a Mac app for recording and editing. Download it here: ${MAC_APP_DOWNLOAD}`,
    "",
    "The code is yours. Please don't share it. If something breaks or feels wrong, reply to this email and tell me. That is what the beta is for.",
    "",
    "Kerem",
    "Yapper",
  ].join("\n");

  const name = escapeHtml(first);
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#18181b;max-width:520px">
<p>Hi ${name},</p>
<p>You're in. Your application to the Yapper Studio private beta was approved.</p>
<p style="margin:24px 0 6px;font-size:13px;color:#71717a">Your access code</p>
<p style="margin:0 0 24px;font-family:ui-monospace,Menlo,monospace;font-size:24px;letter-spacing:2px;font-weight:600">${escapeHtml(invite.code)}</p>
<p>To get started:</p>
<ol style="padding-left:20px">
<li>Open <a href="${access}" style="color:#18181b">${access.replace("https://", "")}</a></li>
<li>${steps[1]}</li>
<li>${steps[2]}</li>
</ol>
<p>Studio also has a Mac app for recording and editing. <a href="${MAC_APP_DOWNLOAD}" style="color:#18181b">Download it here</a>.</p>
<p>The code is yours. Please don't share it. If something breaks or feels wrong, reply to this email and tell me. That is what the beta is for.</p>
<p>Kerem<br>Yapper</p>
</div>`;

  return {
    subject: "You're in: your Yapper Studio beta access",
    text,
    html,
  };
}
