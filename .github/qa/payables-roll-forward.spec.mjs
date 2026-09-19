import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });

await page.evaluate(() => {
  localStorage.setItem('momo_welcome_tour_complete_v1', 'yes');
  document.querySelectorAll('#welcomeTour,.tutorial-overlay,.tutorial-backdrop').forEach((el) => el.remove());
  getCurrentMonthKey = () => '2026-09';
  getTodayString = () => '2026-09-19';
  document.querySelectorAll('section.screen').forEach((el) => el.classList.remove('active'));
  document.querySelector('section.screen[data-screen="payables"]')?.classList.add('active');
});
await page.waitForFunction(() => typeof renderPayables === 'function' && typeof markPayablePaidForCurrentMonth === 'function');

const rows = [
  {
    id:'bpi-1', type:'loan', name:'BPI', provider:'Credit to cash', currency:'PHP',
    frequency:'monthly', paymentMode:'fixed', balanceMode:'balance',
    originalAmount:50000, balance:18652.30, regularPayment:3730.46,
    dueDate:'2026-11-07', dueDayOfMonth:7, paydaySlot:'second',
    paymentGroup:'', paymentGroupRole:'counts',
    payments:[
      {id:'bpi1-sep', amount:3730.46, date:'2026-09-06', paidMonth:'2026-09', cycleTargetAmount:3730.46, source:'month-check', previousDueDate:'2026-09-07', nextDueDate:'2026-10-07'},
      {id:'bpi1-oct', amount:3730.46, date:'2026-09-18', paidMonth:'2026-10', cycleTargetAmount:3730.46, source:'manual', previousDueDate:'2026-10-07', nextDueDate:'2026-11-07'}
    ]
  },
  {
    id:'bpi-2', type:'installment', name:'BPI', provider:'PowerMac', currency:'PHP',
    frequency:'monthly', paymentMode:'fixed', balanceMode:'progress',
    originalAmount:42499.99, balance:17708.35, regularPayment:3541.67,
    paymentsCompleted:7, paymentsTotal:12,
    dueDate:'2026-11-07', dueDayOfMonth:7, paydaySlot:'second',
    paymentGroup:'', paymentGroupRole:'counts',
    payments:[
      {id:'bpi2-sep', amount:3541.67, date:'2026-09-06', paidMonth:'2026-09', cycleTargetAmount:3541.67, source:'month-check', previousDueDate:'2026-09-07', nextDueDate:'2026-10-07'},
      {id:'bpi2-oct', amount:3541.67, date:'2026-09-18', paidMonth:'2026-10', cycleTargetAmount:3541.67, source:'manual', previousDueDate:'2026-10-07', nextDueDate:'2026-11-07'}
    ]
  },
  {
    id:'bdo', type:'credit-card', name:'BDO', provider:'', currency:'PHP',
    frequency:'monthly', paymentMode:'variable', balanceMode:'balance',
    balance:0, regularPayment:22125, dueDate:'2026-11-10', dueDayOfMonth:10,
    statementDay:16, statementReminder:true, paydaySlot:'first',
    paymentGroup:'', paymentGroupRole:'counts',
    payments:[
      {id:'bdo-sep', amount:36000, date:'2026-09-07', paidMonth:'2026-09', cycleTargetAmount:36000, source:'month-check', previousDueDate:'2026-09-10', nextDueDate:'2026-10-10'},
      {id:'bdo-oct', amount:18000, date:'2026-09-18', paidMonth:'2026-10', cycleTargetAmount:18000, source:'manual', previousDueDate:'2026-10-10', nextDueDate:'2026-11-10'}
    ]
  }
];

await page.evaluate(async (rows) => {
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('momo_database', 4);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('cards', 'readwrite');
      const store = tx.objectStore('cards');
      store.clear();
      rows.forEach((row) => store.put(row));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
  cards = rows;
  activePayablesView = 'due';
  renderPayables();
}, rows);

assert.equal((await page.locator('#payablesHeroLabel').textContent()).trim(), 'Still to pay for November');
assert.match((await page.locator('#payablesCount').textContent()).trim(), /left for November/);
assert.equal((await page.locator('#payablesListKicker').textContent()).trim(), 'November cycle');
assert.equal((await page.locator('#payablesComingUpLabel').textContent()).trim(), 'Due for November');
assert.equal((await page.locator('#payablesPaidLabel').textContent()).trim(), 'Paid for November');
assert.equal(await page.getByText("You're clear for September", { exact:true }).count(), 0);
assert.ok(await page.getByText('Due · Nov 7', { exact:true }).count() >= 2);
assert.ok(await page.getByText('Due · Nov 10', { exact:true }).count() >= 1);

const before = await page.locator('#payablesTotal').textContent();
assert.match(before, /29,397\.13/);

await page.evaluate(async () => {
  await markPayablePaidForCurrentMonth('bpi-1', '2026-11');
});
await page.waitForTimeout(150);

assert.equal((await page.locator('#payablesHeroLabel').textContent()).trim(), 'Still to pay for November');
assert.ok(await page.getByText('Done for November', { exact:true }).count() === 1);
assert.ok(await page.getByText('Back Dec 7', { exact:true }).count() >= 1);

const saved = await page.evaluate(async () => {
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open('momo_database', 4);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('cards', 'readonly');
      const get = tx.objectStore('cards').get('bpi-1');
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  });
});
assert.equal(saved.dueDate, '2026-12-07');
assert.ok(saved.payments.some((p) => p.paidMonth === '2026-11' && p.source === 'month-check'));

await page.evaluate(async () => {
  await markPayablePaidForCurrentMonth('bpi-2', '2026-11');
  await markPayablePaidForCurrentMonth('bdo', '2026-11');
});
await page.waitForTimeout(200);

assert.equal((await page.locator('#payablesHeroLabel').textContent()).trim(), 'Still to pay for December');
assert.equal((await page.locator('#payablesListKicker').textContent()).trim(), 'December cycle');
assert.equal(await page.getByText('Done for September', { exact:true }).count(), 0);
assert.equal(document.documentElement.scrollWidth > document.documentElement.clientWidth, false);

await browser.close();
console.log('Rolling Due cycle QA passed');
