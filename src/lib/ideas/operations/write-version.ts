import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { getBrainContextSafe } from "@/lib/brain/context/server";
import { isVersionFormat, type VersionFormat } from "@/lib/content/formats";
import { getContentItem } from "@/lib/db/content";
import {
  listContentVersions,
  saveContentVersion,
  type ContentVersionRow,
} from "@/lib/db/content-versions";
import {
  refused,
  refusedBy,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import {
  ideaMaterial,
  versionInput,
  versionSource,
} from "@/lib/ideas/versions/stored";
import { writeVersion } from "@/lib/ideas/versions/write";
import { guardProviderSpend } from "@/lib/provider-rate-limit";

export interface WrittenVersion {
  version: ContentVersionRow;
  balance: number;
  used: Awaited<ReturnType<typeof getBrainContextSafe>>["used"];
}

/**
 * Write one version of an idea from another of its versions (the lead unless
 * `from` names a different one) and save it. Billed like drafting an idea, and
 * refunded when the writing fails, so a failed attempt costs nothing. The
 * canvas (through its route) and Chirpy share it.
 */
export async function writeIdeaVersion(
  request: Request,
  userId: string,
  id: string,
  format: VersionFormat,
  from: unknown,
  signal?: AbortSignal,
): Promise<OperationResult<WrittenVersion>> {
  const item = await getContentItem(userId, id);
  if (!item) return refused(404, "not_found");
  const lead = item.leadFormat as VersionFormat;
  if (format === lead) return refused(409, "lead_format");

  const fromFormat = isVersionFormat(from) ? from : lead;
  if (fromFormat === format) return refused(400, "same_format");
  const versions = await listContentVersions(userId, id);
  const fromRow =
    fromFormat === lead ? item : versions.find((v) => v.format === fromFormat);
  if (!fromRow) return refused(409, "no_source_version");
  const source = versionSource(fromFormat, fromRow);
  if (!source.script && !source.alternatives.length) {
    return refused(409, "empty_source_version");
  }

  if (!process.env.SURPLUS_API_KEY) return refused(501, "no_provider");
  const billing = await preflightPaidActionOrResponse(userId, "expand_idea");
  if (billing) return refusedBy(billing);
  const spendLimited = await guardProviderSpend(
    request,
    userId,
    "ideas-version",
  );
  if (spendLimited) return refusedBy(spendLimited);
  const access = await reservePaidActionOrResponse(userId, "expand_idea");
  if (access.response) return refusedBy(access.response);
  const { reservation } = access;

  try {
    const brain = await getBrainContextSafe(userId, {
      surface: "script",
      format,
      task: [item.title, source.title, source.script.slice(0, 1500)]
        .filter(Boolean)
        .join("\n"),
      signal,
    });
    const written = await writeVersion(
      format,
      ideaMaterial(item),
      source,
      { section: brain.section, pillarNames: brain.pillarNames },
      signal,
    );
    const version = await saveContentVersion(
      userId,
      id,
      format,
      versionInput(written, fromFormat),
    );
    if (!version) throw new Error("version_not_saved");
    return succeeded({
      version,
      balance: reservation.balance,
      used: brain.used,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "version_failed";
    await refundCreditReservation(userId, reservation, detail);
    return refused(
      detail === "no_provider" ? 501 : 502,
      "version_failed",
      detail,
    );
  }
}
