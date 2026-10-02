import { eq } from "drizzle-orm";
import { trainSharesStudioWallet } from "@/lib/billing/shared-wallet";
import type { Product } from "@/lib/billing/products";
import { getDb, type DbTx } from "./client";
import { deductWithinTx, InsufficientCreditsError } from "./credits";
import { users } from "./schema";

interface TrainWalletRow {
  train: number;
  studio: number;
  createdAt: Date;
}

async function readWallets(
  db: Pick<DbTx, "select">,
  userId: string,
): Promise<TrainWalletRow | null> {
  const [row] = await db
    .select({
      train: users.trainCreditsBalance,
      studio: users.creditsBalance,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  return row ?? null;
}

/** The wallet a Train charge of `amount` would come from, or null if neither
 * can cover it. A charge is never split across wallets. */
function walletFor(row: TrainWalletRow, amount: number): Product | null {
  if (row.train >= amount) return "train";
  if (trainSharesStudioWallet(row) && row.studio >= amount) return "studio";
  return null;
}

/** Credits a Train action can spend right now: the Train wallet, or the shared
 * Studio balance for the accounts that still have one, whichever is larger. */
export async function getTrainSpendable(userId: string): Promise<number> {
  const row = await readWallets(getDb(), userId);
  if (!row) return 0;
  return Math.max(row.train, trainSharesStudioWallet(row) ? row.studio : 0);
}

/**
 * Charge a Train action inside the caller's transaction. Spends the Train
 * wallet first and only then a shared legacy balance. Returns what is still
 * spendable in Train afterwards. Throws `InsufficientCreditsError` when neither
 * wallet covers the cost.
 */
export async function deductTrainWithinTx(
  tx: DbTx,
  userId: string,
  amount: number,
  opts: { submissionId?: string; metadata?: Record<string, unknown> } = {},
): Promise<number> {
  const before = await readWallets(tx, userId);
  const product = before && walletFor(before, amount);
  if (!before || !product) throw new InsufficientCreditsError();
  // The conditional update inside is the real guard: a parallel request that
  // spent the same wallet first makes this throw instead of overdrawing.
  const remaining = await deductWithinTx(tx, userId, amount, {
    ...opts,
    product,
    metadata: { ...opts.metadata, surface: "train" },
  });
  const after = { ...before, [product]: remaining };
  return Math.max(
    after.train,
    trainSharesStudioWallet(after) ? after.studio : 0,
  );
}
