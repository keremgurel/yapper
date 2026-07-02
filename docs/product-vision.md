# Yapper — Product Vision & Build Plan

> **Status:** living document · **Last updated:** 2026-07-01
> The single place that captures _what we're building, why, how it makes money,
> and in what order._ Cost figures are grounded in 2026 provider pricing
> (research in this doc); treat them as planning numbers, finalize on measured COGS.

---

## 1. North star

**Yapper takes a creator from _idea → shot → polished clip → posted_, with an AI
speaking coach in the loop the whole way.** Not "an editor" — a create-to-post
studio for people who talk to camera.

**Three-layer funnel** (the "learning content → tools → platform" model):

- **Layer 1 — SEO _tools_ = top of funnel.** Not articles: **interactive tool
  pages** that rank for high-intent, do-the-thing queries (teleprompter,
  words-per-minute calculator, filler-word counter, hook generator, the practice
  drills). A tool page is a live demo of the product, not a reader we have to
  re-capture. The existing blog guides stay indexed but get **repointed** —
  reframed toward the creator outcome, each bolted to its matching tool + CTA.
  Client-side, keyless, ~$0 to run. **This is the traffic engine.**
- **Layer 2 — free in-browser editor = the taste.** Cut silences, trim,
  captions, 1-click edit, export. Free forever, client-side, makes the tools
  feel like a product. The bridge from "I used a free tool" to "this is my studio."
- **Layer 3 — premium creator platform = the money.** "Learn to yap" — the AI
  create loop (inspiration → script → teleprompter record → edit → feedback →
  post), behind a paywall, on web **and** a future native app on the same backend.

**Brand repositioning:** the site is brand-split today (speaking-exam / learning
heritage _and_ creator studio). Consolidate everything around one outcome —
**get better on camera and post consistently**. The learning content isn't
discarded; it becomes the SEO layer that feeds the tools, which feed the platform.
The free editor is the hook; the AI create-and-coach loop is the product.

> **Ownership split (two parallel work streams):** this session owns **structure**
> — the `/tools` IA, routing, page scaffolding, SEO/schema, CTAs, and the platform
> core. The design/brand session owns **visual identity + copy tone** (homepage,
> Chirpy, palette). Repositioning lands as: I build the funnel plumbing, they dress it.

---

## 2. The core loop (the whole product in one pass)

The user moves through a pipeline. Each step says what the user does, what the
AI does, and whether it's free or metered.

| #   | Step                         | User does                                                                                                | AI does                                                                                                                                                                           | Free / Paid                      |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 0   | **Onboard** (during sign-up) | Picks content **pillars** ("what do you wanna yap about") + a few **creators they like**. All skippable. | Nothing yet — this _seeds_ personalization for later generation.                                                                                                                  | Free (part of auth)              |
| 1   | **Inspiration**              | Saves TikTok / YouTube / IG clips into pillar folders (this section already exists in the app).          | — (later: auto-summarize a saved clip).                                                                                                                                           | Free to save                     |
| 2   | **Ideate**                   | Picks a saved inspiration **or** hits "Surprise me".                                                     | Generates a **content outline + hook (several variants) + key talking points**. "Surprise me" draws on _all their saved inspiration + past content_. Optional: a **full script**. | **Credit**                       |
| 3   | **Choose teleprompter view** | Chooses what shows while recording: **full script**, **hook + key points**, or **nothing**.              | —                                                                                                                                                                                 | Free                             |
| 4   | **Record**                   | Records camera + mic in a **TikTok-style recorder** with the chosen notes as a **teleprompter** overlay. | —                                                                                                                                                                                 | Free to record                   |
| 5   | **Edit**                     | Quickly fixes mistakes in the transcript-based editor (cut words, silences, 1-click).                    | Optional AI "clean up retakes".                                                                                                                                                   | Editing free; AI cleanup metered |
| 6   | **Feedback** (optional)      | Chooses **Audio / Video / Full** coaching, then **retakes** or moves on.                                 | Coaching on delivery + on-camera presence.                                                                                                                                        | **Credit** (tiered)              |
| 7   | **Publish**                  | Export now. **One-click cross-post** later.                                                              | —                                                                                                                                                                                 | Free (export)                    |

**Design intent to preserve:** the loop is _fast and forgiving_ — generate an
idea in seconds, read it off a teleprompter so you don't fumble, fix the fumble
you did make in one tap, and (optionally) get coached before you post.

---

## 3. Monetization

**Model: hard paywall + 7-day free trial → monthly subscription (tiers) +
credit top-ups.**

- **The free editor stays free** (the funnel). Everything _AI_ — generation,
  coaching, the guided create loop — is **premium**, behind the paywall.
- **7-day free trial**, then a **monthly subscription** in tiers.
- Subscription includes a **monthly credit allotment**; credits meter the AI
  actions (generation + feedback). Run out → **buy top-up credit packs**.
- This is the Higgsfield-style shape (sub + top-ups) — we borrow the _shape_,
  not their numbers.

**Free vs paid line:**

| Free forever (funnel)                                          | Premium (paywall + trial)                        |
| -------------------------------------------------------------- | ------------------------------------------------ |
| In-browser editor: cut/trim, remove silences, captions, export | AI feedback (audio / video / full)               |
| Basic 1-click edit (silence + pause trim — client-side)        | AI idea/hook/script generation + "Surprise me"   |
| Save inspiration                                               | Teleprompter-guided record flow (premium polish) |
|                                                                | Session history + re-watch library               |
|                                                                | One-click cross-post (later)                     |

**Credits = the AI meter.** Each AI action has a credit cost proportional to
what it costs us (§4). Exact credit-per-action and tier prices are set in the
**Billing phase on measured COGS** — §7. Directional starting point:

- Audio feedback = 1 · Video = 2 · Full = 3 credits.
- Idea/hook/points generation = 1 · Full script = 2 · Surprise-me = 2 credits.
- $X.99/mo → an allotment framed as "N full analyses / M ideas per month".
- Top-up packs for heavy users.

> **Open tension to resolve:** "hard paywall" vs the earlier "generous free
> tier." Resolution in this doc: the **editor** is the generous free tier
> (funnel); the **AI** is hard-paywalled with a trial. Keep that line crisp.

---

## 4. What each AI action costs us (the money map)

**Guiding principle: do the free/deterministic work on-device; only pay for
genuine AI judgment.** All the _meters_ (WPM, filler rate, pauses, clarity,
vocab) are computed for **$0** from transcript + word timings — the LLM only
writes the words a coach would say.

### Editor (the free funnel — keep our cost ~$0 on web)

| Action                                     | How                                     | Our cost                                                           |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------ |
| Transcribe for editing                     | In-browser Whisper on web (client-side) | **$0** on web. On mobile/premium → server Deepgram (~$0.009/clip). |
| Remove silences                            | Client-side VAD                         | **$0**                                                             |
| 1-click edit (silence + pauses + captions) | Client-side                             | **$0**                                                             |
| 1-click AI "clean up retakes"              | LLM pass (Surplus/Gemini)               | **~$0.001** — cheap; keep free or make it a light premium touch.   |

> Decision to keep: **editor transcription stays client-side (free) on the free
> web tool.** Server-side Deepgram is the _authoritative_ path for **feedback**
> and for **mobile** (in-browser Whisper can't run natively). Don't route the
> free editor through paid transcription.

### Feedback (premium) — per ~2-min clip

| Tier      | Pipeline                                                                                 | Model                                      | COGS             |
| --------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------- |
| **Audio** | Deepgram Nova-3 (word timings + per-word confidence) → free meters → 1 LLM coaching pass | Deepgram + GPT-4o-mini / Gemini Flash-Lite | **~$0.01**       |
| **Video** | Gemini **native video** (Files API — frames + audio in one call) → on-camera rubric      | Gemini 2.5 Flash                           | **~$0.015–0.02** |
| **Full**  | Deepgram meters + Gemini video + synthesis pass                                          | above combined                             | **~$0.03**       |

Why Gemini for video: it's the **only** mainstream model that ingests video
directly (samples frames + hears audio together) — GPT-4o/Claude need us to run
ffmpeg and send frames as images at **10–20× the cost** and blind to motion.
Cost levers: `media_resolution` low/medium, low fps for long clips, structured
output, batch mode (~50% off) for non-realtime.

### Generation (premium) — text, cheap

| Action                               | Approach                                                                     | Model                           | COGS             |
| ------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------- | ---------------- |
| Outline + hook variants + key points | **One structured call** returning all fields + N hook variants (not N calls) | Gemini Flash-Lite / GPT-4o-mini | **~$0.002**      |
| Full script                          | Separate opt-in call (longer output)                                         | same                            | **~$0.005–0.01** |
| "Surprise me"                        | Retrieve over saved inspiration + past content, then one generation call     | same (+ cheap embed/retrieve)   | **~$0.005**      |

> **Recommended (you asked me to decide):** generate outline + **multiple hook
> variants** + key points in **a single structured call** (cheaper + lower
> latency than per-field calls); reserve the **full script** for a separate
> opt-in call since its output is long (the expensive side). Cache the static
> system/rubric prompt. Use a cheap fast model; only escalate to a bigger model
> for a paid "deep" option.

### Storage (Cloudflare R2)

$0.015/GB-month, **$0 egress** (re-watch never costs us). Free tier 10 GB.
Per-user quota metered in Postgres → iCloud-style "delete or upgrade".

---

## 5. Architecture principles (how it stays seamless + cheap)

1. **One backend, thin clients.** Every AI/paid action is a server API call.
   Web now, native iOS later, hit the **identical endpoints** with the same
   recording → same result. No provider keys on the client.
2. **Auth only at the paid action.** Clerk gate fires exactly when the user
   invokes a credit/AI action — the free editor needs no login.
3. **Free on-device, paid on-server.** Deterministic + free work runs
   client-side (in-browser transcribe/edit on web); anything that must be shared,
   authoritative, or key-holding runs server-side (feedback, generation, video).
4. **Measure, then price.** Every AI call logs its real token/API cost per run so
   Billing sets credits/prices on data, not guesses.
5. **Reuse speaking-coach.** Port its grader client — one OpenAI-compatible SDK
   through the **Surplus** gateway (serves GPT/Gemini/Claude cheap) with
   native-provider fallback, plus its JSON-recovery + refund-on-failure patterns.

**Stack:** Clerk (auth) · Neon Postgres + Drizzle (users, credits, submissions) ·
Cloudflare R2 (media, $0 egress) · Vercel functions (Fluid Compute) · Surplus →
Gemini/GPT (AI). No Azure.

---

## 6. Data we keep per user

- **profile** — content pillars, liked creators (from onboarding).
- **inspiration** — saved clips (URL + pillar tag + optional AI summary).
- **ideas / scripts** — generated outlines, hook variants, key points, scripts.
- **submissions** — recordings + media (R2 key + bytes) + transcript/feedback/scores.
- **credits** — balance + append-only ledger (grant / deduct / refund).

(users, credit_ledger, submissions already exist — Phase 2. profile,
inspiration, ideas are added as their phases land.)

---

## 7. Build roadmap

| Phase | Deliverable                                                                                                                                                       | Status                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1     | **Clerk auth** — sign-in-or-up, gate only paid actions                                                                                                            | ✅ merged (`#26`)     |
| 2     | **Data layer** — Neon + Drizzle, credit ledger, submissions, storage metering, Clerk webhook                                                                      | ✅ merged (`#27`)     |
| 3     | **Audio feedback loop** — server transcription + free meters + coaching; auth gate + credit deduct/refund + store + display. _Proves the whole machinery at ~1¢._ | ✅ merged             |
| 4     | **R2 media + Video/Full feedback** — presigned uploads, Gemini video, re-watch, storage quota + hardening                                                         | ✅ merged (`#31/#33`) |
| 5a    | **Idea generation** — outline + hook variants + key points (structured call), charge-on-success                                                                   | ✅ merged (`#29`)     |
| 5b    | **Ideation rest** — onboarding pillars → full script generation + "Surprise me"                                                                                   | **next**              |
| 6     | **Teleprompter recorder** — TikTok-style capture with notes overlay                                                                                               |                       |
| 7     | **History dashboard** — past sessions + feedback + re-watch in one place                                                                                          | ✅ merged (`#30`)     |
| 8     | **Billing** — Stripe: hard paywall + 7-day trial + monthly tiers + credit top-ups; finalize pricing on measured COGS                                              | needs Stripe creds    |
| 9     | **One-click cross-post**                                                                                                                                          | later                 |
| 10    | **SEO tools layer** — `/tools` hub, promote drills to indexable tool pages, repoint guides + CTAs (structure only; visuals by design session)                     | after platform core   |

**Sequencing note (current):** the whole feedback machine (auth + credits +
storage + audio/video/full + history) is **live**. Remaining order, decided
2026-07-01: **finish the platform core first** (5b script/Surprise-me → 6
teleprompter → 8 billing), _then_ build the SEO tools layer (Phase 10) — so the
new top-of-funnel traffic lands on a complete product instead of a half-built one.
Order is a lever, not a contract.

---

## 8. Open decisions (resolve as we reach them)

- **Exact free/paywall line** for editor AI cleanup (free loss-leader vs premium).
- **Credit numbers + tier prices** — set in Phase 8 on measured COGS.
- **Generation model** — recommend Gemini Flash-Lite / GPT-4o-mini; escalate only
  for a paid "deep" option.
- **Teleprompter default** — recommend **hook + key points** (natural delivery;
  full script reads robotic, offer it but warn).
- **When to start the native mobile app** — the architecture is built to make it
  a thin client from day one; pick the moment.
- **"Surprise me" retrieval** — simple (recent inspiration in the prompt) vs
  embeddings/RAG over the whole library. Start simple.
