import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BetaAdmin from "@/components/admin/beta/beta-admin";
import { isAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Private beta",
  robots: { index: false },
};

/** The beta admin. Gated here as well as in the API, with `notFound` rather
 * than a redirect, the same as the skill catalog. */
export default async function Page() {
  const { userId } = await auth();
  if (!isAdmin(userId)) notFound();
  return <BetaAdmin />;
}
