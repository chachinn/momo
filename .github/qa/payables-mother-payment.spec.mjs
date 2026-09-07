import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('momo_welcome_tour_complete_v1', 'yes');
  document.querySelectorAll('#welcomeTour,.tutorial-overlay,.tutorial-backdrop').forEach((el) => el.remove());
});
await page.waitForFunction(() => typeof renderPayables === 'function');

const records = [
  {
    id: 'mother', type: 'credit-card', name: 'Card Bill', provider: 'Example Bank', currency: 'PHP',
    frequency: 'monthly', paymentMode: 'variable', balanceMode: 'balance', balance: 0,
    regularPayment: 10000, dueDate: '2026-09-10', dueDayOfMonth: 10, statementDay: 16,
    statementReminder: true, paydaySlot: 'second', paymentGroup: 'My Card', paymentGroupRole: 'counts', payments: []
  },
  {
    id: 'child1', type: 'installment', name: 'My Card', provider: 'Installment A', currency: 'PHP',
    frequency: 'monthly', paymentMode: 'fixed', balanceMode: 'progress', balance: 20000,
    regularPayment: 2000, paymentsCompleted: 2, paymentsTotal: 12, installmentCount: 12, installmentsPaid: 2,
    dueDate: '2026-09-10', dueDayOfMonth: 10, paydaySlot: 'second', paymentGroup: 'My Card', paymentGroupRole: 'breakdown', payments: []
  },
  {
    id: 'child2', type: 'installment', name: 'My Card', provider: 'Installment B', currency: 'PHP',
    frequency: 'monthly', paymentMode: 'fixed', balanceMode: 'progress', balance: 11000,
    regularPayment: 1000, paymentsCompleted: 1, paymentsTotal: 12, installmentCount: 12, installmentsPaid: 1,
    dueDate: '2026-09-10', dueDayOfMonth: 10, paydaySlot: 'second', paymentGroup: 'My Card', paymentGroupRole: 'breakdown', payments: []
  },
  {
    id: 'child3', type: 'installment', name: 'My Card', provider: 'Installment C', currency: 'PHP',
    frequency: 'monthly', paymentMode: 'fixed', balanceMode: 'progress', balance: 27000,
    regularPayment: 3000, paymentsCompleted: 3, paymentsTotal: 12, installmentCount: 12, installmentsPaid: 3,
    dueDate: '2026-09-10', dueDayOfMonth: 10, paydaySlot: 'second', paymentGroup: 'My Card', paymentGroupRole: 'breakdown', payments: []
  }
];

await page.evaluate(async (rows) => {
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('momo_database', 4);
    req.onsuccess = () => {
      const database = req.result;
      const tx = database.transaction('cards', 'readwrite');
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
}, records);

const group = page.locator('.payable-account-group');
await group.waitFor();
assert.equal(await group.locator('.payable-account-copy > strong').textContent(), 'Card Bill');
assert.match(await group.locator('.payable-breakdown-total').textContent(), /₱6,000\.00/);
assert.equal(await group.locator('.payable-account-children .payable-nested-item').count(), 3);
assert.equal(await group.locator('.payable-account-children').getByText('Card Bill', { exact: true }).count(), 0);

await group.locator('.payable-account-header').click();
await page.locator('#payableDetailModal:not([hidden])').waitFor();
assert.equal(await page.locator('#payableDetailTitle').textContent(), 'Card Bill');
await page.locator('#closePayableDetail').click();
await group.waitFor();
assert.equal(await group.locator('.payable-account-children .payable-nested-item').count(), 3);

await page.evaluate(() => openPayableEditor('mother'));
await page.locator('#payableModal:not([hidden])').waitFor();
assert.equal(await page.locator('#payableStatementBalanceField').isHidden(), true);
assert.equal(await page.locator('#payableMinimumDueField').isHidden(), true);
assert.equal(await page.locator('#payableCreditLimit').isVisible(), true);
await page.locator('#closePayableModal').click();

await page.evaluate(async () => {
  const originalToday = getTodayString;
  // QA runner date is not part of product semantics; explicitly exercise September's cycle.
  window.__momoQaToday = originalToday;
  // Directly use payment helper so the mother-cycle sync is tested without relying on wall-clock month.
  const item = cards.find((entry) => entry.id === 'mother');
  const result = await applyPayablePayment(item, 10000, '2026-09-06', 'QA mother payment', { paidMonth: '2026-09' });
  if (!result?.completedCycle) throw new Error('Mother payment did not complete cycle');
  await syncPayableGroupBreakdowns('My Card', '2026-09-06', 'QA mother payment');
});

const after = await page.evaluate(() => cards.map((item) => ({ id: item.id, completed: item.paymentsCompleted, dueDate: item.dueDate, regularPayment: item.regularPayment })));
assert.equal(after.find((x) => x.id === 'mother').regularPayment, 0);
assert.equal(after.find((x) => x.id === 'child1').completed, 3);
assert.equal(after.find((x) => x.id === 'child2').completed, 2);
assert.equal(after.find((x) => x.id === 'child3').completed, 4);

assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
await browser.close();
console.log('Mother payable hierarchy QA passed');
