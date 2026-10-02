"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { Coins, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  invalidateClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";
import {
  installPaywallWatch,
  onPaywall,
  type PaywallReason,
} from "@/lib/billing/paywall-watch";
import { TRIAL_CREDITS, TRIAL_DAYS } from "@/lib/billing/plans";
import styles from "./paywall-dialog.module.css";

const COPY: Record<
  PaywallReason,
  { title: string; body: string; action: string; href: string }
> = {
  not_entitled: {
    title: "Start your free trial to use AI",
    body: `Scripts, transcription, one-click edits, thumbnails and captions use AI. Your ${TRIAL_DAYS}-day trial includes ${TRIAL_CREDITS} credits, and you can cancel before it ends.`,
    action: "Start free trial",
    href: "/products/studio/pricing",
  },
  insufficient_credits: {
    title: "You're out of credits",
    body: "That action needs more credits than you have left. Add a credit pack, or wait for the credits that come with your next payment.",
    action: "Add credits",
    href: "/products/studio/pricing#credits",
  },
};

/**
 * The upgrade prompt for Studio. It opens when any Studio action is refused
 * for billing, says why in one line, and offers the one next step. Recording,
 * writing and manual editing never trigger it, because they are free.
 */
export default function PaywallDialog() {
  const [reason, setReason] = useState<PaywallReason | null>(null);
  useEffect(() => {
    installPaywallWatch();
    return onPaywall((next) => {
      setReason(next);
      // The meter in the header should agree with what just happened.
      invalidateClientResource(STUDIO_RESOURCE_KEYS.billing);
    });
  }, []);

  const copy = reason ? COPY[reason] : null;
  const Icon = reason === "insufficient_credits" ? Coins : Sparkles;

  return (
    <Dialog.Root
      open={reason !== null}
      onOpenChange={(open) => !open && setReason(null)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        {copy && (
          <Dialog.Content className={styles.content}>
            <Dialog.Close className={styles.close} aria-label="Close">
              <X size={16} />
            </Dialog.Close>
            <span className={styles.icon} aria-hidden="true">
              <Icon size={18} />
            </span>
            <Dialog.Title className={styles.title}>{copy.title}</Dialog.Title>
            <Dialog.Description className={styles.body}>
              {copy.body}
            </Dialog.Description>
            <div className={styles.actions}>
              <Button asChild>
                <Link href={copy.href} onClick={() => setReason(null)}>
                  {copy.action}
                </Link>
              </Button>
              <Dialog.Close asChild>
                <Button variant="outline">Not now</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
