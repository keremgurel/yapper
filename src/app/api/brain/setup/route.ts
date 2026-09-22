import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import {
  proposeBrainSetup,
  SETUP_DOCUMENT_MAX,
  SETUP_ESSENTIAL_KEYS,
  type BrainSetupInput,
} from "@/lib/brain/setup";
import { listPillars } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Read one document and propose the whole Brain from it.
 *
 * Nothing is saved here. The proposal goes back to a preview the creator
 * edits field by field, and applying is the ordinary project patch and block
 * creates.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const document =
    typeof body.document === "string"
      ? body.document.slice(0, SETUP_DOCUMENT_MAX)
      : "";
  if (document.trim().length < 40) {
    return Response.json({ error: "no_input" }, { status: 400 });
  }

  await ensureUser(userId);
  if (!process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const billing = await preflightPaidActionOrResponse(userId, "ingest_context");
  if (billing) return billing;

  const spendLimited = await guardProviderSpend(req, userId, "brain-ingest");
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "ingest_context");
  if (access.response) return access.response;
  const { reservation } = access;

  try {
    const project = await getActiveProject(userId);
    const pillars = await listPillars(project.id);
    const current: BrainSetupInput["current"] = {
      essentials: Object.fromEntries(
        SETUP_ESSENTIAL_KEYS.map((key) => [
          key,
          String((project as Record<string, unknown>)[key] ?? "").slice(0, 700),
        ]).filter(([, value]) => value),
      ),
      pillars: pillars.map((pillar) => ({
        name: pillar.name,
        description: pillar.description.slice(0, 300),
      })),
    };
    const proposal = await proposeBrainSetup({ document, current }, req.signal);
    return Response.json({ proposal, balance: reservation.balance });
  } catch (error) {
    await refundCreditReservation(userId, reservation, "setup_failed");
    console.error("[brain/setup] failed", error);
    return Response.json({ error: "setup_failed" }, { status: 502 });
  }
}
