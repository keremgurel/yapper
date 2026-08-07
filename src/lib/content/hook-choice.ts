import type { ContentHook } from "@/lib/db/schema";

/**
 * Which hook you are actually going with.
 *
 * The chosen hook is the one at position 0, rather than a new stored flag.
 * That is not a shortcut: everything downstream already treats the first hook
 * as the real one. The teleprompter opens its notes view with `hooks[0]`, and
 * the script generator is told to open with the strongest hook it is given.
 * Making the order carry the choice keeps those three in agreement for free,
 * and needs no migration.
 *
 * The rest stay in place as the shortlist, because the discarded options are
 * what you compare against when the chosen one stops feeling right.
 */
export function chooseHook(hooks: ContentHook[], index: number): ContentHook[] {
  if (index <= 0 || index >= hooks.length) return hooks;
  const picked = hooks[index];
  return [picked, ...hooks.filter((_, i) => i !== index)];
}

/** The line that will actually open the video, if there is one. */
export function chosenHook(hooks: ContentHook[]): ContentHook | null {
  return hooks.find((hook) => hook.text.trim()) ?? null;
}
