import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Auth = { protect: () => Promise<void> };
type Handler = (auth: Auth, request: NextRequest) => Promise<void>;
const middleware = vi.hoisted(() =>
  vi.fn<(handler: Handler, options: unknown) => Handler>((handler) => handler),
);

vi.mock("@clerk/nextjs/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@clerk/nextjs/server")>()),
  clerkMiddleware: middleware,
}));

await import("./proxy");
const handler = middleware.mock.calls[0][0];
const protect = vi.fn(async () => {});

async function visit(path: string, native = false) {
  await handler(
    { protect },
    new NextRequest(`https://ypr.app${path}`, {
      headers: {
        "user-agent": native ? "YapperStudioNative/1.0" : "Mozilla/5.0",
      },
    }),
  );
}

describe("Studio authentication entry", () => {
  beforeEach(() => protect.mockClear());

  it("uses the branded authentication routes", () => {
    expect(middleware.mock.calls[0][1]).toEqual({
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
    });
  });

  it.each([
    "/sign-in",
    "/sign-in/factor-one",
    "/sign-in/sso-callback",
    "/sign-up",
    "/sign-up/verify-email-address",
    "/studio/native-auth",
    "/studio/handoff",
  ])("allows signed-out visitors to reach %s", async (path) => {
    await visit(path);
    expect(protect).not.toHaveBeenCalled();
  });

  it.each(["/studio/home", "/studio/library/123", "/api/content"])(
    "still requires authentication for %s",
    async (path) => {
      await visit(path);
      expect(protect).toHaveBeenCalledOnce();
    },
  );

  it("allows the native sign-in shell without exempting native API requests", async () => {
    await visit("/studio/home", true);
    expect(protect).not.toHaveBeenCalled();
    await visit("/api/content", true);
    expect(protect).toHaveBeenCalledOnce();
  });
});
