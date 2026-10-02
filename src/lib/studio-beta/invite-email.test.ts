import { describe, expect, it } from "vitest";
import { buildInviteEmail, MAC_APP_DOWNLOAD } from "./invite-email";

describe("the beta invitation email", () => {
  const email = buildInviteEmail({
    name: "Maya Okafor",
    code: "K7QM-2HXP-9RTD",
  });

  it("greets by first name and carries the code in both versions", () => {
    expect(email.text).toContain("Hi Maya,");
    expect(email.text).toContain("K7QM-2HXP-9RTD");
    expect(email.html).toContain("K7QM-2HXP-9RTD");
  });

  it("says where to enter the code and where to get the Mac app", () => {
    for (const body of [email.text, email.html]) {
      expect(body).toContain("ypr.app/studio-access");
      expect(body).toContain(MAC_APP_DOWNLOAD);
    }
  });

  it("never puts the code in a link", () => {
    expect(email.html).not.toMatch(/href="[^"]*K7QM/);
  });

  it("escapes a name before it reaches the HTML", () => {
    const html = buildInviteEmail({
      name: '<img src=x onerror="alert(1)">',
      code: "AAAA-BBBB-CCCC",
    }).html;
    expect(html).not.toContain("<img");
  });
});
