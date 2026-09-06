import type { Metadata } from "next";
import RecordClient from "@/components/teleprompter/record-client";

export const metadata: Metadata = {
  title: "Record with teleprompter",
  description:
    "Record your take with a scrolling teleprompter, then download it or save it to your content library.",
  alternates: { canonical: "https://ypr.app/studio/recorder" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ item?: string | string[]; idea?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedItem =
    typeof params.item === "string" ? params.item : undefined;
  const legacyIdeaId =
    typeof params.idea === "string" ? params.idea : undefined;
  return (
    <RecordClient
      key={`${requestedItem ?? ""}:${legacyIdeaId ?? ""}`}
      requestedItem={requestedItem}
      legacyIdeaId={legacyIdeaId}
    />
  );
}
