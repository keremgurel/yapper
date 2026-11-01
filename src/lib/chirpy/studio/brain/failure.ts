import type { OperationRefusal } from "@/lib/http/operation-result";
import { failureFrom, StudioActionFailure } from "../executor";

const SENTENCES: Record<string, string> = {
  ingest_failed: "Naming that paste failed, so the credit was refunded.",
  setup_failed: "Reading that document failed, so the credits were refunded.",
  derive_failed: "Rewriting your voice failed, so nothing changed.",
  no_samples: "Your voice set is empty. Add videos to it first.",
  too_long: "That video is too long to listen to.",
  no_captions:
    "That YouTube video has no captions to read. Nothing was charged.",
};

/** A Brain operation's refusal as a sentence, falling back to the shared
 * wording for billing, rate limits and missing rows. */
export function brainFailure(
  refusal: OperationRefusal,
  subject: string,
): StudioActionFailure {
  const sentence = SENTENCES[refusal.error];
  return sentence
    ? new StudioActionFailure(refusal.error, sentence)
    : failureFrom(refusal, subject);
}
