import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import AuthForm from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign in to your studio",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <AuthShell>
      <AuthForm mode="sign-in" />
    </AuthShell>
  );
}
