const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", js)(
    (name) => load(path.resolve(path.dirname(file), name + ".ts")),
    module,
    module.exports,
  );
  return module.exports;
}
(async () => {
  const { freshData } = load("src/data/defaults.ts");
  const { prepareImport, readLegacy, fingerprint, mapSnapshot, cloudError } =
    load("src/services/mapping.ts");
  const { createWorkspaceRepository: factory } = load(
    "src/services/workspace.ts",
  );
  const createWorkspaceRepository = (mock) =>
    factory(
      {
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: "a" }, access_token: "token-a" } },
            error: null,
          }),
        },
        rpc: (...args) => ({
          setHeader: (name, value) => {
            assert.equal(name, "Authorization");
            assert.equal(value, "Bearer token-a");
            return mock.rpc(...args);
          },
        }),
      },
      "a",
    );
  const { authTransition, initialAuth } = load("src/auth/state.ts");
  const legacy = freshData(true);
  const original = JSON.stringify(legacy);
  const store = new Map();
  global.localStorage = { getItem: (key) => store.get(key) ?? null };
  assert.equal(readLegacy().data, null);
  store.set("dinero:v1", original);
  assert.deepEqual(readLegacy().data, legacy);
  assert.equal(readLegacy().data.demo, true);
  const mapped = prepareImport(legacy);
  assert.notEqual(mapped.categories[0].id, legacy.categories[0].id);
  assert.equal(mapped.transactions[0].categoryId, mapped.categories[0].id);
  assert.equal(mapped.transactions[0].amount, legacy.transactions[0].amount);
  assert.equal(mapped.transactions[0].date, legacy.transactions[0].date);
  assert.deepEqual(mapped.budgets, legacy.budgets);
  assert.deepEqual(mapped.settings, legacy.settings);
  assert.equal(mapped.categories[2].icon, 0);
  assert.equal(store.get("dinero:v1"), original);
  const hash = await fingerprint(legacy);
  assert.equal(
    hash,
    await fingerprint({
      ...legacy,
      transactions: [...legacy.transactions].reverse(),
    }),
  );
  assert.notEqual(
    hash,
    await fingerprint({ ...legacy, settings: { currency: "USD" } }),
  );
  store.set("dinero:v1", "malformed");
  assert.ok(readLegacy().error);
  assert.equal(store.get("dinero:v1"), "malformed");
  const snapshot = { data: mapped, revision: 1, imports: [] };
  assert.deepEqual(mapSnapshot(snapshot), snapshot);
  assert.throws(() => mapSnapshot({ ...snapshot, revision: -1 }));
  let calls = 0;
  const failure = {
    rpc: async () => {
      calls++;
      return { data: null, error: { message: "network failure" } };
    },
  };
  const repo = createWorkspaceRepository(failure);
  await assert.rejects(repo.load(), { message: "network failure" });
  await assert.rejects(repo.save(mapped, 1), { message: "network failure" });
  assert.equal(calls, 2);
  const success = createWorkspaceRepository({
    rpc: async (name, args) => {
      assert.equal(name, "save_workspace");
      assert.equal(args.expected_revision, 1);
      assert.equal(args.import_hash, hash);
      return {
        data: { ...snapshot, revision: 2, imports: [hash] },
        error: null,
      };
    },
  });
  assert.equal((await success.save(mapped, 1, hash)).revision, 2);
  const mismatch = createWorkspaceRepository({
    rpc: async () => ({
      data: { ...snapshot, data: { ...mapped, transactions: [] } },
      error: null,
    }),
  });
  await assert.rejects(mismatch.save(mapped, 1, hash), /did not match/);
  const sessionA = { user: { id: "a" } },
    sessionB = { user: { id: "b" } };
  let auth = authTransition(initialAuth, "INITIAL_SESSION", sessionA);
  assert.equal(auth.loading, false);
  const generation = auth.generation;
  auth = authTransition(auth, "TOKEN_REFRESHED", sessionA);
  assert.equal(auth.generation, generation);
  auth = authTransition(auth, "SIGNED_OUT", null);
  assert.equal(auth.session, null);
  assert.equal(auth.recovery, false);
  auth = authTransition(auth, "SIGNED_IN", sessionB);
  assert.notEqual(auth.generation, generation);
  assert.equal(auth.session.user.id, "b");
  auth = authTransition(auth, "PASSWORD_RECOVERY", sessionB);
  assert.equal(auth.recovery, true);
  auth = authTransition(auth, "SIGNED_OUT", null);
  assert.equal(auth.recovery, false);
  assert.match(cloudError({ message: "revision_conflict" }), /another tab/);
  assert.match(cloudError({ message: "already_imported" }), /already imported/);
  let leaked = false;
  const switched = factory(
    {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: "b" }, access_token: "token-b" } },
          error: null,
        }),
      },
      rpc: () => {
        leaked = true;
      },
    },
    "a",
  );
  await assert.rejects(switched.save(mapped, 1), /session changed/);
  assert.equal(leaked, false);
  console.log(
    "Passed LOCAL/MOCK tests: auth transitions, account boundaries, mapping, local backup preservation, import fingerprints, response verification, and persistence failures.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
