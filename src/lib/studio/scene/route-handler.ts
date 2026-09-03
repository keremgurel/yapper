import { auth } from "@clerk/nextjs/server";
import {
  preflightPaidActionOrResponse,
  reservePaidActionOrResponse,
  refundCreditReservation,
  PAID_ACTIONS,
} from "@/lib/billing/actions";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { loadBrandContext } from "./brand-context";
import { parseDirectInput } from "./direct-input";
import { directChecked } from "./direct-checked";
import { parseDesignInput } from "./design-input";
import { designMoments } from "./design-moments";
import { parseReviseInput } from "./revise-input";
import { deliverScene } from "./scene-delivery";
import { callSceneModel, sceneModelFailureReason } from "./scene-model-call";
import {
  REVISE_SYSTEM,
  RETIME_SYSTEM,
  buildReviseUserMessage,
  buildRetimeUserMessage,
} from "./prompts/revise-prompt";
import { extractJsonObject, replyString } from "./reply-json";
import { designChecked } from "./design-checked";

type Mode = "direct" | "design" | "revise";

/** Shared ingress, billing and failure handling for the three scene passes. */
export async function handleSceneRequest(
  req: Request,
  mode: Mode,
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingress = await guardProviderIngress(req);
  if (ingress) return ingress;
  if (!process.env.SURPLUS_API_KEY)
    return Response.json({ error: "no_provider" }, { status: 501 });
  let raw: unknown;
  try {
    raw = await readBoundedJson(req, { maxBytes: 256 * 1024 });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const direct = mode === "direct" ? parseDirectInput(raw) : null;
  const design = mode === "design" ? parseDesignInput(raw) : null;
  const revise = mode === "revise" ? parseReviseInput(raw) : null;
  if (!direct && !design && !revise)
    return Response.json({ error: "bad_request" }, { status: 400 });
  if (direct && !direct.words.length)
    return Response.json({ error: "no_transcript" }, { status: 400 });
  const action = direct
    ? "direct_overlays"
    : design
      ? "design_overlay"
      : revise?.op === "retime"
        ? "retime_overlay"
        : "revise_overlay";
  const quantity = design?.moments.length ?? 1;
  const preflight = await preflightPaidActionOrResponse(userId, action, {
    quantity,
  });
  if (preflight) return preflight;
  const limited = await guardProviderSpend(
    req,
    userId,
    mode === "direct"
      ? "direct-overlays"
      : mode === "design"
        ? "design-overlays"
        : "revise-overlay",
  );
  if (limited) return limited;
  const access = await reservePaidActionOrResponse(userId, action, {
    quantity,
  });
  if (access.response) return access.response;
  const reservation = access.reservation;
  const imageHolds: { release(reason: string): Promise<void> }[] = [];
  const reserveImage = async () => {
    const hold = await reservePaidActionOrResponse(userId, "scene_image");
    if (hold.response) return null;
    let released = false;
    const imageHold = {
      release: async (reason: string) => {
        if (released) return;
        released = true;
        await refundCreditReservation(userId, hold.reservation, reason);
      },
    };
    imageHolds.push(imageHold);
    return imageHold;
  };
  try {
    const brand = await loadBrandContext(userId);
    const model =
      process.env.AI_OVERLAY_MODEL ??
      (revise?.op === "retime"
        ? (process.env.AI_PLACE_MODEL ?? "gpt-5.4-mini")
        : direct
          ? (process.env.AI_DIRECT_MODEL ?? "claude-opus-4.7")
          : "claude-opus-4.7");
    if (direct) {
      const reviewed = await directChecked(direct, brand, model, req.signal);
      return Response.json({
        ...reviewed,
        brand,
        model,
      });
    }
    if (design) {
      const result = await designMoments({
        ...design,
        brand,
        model,
        signal: req.signal,
        reserveImage,
      });
      if (result.failed.length)
        await refundCreditReservation(
          userId,
          reservation,
          "partial_design_failure",
          {
            amount: result.failed.length * PAID_ACTIONS.design_overlay.credits,
          },
        );
      return Response.json({ ...result, brand, model });
    }
    if (revise?.op === "retime") {
      const { content } = await callSceneModel({
        model,
        system: RETIME_SYSTEM,
        user: buildRetimeUserMessage(revise),
        maxCompletionTokens: 600,
        timeoutMs: 60_000,
        signal: req.signal,
      });
      const reply = extractJsonObject(content);
      if (!reply) throw new Error("invalid_reply");
      return Response.json({
        quote: replyString(reply.quote, 400) ?? "",
        cue: replyString(reply.cue, 80),
      });
    }
    if (revise?.op === "restyle") {
      const content = await designChecked({
        model,
        system: REVISE_SYSTEM,
        user: buildReviseUserMessage(revise, brand),
        quality: {
          widthPx: revise.box.widthPx,
          heightPx: revise.box.heightPx,
          frameHeightPx: revise.frameHeightPx,
          requireMotion: /animat|motion|counter/i.test(revise.instruction),
        },
        duration: revise.duration,
        hasBrandLogo: brand.logos.length > 0,
        existingImageKeys: sceneImageKeys(revise.asset.scene),
        signal: req.signal,
      });
      const result = await deliverScene({
        id: "revision",
        reply: content,
        fallback: revise.asset,
        frameHeightPx: revise.frameHeightPx,
        boxHeightPx: revise.box.heightPx,
        takenNames: [],
        reserveImage,
        signal: req.signal,
        existingImageKeys: sceneImageKeys(revise.asset.scene),
        hasBrandLogo: brand.logos.length > 0,
      });
      if (!result.ok) throw new Error(result.failed.reason);
      return Response.json({ ...result.scene, brand, model });
    }
    throw new Error("bad_request");
  } catch (error) {
    await Promise.all(imageHolds.map((hold) => hold.release("request_failed")));
    await refundCreditReservation(
      userId,
      reservation,
      sceneModelFailureReason(error),
    );
    return Response.json(
      { error: sceneModelFailureReason(error) },
      { status: 502 },
    );
  }
}

/** Existing references survive restyling; they remain local to the asset. */
function sceneImageKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, unknown>;
  const asset =
    typeof node.asset === "string" &&
    /^image:[A-Za-z0-9_-]{1,40}$/.test(node.asset)
      ? [node.asset.slice(6)]
      : [];
  return [
    ...asset,
    ...[node.nodes, node.children].flatMap((children) =>
      Array.isArray(children) ? children.flatMap(sceneImageKeys) : [],
    ),
  ];
}
