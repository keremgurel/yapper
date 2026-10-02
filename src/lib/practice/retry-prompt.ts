/**
 * Hands a prompt from a feedback report back to the practice console, so
 * "try this prompt again" opens the exercise on the same question. Session
 * storage keeps it to this tab and it is read once.
 */
const KEY = "yapper:retry-prompt";

export function storeRetryPrompt(prompt: string): void {
  try {
    sessionStorage.setItem(KEY, prompt);
  } catch {
    // Storage can be unavailable (private mode). The exercise still opens.
  }
}

export function takeRetryPrompt(): string | null {
  try {
    const prompt = sessionStorage.getItem(KEY);
    if (prompt) sessionStorage.removeItem(KEY);
    return prompt?.trim() || null;
  } catch {
    return null;
  }
}
