import { auth } from "@clerk/nextjs/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import {
  numberedTranscript,
  RETAKE_CLUSTER_PROMPT,
  retakeCutsFromResponse,
} from "@/lib/studio/retake-clusters";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { parseCleanTranscriptWords } from "@/lib/studio/clean-transcript-input";
import { fetchBoundedJson } from "@/lib/http/outbound";

export const runtime = "nodejs";
// The model works through every retake cluster before it answers, so this is a
// reading job measured in minutes, not seconds, and the time grows with the
// take: 472 words took half a minute, 1,888 took four. The route accepts 5,000,
// so the budget would need about ten minutes. It gets five, because that is
// what the Hobby plan allows a function; past roughly 2,200 words the request
// gives up and refunds rather than returning half an edit.
//
// It reads the take whole. Splitting it was the obvious way to keep the wall
// clock flat, and it was wrong: a boundary has to miss every retake cluster,
// and the speaker's own silences do not mark them. Measured on a real take,
// the longest pause in the whole recording, eighteen seconds, sits in the
// middle of one — he stopped, thought, and ran the line again. Splitting there
// scored 57 lost words and 58 retakes left in, where reading it whole scored
// nothing wrong at all.
export const maxDuration = 300;
const MAX_JSON_BYTES = 256 * 1024;
const PROVIDER_TIMEOUT_MS = 280_000;
// The answer quotes every attempt it found before deciding between them, which
// is what makes it accurate, and that scales with the take.
const MAX_COMPLETION_TOKENS = 32_000;
const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
}

/**
 * The AI "remove mistakes" pass.
 *
 * The model is given the transcript as numbered words and answers with the word
 * ranges to delete, grouped by retake cluster. Nothing is matched back by text,
 * so the failure that used to define this route — a cleaned script that could
 * not be told apart from the wrong attempt at the same line — cannot happen.
 * A response that does not describe a coherent edit is refused whole.
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
  // Measured against a real 472 word take with a hand-checked answer, twice:
  // this model got every word right both times. The next best left 17 wrong,
  // and what shipped before this left 92.
  const model = process.env.AI_CLEAN_MODEL ?? "gemini-3.7-flash";

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

  try {
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
            { role: "system", content: RETAKE_CLUSTER_PROMPT },
            { role: "user", content: numberedTranscript(words) },
          ],
        }),
      },
      {
        timeoutMs: PROVIDER_TIMEOUT_MS,
        maxBytes: MAX_PROVIDER_RESPONSE_BYTES,
        signal: req.signal,
      },
    );
    if (!response.ok) throw new Error(`ai_${response.status}`);
    // Fail closed on a cut-off answer. Half a decision applied at full
    // confidence looks exactly like a successful edit that lost the ending.
    if (data.choices?.[0]?.finish_reason === "length") {
      throw new Error("transcript_too_long");
    }
    const answer = data.choices?.[0]?.message?.content ?? "";
    if (!answer.trim())
      return Response.json({ cuts: [], balance: reservation.balance });

    const cuts = retakeCutsFromResponse(answer, words.length);
    if (!cuts) {
      await refundCreditReservation(userId, reservation, "unreadable_edit");
      return Response.json({ error: "unreadable_edit" }, { status: 502 });
    }
    return Response.json({ cuts, balance: reservation.balance });
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
