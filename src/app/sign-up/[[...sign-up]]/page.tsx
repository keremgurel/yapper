import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import AuthForm from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Create your studio account",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <AuthShell>
      <AuthForm mode="sign-up" />
    </AuthShell>
  );
}
