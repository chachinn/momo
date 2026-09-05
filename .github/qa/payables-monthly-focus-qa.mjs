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

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

await page.evaluate(async () => {
  const request = indexedDB.open('momo_database', 4);
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const today = new Date();
  const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['cards', 'settings'], 'readwrite');
    const cards = tx.objectStore('cards');
    const settings = tx.objectStore('settings');
    cards.clear();
    cards.put({
      id: 'qa-bpi',
      type: 'credit-card',
      name: 'BPI',
      provider: 'BPI',
      originalAmount: 44774.93,
      balance: 41044.47,
      currency: 'PHP',
      dueDate,
      dueDayOfMonth: due.getDate(),
      regularPayment: 3730.46,
      frequency: 'monthly',
      minimumDue: 0,
      creditLimit: 0,
      statementBalance: 0,
      payments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    settings.put({
      key: 'momo_home_layout_v1',
      value: {
        order: ['snapshot', 'today', 'reminders', 'adventure', 'lately'],
        hidden: [],
        density: 'cozy',
        showPayablesOnHome: false
      },
      updatedAt: new Date().toISOString()
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

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
const knows = (await page.locator('#momoKnowsList').innerText()).replaceAll(',', '');
assert(!knows.includes('41044'));
assert(!knows.includes('3730'));
assert(!knows.includes('BPI'));

await page.evaluate(() => {
  showScreen('payables');
  renderPayables();
});
await page.waitForTimeout(150);

const summary = (await page.locator('#payablesTotal').innerText()).replaceAll(',', '');
assert(summary.includes('3730.46'));
assert(!summary.includes('41044.47'));

const rowAmount = (await page.locator('.payable-item b').first().innerText()).replaceAll(',', '');
assert(rowAmount.includes('3730.46'));
assert(!rowAmount.includes('41044.47'));
assert((await page.locator('.payable-item em').first().innerText()).includes('Monthly payment'));

await page.locator('.payable-item').first().click();
await page.waitForTimeout(100);
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
  showScreen('home');
});
await page.waitForTimeout(700);

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

for (const screen of ['home', 'payables']) {
  await page.evaluate((name) => showScreen(name), screen);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false, `${screen} has horizontal overflow`);
}

assert.deepEqual(pageErrors, []);
await browser.close();
console.log('Payables monthly focus mobile QA passed.');
