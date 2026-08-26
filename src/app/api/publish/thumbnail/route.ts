import { auth } from "@clerk/nextjs/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { generateThumbnail } from "@/lib/publish/thumbnail";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > 18 * 1024 * 1024) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }
  const body = (await req.json().catch(() => null)) as {
    prompt?: unknown;
    frame?: unknown;
    reference?: unknown;
  } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 2000) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const billing = await preflightPaidActionOrResponse(
    userId,
    "publish_thumbnail",
  );
  if (billing) return billing;
  const spendLimited = await guardProviderSpend(
    req,
    userId,
    "publish-thumbnail",
  );
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "publish_thumbnail");
  if (access.response) return access.response;

  try {
    const image = await generateThumbnail(
      {
        prompt,
        frame: typeof body?.frame === "string" ? body.frame : undefined,
        reference:
          typeof body?.reference === "string" ? body.reference : undefined,
      },
      req.signal,
    );
    return Response.json({ image, balance: access.reservation.balance });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "generate_failed";
    await refundCreditReservation(userId, access.reservation, detail);
    if (detail === "thumbnail_bad_image") {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    if (detail === "thumbnail_image_too_large") {
      return Response.json({ error: "payload_too_large" }, { status: 413 });
    }
    console.error("[publish] thumbnail generation failed", error);
    return Response.json({ error: "generate_failed" }, { status: 502 });
  }
}
