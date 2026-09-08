// Use two EMPTY, confirmed, disposable accounts in a staging Supabase project.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
if (!process.argv.includes("--confirm-disposable"))
  throw new Error(
    "Pass --confirm-disposable only for two empty staging test accounts.",
  );
for (const key of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
]) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
const create = () =>
  createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
const a = create(),
  b = create(),
  anon = create(),
  clients = [a, b];
const tables = [
  "categories",
  "transactions",
  "budgets",
  "settings",
  "import_receipts",
];
const fixtures = [];
async function ok(request) {
  const response = await request;
  if (response.error) throw response.error;
  return response.data;
}
try {
  const sa = await ok(
    a.auth.signInWithPassword({
      email: process.env.TEST_USER_A_EMAIL,
      password: process.env.TEST_USER_A_PASSWORD,
    }),
  );
  const sb = await ok(
    b.auth.signInWithPassword({
      email: process.env.TEST_USER_B_EMAIL,
      password: process.env.TEST_USER_B_PASSWORD,
    }),
  );
  assert.notEqual(sa.user.id, sb.user.id, "Two different accounts required");
  for (const client of clients)
    for (const table of tables) {
      assert.equal(
        (await ok(client.from(table).select("id"))).length,
        0,
        "Test accounts must be empty; no existing data will be overwritten",
      );
    }
  for (const [i, client] of clients.entries()) {
    const user_id = i === 0 ? sa.user.id : sb.user.id;
    const rows = {
      categories: {
        id: crypto.randomUUID(),
        user_id,
        name: "Isolation test",
        type: "expense",
        color: "#26876b",
      },
      transactions: {
        id: crypto.randomUUID(),
        user_id,
        type: "expense",
        amount: 100,
        date: "2026-09-08",
        note: "Disposable isolation fixture",
      },
      budgets: {
        id: crypto.randomUUID(),
        user_id,
        month: "2026-09",
        amount: 1000,
      },
      settings: { id: crypto.randomUUID(), user_id, currency: "PHP" },
      import_receipts: {
        id: crypto.randomUUID(),
        user_id,
        fingerprint: crypto.randomUUID().replaceAll("-", "").repeat(2),
      },
    };
    rows.transactions.category_id = rows.categories.id;
    fixtures.push(rows);
    for (const table of tables)
      await ok(client.from(table).insert(rows[table]));
  }
  for (const table of tables) {
    const row = fixtures[1][table];
    assert.deepEqual(
      await ok(a.from(table).select("*").eq("id", row.id)),
      [],
      `A read B ${table}`,
    );
    assert.deepEqual(
      await ok(
        a.from(table).update({ user_id: sb.user.id }).eq("id", row.id).select(),
      ),
      [],
      `A updated B ${table}`,
    );
    assert.deepEqual(
      await ok(a.from(table).delete().eq("id", row.id).select()),
      [],
      `A deleted B ${table}`,
    );
    const injected = await a
      .from(table)
      .insert({ ...row, id: crypto.randomUUID() });
    assert.equal(
      injected.error?.code,
      "42501",
      `Insert ownership rejected in ${table}`,
    );
    const transfer = await a
      .from(table)
      .update({ user_id: sb.user.id })
      .eq("id", fixtures[0][table].id);
    assert.equal(
      transfer.error?.code,
      "42501",
      `Ownership transfer rejected in ${table}`,
    );
    const publicRead = await anon.from(table).select("*");
    assert.ok(
      publicRead.error || publicRead.data.length === 0,
      `Anonymous read in ${table}`,
    );
    assert.equal(
      (await ok(b.from(table).select("id").eq("id", row.id))).length,
      1,
      `B record preserved in ${table}`,
    );
  }
  const attached = await a
    .from("transactions")
    .insert({
      ...fixtures[0].transactions,
      id: crypto.randomUUID(),
      category_id: fixtures[1].categories.id,
    });
  assert.equal(
    attached.error?.code,
    "23503",
    "Cross-account category rejected",
  );
  assert.ok((await anon.rpc("load_workspace")).error, "Anonymous RPC rejected");
  console.log(
    "LIVE Supabase checks passed: two account sessions, all-table owner isolation, cross-owner category denial, and anonymous denial.",
  );
} finally {
  for (const [i, rows] of fixtures.entries())
    for (const table of [
      "transactions",
      "categories",
      "budgets",
      "settings",
      "import_receipts",
    ]) {
      const { error } = await clients[i]
        .from(table)
        .delete()
        .eq("id", rows[table].id);
      if (error)
        console.error(
          `Fixture cleanup failed for ${table} ${rows[table].id}: ${error.message}`,
        );
    }
  await Promise.all(clients.map((c) => c.auth.signOut()));
}
