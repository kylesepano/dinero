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
const { parseAmount, totals, validDate, validTime, dateTimeLabel } = load('src/utils/finance.ts')
const { freshData } = load('src/data/defaults.ts')
const { validateData, loadData, STORAGE_KEY } = load('src/utils/storage.ts')
assert.equal(parseAmount('0.10'), 10)
assert.equal(parseAmount('1250.99'), 125099)
for (const invalid of ['0', '-1', '1.001', '1e3', 'Infinity', 'abc', '10000000000']) assert.equal(parseAmount(invalid), null)
assert.equal(validDate('2024-02-29'), true)
assert.equal(validDate('2026-02-29'), false)
assert.equal(validDate('2026-09-31'), false)
assert.equal(validTime('09:45'), true)
assert.equal(validTime('24:00'), false)
const demo = freshData(true)
assert.equal(validateData(demo), true)
assert.equal(validateData(freshData()), true)
assert.deepEqual(totals(demo.transactions), { income: 6350000, expense: 1209800, balance: 5140200 })
const edited = structuredClone(demo); edited.transactions[0].amount += 100
assert.equal(totals(edited.transactions).balance, 5140300)
assert.equal(totals(edited.transactions.slice(1)).income, 850000)
const debtFixture = [
 { id:'borrowed', type:'debt_borrowed', amount:50000, date:'2026-09-18', time:'09:30', note:'Sam' },
 { id:'lent', type:'debt_lent', amount:12500, date:'2026-09-18', time:'10:15', note:'Jo' },
]
assert.deepEqual(totals(debtFixture), { income:0, expense:0, balance:37500 })
assert.match(dateTimeLabel('2026-09-18', '09:30'), /9:30/)
assert.equal(validateData({ ...freshData(), transactions: debtFixture }), true)
assert.equal(validateData({ ...freshData(), transactions: [{ ...debtFixture[0], categoryId:'salary' }] }), false)
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
console.log('Passed: money parsing, date/time validation, income/expense totals, debt wallet cash flow, backup integrity, persistence, empty workspace, and malformed-storage recovery.')

const { dailyTotals } = load('src/utils/finance.ts')
const dailyFixture = [
 { id:'1',type:'income',amount:10010,categoryId:'salary',date:'2024-02-29',note:'' },
 { id:'2',type:'expense',amount:25,categoryId:'food',date:'2024-02-29',note:'' },
 { id:'3',type:'expense',amount:75,categoryId:'food',date:'2024-02-29',note:'' },
 { id:'4',type:'income',amount:999,categoryId:'salary',date:'2024-03-01',note:'' },
]
const daily = dailyTotals(dailyFixture,'2024-02')
assert.equal(daily.length,29)
assert.deepEqual(daily[28],{date:'2024-02-29',income:10010,expense:100})
assert.deepEqual(daily[0],{date:'2024-02-01',income:0,expense:0})
assert.equal(dailyTotals([], '2025-02').length,28)
assert.equal(dailyTotals([], '2026-04').length,30)
assert.equal(dailyTotals([], '2026-01').length,31)
assert.equal(dailyTotals([], '1900-02').length,28)
assert.equal(dailyTotals([], '2000-02').length,29)
console.log('Passed: daily income/expense aggregation, zero days, month filtering, and leap-year boundaries.')
