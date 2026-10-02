"use client";

import type {
  AdminBetaApplication,
  IssuedInvite,
} from "@/lib/admin/beta-client";
import IssuedCode from "@/components/admin/beta/issued-code";
import { Button } from "@/components/ui/button";
import styles from "./beta-admin.module.css";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const href = (link: string) =>
  /^https?:\/\//i.test(link) ? link : `https://${link}`;

function history(application: AdminBetaApplication): string {
  const parts = [`Applied ${day(application.createdAt)}`];
  if (application.invitedAt)
    parts.push(`invited ${day(application.invitedAt)}`);
  if (application.lastAccessAt)
    parts.push(`last opened Studio ${day(application.lastAccessAt)}`);
  else if (application.status === "approved")
    parts.push("has not opened Studio yet");
  return parts.join(", ");
}

/** One applicant: who they are, what they said, and what can be done next. */
export default function ApplicationCard({
  application,
  invite,
  busy,
  onAction,
}: {
  application: AdminBetaApplication;
  /** Set right after this application was approved in this session. */
  invite: IssuedInvite | null;
  busy: boolean;
  onAction: (action: "approve" | "reject" | "revoke") => void;
}) {
  const { status } = application;
  return (
    <li className={styles.card}>
      <div className={styles.who}>
        <p className={styles.name}>{application.name}</p>
        <a href={`mailto:${application.email}`}>{application.email}</a>
        {application.link && (
          <a
            href={href(application.link)}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.link}
          >
            {application.link}
          </a>
        )}
      </div>
      {application.useCase && (
        <p className={styles.useCase}>{application.useCase}</p>
      )}
      <p className={styles.history}>{history(application)}</p>
      {invite && <IssuedCode invite={invite} email={application.email} />}
      <div className={styles.actions}>
        {status !== "approved" && (
          <Button size="sm" disabled={busy} onClick={() => onAction("approve")}>
            {status === "pending" ? "Approve and invite" : "Approve after all"}
          </Button>
        )}
        {status === "approved" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAction("approve")}
          >
            Send a new code
          </Button>
        )}
        {status === "pending" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAction("reject")}
          >
            Decline
          </Button>
        )}
        {status === "approved" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAction("revoke")}
          >
            Revoke access
          </Button>
        )}
      </div>
    </li>
  );
}
