import { auth } from "@clerk/nextjs/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import {
  alignCleanedToContiguousTakes,
  cutsOutsideKeptTakes,
} from "@/lib/studio/contiguous-take-alignment";
import {
  CLEAN_TRANSCRIPT_CRITIC_PROMPT,
  CLEAN_TRANSCRIPT_SYSTEM_PROMPT,
} from "@/lib/studio/clean-transcript-prompt";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { parseCleanTranscriptWords } from "@/lib/studio/clean-transcript-input";
import { fetchBoundedJson, OutboundHttpError } from "@/lib/http/outbound";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_JSON_BYTES = 256 * 1024;
const PROVIDER_TIMEOUT_MS = 50_000;
const MAX_COMPLETION_TOKENS = 8_192;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * AI "remove mistakes" pass. The model is given the transcript as plain speech
 * and returns CLEANED speech (final takes only), then a separate audit pass
 * checks the draft for missing unique ideas and semantic duplicates. The final
 * text is mapped back sentence-by-sentence to contiguous source takes. This
 * makes a cross-retake "Frankenstein" sentence structurally impossible.
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const key = process.env.SURPLUS_API_KEY;
  if (!key) return Response.json({ error: "no_provider" }, { status: 501 });
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.AI_CLEAN_MODEL ?? "gpt-5.4";

  let rawBody: unknown;
  try {
    rawBody = await readBoundedJson(req, { maxBytes: MAX_JSON_BYTES });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = rawBody as Record<string, unknown>;
  if (Array.isArray(body.words) && body.words.length === 0) {
    return Response.json({ cuts: [] });
  }
  const words = parseCleanTranscriptWords(body.words);
  if (!words) return Response.json({ error: "bad_request" }, { status: 400 });

  const rawText = words.map((w) => w.text).join(" ");
  const billing = await preflightPaidActionOrResponse(
    userId,
    "clean_transcript",
  );
  if (billing) return billing;
  const spendLimited = await guardProviderSpend(
    req,
    userId,
    "clean-transcript",
  );
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "clean_transcript");
  if (access.response) return access.response;
  const { reservation } = access;
  // One wall-clock budget covers both model passes, so the critic cannot start
  // a fresh full window after a slow draft.
  const providerDeadline = Date.now() + PROVIDER_TIMEOUT_MS;
  const complete = async (system: string, user: string): Promise<string> => {
    const remainingMs = providerDeadline - Date.now();
    if (remainingMs <= 0) throw new OutboundHttpError("timeout");
    const { response, data } = await fetchBoundedJson<ChatCompletionResponse>(
      `${base}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_completion_tokens: MAX_COMPLETION_TOKENS,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      },
      {
        timeoutMs: remainingMs,
        maxBytes: MAX_PROVIDER_RESPONSE_BYTES,
        signal: req.signal,
      },
    );
    if (!response.ok) throw new Error(`ai_${response.status}`);
    return data.choices?.[0]?.message?.content ?? "";
  };

  try {
    const draft = await complete(CLEAN_TRANSCRIPT_SYSTEM_PROMPT, rawText);
    if (!draft.trim())
      return Response.json({ cuts: [], balance: reservation.balance });
    const cleaned = await complete(
      CLEAN_TRANSCRIPT_CRITIC_PROMPT,
      `ORIGINAL:\n${rawText}\n\nBAD DRAFT:\n${draft}`,
    );
    if (!cleaned.trim())
      return Response.json({ cuts: [], balance: reservation.balance });

    const alignment = alignCleanedToContiguousTakes(words, cleaned);
    // Fail closed. Applying a partial alignment looks like a successful edit
    // while silently deleting content the model intended to keep.
    if (alignment.coverage < 0.92 || alignment.keep.length === 0) {
      await refundCreditReservation(userId, reservation, "unsafe_alignment");
      return Response.json({ error: "unsafe_alignment" }, { status: 502 });
    }
    return Response.json({
      cuts: cutsOutsideKeptTakes(words.length, alignment.keep),
      balance: reservation.balance,
    });
  } catch (e) {
    await refundCreditReservation(
      userId,
      reservation,
      e instanceof Error ? e.message : "ai_failed",
    );
    return Response.json(
      { error: e instanceof Error ? e.message : "ai_failed" },
      { status: 502 },
    );
  }
}
