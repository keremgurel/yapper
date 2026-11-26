import { sql } from "drizzle-orm";
import { getDb, type DbTx } from "@/lib/db/client";
import { PAID_ACTIONS } from "./paid-actions";

/** Which charge a generated card was paid from, as the design reply said. */
export interface OverlayCharge {
  /** usageId of the design or revision deduction. */
  usageId: string;
  /** The card within that charge: the design moment id, or the asset id. */
  id: string;
}

export interface OverlayDropRefund {
  /** Credits returned for the dropped card. */
  credits: number;
  /** Credits returned for the planning pass, when no card of its run is left. */
  run: number;
}

const DROPPABLE = ["design_overlay", "revise_overlay"] as const;

/**
 * Most dropped cards one account is refunded for in 24 hours. The check runs
 * on frames the client renders, so a client could force a failure; this bounds
 * what that can return. An honest heavy day is two or three runs of six cards.
 */
export const DAILY_DROP_REFUNDS = 20;

/**
 * Record which cards a design or revision charge actually delivered. Only
 * these ids can be refunded later, so a client cannot invent card ids.
 */
export async function recordDeliveredOverlays(
  userId: string,
  usageId: string,
  ids: readonly string[],
): Promise<void> {
  if (!ids.length) return;
  await getDb().execute(sql`
    update credit_ledger set metadata = metadata || ${JSON.stringify({
      delivered: ids,
    })}::jsonb
    where user_id = ${userId} and reason = 'deduction'
      and metadata->>'usageId' = ${usageId}
  `);
}

/**
 * The planning charge a design batch may be tagged with: this user's own
 * direct_overlays deduction from the last 24 hours, or nothing.
 */
export async function ownPlanningCharge(
  userId: string,
  run: string | undefined,
): Promise<string | undefined> {
  if (!run) return undefined;
  const found = await getDb().execute(sql`
    select 1 from credit_ledger
    where user_id = ${userId} and reason = 'deduction' and delta < 0
      and metadata->>'usageId' = ${run}
      and metadata->>'action' = 'direct_overlays'
      and created_at > now() - interval '24 hours'
    limit 1
  `);
  return found.rows.length ? run : undefined;
}
type Droppable = (typeof DROPPABLE)[number];

interface ChargeRow {
  cost: number;
  refunded: number;
  action: string;
  run: string | null;
  delivered: string[];
}

/**
 * Return one card's credits after the rendered review dropped it.
 *
 * The amount comes from the ledger, not the client: the usageId has to be this
 * user's own design or revision deduction from the last 24 hours, one card is
 * worth one unit of that action, and the total refunded on a charge never
 * exceeds what it took. The stripe_ref key makes each card refundable once, so
 * a retried review cannot pay twice.
 *
 * When every design charge of a run has then been refunded in full, nothing
 * from that run reached the timeline, so its planning charge goes back too.
 */
export async function refundDroppedOverlay(
  userId: string,
  charge: OverlayCharge,
  reason: string,
): Promise<OverlayDropRefund> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select id from users where id = ${userId} for update`);
    const row = await chargeRow(tx, userId, charge.usageId, DROPPABLE);
    if (!row || !row.delivered.includes(charge.id))
      return { credits: 0, run: 0 };
    if ((await dropRefundsToday(tx, userId)) >= DAILY_DROP_REFUNDS) {
      console.warn("[billing] overlay drop refund cap reached", { userId });
      return { credits: 0, run: 0 };
    }
    const unit = PAID_ACTIONS[row.action as Droppable].credits;
    const credits = await refundOnce(tx, userId, {
      amount: Math.min(unit, row.cost - row.refunded),
      ref: `overlay_drop_${charge.usageId}_${charge.id}`,
      action: row.action,
      usageId: charge.usageId,
      reason,
    });
    if (!credits || !row.run) return { credits, run: 0 };
    return { credits, run: await refundEmptyRun(tx, userId, row.run) };
  });
}

async function dropRefundsToday(tx: DbTx, userId: string): Promise<number> {
  const result = await tx.execute(sql`
    select count(*)::integer as n from credit_ledger
    where user_id = ${userId} and reason = 'refund'
      and stripe_ref like 'overlay_drop_%'
      and created_at > now() - interval '24 hours'
  `);
  return Number((result.rows[0] as { n?: number } | undefined)?.n ?? 0);
}

async function refundEmptyRun(
  tx: DbTx,
  userId: string,
  run: string,
): Promise<number> {
  const open = await tx.execute(sql`
    select 1 from credit_ledger c
    where c.user_id = ${userId} and c.reason = 'deduction' and c.delta < 0
      and c.metadata->>'action' = 'design_overlay'
      and c.metadata->>'run' = ${run}
      and -c.delta > coalesce((select sum(r.delta) from credit_ledger r
        where r.user_id = c.user_id and r.reason = 'refund' and r.delta > 0
          and r.metadata->>'usageId' = c.metadata->>'usageId'), 0)
    limit 1
  `);
  if (open.rows.length) return 0;
  const plan = await chargeRow(tx, userId, run, ["direct_overlays"]);
  if (!plan) return 0;
  return refundOnce(tx, userId, {
    amount: plan.cost - plan.refunded,
    ref: `overlay_run_${run}`,
    action: "direct_overlays",
    usageId: run,
    reason: "no_overlay_kept",
  });
}

async function chargeRow(
  tx: DbTx,
  userId: string,
  usageId: string,
  actions: readonly string[],
): Promise<ChargeRow | null> {
  const result = await tx.execute(sql`
    select -c.delta as cost, c.metadata->>'action' as action,
      c.metadata->>'run' as run, c.metadata->'delivered' as delivered,
      coalesce((select sum(r.delta) from credit_ledger r
        where r.user_id = c.user_id and r.reason = 'refund' and r.delta > 0
          and r.metadata->>'usageId' = c.metadata->>'usageId'), 0) as refunded
    from credit_ledger c
    where c.user_id = ${userId} and c.reason = 'deduction' and c.delta < 0
      and c.product = 'studio'
      and c.metadata->>'usageId' = ${usageId}
      and c.metadata->>'billingVersion' = '2'
      and c.metadata->>'action' in (${sql.join(
        actions.map((a) => sql`${a}`),
        sql`, `,
      )})
      and c.created_at > now() - interval '24 hours'
    limit 1
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    cost: Number(row.cost),
    refunded: Number(row.refunded),
    action: String(row.action),
    run: typeof row.run === "string" ? row.run : null,
    delivered: Array.isArray(row.delivered)
      ? row.delivered.filter((id): id is string => typeof id === "string")
      : [],
  };
}

async function refundOnce(
  tx: DbTx,
  userId: string,
  entry: {
    amount: number;
    ref: string;
    action: string;
    usageId: string;
    reason: string;
  },
): Promise<number> {
  if (entry.amount <= 0) return 0;
  const claimed = await tx.execute(sql`
    insert into credit_ledger (user_id, delta, reason, balance_after, product, stripe_ref, metadata)
    values (${userId}, ${entry.amount}, 'refund', 0, 'studio', ${entry.ref},
      ${JSON.stringify({
        action: entry.action,
        usageId: entry.usageId,
        reason: entry.reason.slice(0, 200),
        partial: true,
      })}::jsonb)
    on conflict (stripe_ref) do nothing
    returning id
  `);
  const id = (claimed.rows[0] as { id?: string } | undefined)?.id;
  if (!id) return 0;
  await tx.execute(sql`
    with updated as (
      update users set credits_balance = credits_balance + ${entry.amount}
      where id = ${userId} returning credits_balance
    )
    update credit_ledger set balance_after = (select credits_balance from updated)
    where id = ${id}
  `);
  return entry.amount;
}
