import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CatalogAdmin from "@/components/admin/catalog-admin";
import { isAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Skill catalog",
  robots: { index: false },
};

/**
 * The catalog admin.
 *
 * Gated here as well as in the API, and with `notFound` rather than a redirect:
 * a page that says "you are not allowed in here" tells someone there is a here.
 */
export default async function Page() {
  const { userId } = await auth();
  if (!isAdmin(userId)) notFound();
  return <CatalogAdmin />;
}
