import { cookies } from "next/headers";
import { isBetaApplicationApproved } from "@/lib/db/studio-beta";
import {
  STUDIO_ACCESS_COOKIE,
  studioAccessPassword,
} from "@/lib/studio-access";
import { readTesterCookie } from "./tester-cookie";

/**
 * Whether this request comes from a beta tester whose access was taken away.
 * The proxy accepts any correctly signed tester cookie without a database
 * read; this is the check that makes revoking someone take effect on their
 * next page load instead of when the cookie expires. Team members on the
 * shared password, and requests with no gate at all, are never "revoked".
 */
export async function isRevokedTester(): Promise<boolean> {
  const secret = studioAccessPassword();
  if (!secret) return false;
  const store = await cookies();
  const applicationId = await readTesterCookie(
    secret,
    store.get(STUDIO_ACCESS_COOKIE)?.value,
  );
  if (!applicationId) return false;
  return !(await isBetaApplicationApproved(applicationId));
}
