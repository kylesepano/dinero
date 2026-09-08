const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const cache = new Map()
function load(relative) {
 const filename = path.resolve(relative)
 if (cache.has(filename)) return cache.get(filename).exports
 const module = { exports: {} }; cache.set(filename, module)
 const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
 new Function('require', 'module', 'exports', js)((name) => load(path.resolve(path.dirname(filename), name + '.ts')), module, module.exports)
 return module.exports
}
const { parseAmount, totals, validDate } = load('src/utils/finance.ts')
const { freshData } = load('src/data/defaults.ts')
const { validateData, loadData, STORAGE_KEY } = load('src/utils/storage.ts')
assert.equal(parseAmount('0.10'), 10)
assert.equal(parseAmount('1250.99'), 125099)
for (const invalid of ['0', '-1', '1.001', '1e3', 'Infinity', 'abc', '10000000000']) assert.equal(parseAmount(invalid), null)
assert.equal(validDate('2024-02-29'), true)
assert.equal(validDate('2026-02-29'), false)
assert.equal(validDate('2026-09-31'), false)
const demo = freshData(true)
assert.equal(validateData(demo), true)
assert.equal(validateData(freshData()), true)
assert.deepEqual(totals(demo.transactions), { income: 6350000, expense: 1209800, balance: 5140200 })
const edited = structuredClone(demo); edited.transactions[0].amount += 100
assert.equal(totals(edited.transactions).balance, 5140300)
assert.equal(totals(edited.transactions.slice(1)).income, 850000)
for (const mutate of [d => d.transactions[0].amount = 1.5, d => d.transactions[0].categoryId = 'missing', d => d.transactions[0].type = 'expense', d => d.transactions[0].date = '2026-02-30', d => d.categories.push(d.categories[0]), d => d.transactions.push(d.transactions[0]), d => d.budgets.push(d.budgets[0]), d => d.settings.currency = 'INVALID']) {
 const bad = structuredClone(demo); mutate(bad); assert.equal(validateData(bad), false)
}
const store = new Map(); global.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) }
assert.equal(loadData().data.demo, true)
store.set(STORAGE_KEY, JSON.stringify(freshData()))
assert.equal(loadData().data.demo, false)
assert.equal(loadData().data.transactions.length, 0)
store.set(STORAGE_KEY, JSON.stringify(demo))
assert.deepEqual(loadData().data, demo)
store.set(STORAGE_KEY, '{invalid')
assert.ok(loadData().error)
assert.equal(store.get(STORAGE_KEY), '{invalid')
console.log('Passed: money parsing, date validation, totals, edit/delete calculations, backup integrity, persistence, empty workspace, and malformed-storage recovery.')
