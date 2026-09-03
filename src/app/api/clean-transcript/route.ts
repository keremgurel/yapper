import { auth } from "@clerk/nextjs/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import {
  numberedTranscript,
  RETAKE_PROMPT,
} from "@/lib/studio/retake-clusters";
import { cutsFromKeptSpans } from "@/lib/studio/retake-keep-spans";
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
// This is a whole-take reading job: a correction may arrive several sentences
// after the attempt it replaces. It gets five minutes, which is the deployment
// limit; on a provider stall it refunds rather than applying a partial edit.
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
// The keep-only contract measured about 350 completion tokens on the 1,399-word
// production take. Gemini counts hidden thinking against this cap, so it must
// leave room to think as well as to answer; 8,000 did on every measured run,
// while the previous model at 16,000 still ran out mid-answer.
const MAX_COMPLETION_TOKENS = 8_000;
const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  /**
   * The gateway answers 200 and puts the provider's failure in the body. Seen
   * in production: a 503 "provider_overloaded" arriving inside an otherwise
   * ordinary looking completion with empty content.
   */
  error?: { code?: number; message?: string };
}

/** Worth asking again: the model was busy, not wrong. */
function isTransient(error: { code?: number } | undefined, answer: string) {
  if (!answer.trim()) return true;
  const code = error?.code;
  return code === 429 || code === 500 || code === 502 || code === 503;
}

const ATTEMPTS = 3;
const RETRY_PAUSE_MS = 1_500;

function isRetryableProviderFailure(error: unknown): boolean {
  if (error instanceof OutboundHttpError) {
    return error.code === "network_error" || error.code === "invalid_response";
  }
  return error instanceof Error && /^ai_(429|5\d\d)$/.test(error.message);
}

/**
 * The AI "remove mistakes" pass.
 *
 * The model is given the transcript as numbered words and answers with the word
 * ranges that survive; everything else is deleted. Nothing is matched back by
 * text, so the failure that used to define this route, a cleaned script that
 * could not be told apart from the wrong attempt at the same line, cannot
 * happen. A response that does not describe a coherent edit is refused whole.
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
  // The default is selected from repeatable, word-level scoring against a
  // hand-audited real take (docs/one-click-benchmark-review.md, Part 2): on
  // this contract it scored F1 0.986 in about 20 seconds, where gemini-3.1-pro
  // took 100 seconds and failed its own contract on every run. Keep the
  // environment override for canaries. Do not send a `reasoning` parameter:
  // Google rejects it with a 400 through the gateway.
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

  const deadline = Date.now() + PROVIDER_TIMEOUT_MS;
  try {
    let answer = "";
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("timeout");
      try {
        const { response, data } =
          await fetchBoundedJson<ChatCompletionResponse>(
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
                  { role: "system", content: RETAKE_PROMPT },
                  { role: "user", content: numberedTranscript(words) },
                ],
              }),
            },
            {
              timeoutMs: remaining,
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
        answer = data.choices?.[0]?.message?.content ?? "";
        if (answer.trim() && !data.error) break;
        // An overloaded model comes back in a couple of seconds, so asking again
        // costs almost nothing and usually works. What must not happen is this
        // returning as an edit with nothing in it: the editor reads no cuts as a
        // take with no retakes in it, and quietly falls back to matching text
        // locally, which is the guesswork the model is here to replace.
        if (!isTransient(data.error, answer)) {
          throw new Error(
            data.error?.code ? `ai_${data.error.code}` : "empty_answer",
          );
        }
        if (attempt === ATTEMPTS - 1) {
          throw new Error(
            data.error?.code ? `ai_${data.error.code}` : "empty_answer",
          );
        }
      } catch (error) {
        if (
          attempt === ATTEMPTS - 1 ||
          !isRetryableProviderFailure(error) ||
          deadline - Date.now() <= RETRY_PAUSE_MS
        ) {
          throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    }

    const cuts = cutsFromKeptSpans(answer, words.length);
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
