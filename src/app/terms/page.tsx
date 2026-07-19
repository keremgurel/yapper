import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Yapper",
  description:
    "The terms that govern your use of Yapper, the content creation and cross-posting app by OCX Software Inc.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="July 19, 2026"
      intro="These Terms of Service govern your access to and use of Yapper, a product of OCX Software Inc. By creating an account or using the service, you agree to these terms."
    >
      <Section heading="1. Who we are">
        <p>
          {`Yapper ("Yapper", "we", "us", or "our") is operated by OCX Software Inc. and available at ypr.app. Yapper is a web application that helps creators record and edit short-form video, generate and refine scripts and captions with AI assistance, and publish that content to connected social platforms.`}
        </p>
      </Section>

      <Section heading="2. Eligibility and accounts">
        <ul>
          <li>{`You must be at least 13 years old to use Yapper, and at least 18 (or the age of majority where you live) to purchase a paid plan or credits.`}</li>
          <li>{`You are responsible for the accuracy of the information you provide and for keeping your login credentials secure. Authentication is handled by our provider, Clerk.`}</li>
          <li>{`You are responsible for all activity that occurs under your account. Notify us promptly if you suspect unauthorized use.`}</li>
        </ul>
      </Section>

      <Section heading="3. Subscriptions, credits, and billing">
        <ul>
          <li>{`Yapper offers paid subscription plans and one-time credit packs. Prices, plan features, and included allowances are shown at checkout and are the authoritative terms of your purchase.`}</li>
          <li>{`Payments are processed by Stripe. By subscribing, you authorize us, through Stripe, to charge your payment method on a recurring basis until you cancel.`}</li>
          <li>{`Subscriptions renew automatically at the end of each billing period. You can cancel at any time; cancellation takes effect at the end of the current period, and you retain access until then.`}</li>
          <li>{`Any free trial converts to a paid subscription unless you cancel before it ends. Free trials are limited to first-time subscribers.`}</li>
          <li>{`Credits and unused allowances are not redeemable for cash and do not carry unlimited lifetime. Except where required by law, payments are non-refundable, though we may issue refunds at our discretion.`}</li>
          <li>{`We may change prices or plan features. Material changes to a recurring price will be communicated before they take effect and apply to your next renewal.`}</li>
        </ul>
      </Section>

      <Section heading="4. Your content">
        <p>
          {`You retain all ownership of the ideas, scripts, audio, video, images, and other materials you create or upload ("Your Content"). You grant OCX Software Inc. a worldwide, non-exclusive, royalty-free license to host, store, process, transcribe, transmit, and display Your Content solely to operate and provide the service to you, including generating derivative drafts (such as scripts, captions, and edits) at your request and publishing to platforms you connect.`}
        </p>
        <p>
          {`You represent that you have all rights necessary to use Your Content and to grant this license, and that Your Content does not infringe the rights of others or violate any law.`}
        </p>
      </Section>

      <Section heading="5. AI-generated output">
        <p>
          {`Yapper uses third-party AI models to transcribe speech and generate titles, hooks, scripts, captions, and coaching. AI output can be inaccurate, incomplete, or unsuitable, and is provided "as is". You are responsible for reviewing, editing, and deciding whether to use or publish any AI-generated output. You, not Yapper, are responsible for the content you ultimately publish.`}
        </p>
      </Section>

      <Section heading="6. Connecting social platforms">
        <p>
          {`Yapper lets you connect accounts on third-party platforms, including YouTube, TikTok, and Instagram, to publish content. When you connect an account, you authorize Yapper to act on your behalf for the scopes you approve, such as uploading a video you create. Your use of each platform remains subject to that platform's own terms and policies. You can disconnect a platform at any time, which revokes Yapper's ongoing access. We are not responsible for the availability, decisions, or policies of third-party platforms.`}
        </p>
      </Section>

      <Section heading="7. Acceptable use">
        <p>{`You agree not to use Yapper to:`}</p>
        <ul>
          <li>{`create, upload, or publish content that is illegal, infringing, defamatory, deceptive, or harmful, or that violates the rules of a connected platform;`}</li>
          <li>{`impersonate others or misrepresent your affiliation;`}</li>
          <li>{`send spam or engage in coordinated inauthentic behavior;`}</li>
          <li>{`reverse engineer, scrape, overload, or attempt to gain unauthorized access to the service or its infrastructure;`}</li>
          <li>{`resell or provide the service to third parties except as expressly permitted.`}</li>
        </ul>
      </Section>

      <Section heading="8. Intellectual property">
        <p>
          {`The Yapper application, its design, and its underlying software are owned by OCX Software Inc. and protected by intellectual property laws. These terms grant you no rights in our marks or software beyond the right to use the service. If you send us feedback or suggestions, you grant us a perpetual, royalty-free license to use them without obligation.`}
        </p>
      </Section>

      <Section heading="9. Termination">
        <p>
          {`You may stop using Yapper and delete your account at any time. We may suspend or terminate your access if you breach these terms, if required by law, or to protect the service or other users. On termination, your right to use the service ends; sections that by their nature should survive (including content licenses granted to us for content already published, disclaimers, and limitations of liability) will survive.`}
        </p>
      </Section>

      <Section heading="10. Disclaimers and limitation of liability">
        <p>
          {`The service is provided "as is" and "as available", without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted, error-free, or that AI output will meet your expectations.`}
        </p>
        <p>
          {`To the maximum extent permitted by law, OCX Software Inc. will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, or goodwill. Our total liability for any claim relating to the service will not exceed the greater of the amount you paid us in the twelve months before the claim or one hundred US dollars.`}
        </p>
      </Section>

      <Section heading="11. Indemnification">
        <p>
          {`You agree to indemnify and hold harmless OCX Software Inc. from claims, damages, and expenses arising out of Your Content, your use of the service, or your violation of these terms or the rights of others.`}
        </p>
      </Section>

      <Section heading="12. Changes and governing law">
        <p>
          {`We may update these terms from time to time. When we make material changes, we will update the date above and, where appropriate, notify you. Your continued use after changes take effect means you accept the updated terms.`}
        </p>
        <p>
          {`These terms are governed by the laws applicable at OCX Software Inc.'s principal place of business, without regard to conflict-of-law rules, and you agree to the exclusive jurisdiction of the courts located there.`}
        </p>
      </Section>
    </LegalPage>
  );
}
