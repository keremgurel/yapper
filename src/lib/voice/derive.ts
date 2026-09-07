import { fetchBoundedJson } from "@/lib/http/outbound";
import { undash } from "@/lib/text/undash";
import {
  DERIVE_SYSTEM,
  describeSamples,
  type DeriveSample,
} from "@/lib/voice/derive-prompt";

const PROVIDER_TIMEOUT_MS = 40_000;
const MAX_COMPLETION_TOKENS = 1_200;
const MAX_PROVIDER_RESPONSE_BYTES = 512 * 1024;
const FIELD_CAP = 700;

export interface DerivedVoice {
  voice: string;
  scriptingPatterns: string;
  whatIMake: string;
  audience: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
}

function field(raw: Record<string, unknown>, key: keyof DerivedVoice): string {
  const value = raw[key];
  return typeof value === "string"
    ? undash(value.trim()).slice(0, FIELD_CAP)
    : "";
}

export function parseDerivedVoice(content: string): DerivedVoice {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("voice_unparseable");
  }
  if (!raw || typeof raw !== "object") throw new Error("voice_unparseable");
  const record = raw as Record<string, unknown>;
  const derived: DerivedVoice = {
    voice: field(record, "voice"),
    scriptingPatterns: field(record, "scriptingPatterns"),
    whatIMake: field(record, "whatIMake"),
    audience: field(record, "audience"),
  };
  if (!derived.voice && !derived.scriptingPatterns) {
    throw new Error("voice_empty");
  }
  return derived;
}

/** Turns the creator's own transcripts into an editable voice profile. */
export async function deriveVoice(
  samples: DeriveSample[],
  signal?: AbortSignal,
): Promise<DerivedVoice> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.GENERATE_MODEL ?? "gpt-5.4-mini";

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
        temperature: 0.3,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DERIVE_SYSTEM },
          { role: "user", content: describeSamples(samples) },
        ],
      }),
    },
    {
      timeoutMs: PROVIDER_TIMEOUT_MS,
      maxBytes: MAX_PROVIDER_RESPONSE_BYTES,
      signal,
    },
  );
  if (!response.ok) throw new Error(`voice_${response.status}`);
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("voice_truncated");
  return parseDerivedVoice(choice?.message?.content ?? "{}");
}
