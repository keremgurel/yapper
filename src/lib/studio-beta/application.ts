export interface BetaApplicationInput {
  email: string;
  name: string;
  link: string | null;
  useCase: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const BETA_LIMITS = { name: 80, link: 300, useCase: 1000 } as const;

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
};

/**
 * Read an application from the public form. Returns the cleaned application,
 * or the message to show the applicant.
 */
export function parseBetaApplication(
  body: unknown,
): BetaApplicationInput | { error: string } {
  const input = (
    typeof body === "object" && body !== null ? body : {}
  ) as Record<string, unknown>;
  const email = text(input.email, 254)?.toLowerCase() ?? "";
  if (!EMAIL.test(email))
    return { error: "Please enter a valid email address." };
  const name = text(input.name, BETA_LIMITS.name);
  if (!name) return { error: "Please enter your name." };
  return {
    email,
    name,
    link: text(input.link, BETA_LIMITS.link),
    useCase: text(input.useCase, BETA_LIMITS.useCase),
  };
}
