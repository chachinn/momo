import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.MomoSmartMoney?.version === '1.11.0', null, { timeout: 10000 });
assert.equal(await page.evaluate(() => typeof window.convertCurrency === 'function'), true);

await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('momo_database', 4);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const names = ['expenses', 'budgets', 'recurring', 'planned', 'cards', 'settings'];
  for (const name of names) {
    const tx = db.transaction(name, 'readwrite');
    tx.objectStore(name).clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  const tx = db.transaction(names, 'readwrite');
  const now = new Date();
  const expenses = tx.objectStore('expenses');
  const future = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  for (let i = 0; i < 2500; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - (i % 110) - 1);
    expenses.put({
      id: `qa-${i}`,
      title: i % 17 === 0 ? 'Watsons' : `Merchant ${i % 70}`,
      amount: 60 + (i % 700),
      currency: 'PHP',
      category: i % 17 === 0 ? 'Personal Care' : 'Food & Drinks',
      paymentMethod: 'Card',
      date: d.toISOString().slice(0, 10)
    });
  }

  const today = now.toISOString().slice(0, 10);
  expenses.put({ id: 'dup-a', title: 'Cafe Momo', amount: 499, currency: 'PHP', category: 'Food & Drinks', date: today });
  expenses.put({ id: 'dup-b', title: 'Cafe Momo', amount: 499, currency: 'PHP', category: 'Food & Drinks', date: today });

  tx.objectStore('budgets').put({ id: 'b1', name: 'Monthly', amount: 80000, currency: 'PHP', period: 'monthly' });
  tx.objectStore('recurring').put({ id: 'r1', title: 'Internet', amount: 1899, currency: 'PHP', nextDueDate: future(3), active: true });
  tx.objectStore('recurring').put({ id: 'fx1', title: 'FX Test', amount: 2560, currency: 'JPY', nextDueDate: future(2), active: true });
  tx.objectStore('planned').put({ id: 'f1', title: 'Headphones', amount: 5000, currency: 'PHP', targetDate: future(5), status: 'planned' });
  tx.objectStore('cards').put({ id: 'c1', name: 'Card A', balance: 12000, currency: 'PHP', regularPayment: 1500, minimumDue: 900, interestAPR: 24, dueDate: future(4) });
  tx.objectStore('cards').put({ id: 'c2', name: 'Loan B', balance: 6000, currency: 'PHP', regularPayment: 1200, minimumDue: 0, interestAPR: 8, dueDate: future(6) });

  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const target = new Date(now);
  target.setMonth(target.getMonth() + 6);
  tx.objectStore('settings').put({ key: 'monthly_income', value: { [key]: 100000 } });
  tx.objectStore('settings').put({ key: 'payday_plan_v1', value: { savings: 0 } });
  tx.objectStore('settings').put({
    key: 'savings_goals',
    value: [{
      id: 'jar',
      name: 'Japan Jar',
      targetAmount: 30000,
      currency: 'PHP',
      targetDate: target.toISOString().slice(0, 10),
      jarMode: true,
      monthlyPlan: 5000,
      protectedJar: true,
      contributions: [{ id: 'x', amount: 1500, date: `${key}-05` }]
    }]
  });

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
});

const ms = await page.evaluate(async () => {
  const start = performance.now();
  await window.MomoSmartMoney.refresh();
  return performance.now() - start;
});
const result = await page.evaluate(() => window.MomoSmartMoney.buildInsights());
const expectedFx = await page.evaluate(() => window.convertCurrency(2560, 'JPY', 'PHP'));
const fxItem = result.upcoming.find((item) => item.name === 'FX Test');

assert.ok(result.insights.length >= 3);
assert.ok(result.safe.protectedAmount >= 3500);
assert.ok(result.upcoming.some((item) => item.name === 'Card A' && item.amount === 1500));
assert.ok(fxItem && Math.abs(fxItem.amount - expectedFx) < 0.001);
assert.ok(result.insights.some((item) => /Japan Jar/.test(item.title) && !/₱0\/month/.test(item.title)));
assert.ok(result.insights.some((item) => /highest-interest/.test(item.body) && /Card A/.test(item.body)));
assert.ok(result.insights.some((item) => /Possible duplicate/.test(item.title)));
assert.ok(result.insights.some((item) => /Headphones/.test(item.title)));
assert.ok(ms < 2000);

const ui = await page.evaluate(() => ({
  safe: document.getElementById('momoSafeToday')?.textContent?.trim(),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  body: document.body.innerText
}));
assert.ok(ui.safe && ui.safe !== '—');
assert.ok(ui.overflow <= 1);
assert.doesNotMatch(ui.body, /1\.11\.0(?:-smart-money)?/i);

const tour = page.locator('#welcomeTour');
if (await tour.count() && await tour.isVisible()) {
  for (let i = 0; i < 10 && await tour.isVisible(); i += 1) {
    const buttons = tour.locator('button:visible');
    const preferred = buttons.filter({ hasText: /skip|next|done|finish|start|got it|close/i });
    await (await preferred.count() ? preferred.last() : buttons.last()).click();
    await page.waitForTimeout(50);
  }
}

async function dismissContextTip() {
  const gotIt = page.locator('#contextTipGotIt');
  if (await gotIt.count() && await gotIt.isVisible()) {
    await gotIt.click();
    await page.waitForTimeout(80);
    return true;
  }
  return false;
}

async function tapVisibleNav(target) {
  const all = page.locator(`[data-nav="${target}"]`);
  for (let i = 0; i < await all.count(); i += 1) {
    const candidate = all.nth(i);
    const box = await candidate.boundingBox();
    if (!box || box.x >= 390 || box.x + box.width <= 0 || box.y >= 844 || box.y + box.height <= 0) continue;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await dismissContextTip();
      try {
        await candidate.click({ timeout: 2500 });
        await page.waitForTimeout(180);
        await dismissContextTip();
        return;
      } catch (error) {
        const dismissed = await dismissContextTip();
        if (!dismissed && attempt === 2) throw error;
      }
    }
  }
  throw new Error(`No visible ${target} navigation control`);
}

for (const target of ['home', 'budgets', 'trips', 'calendar']) {
  await tapVisibleNav(target);
}

await page.evaluate(() => localStorage.setItem('momo_expense_last_currency', 'JPY'));
await tapVisibleNav('add');
assert.equal(await page.locator('#currency').inputValue(), 'JPY');
await page.selectOption('#currency', 'USD');
assert.equal(await page.evaluate(() => localStorage.getItem('momo_expense_last_currency')), 'USD');
await tapVisibleNav('home');
await tapVisibleNav('add');
assert.equal(await page.locator('#currency').inputValue(), 'USD');

const addLayout = await page.evaluate(() => {
  const add = document.querySelector('[data-screen="add"]');
  const photo = document.querySelector('.expense-photo-compact');
  const more = document.querySelector('.expense-more-details');
  const bottomSave = document.querySelector('[data-screen="add"] .expense-form-actions > .primary-btn');
  return {
    height: add?.scrollHeight || 0,
    photoHeight: photo?.getBoundingClientRect().height || 0,
    photoLabels: document.querySelectorAll('label[for="expensePhoto"]').length,
    oldPhotoAdd: document.querySelectorAll('.photo-add').length,
    detailsOpen: Boolean(more?.open),
    locationInside: Boolean(more?.querySelector('#expenseLocation')),
    notesInside: Boolean(more?.querySelector('#expenseNotes')),
    bottomSaveDisplay: bottomSave ? getComputedStyle(bottomSave).display : 'missing',
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});

assert.equal(addLayout.photoLabels, 1);
assert.equal(addLayout.oldPhotoAdd, 0);
assert.ok(addLayout.photoHeight <= 44);
assert.equal(addLayout.detailsOpen, false);
assert.equal(addLayout.locationInside, true);
assert.equal(addLayout.notesInside, true);
assert.equal(addLayout.bottomSaveDisplay, 'none');
assert.ok(addLayout.overflow <= 1);
assert.ok(addLayout.height <= 680, `Compact Add screen is too tall: ${addLayout.height}px`);

await page.locator('.expense-more-details > summary').click();
assert.ok(await page.locator('#expenseLocation').isVisible());
assert.ok(await page.locator('#expenseNotes').isVisible());

assert.deepEqual(errors, []);
console.log(`PASS final integration QA: 2502 expenses, ${ms.toFixed(1)}ms Smart Money, ${addLayout.height}px Add screen`);
await browser.close();
