"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

/**
 * Wraps ClerkProvider and keeps Clerk's UI (modals, UserButton, sign-in/up) in
 * sync with the app's theme toggle — dark base theme when the app is dark,
 * Clerk's default light theme otherwise.
 */
export default function ClerkThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/studio/home"
      signUpFallbackRedirectUrl="/studio/home"
      appearance={{
        cssLayerName: "clerk",
        theme: resolvedTheme === "dark" ? dark : undefined,
        variables: { colorPrimary: "#06b6d4" },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
