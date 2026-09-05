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
await page.waitForTimeout(500);
await dismissTips();

await page.evaluate(async () => {
  const request = indexedDB.open('momo_database', 4);
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const dueDate = `${monthKey}-${String(today.getDate()).padStart(2, '0')}`;

  await new Promise((resolve, reject) => {
    const names = ['cards', 'settings', 'expenses', 'budgets', 'recurring', 'planned'];
    const tx = db.transaction(names, 'readwrite');
    for (const name of names) tx.objectStore(name).clear();

    tx.objectStore('cards').put({
      id: 'qa-bpi',
      type: 'credit-card',
      name: 'BPI',
      provider: 'BPI',
      originalAmount: 44774.93,
      balance: 41044.47,
      currency: 'PHP',
      dueDate,
      dueDayOfMonth: today.getDate(),
      regularPayment: 3730.46,
      frequency: 'monthly',
      minimumDue: 0,
      creditLimit: 0,
      statementBalance: 0,
      payments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    tx.objectStore('settings').put({
      key: 'momo_home_layout_v1',
      value: {
        order: ['snapshot', 'today', 'reminders', 'adventure', 'lately'],
        hidden: [],
        density: 'cozy',
        showPayablesOnHome: false
      },
      updatedAt: new Date().toISOString()
    });
    tx.objectStore('settings').put({
      key: 'monthly_income',
      value: { [monthKey]: 10000 },
      updatedAt: new Date().toISOString()
    });

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await dismissTips();

const hiddenStates = await page.locator('[data-home-payables]').evaluateAll((nodes) =>
  nodes.map((node) => ({ hidden: node.hidden, display: getComputedStyle(node).display }))
);
assert.equal(hiddenStates.length, 2);
for (const state of hiddenStates) {
  assert.equal(state.hidden, true);
  assert.equal(state.display, 'none');
}

assert.equal((await page.locator('#momoDueNext7').innerText()).trim(), '₱0.00');
assert.equal((await page.locator('#momoProjectedFixed').innerText()).trim(), '₱0.00');

const privateSnapshot = await page.evaluate(() => getMomoTodaySnapshot({ includePayables: false }));
assert(Math.abs(privateSnapshot.protectedCommitments - 3730.46) < 0.01);
assert(Math.abs(privateSnapshot.cushion - 6269.54) < 0.01);
assert.equal(privateSnapshot.projectedCommitments, 0);
assert.equal(privateSnapshot.dueNext7Days, 0);

const knowsPrivate = (await page.locator('#momoKnowsList').innerText()).replaceAll(',', '');
assert(!knowsPrivate.includes('41044'));
assert(!knowsPrivate.includes('3730'));
assert(!knowsPrivate.includes('BPI'));

await page.evaluate(() => {
  showScreen('payables');
  renderPayables();
  if (typeof closeContextTip === 'function') closeContextTip(false);
});
await page.waitForTimeout(120);
await dismissTips();

assert((await page.locator('#payablesTotal').innerText()).replaceAll(',', '').includes('3730.46'));
assert((await page.locator('.payable-item b').first().innerText()).replaceAll(',', '').includes('3730.46'));
assert((await page.locator('.payable-item em').first().innerText()).includes('Monthly payment'));

await page.locator('.payable-item').first().click();
const detailHero = (await page.locator('.payable-detail-hero strong').innerText()).replaceAll(',', '');
assert(detailHero.includes('3730.46'));
const detailBody = (await page.locator('#payableDetailBody').innerText()).replaceAll(',', '');
assert(detailBody.includes('Remaining balance'));
assert(detailBody.includes('41044.47'));

await page.evaluate(async () => {
  momoHomeLayout.showPayablesOnHome = true;
  await saveMomoHomeLayout();
  applyMomoHomeLayout();
  renderMomoToday();
  document.dispatchEvent(new CustomEvent('momo-data-changed'));
  showScreen('home');
  if (typeof closeContextTip === 'function') closeContextTip(false);
});
await page.waitForTimeout(800);
await dismissTips();

const visibleStates = await page.locator('[data-home-payables]').evaluateAll((nodes) =>
  nodes.map((node) => ({ hidden: node.hidden, display: getComputedStyle(node).display }))
);
for (const state of visibleStates) {
  assert.equal(state.hidden, false);
  assert.notEqual(state.display, 'none');
}
const homePayable = (await page.locator('#momoActivePayables').innerText()).replaceAll(',', '');
assert(homePayable.includes('BPI'));
assert(homePayable.includes('3730.46'));
assert(!homePayable.includes('41044.47'));
assert((await page.locator('#momoDueNext7').innerText()).replaceAll(',', '').includes('3730.46'));
assert((await page.locator('#momoProjectedFixed').innerText()).replaceAll(',', '').includes('3730.46'));

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
console.log('Private payable calculations and monthly payment QA passed.');
