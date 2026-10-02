import type { StudioBetaStatus } from "@/lib/db/schema";

/** One application as the admin panel sees it. Dates arrive as ISO strings. */
export interface AdminBetaApplication {
  id: string;
  email: string;
  name: string;
  link: string | null;
  useCase: string | null;
  status: StudioBetaStatus;
  hasCode: boolean;
  createdAt: string;
  decidedAt: string | null;
  invitedAt: string | null;
  lastAccessAt: string | null;
}

/** What approving returns: the code, shown once, and whether it was emailed. */
export interface IssuedInvite {
  code: string;
  emailed: boolean;
  emailProblem: "not_configured" | "failed" | null;
}

export async function listBetaApplications(): Promise<AdminBetaApplication[]> {
  const response = await fetch("/api/admin/beta");
  if (!response.ok) throw new Error("load_failed");
  const body = (await response.json()) as {
    applications: AdminBetaApplication[];
  };
  return body.applications;
}

export async function decideBetaApplication(
  id: string,
  action: "approve" | "reject" | "revoke",
): Promise<IssuedInvite | null> {
  const response = await fetch(`/api/admin/beta/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) throw new Error("action_failed");
  const body = (await response.json()) as Partial<IssuedInvite>;
  return body.code
    ? {
        code: body.code,
        emailed: body.emailed === true,
        emailProblem: body.emailProblem ?? null,
      }
    : null;
}
