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
await page.waitForFunction(() => typeof renderPayables === 'function');

const pay = (amount, source, id, extra = {}) => ({
  id, amount, source, date: '2026-09-06', paidMonth: '2026-09', cycleTargetAmount: amount,
  ...extra
});

const rows = [
  { id:'gloan', type:'loan', name:'GLoan', provider:'Borrowed Money', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress', balance:61566.70, regularPayment:6156.67, paymentsCompleted:9, paymentsTotal:24, dueDate:'2026-10-03', payments:[pay(6156.67,'manual-payment','gloan-pay')] },
  { id:'ggives', type:'loan', name:'GGives', provider:'Borrowed Money', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress', balance:58494.40, regularPayment:5849.44, paymentsCompleted:4, paymentsTotal:12, dueDate:'2026-10-17', payments:[pay(5849.44,'manual-payment','ggives-pay')] },
  { id:'security', type:'loan', name:'Security Bank', provider:'Ready Cash', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'months', balance:48444.40, regularPayment:6055.55, remainingMonths:8, dueDate:'2026-10-13', payments:[pay(6055.55,'month-check','sec-pay')] },
  { id:'bpi1', type:'loan', name:'BPI', provider:'Credit to cash', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress', balance:33574.14, regularPayment:3730.46, paymentsCompleted:3, paymentsTotal:12, dueDate:'2027-01-06', paymentGroup:'BPI Credit Card', paymentGroupRole:'counts', payments:[pay(3730.46,'group-payment','bpi1-pay')] },
  { id:'bpi2', type:'installment', name:'BPI', provider:'PowerMac', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress', balance:28333.36, regularPayment:3541.67, paymentsCompleted:4, paymentsTotal:12, dueDate:'2027-01-06', paymentGroup:'BPI Credit Card', paymentGroupRole:'counts', payments:[pay(3541.67,'group-payment','bpi2-pay')] },
  { id:'bdo', type:'credit-card', name:'BDO', provider:'Example Bank', currency:'PHP', frequency:'monthly', paymentMode:'variable', balanceMode:'balance', balance:0, regularPayment:0, dueDate:'2026-10-10', paymentGroup:'BDO Credit Card', paymentGroupRole:'counts', payments:[pay(36000,'month-check','bdo-pay')] },
  { id:'bdob1', type:'installment', name:'BDO Credit Card', provider:'Balance Convert', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress', balance:70854.88, regularPayment:8856.86, paymentsCompleted:4, paymentsTotal:12, dueDate:'2026-10-10', paymentGroup:'BDO Credit Card', paymentGroupRole:'breakdown', payments:[pay(8856.86,'group-breakdown-track','bdob1-pay')] },
  { id:'bdob2', type:'installment', name:'BDO Credit Card', provider:'SM Appliance', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress', balance:15311.61, regularPayment:1701.29, paymentsCompleted:3, paymentsTotal:12, dueDate:'2026-10-10', paymentGroup:'BDO Credit Card', paymentGroupRole:'breakdown', payments:[pay(1701.29,'group-breakdown-track','bdob2-pay')] },
  { id:'bdob3', type:'installment', name:'BDO Credit Card', provider:'Purchase Convert', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress', balance:27046.11, regularPayment:3863.73, paymentsCompleted:5, paymentsTotal:12, dueDate:'2026-10-10', paymentGroup:'BDO Credit Card', paymentGroupRole:'breakdown', payments:[pay(3863.73,'group-breakdown-track','bdob3-pay')] }
];

await page.evaluate(async (records) => {
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('momo_database', 4);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('cards', 'readwrite');
      const store = tx.objectStore('cards');
      store.clear();
      records.forEach((row) => store.put(row));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
  cards = records;
  activePayablesView = 'due';
  renderPayables();
}, rows);

// Real September cash paid = all six actual obligations, excluding BDO tracking shadow payments.
assert.equal(await page.locator('#payablesPaidMonth').textContent(), '₱61,333.79');

// Done list includes manual GLoan/GGives payments too, not only checkbox payments.
const done = page.locator('section.screen[data-screen="payables"] .payables-cycle-done');
await done.waitFor({ state: 'visible' });
assert.equal(await done.locator('.payable-cycle-row').count(), 6);
assert.equal(await done.getByText('GLoan', { exact: true }).count(), 1);
assert.equal(await done.getByText('GGives', { exact: true }).count(), 1);
assert.equal(await done.getByText('Balance Convert', { exact: true }).count(), 0);

// Remaining fixed-term debt includes BDO tracking-only installment balances, but not the variable mother bill.
const expectedDebt = 61566.70 + 58494.40 + 48444.40 + 33574.14 + 28333.36 + 70854.88 + 15311.61 + 27046.11;
const actualDebt = await page.evaluate(() => getPayableRemainingDebtTotalPHP());
assert.equal(Math.round(actualDebt * 100), Math.round(expectedDebt * 100));

// All Payables remains the full normal monthly plan; BDO breakdown children are not double-counted.
await page.locator('[data-payables-view="all"]').click();
assert.equal(await page.locator('#payablesTotal').textContent(), '₱61,333.79');

assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
await browser.close();
console.log('Payables totals reconciliation QA passed');
