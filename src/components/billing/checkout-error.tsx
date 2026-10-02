import styles from "./pricing.module.css";

const NOT_LIVE = ["not_configured", "price_not_configured", "price_mismatch"];

/** Why a checkout did not start, in the visitor's terms. */
export default function CheckoutError({
  error,
  productName,
}: {
  error: string | null;
  productName: string;
}) {
  if (!error) return null;
  const message =
    error === "already_subscribed"
      ? `You already have a ${productName} plan. Use Manage billing to change it.`
      : error === "subscription_required"
        ? `Start a ${productName} plan before adding more.`
        : NOT_LIVE.includes(error)
          ? "These plans aren’t available for checkout yet. Please check back soon."
          : "Could not start checkout. Please try again.";
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  );
}
