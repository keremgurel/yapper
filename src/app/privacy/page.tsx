import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Yapper, by OCX Software Inc., collects, uses, shares, and protects your data, including data from connected social platforms.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="July 19, 2026"
      intro="This Privacy Policy explains what information Yapper, a product of OCX Software Inc., collects, how we use and share it, and the choices you have. It applies to ypr.app and the Yapper application."
    >
      <Section heading="1. Information we collect">
        <ul>
          <li>{`Account information: your name and email address, provided through our authentication provider, Clerk, when you sign up or sign in.`}</li>
          <li>{`Content you create: the ideas, scripts, captions, and the audio and video recordings you make or upload in Yapper.`}</li>
          <li>{`Voice and audio: recordings you capture are processed to produce transcripts and delivery feedback.`}</li>
          <li>{`Connected-platform data: when you link a YouTube, TikTok, or Instagram account, we receive the access tokens and basic profile details needed to publish on your behalf, limited to the permissions you approve.`}</li>
          <li>{`Payment information: handled by our payment processor, Stripe. We receive your subscription status and a customer identifier; we do not store your full card number.`}</li>
          <li>{`Usage and device data: analytics events, log data, approximate location derived from IP address, and device or browser information, used to operate and improve the service.`}</li>
        </ul>
      </Section>

      <Section heading="2. How we use your information">
        <ul>
          <li>{`to provide the service, including recording, editing, transcription, script and caption generation, and publishing;`}</li>
          <li>{`to process payments, manage subscriptions and credits, and enforce usage limits;`}</li>
          <li>{`to publish content to the platforms you connect, at your direction;`}</li>
          <li>{`to secure the service, prevent abuse, and comply with legal obligations;`}</li>
          <li>{`to communicate with you about your account, and to improve Yapper.`}</li>
        </ul>
        <p>{`We do not sell your personal information, and we do not use the content of your recordings or the data we receive from connected platforms to train our own general-purpose models.`}</p>
      </Section>

      <Section heading="3. AI processing">
        <p>
          {`To transcribe audio and generate or refine drafts, we send the relevant content (such as audio, transcripts, or your text prompts) to third-party AI providers that process it on our behalf to return a result. These providers are contractually limited to using the data to provide their service to us.`}
        </p>
      </Section>

      <Section heading="4. How we share information (service providers)">
        <p>{`We share information only with providers that help us run Yapper, each acting on our instructions:`}</p>
        <ul>
          <li>{`Clerk — authentication and account management;`}</li>
          <li>{`Neon — our database;`}</li>
          <li>{`Cloudflare R2 — storage for your media;`}</li>
          <li>{`Stripe — payment processing;`}</li>
          <li>{`Deepgram and Google (Gemini), among other AI providers — transcription and content generation;`}</li>
          <li>{`PostHog — product analytics;`}</li>
          <li>{`Resend — transactional email;`}</li>
          <li>{`Vercel — application hosting;`}</li>
          <li>{`the social platforms you connect (YouTube, TikTok, Instagram) — to publish the content you choose.`}</li>
        </ul>
        <p>{`We may also disclose information to comply with the law, enforce our terms, protect rights and safety, or in connection with a merger, acquisition, or sale of assets. In that case this policy will continue to apply to your information.`}</p>
      </Section>

      <Section heading="5. Connected social platforms">
        <p>
          {`When you connect a platform, Yapper accesses only the data and permissions you authorize, and uses them solely to provide the features you request, primarily publishing a video you created. We store platform access and refresh tokens in encrypted form and use them only to act on your behalf. You can disconnect any platform at any time in the app, which revokes Yapper's ongoing access; you can also revoke access from within the platform's own settings.`}
        </p>
        <p>
          {`Yapper's use of information received from Google APIs, including YouTube API Services, adheres to the `}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          {`, including the Limited Use requirements. By using the YouTube integration you also agree to the `}
          <a
            href="https://www.youtube.com/t/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTube Terms of Service
          </a>
          {`, and Google's Privacy Policy is available at `}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            policies.google.com/privacy
          </a>
          {`. Data received from TikTok and Instagram is likewise used only to provide the publishing features you request and is handled in accordance with each platform's developer policies.`}
        </p>
      </Section>

      <Section heading="6. Data retention">
        <p>
          {`We keep your information for as long as your account is active or as needed to provide the service. You can delete individual content at any time. When you delete your account, we delete or de-identify your personal information and content within a reasonable period, except where we must retain certain records to meet legal, tax, or security obligations.`}
        </p>
      </Section>

      <Section heading="7. Your rights and choices">
        <ul>
          <li>{`Access, correct, or delete your personal information and content;`}</li>
          <li>{`export the content you have created;`}</li>
          <li>{`disconnect a linked social platform, which revokes our access;`}</li>
          <li>{`delete your account entirely.`}</li>
        </ul>
        <p>
          {`Depending on where you live, you may have additional rights under laws such as the GDPR or CCPA. To exercise any of these, use the controls in the app or email `}
          <a href="mailto:support@ypr.app">support@ypr.app</a>
          {`.`}
        </p>
      </Section>

      <Section heading="8. Security">
        <p>
          {`We use encryption in transit, encryption of sensitive credentials at rest, access controls, and reputable infrastructure providers to protect your data. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.`}
        </p>
      </Section>

      <Section heading="9. Cookies">
        <p>
          {`We use strictly necessary cookies for authentication and session management, and analytics cookies to understand how the product is used. You can control cookies through your browser settings, though disabling essential cookies may prevent you from signing in.`}
        </p>
      </Section>

      <Section heading="10. Children">
        <p>
          {`Yapper is not directed to children under 13, and we do not knowingly collect their personal information. If you believe a child has provided us information, contact us and we will delete it.`}
        </p>
      </Section>

      <Section heading="11. International users">
        <p>
          {`We operate the service using infrastructure that may process and store data in the United States and other countries. By using Yapper, you understand that your information may be transferred to and processed in locations with different data protection laws than your own.`}
        </p>
      </Section>

      <Section heading="12. Changes to this policy">
        <p>
          {`We may update this policy from time to time. When we make material changes, we will revise the date above and, where appropriate, notify you. Your continued use of Yapper after the changes take effect means you accept the updated policy.`}
        </p>
      </Section>
    </LegalPage>
  );
}
