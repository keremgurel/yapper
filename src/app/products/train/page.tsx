import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  MessageCircle,
  Shuffle,
} from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import TrainingPreview from "@/components/marketing/training-preview";
import TrainFeedbackDemo from "@/components/marketing/train-feedback-demo";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { GlassyButton } from "@/components/ui/glassy-button";
import { marketingMetadata } from "@/lib/marketing-metadata";
import { ProductJsonLd } from "@/app/home-json-ld";
import styles from "@/components/marketing/train-product.module.css";

export const metadata = marketingMetadata(
  "Public speaking app with practice & AI coaching",
  "Build speaking confidence with random topics, freestyle practice, interview prompts, and AI feedback. Start practicing online with Yapper Train, free and without an account.",
  "/products/train",
);

export default function YapperProductPage() {
  return (
    <MarketingLayout>
      <ProductJsonLd product="train" />
      <section className={styles.hero}>
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Products", href: "/products" },
              { label: "Yapper Train", href: "/products/train" },
            ]}
          />
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <h1 className="type-display">
                Get comfortable
                <br />
                being heard.
              </h1>
              <p className="marketing-lede">
                For the interview, the camera, or the conversation you keep
                rehearsing in your head. Find your words with Yapper Train.
              </p>
              <div className="marketing-actions">
                <GlassyButton
                  href="/training/random-topic-generator"
                  height={48}
                >
                  Start practicing <ArrowRight size={16} />
                </GlassyButton>
                <Link className="marketing-text-link" href="/training">
                  Explore the exercises <ArrowUpRight size={15} />
                </Link>
              </div>
              <p className="marketing-note">
                Free practice. No account needed.
              </p>
            </div>
            <TrainingPreview />
          </div>
          <div className={styles.practiceLoop} aria-label="How practice works">
            <span>
              <span>01</span> Find a prompt
            </span>
            <ArrowRight aria-hidden="true" size={16} />
            <span>
              <span>02</span> Give it a minute
            </span>
            <ArrowRight aria-hidden="true" size={16} />
            <span>
              <span>03</span> Hear what to improve
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="marketing-container">
          <div className={styles.sectionHeading}>
            <h2 className="type-h2">
              Real life doesn’t come
              <br />
              with a script.
            </h2>
            <p className="type-description">
              Give yourself a little room to rehearse.
              <br />
              Choose a moment you want to feel ready for.
            </p>
          </div>
          <div className={styles.practiceCards}>
            <Link
              href="/training/interview-prep"
              className={`${styles.practiceCard} ${styles.peach}`}
            >
              <div className={styles.cardTop}>
                <MessageCircle size={21} />
                <span>For the next opportunity</span>
                <ArrowUpRight size={18} />
              </div>
              <div className={styles.interviewArt} aria-hidden="true">
                <div className={styles.questionBubble}>
                  “Tell me about a time
                  <br />
                  you figured it out.”
                </div>
                <div className={styles.answerOutline}>
                  <span>Situation</span>
                  <span>Task</span>
                  <span>Action</span>
                  <span>
                    Result <Check size={12} />
                  </span>
                </div>
              </div>
              <div className={styles.cardCopy}>
                <h3 className="type-h3">Walk in with an answer.</h3>
                <p>
                  Practice interview questions until your experience is easier
                  to put into words.
                </p>
                <span>
                  Practice an interview <ArrowRight size={15} />
                </span>
              </div>
            </Link>
            <Link
              href="/training/random-topic-generator"
              className={`${styles.practiceCard} ${styles.lilac}`}
            >
              <div className={styles.cardTop}>
                <Shuffle size={21} />
                <span>For the unexpected question</span>
                <ArrowUpRight size={18} />
              </div>
              <div className={styles.topicsArt} aria-hidden="true">
                <div className={styles.topicBack} />
                <div className={styles.topicFront}>
                  <span>A fresh perspective</span>
                  <p>
                    What’s a belief
                    <br />
                    you’ve outgrown?
                  </p>
                  <span>Take a minute to think out loud.</span>
                </div>
              </div>
              <div className={styles.cardCopy}>
                <h3 className="type-h3">Find your feet. Then your flow.</h3>
                <p>
                  A new topic, a short timer, and space to turn a thought into a
                  clear point.
                </p>
                <span>
                  Try a random topic <ArrowRight size={15} />
                </span>
              </div>
            </Link>
            <Link
              href="/training/read-aloud"
              className={`${styles.practiceCard} ${styles.sage}`}
            >
              <div className={styles.cardTop}>
                <AudioLines size={21} />
                <span>For a voice that feels like you</span>
                <ArrowUpRight size={18} />
              </div>
              <div className={styles.readingArt} aria-hidden="true">
                <p>
                  Take your time.
                  <br />
                  <span>Let the thought land.</span>
                  <br />
                  Then keep going.
                </p>
                <div className={styles.wave}>
                  {Array.from({ length: 35 }, (_, i) => (
                    <i
                      key={i}
                      style={{ height: `${12 + ((i * 17 + i * i) % 32)}px` }}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.cardCopy}>
                <h3 className="type-h3">Sound more like yourself.</h3>
                <p>
                  Work on pace, pauses, and expression. Get comfortable hearing
                  your own voice.
                </p>
                <span>
                  Practice reading aloud <ArrowRight size={15} />
                </span>
              </div>
            </Link>
          </div>
          <div className={styles.libraryLink}>
            <span>
              Freestyle, everyday conversations, camera practice, and more.
            </span>
            <Link className="marketing-text-link" href="/training">
              Find your exercise <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`marketing-container ${styles.feedbackGrid}`}>
          <TrainFeedbackDemo />
          <div className={styles.feedbackCopy}>
            <p className="type-label">Your words, with a little guidance</p>
            <h2 className="type-h2">
              Don’t just hear yourself.
              <br />
              Understand yourself.
            </h2>
            <p className="type-description">
              AI coaching shows where your point gets lost, which words get in
              the way, and how to say it more clearly.
            </p>
            <ul className={styles.feedbackBenefits}>
              <li>
                <Check size={16} />
                <span>Specific corrections in your own answer</span>
              </li>
              <li>
                <Check size={16} />
                <span>A clearer version that keeps your meaning</span>
              </li>
              <li>
                <Check size={16} />
                <span>One useful focus for your next attempt</span>
              </li>
            </ul>
            <Link href="/pricing" className="marketing-text-link">
              Explore plans and coaching credits <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="marketing-container">
          <div className={styles.routine}>
            <div>
              <BookOpen size={24} />
              <h2 className="type-h2">
                A little warm-up.
                <br />A clearer head.
              </h2>
              <p className="type-description">
                Before the meeting or the next recording, loosen up your voice
                and get your words moving.
              </p>
              <Link
                href="/training/fluency-on-steroids"
                className="marketing-text-link"
              >
                Try the 12-minute routine <ArrowUpRight size={15} />
              </Link>
            </div>
            <ol className={styles.routineSteps}>
              <li>
                <span>01</span>
                <div>
                  <strong>Start with one clear sentence</strong>
                  <p>Replace “I always freeze” with a small, doable action.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Get your words moving</strong>
                  <p>Read aloud to stretch your recall and articulation.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Warm up your voice</strong>
                  <p>Explore pitch, volume, and emphasis in one sentence.</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <strong>Make your point</strong>
                  <p>Read a paragraph, then give a short spoken summary.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.finalSection}>
        <div className="marketing-container">
          <div className={styles.finalPanel}>
            <div>
              <h2 className="type-h2">
                Your next conversation
                <br />
                starts here.
              </h2>
              <p>One prompt. One minute. See what you have to say.</p>
              <GlassyButton href="/training/random-topic-generator" height={48}>
                Start practicing <ArrowRight size={16} />
              </GlassyButton>
            </div>
            <div className={styles.accessDetails}>
              <div>
                <strong>Practice freely.</strong>
                <p>
                  Prompts, a timer, and practice recording.
                  <br />
                  No account needed.
                </p>
              </div>
              <div>
                <strong>Get coaching when you want it.</strong>
                <p>
                  Sign in for AI feedback with credits shared across Yapper
                  Train and Yapper Studio.
                </p>
                <Link href="/pricing">
                  See plans and credits <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
