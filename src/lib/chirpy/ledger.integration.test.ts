import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Pool } from "pg";
import { withPlanLedger } from "./ledger";
import type { PlanInput } from "./protocol";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const user = `chirpy-test-${randomUUID()}`;
const projectID = randomUUID(),
  sessionID = randomUUID();
const input = (): PlanInput => ({
  protocolVersion: 1,
  projectID,
  sessionID,
  executionID: randomUUID(),
  revision: 1,
  context: { projectID, sessionID, revision: 1 },
  catalog: [{ id: "editor.captions.setVisible" }],
  messages: [{ role: "user", content: "hide captions" }],
});
beforeAll(async () => {
  await pool.query("insert into users(id, credits_balance) values ($1, 20)", [
    user,
  ]);
});
afterAll(async () => {
  await pool.query("delete from users where id = $1", [user]);
  await pool.end();
});
it("serializes duplicate model calls and charges once, including retries after completion", async () => {
  const request = input();
  let generated = 0;
  const generate = async () => {
    generated++;
    return {
      message: "",
      actions: [
        { action: "editor.captions.setVisible", arguments: { visible: false } },
      ],
    };
  };
  const results = await Promise.all(
    Array.from({ length: 6 }, () => withPlanLedger(user, request, generate)),
  );
  expect(generated).toBe(1);
  for (const result of results) expect(result).toEqual(results[0]);
  await withPlanLedger(
    user,
    { ...request, context: { revision: 1, sessionID, projectID } },
    generate,
  );
  expect(generated).toBe(1);
  const ledger = await pool.query(
    "select * from credit_ledger where user_id = $1 and metadata->>'usageId' = $2",
    [user, request.executionID],
  );
  expect(ledger.rows).toHaveLength(1);
  expect(ledger.rows[0].delta).toBe(-1);
  await expect(
    withPlanLedger(user, { ...request, revision: 2 }, generate),
  ).rejects.toThrow("execution_conflict");
});
it("rolls the reservation and response back when the provider fails", async () => {
  const request = input();
  await expect(
    withPlanLedger(user, request, async () => {
      throw new Error("provider_failed");
    }),
  ).rejects.toThrow("provider_failed");
  expect(
    (
      await pool.query(
        "select * from chirpy_plans where user_id = $1 and execution_id = $2",
        [user, request.executionID],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await pool.query(
        "select * from credit_ledger where user_id = $1 and metadata->>'usageId' = $2",
        [user, request.executionID],
      )
    ).rows,
  ).toHaveLength(0);
});
it("does not call the provider when the atomic credit reservation fails", async () => {
  await pool.query("update users set credits_balance = 0 where id = $1", [
    user,
  ]);
  let generated = false;
  await expect(
    withPlanLedger(user, input(), async () => {
      generated = true;
      return { message: "No edit", actions: [] };
    }),
  ).rejects.toThrow("insufficient_credits");
  expect(generated).toBe(false);
});
