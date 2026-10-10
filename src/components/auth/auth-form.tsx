"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { ComponentProps } from "react";
import { buttonVariants } from "@/components/ui/button";
import styles from "./auth.module.css";

const appearance: NonNullable<ComponentProps<typeof SignIn>["appearance"]> = {
  theme: shadcn,
  variables: {
    fontFamily: "var(--sg-font-system)",
    fontSize: "16px",
    colorPrimary: "var(--sg-text)",
    colorPrimaryForeground: "var(--sg-bg)",
    colorBackground: "var(--sg-bg)",
    colorForeground: "var(--sg-text)",
    colorMutedForeground: "var(--sg-text-muted)",
    colorInput: "var(--sg-surface)",
    colorInputForeground: "var(--sg-text)",
    colorRing: "var(--sg-text)",
    borderRadius: "10px",
  },
  options: {
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
  },
  elements: {
    rootBox: styles.root,
    cardBox: styles.cardBox,
    card: styles.card,
    header: styles.formHeader,
    headerTitle: styles.title,
    headerSubtitle: styles.subtitle,
    socialButtonsBlockButton: styles.socialButton,
    lastAuthenticationStrategyBadge: styles.lastUsed,
    socialButtonsProviderIcon__apple: styles.appleIcon,
    formFieldInput: styles.input,
    formFieldLabel: styles.label,
    formButtonPrimary: `${buttonVariants({ variant: "titanium", size: "lg" })} ${styles.primary}`,
    footer: styles.clerkFooter,
    footerAction: styles.footerAction,
    footerActionLink: styles.textLink,
    formFieldAction: styles.textLink,
    dividerLine: styles.divider,
    dividerText: styles.dividerText,
  },
};

export default function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const fallback = (
    <p className={styles.loading} role="status">
      Loading secure sign-in…
    </p>
  );

  return mode === "sign-in" ? (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/studio/home"
      signUpFallbackRedirectUrl="/studio/home"
      appearance={appearance}
      fallback={fallback}
    />
  ) : (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/studio/home"
      signInFallbackRedirectUrl="/studio/home"
      appearance={appearance}
      fallback={fallback}
    />
  );
}
