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
await page.waitForFunction(() => typeof putRecord === 'function' && typeof loadAppData === 'function');
await page.waitForTimeout(350);

await page.evaluate(async () => {
  for (const selector of ['#welcomeTour', '#contextTipModal']) {
    const el = document.querySelector(selector);
    if (el) {
      el.hidden = true;
      el.style.display = 'none';
    }
  }
  document.body.classList.remove('tutorial-open', 'modal-open', 'drawer-open');

  await putRecord(STORES.trips, {
    id: 'qa-trip',
    name: 'Japan October 2026',
    destination: 'Tokyo',
    startDate: '2026-10-18',
    endDate: '2026-10-25',
    budget: 200000,
    dailyBudget: 0,
    currency: 'PHP',
    notes: ''
  });

  await loadAppData();
  renderAll();
  showScreen('trips');
  window.scrollTo(0, 0);
});

await page.waitForTimeout(120);

const compact = await page.evaluate(() => {
  const converter = document.getElementById('inlineConverter');
  const a = converter?.querySelector('.converter-side-a');
  const b = converter?.querySelector('.converter-side-b');
  const operators = converter?.querySelector('.calculator-operator-bar');
  const quick = document.querySelector('[data-trip-expense-id="qa-trip"]');
  const nav = document.querySelector('.bottom-nav');
  const stats = [...document.querySelectorAll('.trip-info-cell')];
  const converterBox = converter?.getBoundingClientRect();
  const quickBox = quick?.getBoundingClientRect();
  const navBox = nav?.getBoundingClientRect();
  const aBox = a?.getBoundingClientRect();
  const bBox = b?.getBoundingClientRect();

  return {
    converterHeight: converterBox?.height || 0,
    compactClass: Boolean(converter && !converter.classList.contains('is-expanded')),
    operatorsHidden: Boolean(operators && getComputedStyle(operators).display === 'none'),
    sameRow: Boolean(aBox && bBox && Math.abs(aBox.top - bBox.top) <= 2),
    quickHeight: quickBox?.height || 0,
    quickBottom: quickBox?.bottom || 9999,
    navTop: navBox?.top || 0,
    quickVisibleBeforeNav: Boolean(quickBox && navBox && quickBox.bottom <= navBox.top - 4),
    statsCount: stats.length,
    statsGrid: getComputedStyle(document.querySelector('.trip-info-row')).display,
    leftTinted: stats[2] ? getComputedStyle(stats[2]).backgroundImage !== 'none' : false,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});

assert.equal(compact.compactClass, true, 'Trips converter must default compact');
assert.equal(compact.operatorsHidden, true, 'Calculator operator row should be hidden in compact mode');
assert.equal(compact.sameRow, true, 'Two currencies should sit side-by-side in compact mode');
assert.ok(compact.converterHeight <= 180, `Compact converter is still too tall: ${Math.round(compact.converterHeight)}px`);
assert.ok(compact.quickHeight >= 48, `Travel Add Expense target too small: ${Math.round(compact.quickHeight)}px`);
assert.equal(compact.quickVisibleBeforeNav, true, `Travel Add Expense must be visible without scrolling (bottom ${Math.round(compact.quickBottom)}, nav ${Math.round(compact.navTop)})`);
assert.equal(compact.statsCount, 3, 'Trip should show Budget, Spent, Left stats');
assert.equal(compact.statsGrid, 'grid');
assert.equal(compact.leftTinted, true);
assert.ok(compact.overflow <= 1, `Trips screen horizontal overflow: ${compact.overflow}px`);

await page.locator('#toggleTravelConverter').click();
await page.waitForTimeout(60);
const expanded = await page.evaluate(() => ({
  expanded: document.getElementById('inlineConverter')?.classList.contains('is-expanded') || false,
  operatorDisplay: getComputedStyle(document.querySelector('#inlineConverter .calculator-operator-bar')).display,
  label: document.getElementById('toggleTravelConverter')?.textContent?.trim() || ''
}));
assert.equal(expanded.expanded, true);
assert.notEqual(expanded.operatorDisplay, 'none', 'Full calculator must restore operators');
assert.equal(expanded.label, 'Compact');

await page.locator('#toggleTravelConverter').click();
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(50);

await page.locator('[data-trip-expense-id="qa-trip"]').click();
await page.waitForTimeout(100);
const addState = await page.evaluate(() => {
  const add = document.querySelector('.screen[data-screen="add"]');
  const save = add?.querySelector('.expense-form-actions > .primary-btn');
  return {
    active: Boolean(add?.classList.contains('active')),
    tripValue: document.getElementById('expenseTrip')?.value || '',
    saveVisible: Boolean(save && getComputedStyle(save).display !== 'none'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});
assert.equal(addState.active, true, 'Travel Add Expense must use the normal Add Expense screen');
assert.equal(addState.tripValue, 'qa-trip', 'Travel Add Expense must preset its trip');
assert.equal(addState.saveVisible, true, 'Save Expense must remain visible');
assert.ok(addState.overflow <= 1, `Add screen horizontal overflow: ${addState.overflow}px`);
assert.deepEqual(errors, []);

console.log(`PASS compact travel UI; converter ${Math.round(compact.converterHeight)}px, Add Expense ${Math.round(compact.quickHeight)}px, button bottom ${Math.round(compact.quickBottom)} before nav ${Math.round(compact.navTop)}`);
await browser.close();
