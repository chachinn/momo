import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

const dismissTips = async () => {
  await page.evaluate(() => {
    if (typeof closeWelcomeTour === 'function') closeWelcomeTour(false);
    if (typeof closeContextTip === 'function') closeContextTip(false);
  });
};

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await dismissTips();

await page.evaluate(async () => {
  const request = indexedDB.open('momo_database', 4);
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const dueDay = Math.min(today.getDate() + 1, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
  const dueDate = `${monthKey}-${String(dueDay).padStart(2, '0')}`;
  const cards = [
    ['qa-bpi', 'BPI', 10000, 3730.46],
    ['qa-2', 'Payable 2', 8000, 1000],
    ['qa-3', 'Payable 3', 7000, 1000],
    ['qa-4', 'Payable 4', 6000, 1000],
    ['qa-5', 'Payable 5', 5000, 1000],
    ['qa-6', 'Payable 6', 4000, 1000]
  ];

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['cards', 'settings', 'expenses', 'budgets', 'recurring', 'planned'], 'readwrite');
    for (const name of ['cards', 'settings', 'expenses', 'budgets', 'recurring', 'planned']) {
      tx.objectStore(name).clear();
    }

    for (const [id, name, balance, regularPayment] of cards) {
      tx.objectStore('cards').put({
        id,
        type: 'loan',
        name,
        provider: name,
        originalAmount: balance,
        balance,
        currency: 'PHP',
        dueDate,
        dueDayOfMonth: dueDay,
        regularPayment,
        frequency: 'monthly',
        minimumDue: 0,
        payments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    tx.objectStore('settings').put({
      key: 'monthly_income',
      value: { [monthKey]: 20000 },
      updatedAt: new Date().toISOString()
    });

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1100);
await dismissTips();

// Fresh users default to showing payables on Home.
assert.equal(await page.evaluate(() => momoHomeLayout.showPayablesOnHome), true);
for (const state of await page.locator('[data-home-payables]').evaluateAll((nodes) => nodes.map((node) => ({ hidden: node.hidden, display: getComputedStyle(node).display })))) {
  assert.equal(state.hidden, false);
  assert.notEqual(state.display, 'none');
}

// Legacy custom-home settings without the privacy key also default to show.
assert.equal(await page.evaluate(() => {
  loadMomo19Settings([{ key: 'momo_home_layout_v1', value: { order: ['snapshot', 'today', 'reminders', 'adventure', 'lately'], hidden: [], density: 'cozy' } }]);
  return momoHomeLayout.showPayablesOnHome;
}), true);

await page.evaluate(() => {
  showScreen('payables');
  renderPayables();
  if (typeof closeContextTip === 'function') closeContextTip(false);
});
await page.waitForTimeout(150);
await dismissTips();

assert.equal(await page.locator('.payable-cycle-row:not(.is-cycle-paid) .payable-item').count(), 6);
assert.equal((await page.locator('#payablesActiveCount').innerText()).trim(), '6 left');
assert((await page.locator('#payablesTotal').innerText()).replaceAll(',', '').includes('8730.46'));

// One-tap monthly checkoff records the scheduled payment and moves it out of this month.
await page.locator('input[data-payable-month-toggle="qa-bpi"]').first().check({ force: true });
await page.waitForTimeout(300);

assert.equal(await page.locator('.payable-cycle-row:not(.is-cycle-paid) .payable-item').count(), 5);
assert.equal((await page.locator('#payablesActiveCount').innerText()).trim(), '5 left');
assert.equal((await page.locator('#payablesTotal').innerText()).replaceAll(',', '').trim(), '₱5000.00'.replaceAll(',', ''));
assert((await page.locator('#payablesPaidMonth').innerText()).replaceAll(',', '').includes('3730.46'));
assert.equal(await page.locator('.payables-cycle-done input[data-payable-month-toggle="qa-bpi"]').isChecked(), true);

const checkedState = await page.evaluate(() => {
  const item = cards.find((entry) => entry.id === 'qa-bpi');
  const payment = getPayableCycleCheckPayment(item);
  return {
    balance: item.balance,
    dueDate: item.dueDate,
    paymentAmount: payment?.amount,
    waitingNow: isPayableWaitingThisMonth(item),
    waitingWhenNextMonthArrives: isPayableWaitingInMonth(item, item.dueDate),
    paymentSource: payment?.source,
    paidMonth: payment?.paidMonth
  };
});
assert(Math.abs(checkedState.balance - 6269.54) < 0.01);
assert(Math.abs(checkedState.paymentAmount - 3730.46) < 0.01);
assert.equal(checkedState.waitingNow, false);
assert.equal(checkedState.waitingWhenNextMonthArrives, true);
assert.equal(checkedState.paymentSource, 'month-check');
assert(checkedState.paidMonth);

// Opting out remains private and persists, while calculations still protect current unpaid payables.
await page.evaluate(async () => {
  momoHomeLayout.showPayablesOnHome = false;
  await saveMomoHomeLayout();
  applyMomoHomeLayout();
  renderMomoToday();
  document.dispatchEvent(new CustomEvent('momo-data-changed'));
});
await page.waitForTimeout(700);

for (const state of await page.locator('[data-home-payables]').evaluateAll((nodes) => nodes.map((node) => ({ hidden: node.hidden, display: getComputedStyle(node).display })))) {
  assert.equal(state.hidden, true);
  assert.equal(state.display, 'none');
}
const privateSnapshot = await page.evaluate(() => getMomoTodaySnapshot({ includePayables: false }));
assert(Math.abs(privateSnapshot.protectedCommitments - 5000) < 0.01);
assert.equal(privateSnapshot.projectedCommitments, 0);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await dismissTips();
assert.equal(await page.evaluate(() => momoHomeLayout.showPayablesOnHome), false);
await page.evaluate(() => { showScreen('payables'); renderPayables(); });
await page.waitForTimeout(120);
assert.equal(await page.locator('.payable-cycle-row:not(.is-cycle-paid) .payable-item').count(), 5);

// Unchecking is an undo: restore this month's payment, balance, and due date.
await page.locator('.payables-cycle-done input[data-payable-month-toggle="qa-bpi"]').uncheck({ force: true });
await page.waitForTimeout(300);
assert.equal(await page.locator('.payable-cycle-row:not(.is-cycle-paid) .payable-item').count(), 6);
assert.equal((await page.locator('#payablesActiveCount').innerText()).trim(), '6 left');
assert((await page.locator('#payablesTotal').innerText()).replaceAll(',', '').includes('8730.46'));
assert.equal((await page.locator('#payablesPaidMonth').innerText()).replaceAll(',', '').trim(), '₱0.00'.replaceAll(',', ''));
const undone = await page.evaluate(() => {
  const item = cards.find((entry) => entry.id === 'qa-bpi');
  return {
    balance: item.balance,
    waiting: isPayableWaitingThisMonth(item),
    payment: getPayableCycleCheckPayment(item)
  };
});
assert.equal(undone.balance, 10000);
assert.equal(undone.waiting, true);
assert.equal(undone.payment, null);

for (const screen of ['home', 'payables']) {
  await page.evaluate((name) => {
    showScreen(name);
    if (typeof closeContextTip === 'function') closeContextTip(false);
  }, screen);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false, `${screen} has horizontal overflow`);
}

assert.deepEqual(pageErrors, []);
await browser.close();
console.log('Monthly payable checkoff and default visibility QA passed.');
