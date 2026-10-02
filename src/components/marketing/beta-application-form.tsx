"use client";

import { useId, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./beta-application.module.css";

type State = "idle" | "sending" | "sent";

/**
 * The application to the Studio private beta. Four questions: who you are,
 * where to reach you, where you publish, and what you want to make. The last
 * two are optional but are what an application is judged on.
 */
export default function BetaApplicationForm() {
  const id = useId();
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "sending") return;
    const form = new FormData(event.currentTarget);
    setState("sending");
    setError(null);
    try {
      const response = await fetch("/api/studio-beta/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many tries. Please wait a few minutes."
            : (body.error ?? "Something went wrong. Please try again."),
        );
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("Could not reach the server. Check your connection.");
      setState("idle");
    }
  };

  if (state === "sent")
    return (
      <div className={styles.card} role="status">
        <span className={styles.done} aria-hidden="true">
          <Check size={18} strokeWidth={2.4} />
        </span>
        <h3>Application received</h3>
        <p>
          We read every application. If you are approved, you will get an email
          with your personal access code and a link to the Mac app.
        </p>
      </div>
    );

  return (
    <form
      className={styles.card}
      onSubmit={submit}
      aria-busy={state === "sending"}
    >
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${id}-name`}>Name</label>
          <Input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            required
            maxLength={80}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-email`}>Email</label>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-link`}>
          Where do you post? <span>Optional</span>
        </label>
        <Input
          id={`${id}-link`}
          name="link"
          inputMode="url"
          placeholder="A channel or profile link"
          maxLength={300}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-use`}>
          What do you want to make with Studio? <span>Optional</span>
        </label>
        <textarea
          id={`${id}-use`}
          name="useCase"
          rows={3}
          maxLength={1000}
          placeholder="For example: two short talking videos a week about my bakery"
        />
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Apply for the beta"}
      </Button>
    </form>
  );
}
