import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
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
} from "@/lib/db/content-versions";
import {
  ideaMaterial,
  versionInput,
  versionSource,
} from "@/lib/ideas/versions/stored";
import { writeVersion } from "@/lib/ideas/versions/write";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string; format: string }> };

/**
 * Write one version of an idea from another of its versions (the lead unless
 * the body names a different one) and save it. Billed like drafting an idea,
 * and refunded when the writing fails, so a failed attempt costs nothing.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const { id, format } = await params;
  if (!isVersionFormat(format)) {
    return Response.json({ error: "bad_format" }, { status: 400 });
  }
  const item = await getContentItem(userId, id);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });
  const lead = item.leadFormat as VersionFormat;
  if (format === lead) {
    return Response.json({ error: "lead_format" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fromFormat = isVersionFormat(body.from) ? body.from : lead;
  if (fromFormat === format) {
    return Response.json({ error: "same_format" }, { status: 400 });
  }
  const versions = await listContentVersions(userId, id);
  const fromRow =
    fromFormat === lead ? item : versions.find((v) => v.format === fromFormat);
  if (!fromRow) {
    return Response.json({ error: "no_source_version" }, { status: 409 });
  }
  const from = versionSource(fromFormat, fromRow);
  if (!from.script && !from.alternatives.length) {
    return Response.json({ error: "empty_source_version" }, { status: 409 });
  }

  if (!process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const billing = await preflightPaidActionOrResponse(userId, "expand_idea");
  if (billing) return billing;
  const spendLimited = await guardProviderSpend(req, userId, "ideas-version");
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "expand_idea");
  if (access.response) return access.response;
  const { reservation } = access;

  const brain = await getBrainContextSafe(userId, {
    surface: "script",
    format,
    task: [item.title, from.title, from.script.slice(0, 1500)]
      .filter(Boolean)
      .join("\n"),
    signal: req.signal,
  });
  try {
    const written = await writeVersion(
      format,
      ideaMaterial(item),
      from,
      { section: brain.section, pillarNames: brain.pillarNames },
      req.signal,
    );
    const version = await saveContentVersion(
      userId,
      id,
      format,
      versionInput(written, fromFormat),
    );
    if (!version) throw new Error("version_not_saved");
    return Response.json({
      version,
      balance: reservation.balance,
      used: brain.used,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "version_failed";
    await refundCreditReservation(userId, reservation, detail);
    const status = detail === "no_provider" ? 501 : 502;
    return Response.json({ error: "version_failed", detail }, { status });
  }
}
