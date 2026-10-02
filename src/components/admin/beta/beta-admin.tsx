"use client";

import { useEffect, useState } from "react";
import ApplicationCard from "@/components/admin/beta/application-card";
import { PageHeader } from "@/components/studio-ui";
import {
  decideBetaApplication,
  listBetaApplications,
  type AdminBetaApplication,
  type IssuedInvite,
} from "@/lib/admin/beta-client";
import type { StudioBetaStatus } from "@/lib/db/schema";
import styles from "./beta-admin.module.css";

const TABS: { status: StudioBetaStatus; label: string; empty: string }[] = [
  {
    status: "pending",
    label: "Waiting",
    empty: "No applications are waiting.",
  },
  {
    status: "approved",
    label: "Testers",
    empty: "No one has been approved yet.",
  },
  { status: "rejected", label: "Declined", empty: "No one has been declined." },
  { status: "revoked", label: "Revoked", empty: "No access has been revoked." },
];

/**
 * The private beta: who applied, who is in, and the buttons to decide. An
 * approval issues the tester's access code and emails their invitation.
 */
export default function BetaAdmin() {
  const [applications, setApplications] = useState<
    AdminBetaApplication[] | null
  >(null);
  const [tab, setTab] = useState<StudioBetaStatus>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invites, setInvites] = useState<Record<string, IssuedInvite>>({});
  const [failed, setFailed] = useState(false);

  const load = () =>
    listBetaApplications().then(setApplications, () => {
      setApplications([]);
      setFailed(true);
    });
  useEffect(() => {
    void load();
  }, []);

  const act = async (
    application: AdminBetaApplication,
    action: "approve" | "reject" | "revoke",
  ) => {
    if (
      action === "revoke" &&
      !window.confirm(`Revoke Studio access for ${application.email}?`)
    )
      return;
    setBusyId(application.id);
    setFailed(false);
    try {
      const invite = await decideBetaApplication(application.id, action);
      if (invite) {
        setInvites((current) => ({ ...current, [application.id]: invite }));
        setTab("approved");
      }
      await load();
    } catch {
      setFailed(true);
    } finally {
      setBusyId(null);
    }
  };

  const shown = applications?.filter((item) => item.status === tab) ?? [];
  const current = TABS.find((item) => item.status === tab)!;

  return (
    <div className="w-full space-y-6 pb-12">
      <PageHeader
        title="Private beta"
        description="People who applied to test Studio. Approving someone issues their personal access code and emails the invitation."
      />
      <div className={styles.tabs} role="tablist" aria-label="Applications">
        {TABS.map((item) => (
          <button
            key={item.status}
            type="button"
            role="tab"
            aria-selected={tab === item.status}
            onClick={() => setTab(item.status)}
          >
            {item.label}
            <span>
              {applications?.filter((a) => a.status === item.status).length ??
                0}
            </span>
          </button>
        ))}
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          That did not go through. Reload and try again.
        </p>
      )}
      {applications === null ? (
        <p className="text-muted-foreground text-sm">Loading applications…</p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">{current.empty}</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              invite={invites[application.id] ?? null}
              busy={busyId === application.id}
              onAction={(action) => void act(application, action)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
