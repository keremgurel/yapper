"use client";

import { useUser } from "@clerk/nextjs";

import ProgressSignedOut from "@/components/progress/progress-signed-out";
import ProgressView from "@/components/progress/progress-view";
import SessionsTableSkeleton from "@/components/progress/sessions-table-skeleton";

/**
 * Chooses the signed-in or signed-out view on the client.
 *
 * Clerk's server-side helpers need the route to be in the proxy matcher, and
 * the public pages are deliberately excluded from it so crawler traffic cannot
 * spend Fluid CPU on a page that could have been static. Reading the session in
 * the browser keeps this page static and matches how /history already does it.
 */
export default function ProgressGate() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="marketing-container py-10">
        <SessionsTableSkeleton />
      </div>
    );
  }

  return isSignedIn ? <ProgressView /> : <ProgressSignedOut />;
}
