import Link from "next/link";
import MarketingLayout from "@/components/marketing/marketing-layout";
import { ProductPair } from "@/components/marketing/product-sections";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { marketingMetadata } from "@/lib/marketing-metadata";

export const metadata = marketingMetadata(
  "Meet Yapper Train and Yapper Studio",
  "Choose Yapper Train for speaking practice and coaching, or Yapper Studio for the complete content creation workflow from idea to published video.",
  "/products",
);
export default function ProductsPage() {
  return (
    <MarketingLayout>
      <section className="marketing-hero">
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Products", href: "/products" },
            ]}
          />
          <h1 className="type-h1 max-w-2xl">
            What do you want to do with your voice?
          </h1>
          <p className="marketing-lede">
            Get better at speaking, or turn what you have to say into content.
            There’s a Yapper for each.
          </p>
          <div className="mt-14">
            <ProductPair />
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <h2 className="type-h2">Two products. Clear purposes.</h2>
          <table className="marketing-comparison">
            <caption className="sr-only">
              Compare Yapper Studio and Yapper Train speaking practice
            </caption>
            <thead>
              <tr>
                <th scope="col">Your goal</th>
                <th scope="col">Yapper Studio</th>
                <th scope="col">Yapper Train</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">What you do</th>
                <td>Make and publish content</td>
                <td>Practice and improve your speaking</td>
              </tr>
              <tr>
                <th scope="row">Your workflow</th>
                <td>Idea, script, record, edit, publish</td>
                <td>Prompt, practice, feedback, repeat</td>
              </tr>
              <tr>
                <th scope="row">Where to start</th>
                <td>Bring an idea or reference</td>
                <td>Pick a topic or a real situation</td>
              </tr>
              <tr>
                <th scope="row">Availability</th>
                <td>Private testing; join the waitlist</td>
                <td>Free web practice; AI coaching uses credits</td>
              </tr>
              <tr>
                <th scope="row">Explore</th>
                <td>
                  <Link
                    href="/features"
                    className="underline underline-offset-4"
                  >
                    Studio features
                  </Link>
                </td>
                <td>
                  <Link
                    href="/training"
                    className="underline underline-offset-4"
                  >
                    Speaking practice
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="marketing-note">
            The product split does not change existing subscriptions or credit
            balances.{" "}
            <Link href="/pricing" className="underline underline-offset-4">
              See current pricing
            </Link>
            .
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
