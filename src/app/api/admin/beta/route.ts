import { auth } from "@clerk/nextjs/server";
import { isAdmin, notFound } from "@/lib/auth/admin";
import { listBetaApplications } from "@/lib/db/studio-beta";

export const runtime = "nodejs";

/** Every beta application, for the admin panel. The code hash never leaves the
 * server; the panel only needs to know whether a code exists. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!isAdmin(userId)) return notFound();
  const applications = await listBetaApplications();
  return Response.json({
    applications: applications.map(({ accessCodeHash, ...rest }) => ({
      ...rest,
      hasCode: accessCodeHash !== null,
    })),
  });
}
