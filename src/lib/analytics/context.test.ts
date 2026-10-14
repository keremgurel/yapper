import { expect, it } from "vitest";
import { analyticsURL, clientContext, pageName } from "./context";

it("separates native webviews from browser traffic and records the release", () => {
  expect(clientContext("Mozilla/5.0 YapperStudioNative/0.9.25")).toMatchObject({
    surface: "macos",
    app_version: "0.9.25",
    client: "native_webview",
  });
  expect(clientContext("Mozilla/5.0 Safari/605")).toMatchObject({
    surface: "web",
    client: "browser",
  });
});
it("strips auth credentials and content while retaining campaign attribution", () => {
  expect(
    analyticsURL(
      "https://ypr.app/studio/native-auth?ticket=secret&state=secret&utm_source=google#private",
    ),
  ).toBe("https://ypr.app/studio/native-auth?utm_source=google");
  expect(analyticsURL("not a URL")).toBe("");
  expect(pageName("/studio/ideas/abc-sensitive-id")).toBe("/studio/ideas/:id");
});
