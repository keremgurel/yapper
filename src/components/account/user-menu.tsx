"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { siteContextFor } from "@/data/site-navigation";
import { TRAINING_FEEDBACK_CREDITS } from "@/lib/db/constants";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { creditMeterFor } from "@/lib/billing/credit-meter";
import CreditAvatar, { creditMeterStyle } from "./credit-avatar";
import { useClerk, useUser } from "@clerk/nextjs";
import { Clock, LogOut, Settings, TrendingUp, HardDrive } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const item =
  "flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-bold";

/** One account control across Studio and the public site. */
export default function UserMenu() {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const { status, refresh } = useBillingStatus(!!user);
  const pathname = usePathname();
  const isTrain = siteContextFor(pathname) === "train";
  useEffect(() => {
    if (!user) return;
    const update = () => {
      void refresh(false);
    };
    const afterSpend = () => {
      void refresh();
    };
    window.addEventListener("focus", update);
    window.addEventListener("studio:credits-changed", afterSpend);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("studio:credits-changed", afterSpend);
    };
  }, [user, refresh]);
  const meter = status
    ? (status.creditMeter ?? creditMeterFor(status))
    : undefined;
  if (!user) return null;

  const email = user.primaryEmailAddress?.emailAddress;
  const name = user.fullName || user.firstName || email?.split("@")[0] || "You";

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void refresh();
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${name}${status ? `, ${status.balance.toLocaleString()} credits left` : ""}`}
          title={
            status
              ? `${status.balance.toLocaleString()} credits left`
              : "Account"
          }
          className="hover:bg-muted focus-visible:ring-ring flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <CreditAvatar name={name} src={user.imageUrl} meter={meter} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        collisionPadding={16}
        style={{ boxShadow: "var(--sg-shadow-panel)" }}
        className="border-border bg-card w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-2"
      >
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <CreditAvatar
            name={name}
            src={user.imageUrl}
            meter={meter}
            size={48}
          />
          <span className="min-w-0">
            <span className="text-foreground block truncate text-[13px] font-bold">
              {name}
            </span>
            <span className="text-muted-foreground block text-xs">
              {meter?.planLabel ?? "Account"}
            </span>
          </span>
        </div>

        <div className="bg-muted/60 my-2 rounded-xl p-3">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold">Credits</span>
            <span className="text-muted-foreground tabular-nums">
              {status
                ? `${status.balance.toLocaleString()} left`
                : "Balance unavailable"}
            </span>
          </div>
          <div
            className="credit-indicator bg-foreground/10 mt-3 h-1.5 overflow-hidden rounded-full"
            style={creditMeterStyle(meter)}
            aria-hidden="true"
          >
            {meter?.fraction != null && (
              <div
                className="h-full rounded-full bg-current"
                style={{ width: `${meter.fraction * 100}%` }}
              />
            )}
          </div>
          {meter?.allowance && (
            <p className="text-muted-foreground mt-2 text-[11px]">
              {meter.allowance.toLocaleString()} included{" "}
              {status?.trialing ? "in your trial" : "per billing period"}. Extra
              credits count too.
            </p>
          )}
          <DropdownMenuItem
            asChild
            className="mt-3 justify-center rounded-lg border px-3 py-2 text-xs font-semibold"
          >
            <Link href="/pricing">
              {status?.entitled
                ? "Manage membership & credits"
                : "Explore membership"}
            </Link>
          </DropdownMenuItem>
        </div>

        {isTrain && status?.train && (
          <DropdownMenuItem asChild className={`${item} hover:bg-muted`}>
            <Link href="/products/train/pricing">
              {status.train.unlimited
                ? "Train Plus · unlimited feedback"
                : `${Math.floor(status.train.balance / TRAINING_FEEDBACK_CREDITS)} Train feedback sessions left`}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem
          className={`${item} hover:bg-muted`}
          onSelect={() => openUserProfile()}
        >
          <Settings className="h-4 w-4" />
          Manage account
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={`${item} hover:bg-muted`}>
          <Link href="/studio/storage" className="no-underline">
            <HardDrive className="h-4 w-4" />
            Storage
          </Link>
        </DropdownMenuItem>
        {isTrain && (
          <>
            <DropdownMenuItem asChild className={`${item} hover:bg-muted`}>
              <Link href="/history" className="no-underline">
                <Clock className="h-4 w-4" />
                Recorded sessions
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className={`${item} hover:bg-muted`}>
              <Link href="/progress" className="no-underline">
                <TrendingUp className="h-4 w-4" />
                Your progress
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem
          className={`${item} text-red-500 hover:bg-red-500/10`}
          onSelect={() => void signOut({ redirectUrl: "/" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
