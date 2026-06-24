import Link from "next/link";
import {
  ArrowRight,
  Camera,
  LibraryBig,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { inspirationFeatures, programFamilies } from "@/data/training";

const featuredFamilies = programFamilies.filter(
  (family) =>
    family.slug !== "freestyle-reps" && family.slug !== "fluency-on-steroids",
);

const statusStyles = {
  "Free now":
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  Coming: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  "Credits later":
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200",
};

export default function HomeFutureSections() {
  return (
    <div className="relative overflow-hidden">
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="font-mono text-xs font-black tracking-[0.18em] text-cyan-700 uppercase dark:text-cyan-300">
                Bigger than prompts
              </p>
              <h2 className="font-display mt-4 max-w-xl text-4xl leading-[0.95] font-black text-slate-950 sm:text-6xl dark:text-white">
                Train the ways people actually speak.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-slate-700 sm:text-lg dark:text-white/64">
              Random topics and freestyle reps are the free wedge. The future
              Yapper library is built around camera-speaking situations:
              explaining what you read, reading out loud, interviews, dating,
              conflict, and creator takes.
            </p>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {featuredFamilies.slice(0, 6).map((family) => (
              <article
                key={family.slug}
                className="rounded-2xl border border-slate-900/8 bg-white/58 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/8 dark:bg-white/[0.045] dark:shadow-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${statusStyles[family.status]}`}
                  >
                    {family.status}
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-white/42">
                    {family.duration}
                  </span>
                </div>
                <h3 className="font-display mt-5 text-2xl leading-none font-black text-slate-950 dark:text-white">
                  {family.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-white/62">
                  {family.prompt}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-900/8 bg-slate-950 px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8 dark:border-white/8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="font-mono text-xs font-black tracking-[0.18em] text-orange-200 uppercase">
              Today vs future
            </p>
            <h2 className="font-display mt-4 text-4xl leading-[0.95] font-black sm:text-6xl">
              Free reps now. Guided programs later.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/62">
              The free product stays simple: open camera, get a prompt or go
              freestyle, and practice. When programs and feedback arrive, paid
              credits will be for specific task reviews, not for blocking the
              core rep.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Camera,
                label: "Free now",
                title: "Random topic and freestyle camera reps",
              },
              {
                icon: LibraryBig,
                label: "Coming",
                title: "Programs for real speaking situations",
              },
              {
                icon: WalletCards,
                label: "Credits later",
                title: "Spend credits for one concrete fix, then run it back",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"
              >
                <item.icon className="h-5 w-5 text-cyan-200" />
                <p className="mt-5 text-xs font-black tracking-[0.14em] text-white/42 uppercase">
                  {item.label}
                </p>
                <p className="mt-2 text-sm leading-6 font-bold text-white/88">
                  {item.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="rounded-[2rem] border border-slate-900/10 bg-[#11141c] p-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.18)] sm:p-8 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/15">
                <Sparkles className="h-5 w-5 text-cyan-200" />
              </div>
              <div>
                <p className="font-mono text-xs font-black tracking-[0.18em] text-cyan-200 uppercase">
                  Lab preview
                </p>
                <h2 className="font-display text-3xl leading-none font-black">
                  Inspiration becomes output.
                </h2>
              </div>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {inspirationFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl bg-white/[0.06] p-4"
                >
                  <h3 className="text-sm font-black">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/58">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-xs font-black tracking-[0.18em] text-orange-700 uppercase dark:text-orange-300">
              Training programs
            </p>
            <h2 className="font-display mt-4 text-4xl leading-[0.95] font-black text-slate-950 sm:text-6xl dark:text-white">
              A practice library for every kind of yap.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-700 dark:text-white/64">
              Browse the program map, including the current Fluency on steroids
              protocol and future task families.
            </p>
            <Link
              href="/training"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white no-underline shadow-[0_16px_40px_rgba(15,23,42,0.2)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
            >
              Explore training
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
