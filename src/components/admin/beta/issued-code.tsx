"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { IssuedInvite } from "@/lib/admin/beta-client";
import styles from "./beta-admin.module.css";

/**
 * Shown once, right after approving: the tester's access code and whether the
 * invitation went out. The code is not stored in a readable form, so this is
 * the only time it can be copied.
 */
export default function IssuedCode({
  invite,
  email,
}: {
  invite: IssuedInvite;
  email: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(invite.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className={styles.issued} role="status">
      <div>
        <p className={styles.issuedLabel}>Access code</p>
        <p className={styles.code}>{invite.code}</p>
      </div>
      <button type="button" onClick={copy} className={styles.copy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <p className={styles.issuedNote}>
        {invite.emailed
          ? `Invitation emailed to ${email}. This code is not shown again.`
          : invite.emailProblem === "not_configured"
            ? `Email sending is not set up, so nothing was sent. Send this code to ${email} yourself. It is not shown again.`
            : `The email to ${email} failed. Send this code yourself, or approve again to issue a new one.`}
      </p>
    </div>
  );
}
