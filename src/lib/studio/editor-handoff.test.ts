import { describe, expect, it } from "vitest";
import { desktopEditorUrl, studioEditorUrl } from "./editor-handoff";

describe("editor handoff", () => {
  it("preserves the selected item through the Library and desktop links", () => {
    const itemId = "8e5e8f27-3256-4b83-9c2a-403314d1de60";
    const page = new URL(studioEditorUrl(itemId), "https://ypr.app");
    const native = new URL(desktopEditorUrl(page.searchParams.get("item")));
    expect(native.protocol).toBe("yapper-studio:");
    expect(native.host + native.pathname).toBe("open/editor");
    expect(native.searchParams.get("item")).toBe(itemId);
  });
  it("opens the editor without inventing an item for the sidebar link", () => {
    expect(desktopEditorUrl()).toBe("yapper-studio://open/editor");
  });
});
