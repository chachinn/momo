import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('momo_welcome_tour_complete_v1', 'yes');
  document.querySelectorAll('#welcomeTour,.tutorial-overlay,.tutorial-backdrop').forEach((el) => el.remove());
  document.querySelectorAll('section.screen').forEach((el) => el.classList.remove('active'));
  document.querySelector('section.screen[data-screen="payables"]')?.classList.add('active');
});
await page.waitForFunction(() => typeof renderPayables === 'function' && typeof openPayableEditor === 'function');

const rows = [
  {
    id:'bdo', type:'credit-card', name:'BDO', provider:'', currency:'PHP',
    frequency:'monthly', paymentMode:'variable', balanceMode:'balance',
    balance:0, regularPayment:22125, dueDate:'2026-10-10', dueDayOfMonth:10,
    statementDay:16, statementReminder:true, paydaySlot:'first',
    paymentGroup:'BDO Credit Card', paymentGroupRole:'counts',
    payments:[{
      id:'sep-bdo', amount:36000, date:'2026-09-07',
      paidMonth:'2026-09', cycleMonth:'2026-09',
      cycleTargetAmount:36000, source:'manual'
    }]
  },
  {
    id:'balance', type:'installment', name:'Balance Convert', currency:'PHP',
    frequency:'monthly', paymentMode:'fixed', balanceMode:'progress',
    balance:70854.88, regularPayment:8856.86, paymentsCompleted:4, paymentsTotal:12,
    dueDate:'2026-10-10', dueDayOfMonth:10, paydaySlot:'second',
    paymentGroup:'BDO Credit Card', paymentGroupRole:'breakdown'
  },
  {
    id:'sm', type:'installment', name:'SM Appliance', currency:'PHP',
    frequency:'monthly', paymentMode:'fixed', balanceMode:'progress',
    balance:15311.61, regularPayment:1701.29, paymentsCompleted:3, paymentsTotal:12,
    dueDate:'2026-10-10', dueDayOfMonth:10, paydaySlot:'second',
    paymentGroup:'BDO Credit Card', paymentGroupRole:'breakdown'
  },
  {
    id:'purchase', type:'installment', name:'Purchase Convert', currency:'PHP',
    frequency:'monthly', paymentMode:'fixed', balanceMode:'progress',
    balance:15454.92, regularPayment:3863.73, paymentsCompleted:8, paymentsTotal:12,
    dueDate:'2026-10-10', dueDayOfMonth:10, paydaySlot:'second',
    paymentGroup:'BDO Credit Card', paymentGroupRole:'breakdown'
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
      rows.forEach((r) => store.put(r));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
  cards = rows;
  activePayablesView = 'all';
  renderPayables();
}, rows);

const group = page.locator('.payable-account-group').filter({ hasText: 'BDO' }).first();
await assert.doesNotReject(async () => await group.waitFor({ state:'visible' }));

const totalText = await group.locator('.payable-account-total b').textContent();
assert.match(totalText, /22,125\.00/);
assert.doesNotMatch(totalText, /36,000\.00/);

const breakdownText = await group.locator('.payable-breakdown-total').textContent();
assert.match(breakdownText, /14,421\.88/);

const heroText = await page.locator('#payablesTotal').textContent();
assert.match(heroText, /22,125\.00/);

await page.evaluate(() => openPayableEditor('bdo'));
await page.locator('#payableModal:not([hidden])').waitFor({ state:'visible' });
assert.equal(await page.locator('#payableRegularPayment').inputValue(), '22125');

const statementHidden = await page.locator('#payableStatementBalanceField').evaluate((el) => el.hidden);
const minimumHidden = await page.locator('#payableMinimumDueField').evaluate((el) => el.hidden);
assert.equal(statementHidden, true);
assert.equal(minimumHidden, true);

const layout = await page.evaluate(() => {
  const day = document.querySelector('.payable-statement-day-field')?.getBoundingClientRect();
  const reminder = document.querySelector('.payable-reminder-toggle')?.getBoundingClientRect();
  const credit = document.querySelector('#payableCreditLimit')?.getBoundingClientRect();
  const apr = document.querySelector('#payableInterestAPR')?.getBoundingClientRect();
  const checkbox = getComputedStyle(document.querySelector('#payableStatementReminder'));
  const track = document.querySelector('.payable-toggle-track')?.getBoundingClientRect();
  return {
    dayX: day?.x, reminderX: reminder?.x, reminderW: reminder?.width, reminderH: reminder?.height,
    creditX: credit?.x, creditY: credit?.y, aprX: apr?.x, aprY: apr?.y,
    checkboxOpacity: checkbox.opacity, trackW: track?.width,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  };
});
assert.ok(layout.reminderX > layout.dayX);
assert.ok(layout.reminderW > 150);
assert.ok(layout.reminderH < 90);
assert.equal(layout.checkboxOpacity, '0');
assert.ok(layout.trackW >= 36);
assert.ok(layout.aprX > layout.creditX);
assert.ok(Math.abs(layout.aprY - layout.creditY) < 4);
assert.equal(layout.overflow, false);

await browser.close();
console.log('Variable payable amount + editor UI QA passed');
