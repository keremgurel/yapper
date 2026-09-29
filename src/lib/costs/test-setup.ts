import { vi } from "vitest";
// Provider/network unit tests do not open the production accounting database.
// The budget's own database and egress tests explicitly unmock this module.
vi.mock("@/lib/costs/provider-budget", () => ({
  guardProviderEgress: vi.fn(() => null),
}));
