# Storage economics

Last verified: 2026-08-27.

## What actually costs money

- Finished videos and imported cross-post masters live in Cloudflare R2
  Standard storage. This is the user-facing quota meter.
- Projects, Brain blocks, skills, ideas, library items, views and dictionary
  entries live in Neon Postgres. They are shown separately because text rows are
  several orders of magnitude smaller than video.
- Native editor project state and source media remain in the user's Application
  Support folder/on-disk source locations. They do not create cloud storage
  cost until the creator explicitly sends a final export to Poster.
- AI/transcription spend and application compute are not storage costs and must
  remain in the credits/unit-economics model.

## Current marginal rates

Cloudflare R2 Standard:

- $0.015 per GB-month stored.
- $4.50 per million Class A operations (writes/listing).
- $0.36 per million Class B operations (reads/metadata).
- Zero internet egress fees.
- The account receives 10 GB-month, 1 million Class A operations and 10 million
  Class B operations free each month. Treat this as an account-wide buffer, not
  a promise attached to every user.

Neon Launch:

- $0.35 per GB-month of database storage.
- $0.20 per GB-month of retained WAL/history on paid plans.
- Compute and network transfer are separate from storage.

## Marginal storage cost per fully used allowance

| Allowance          | R2 storage cost/month | Monthly-equivalent membership revenue |         Storage share |
| ------------------ | --------------------: | ------------------------------------: | --------------------: |
| 2 GB free fallback |                 $0.03 |                                   n/a |                   n/a |
| 25 GB Weekly       |                $0.375 |                          about $34.62 | 1.1% before free tier |
| 50 GB Monthly      |                 $0.75 |                                $24.99 | 3.0% before free tier |
| 100 GB Yearly      |                 $1.50 |                          about $16.67 | 9.0% before free tier |

R2 bills by GB-month, so margins must compare against monthly-equivalent plan
revenue rather than the price printed for a different cadence. Storage remains
healthy at these allowances, but the yearly plan is the one to watch: a user
holding the full 100 GB all year creates about $18 of annual R2 storage cost
before the account-wide free tier.

## Product accounting rules

1. `users.storage_bytes` is the authoritative quota counter for active,
   referenced media. Never derive enforcement from client claims.
2. Pending uploads reserve their declared bytes atomically, but do not enter the
   active counter until `HeadObject` verifies the uploaded object.
3. One physical object is counted once even when referenced by a submission and
   an imported-platform cache row.
4. Deleting the last durable reference refunds quota transactionally, then the
   lifecycle worker removes the R2 object.
5. Written workspace size is measured and disclosed separately. Do not charge
   normal text records against a GB-scale video quota unless a future product
   introduces large file attachments or embeddings that materially change the
   economics.

## Capacity trigger

Review the tier allowances when either condition becomes true:

- R2 storage exceeds roughly 20% of recurring membership revenue for a tier.
- The 95th-percentile active user reaches 70% of their allowance and retained
  video is still growing month over month.

Until then, use clear meters and deletion/upgrade paths rather than shrinking
allowances. The current raw storage margins have substantial headroom.
