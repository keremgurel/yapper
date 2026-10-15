import { expect, it } from "vitest";
import { activeDismissals } from "./use-home-dismissals";
it("ignores corrupt data and expires dismissed suggestions", () => {
  expect(activeDismissals("broken", 100)).toEqual({});
  expect(activeDismissals("null", 100)).toEqual({});
  expect(
    activeDismissals('{"old":99,"current":200,"bad":"forever"}', 100),
  ).toEqual({ current: 200 });
});
