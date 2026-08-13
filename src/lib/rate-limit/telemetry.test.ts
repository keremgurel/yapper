import { describe, expect, it, vi } from "vitest";
import { recordRateLimitTelemetry } from "./telemetry";

describe("rate-limit telemetry privacy", () => {
  it("emits only the fixed privacy-safe dimensions", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    recordRateLimitTelemetry({
      outcome: "denied",
      scope: "ip:provider-ingress",
      actor: "ip",
      unknownIp: true,
    });
    expect(info).toHaveBeenCalledWith("[rate-limit]", {
      outcome: "denied",
      scope: "ip:provider-ingress",
      actor: "ip",
      unknownIp: true,
    });
  });
});
