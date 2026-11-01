import { removeBrandAsset } from "@/lib/db/brand";
import { drainR2AfterResponse } from "@/lib/db/r2-drain";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

/** Remove one of the creator's logos, give its bytes back to their storage,
 * and delete the file once the response has gone out. */
export async function deleteBrandLogo(
  userId: string,
  id: string,
): Promise<OperationResult<null>> {
  if (!(await removeBrandAsset(userId, id))) return refused(404, "not_found");
  drainR2AfterResponse();
  return succeeded(null);
}
