import BetaApplicationForm from "@/components/marketing/beta-application-form";

/** The Studio sign-up slot on marketing pages. During the private beta it is
 * an application, not a plain email list. */
export default function StudioWaitlist() {
  return <BetaApplicationForm />;
}
