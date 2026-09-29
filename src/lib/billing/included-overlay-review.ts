import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

/** Three automated checks per purchased overlay unit, for 24 hours. Claims
 * survive retries/restarts and do not charge the creator again. Failed checks
 * still consume an allowance because the provider may already have billed us. */
export async function claimIncludedOverlayReview(
  userId: string,
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select id from users where id = ${userId} for update`);
    const result = await tx.execute(sql`
      with purchased as (
        select c.*, greatest(1, least(8, coalesce((c.metadata->>'quantity')::integer, 1))) as units,
          coalesce((select sum(r.delta) from credit_ledger r where r.user_id = c.user_id
            and r.reason = 'refund' and r.delta > 0
            and r.metadata->>'usageId' = c.metadata->>'usageId'), 0) as refunded
        from credit_ledger c
        where c.user_id = ${userId} and c.reason = 'deduction' and c.delta < 0
          and c.created_at > now() - interval '24 hours'
          and c.metadata->>'billingVersion' = '2'
          and c.metadata->>'action' in ('design_overlay', 'revise_overlay', 'retime_overlay', 'direct_overlays')
      ), eligible as (
        select c.*, (greatest(0, units - floor(refunded * units / (-delta)::numeric)) * 3)::integer as checks
        from purchased c
      ), available as (
        select c.id, c.metadata->>'usageId' as usage_id, slot
        from eligible c cross join lateral generate_series(1, c.checks) slot
        where not exists (select 1 from credit_ledger used
          where used.stripe_ref = 'overlay_review_' || c.id::text || '_' || slot::text)
        order by c.created_at, slot limit 1
      )
      insert into credit_ledger (user_id, delta, reason, balance_after, stripe_ref, metadata)
      select ${userId}, 0, 'deduction', u.credits_balance,
        'overlay_review_' || a.id::text || '_' || a.slot::text,
        jsonb_build_object('action', 'included_overlay_review', 'usageId', a.usage_id)
      from available a join users u on u.id = ${userId}
      on conflict (stripe_ref) do nothing returning id
    `);
    return result.rows.length === 1;
  });
}
