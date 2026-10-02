import { describe, expect, it } from "vitest";
import { PRODUCT_SPLIT_AT, trainSharesStudioWallet } from "./shared-wallet";

describe("which accounts keep one balance for both products", () => {
  it("keeps the shared balance for accounts created before the split", () => {
    expect(
      trainSharesStudioWallet({ createdAt: new Date("2026-09-01T00:00:00Z") }),
    ).toBe(true);
    expect(
      trainSharesStudioWallet({
        createdAt: new Date(PRODUCT_SPLIT_AT.getTime() - 1),
      }),
    ).toBe(true);
  });
  it("keeps Studio credits out of Train for accounts created since", () => {
    expect(trainSharesStudioWallet({ createdAt: PRODUCT_SPLIT_AT })).toBe(
      false,
    );
    expect(
      trainSharesStudioWallet({ createdAt: new Date("2026-11-01T00:00:00Z") }),
    ).toBe(false);
  });
});
