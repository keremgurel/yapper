/**
 * The one local test identity fake auth signs everyone in as. It exists so an
 * agent or a developer can drive signed-in Studio screens on localhost without
 * a Clerk account. See docs/local-fake-auth.md.
 */
if (process.env.NODE_ENV === "production") {
  throw new Error("fake auth must never load in a production build");
}

export const FAKE_USER = {
  id: process.env.NEXT_PUBLIC_YAPPER_FAKE_AUTH_USER_ID || "user_local_test",
  firstName: "Local",
  lastName: "Tester",
  email: "local-tester@yapper.test",
};
