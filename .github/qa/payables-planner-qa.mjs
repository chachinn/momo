import { chromium } from 'playwright';

const base = process.env.MOMO_QA_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const closeEnough = (a, b, epsilon = 0.02) => Math.abs(Number(a) - Number(b)) <= epsilon;

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('momo_welcome_tour_complete_v1', 'yes');
});

await page.evaluate(async () => {
  const records = [
    {
      id: 'gloan', type: 'loan', name: 'GLoan', provider: 'Borrowed Money', currency: 'PHP',
      originalAmount: 147760.08, balance: 92350.05, regularPayment: 6156.67, frequency: 'monthly', paymentMode: 'fixed',
      balanceMode: 'progress', paymentsCompleted: 9, paymentsTotal: 24, dueDate: '2026-10-03', dueDayOfMonth: 3,
      paydaySlot: 'first', paymentGroup: '', payments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    },
    {
      id: 'bpi-cash', type: 'loan', name: 'BPI', provider: 'Credit to cash', currency: 'PHP',
      originalAmount: 44765.52, balance: 33574.14, regularPayment: 3730.46, frequency: 'monthly', paymentMode: 'fixed',
      balanceMode: 'months', remainingMonths: 9, startingRemainingMonths: 12, dueDate: '2026-10-06', dueDayOfMonth: 6,
      paydaySlot: 'first', paymentGroup: 'BPI Credit Card', payments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    },
    {
      id: 'bpi-powermac', type: 'installment', name: 'BPI', provider: 'PowerMac', currency: 'PHP',
      originalAmount: 42500.04, balance: 28333.36, regularPayment: 3541.67, frequency: 'monthly', paymentMode: 'fixed',
      balanceMode: 'progress', paymentsCompleted: 4, paymentsTotal: 12, installmentCount: 12, installmentsPaid: 4,
      dueDate: '2026-10-06', dueDayOfMonth: 6, paydaySlot: 'second', paymentGroup: 'BPI Credit Card', payments: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    },
    {
      id: 'security', type: 'loan', name: 'Security Bank', provider: 'Ready Cash', currency: 'PHP',
      originalAmount: 72666.6, balance: 72666.6, regularPayment: 6055.55, frequency: 'monthly', paymentMode: 'fixed',
      balanceMode: 'months', remainingMonths: 12, startingRemainingMonths: 12, dueDate: '2026-10-13', dueDayOfMonth: 13,
      paydaySlot: 'second', paymentGroup: '', payments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }
  ];
  const open = indexedDB.open('momo_database', 4);
  const db = await new Promise((resolve, reject) => {
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onupgradeneeded = () => {
      const database = open.result;
      if (!database.objectStoreNames.contains('cards')) database.createObjectStore('cards', { keyPath: 'id' });
    };
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('cards', 'readwrite');
    const store = tx.objectStore('cards');
    store.clear();
    records.forEach((record) => store.put(record));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
});

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(400);

// Open Payables via drawer.
await page.locator('#menuButton').click();
await page.locator('#sideDrawer [data-drawer-nav="payables"]').click();
await page.waitForTimeout(200);
await page.locator('[data-payables-view="all"]').click();
await page.waitForTimeout(150);

const totalText = await page.locator('#payablesTotal').textContent();
assert(totalText?.includes('19,484.35'), `All Payables monthly total should be 19,484.35, got ${totalText}`);
const firstPayday = await page.locator('#payablesPaydayOne').textContent();
const secondPayday = await page.locator('#payablesPaydayTwo').textContent();
assert(firstPayday?.includes('9,887.13'), `1st payday total wrong: ${firstPayday}`);
assert(secondPayday?.includes('9,597.22'), `2nd payday total wrong: ${secondPayday}`);

// GLoan 9/24 progress must be visible as 37.5%.
const gloan = page.locator('section.screen[data-screen="payables"] .payable-item', { hasText: 'GLoan' }).first();
const gloanBar = gloan.locator('.payable-progress i');
const width = await gloanBar.getAttribute('style');
assert(width?.includes('37.5'), `GLoan progress should be 37.5%, got ${width}`);

// BPI grouped-payment summary exists.
const groupCard = page.locator('.payable-group-card', { hasText: 'BPI Credit Card' });
assert(await groupCard.count() === 1, 'BPI payment group card missing');
assert((await groupCard.textContent())?.includes('2 linked items'), 'BPI group should show 2 linked items');

// Manual partial payment before due date stays on Oct cycle and does not advance due date.
const bpiCash = page.locator('section.screen[data-screen="payables"] .payable-item', { hasText: 'Credit to cash' }).first();
await bpiCash.click();
await page.locator('[data-payable-pay="bpi-cash"]').click();
await page.locator('#payablePaymentAmount').fill('1000');
await page.locator('#payablePaymentDate').fill('2026-09-20');
await page.locator('#payablePaymentNote').fill('Early partial');
await page.locator('#payablePaymentForm button[type="submit"]').click();
await page.waitForTimeout(150);

let stored = await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('momo_database', 4);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  const result = await new Promise((resolve, reject) => {
    const req = db.transaction('cards').objectStore('cards').get('bpi-cash');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  db.close(); return result;
});
assert(stored.dueDate === '2026-10-06', `Partial payment advanced due date unexpectedly: ${stored.dueDate}`);
assert(closeEnough(stored.balance, 32574.14), `Partial payment balance wrong: ${stored.balance}`);
assert(stored.payments.at(-1).paidMonth === '2026-10', `Early payment should apply to Oct cycle: ${stored.payments.at(-1).paidMonth}`);
assert(closeEnough(stored.payments.at(-1).cycleTargetAmount, 3730.46), 'Cycle target should stay 3730.46');

// Pay the linked BPI group together for the remainder. It should allocate one action across both entries.
await page.locator('#closePayableDetail').click();
await page.locator('[data-payables-view="all"]').click();
await page.locator('.payable-group-card', { hasText: 'BPI Credit Card' }).locator('[data-payable-group-pay]').click();
await page.waitForTimeout(100);
const groupAmount = Number(await page.locator('#payableGroupPaymentAmount').inputValue());
assert(groupAmount > 6200 && groupAmount < 6300, `Unexpected remaining BPI group amount ${groupAmount}`);
await page.locator('#payableGroupPaymentDate').fill('2026-09-21');
await page.locator('#payableGroupPaymentForm button[type="submit"]').click();
await page.waitForTimeout(200);

const bpiState = await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const req = indexedDB.open('momo_database', 4); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
  const get = (id) => new Promise((resolve, reject) => { const req = db.transaction('cards').objectStore('cards').get(id); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
  const a = await get('bpi-cash'); const b = await get('bpi-powermac'); db.close(); return {a,b};
});
assert(bpiState.a.dueDate === '2026-11-06', `BPI cash due date should advance to Nov: ${bpiState.a.dueDate}`);
assert(bpiState.b.dueDate === '2026-11-06', `PowerMac due date should advance to Nov: ${bpiState.b.dueDate}`);
assert(bpiState.b.paymentsCompleted === 5, `PowerMac installment should advance to 5/12: ${bpiState.b.paymentsCompleted}`);
const groupIds = [bpiState.a.payments.at(-1).groupPaymentId, bpiState.b.payments.at(-1).groupPaymentId];
assert(groupIds[0] && groupIds[0] === groupIds[1], 'Combined BPI payment should share one groupPaymentId');

// GLoan full early cycle payment advances progress from 9/24 to 10/24.
await page.locator('section.screen[data-screen="payables"] .payable-item', { hasText: 'GLoan' }).first().click();
await page.locator('[data-payable-pay="gloan"]').click();
await page.locator('#payablePaymentDate').fill('2026-09-22');
await page.locator('#payablePaymentForm button[type="submit"]').click();
await page.waitForTimeout(150);
const gloanStored = await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const req=indexedDB.open('momo_database',4); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
  const value = await new Promise((resolve,reject)=>{ const req=db.transaction('cards').objectStore('cards').get('gloan'); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
  db.close(); return value;
});
assert(gloanStored.paymentsCompleted === 10, `GLoan should be 10/24 after payment, got ${gloanStored.paymentsCompleted}`);
assert(gloanStored.dueDate === '2026-11-03', `GLoan due date should advance: ${gloanStored.dueDate}`);

// All total remains the monthly plan even after early payments moved due dates forward.
await page.locator('#closePayableDetail').click();
await page.locator('[data-payables-view="all"]').click();
await page.waitForTimeout(100);
const totalAfter = await page.locator('#payablesTotal').textContent();
assert(totalAfter?.includes('19,484.35'), `All monthly total should remain 19,484.35 after payments, got ${totalAfter}`);

// Due view for September should still be zero because all seeded dues are October+.
await page.locator('[data-payables-view="due"]').click();
const dueTotal = await page.locator('#payablesTotal').textContent();
assert(dueTotal?.includes('0.00'), `September Due total should be zero, got ${dueTotal}`);
assert((await page.locator('#payablesPaydayOne').textContent())?.includes('0.00'), 'Due 1st payday should be zero for September');
assert((await page.locator('#payablesPaydayTwo').textContent())?.includes('0.00'), 'Due 2nd payday should be zero for September');

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
assert(!overflow, 'Horizontal overflow detected at 390x844');
assert(errors.length === 0, `Browser page errors: ${errors.join(' | ')}`);

console.log('PAYABLES_PLANNER_QA_PASS');
await browser.close();
