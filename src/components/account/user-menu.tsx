"use client";

import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  ChevronDown,
  Clock,
  Layers,
  Lightbulb,
  LogOut,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const item =
  "flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-bold";

/** Signed-in account menu: avatar + name trigger, dropdown for manage account,
 * recorded sessions, the (soon) creator surfaces, and sign out. Uses Clerk's
 * useUser/useClerk so it stays a plain component styled to our design system.
 * Shows the user's name when Clerk has it (enable Name at sign-up in the Clerk
 * dashboard), otherwise falls back to the email handle. */
export default function UserMenu() {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  if (!user) return null;

  const email = user.primaryEmailAddress?.emailAddress;
  const name = user.fullName || user.firstName || email?.split("@")[0] || "You";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="border-border bg-card hover:bg-muted flex items-center gap-2 rounded-full border py-1 pr-2.5 pl-1 shadow-sm transition-colors"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.imageUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
          />
          <span className="text-foreground max-w-[130px] truncate text-[13px] font-bold">
            {name}
          </span>
          <ChevronDown className="text-foreground/60 h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        style={{ boxShadow: "var(--sg-shadow-panel)" }}
        className="border-border bg-card w-64 rounded-2xl p-1.5"
      >
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.imageUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover"
          />
          <span className="min-w-0">
            <span className="text-foreground block truncate text-[13px] font-bold">
              {name}
            </span>
            {email && (
              <span className="text-foreground/55 block truncate text-[11.5px]">
                {email}
              </span>
            )}
          </span>
        </div>

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem
          className={`${item} hover:bg-muted`}
          onSelect={() => openUserProfile()}
        >
          <Settings className="h-4 w-4" />
          Manage account
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={`${item} hover:bg-muted`}>
          <Link href="/history" className="no-underline">
            <Clock className="h-4 w-4" />
            Recorded sessions
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className={`${item} hover:bg-muted`}>
          <Link href="/studio/inspiration" className="no-underline">
            <Lightbulb className="h-4 w-4" />
            Inspiration
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={`${item} hover:bg-muted`}>
          <Link href="/studio/library" className="no-underline">
            <Layers className="h-4 w-4" />
            Content Library
          </Link>
        </DropdownMenuItem>

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
