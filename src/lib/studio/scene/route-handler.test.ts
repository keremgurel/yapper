import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ingress: vi.fn(),
  spend: vi.fn(),
  preflight: vi.fn(),
  reserve: vi.fn(),
  refund: vi.fn(),
  model: vi.fn(),
  image: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.ingress,
  guardProviderSpend: mocks.spend,
}));
vi.mock("@/lib/billing/actions", () => ({
  preflightPaidActionOrResponse: mocks.preflight,
  reservePaidActionOrResponse: mocks.reserve,
  refundCreditReservation: mocks.refund,
  PAID_ACTIONS: { design_overlay: { credits: 2 } },
}));
vi.mock("./brand-context", () => ({
  loadBrandContext: async () => ({
    palette: {
      primary: "#ff0000",
      secondary: "#000000",
      accent: "#ff0000",
      ink: "#000000",
      surface: "#ffffff",
      muted: "#888888",
    },
    logos: [],
    colors: [],
    hasKit: false,
  }),
}));
vi.mock("./scene-model-call", () => ({
  callSceneModel: mocks.model,
  sceneModelFailureReason: () => "ai_failed",
}));
vi.mock("./generate-scene-image", () => ({ generateSceneImage: mocks.image }));

import { handleSceneRequest } from "./route-handler";
import { DIRECT_SYSTEM } from "./prompts/direct-prompt";

const scene = {
  version: 1,
  duration: 2,
  nodes: [
    {
      id: "card",
      type: "rect",
      x: 0.5,
      y: 0.5,
      width: 1,
      height: 1,
      fill: "brand.primary",
    },
  ],
  animations: [],
};
const moment = {
  id: "one",
  name: "Growing red card",
  description: "A red card expands",
  brief: "Make a growing red card",
  kind: "other",
  quote: "we have grown",
  duration: 2,
  box: { aspect: 1.6, widthPx: 640, heightPx: 400 },
};
const design = { frameAspect: 1.77, frameHeightPx: 1080, moments: [moment] };
const request = (body: unknown) =>
  new Request("https://ypr.app/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SURPLUS_API_KEY", "test");
  mocks.auth.mockResolvedValue({ userId: "user" });
  mocks.ingress.mockResolvedValue(null);
  mocks.spend.mockResolvedValue(null);
  mocks.preflight.mockResolvedValue(null);
  mocks.reserve.mockResolvedValue({
    reservation: { cost: 2, quantity: 1, usageId: "test" },
  });
  mocks.model.mockResolvedValue({
    content: JSON.stringify({
      scene,
      name: moment.name,
      description: moment.description,
    }),
  });
  mocks.image.mockResolvedValue(null);
});

describe("generated overlay routes", () => {
  it("requires authentication before model or billing calls", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await handleSceneRequest(request(design), "design")).status).toBe(
      401,
    );
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("rejects invalid designs before spending", async () => {
    expect(
      (await handleSceneRequest(request({ ...design, moments: [] }), "design"))
        .status,
    ).toBe(400);
    expect(mocks.model).not.toHaveBeenCalled();
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("delivers a validated scene and brand context", async () => {
    const response = await handleSceneRequest(request(design), "design");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.scenes[0]).toMatchObject({
      id: "one",
      name: moment.name,
      scene: { duration: 2 },
    });
    expect(body.brand.palette.primary).toBe("#ff0000");
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("refunds failed designs", async () => {
    mocks.model.mockResolvedValue({ content: "not json" });
    const body = await (
      await handleSceneRequest(request(design), "design")
    ).json();
    expect(body.scenes).toEqual([]);
    expect(body.failed).toHaveLength(1);
    expect(mocks.refund).toHaveBeenCalledWith(
      "user",
      expect.anything(),
      "partial_design_failure",
      { amount: 2 },
    );
  });
  it("refunds malformed director replies rather than claiming no useful moments", async () => {
    mocks.model.mockResolvedValue({ content: "{}" });
    const response = await handleSceneRequest(
      request({ words: [{ text: "hello" }] }),
      "direct",
    );
    expect(response.status).toBe(502);
    expect(mocks.refund).toHaveBeenCalled();
  });
  it("allows a deliberate no-overlay decision", async () => {
    vi.stubEnv("AI_OVERLAY_MODEL", undefined);
    vi.stubEnv("AI_DIRECT_MODEL", undefined);
    mocks.model.mockResolvedValue({
      content: '{"moments":[],"passedOn":"The speech is already clear."}',
    });
    const response = await handleSceneRequest(
      request({ words: [{ text: "hello" }] }),
      "direct",
    );
    expect(response.status).toBe(200);
    expect((await response.json()).moments).toEqual([]);
    expect(mocks.model).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-4.7",
        system: DIRECT_SYSTEM,
      }),
    );
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("preserves existing pictures during a restyle without regenerating them", async () => {
    const pictured = {
      ...scene,
      nodes: [
        {
          id: "picture",
          type: "image",
          x: 0.5,
          y: 0.5,
          width: 1,
          height: 1,
          asset: "image:existing",
        },
      ],
    };
    mocks.model.mockResolvedValue({
      content: JSON.stringify({
        scene: pictured,
        name: moment.name,
        description: moment.description,
      }),
    });
    const response = await handleSceneRequest(
      request({
        op: "restyle",
        instruction: "make it minimal",
        frameAspect: 1.77,
        frameHeightPx: 1080,
        duration: 2,
        box: moment.box,
        asset: { ...moment, scene: pictured },
      }),
      "revise",
    );
    expect(response.status).toBe(200);
    expect((await response.json()).scene.nodes[0].asset).toBe("image:existing");
    expect(mocks.image).not.toHaveBeenCalled();
  });
  it("leaves visual concepts open-ended", () => {
    expect(DIRECT_SYSTEM).toContain("no template catalogue");
    expect(DIRECT_SYSTEM).not.toContain(
      "transitions between points do not qualify",
    );
    expect(DIRECT_SYSTEM).toContain("not a design constraint");
  });
});
