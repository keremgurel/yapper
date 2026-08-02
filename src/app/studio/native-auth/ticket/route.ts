import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const STATE_PATTERN = /^[a-f0-9-]{32,64}$/i;

/** Mint a one-use Clerk ticket only after the system browser is authenticated. */
export async function GET(request: Request): Promise<Response> {
  const { userId } = await auth();
  const state = new URL(request.url).searchParams.get("state") ?? "";

  if (!STATE_PATTERN.test(state)) {
    return Response.json({ error: "invalid_state" }, { status: 400 });
  }
  if (!userId) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL(
          `/studio/native-auth?state=${encodeURIComponent(state)}`,
          request.url,
        ).toString(),
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
        Pragma: "no-cache",
      },
    });
  }

  const client = await clerkClient();
  const signInToken = await client.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: 60,
  });
  const callback = new URL("yapper-studio://auth/callback");
  callback.searchParams.set("ticket", signInToken.token);
  callback.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: callback.toString(),
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
      Pragma: "no-cache",
    },
  });
}
