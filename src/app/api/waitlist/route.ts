import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getPostHogClient } from "@/lib/posthog-server";
import { guardWaitlistEmail, guardWaitlistIp } from "@/lib/public-rate-limit";

export const runtime = "nodejs";

const DESKTOP_WAITLIST_SEGMENT_ID =
  process.env.RESEND_WAITLIST_SEGMENT_ID ??
  "5cdf81a1-e3ed-45b7-a456-fda91b191fa8";

export async function POST(req: Request) {
  const ipLimited = await guardWaitlistIp(req);
  if (ipLimited) return ipLimited;

  let email: unknown;
  try {
    const body = await req.json();
    email = body?.email;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (typeof email !== "string") {
    return NextResponse.json(
      { error: "Please enter your email." },
      { status: 400 },
    );
  }

  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  const emailLimited = await guardWaitlistEmail(trimmed);
  if (emailLimited) return emailLimited;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is missing");
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.contacts.create({
      email: trimmed,
      unsubscribed: false,
      segments: [{ id: DESKTOP_WAITLIST_SEGMENT_ID }],
    });

    if (error) {
      console.error("Resend contacts.create error:", error);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 502 },
      );
    }

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: trimmed,
      event: "waitlist_joined",
      properties: {
        email: trimmed,
        source: "desktop_marketing_hero",
        resend_segment_id: DESKTOP_WAITLIST_SEGMENT_ID,
      },
    });
    posthog.identify({
      distinctId: trimmed,
      properties: { email: trimmed, waitlist: true },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Waitlist signup error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
