const fs = require("node:fs");
const { PGlite } = require(
  process.env.PGLITE_MODULE_PATH || "@electric-sql/pglite",
);
(async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const file of fs.readdirSync("supabase/migrations").sort())
    await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
  await db.exec(fs.readFileSync("supabase/tests/isolation.sql", "utf8"));
  await db.close();
  console.log(
    "LOCAL PGlite PostgreSQL passed migrations, two-role isolation, cross-owner inserts/updates/deletes, foreign keys, atomic rollback, stale revisions, duplicate imports, and anonymous denial. This is NOT a live Supabase test.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
