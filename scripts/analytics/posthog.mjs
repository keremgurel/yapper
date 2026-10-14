import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function credentials(root = process.cwd()) {
  let file = {};
  try {
    file = Object.fromEntries(
      readFileSync(resolve(root, ".env.local"), "utf8")
        .split("\n")
        .filter((line) => /^[A-Z0-9_]+=/.test(line))
        .map((line) => {
          const at = line.indexOf("=");
          return [
            line.slice(0, at),
            line.slice(at + 1).replace(/^["']|["']$/g, ""),
          ];
        }),
    );
  } catch {
    /* CI supplies environment variables. */
  }
  return { ...file, ...process.env };
}

export function posthogAPI(env) {
  if (!env.POSTHOG_PERSONAL_API_KEY || env.POSTHOG_PROJECT_ID !== "383795") {
    throw new Error(
      "Set Yapper POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID=383795 in .env.local.",
    );
  }
  const host = env.POSTHOG_API_HOST || "https://us.posthog.com";
  if (host !== "https://us.posthog.com")
    throw new Error("Unexpected Yapper API host");
  return async (path, body, method = body ? "POST" : "GET") => {
    let response;
    for (let attempt = 0; attempt < 4; attempt++) {
      response = await fetch(`${host}/api/projects/383795${path}`, {
        method,
        signal: AbortSignal.timeout(90_000),
        headers: {
          Authorization: `Bearer ${env.POSTHOG_PERSONAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (
        !(method === "GET" || method === "PATCH" || path === "/query/") ||
        ![429, 502, 503, 504].includes(response.status) ||
        attempt === 3
      )
        break;
      await response.arrayBuffer();
      await new Promise((resolve) =>
        setTimeout(resolve, 3_000 * (attempt + 1)),
      );
    }
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        `PostHog ${response.status}: ${JSON.stringify(data.detail ?? data.error ?? "request failed")}`,
      );
    return data;
  };
}
