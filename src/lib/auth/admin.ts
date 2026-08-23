/**
 * Who may edit the skill catalog.
 *
 * An allowlist of Clerk ids in the environment rather than a role on the user
 * row, because there is exactly one thing behind this gate and adding a
 * permissions model to guard it would be more surface than the thing it
 * guards. When there is a second admin-only feature, this is the one place that
 * changes.
 *
 * Unset means nobody, deliberately. A misconfigured deploy should lock the
 * catalog rather than open it.
 */
export function adminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return adminUserIds().includes(userId);
}

/** The 404, not a 403: an admin surface that announces itself to everyone who
 * pokes at it is an invitation. */
export function notFound(): Response {
  return Response.json({ error: "not_found" }, { status: 404 });
}
