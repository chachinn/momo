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
await page.waitForTimeout(700);

await page.evaluate(async () => {
  for (const selector of ['#welcomeTour', '#contextTipModal']) {
    const el = document.querySelector(selector);
    if (el) {
      el.hidden = true;
      el.style.display = 'none';
    }
  }
  document.body.classList.remove('tutorial-open', 'modal-open', 'drawer-open');

  await putRecord('trips', {
    id: 'qa-trip',
    name: 'QA Japan Trip',
    startDate: '2026-10-18',
    endDate: '2026-10-25',
    budget: 200000,
    currency: 'PHP',
    emoji: '✈️'
  });

  await loadAppData();
  showScreen('trips');
});

await page.waitForTimeout(100);

const travelLayout = await page.evaluate(() => {
  const converter = document.getElementById('inlineConverter');
  const tripList = document.getElementById('tripList');
  const converterBeforeTrips = Boolean(
    converter && tripList &&
    (converter.compareDocumentPosition(tripList) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  const quickButton = document.querySelector('.trip-quick-expense-btn[data-trip-expense-id="qa-trip"]');
  return {
    converterBeforeTrips,
    converterVisible: Boolean(converter && getComputedStyle(converter).display !== 'none'),
    quickButtonExists: Boolean(quickButton),
    quickButtonText: quickButton?.textContent?.replace(/\s+/g, ' ').trim() || '',
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});

assert.equal(travelLayout.converterBeforeTrips, true, 'Currency Converter must be above the trip list');
assert.equal(travelLayout.converterVisible, true);
assert.equal(travelLayout.quickButtonExists, true, 'Rendered trip card must include Add Expense');
assert.match(travelLayout.quickButtonText, /Add Expense/);
assert.ok(travelLayout.overflow <= 1, `Trips screen horizontal overflow: ${travelLayout.overflow}px`);

const quickButton = page.locator('.trip-quick-expense-btn[data-trip-expense-id="qa-trip"]');
const quickButtonBox = await quickButton.boundingBox();
assert.ok(quickButtonBox && quickButtonBox.height >= 54, `Trip Add Expense tap target too small: ${quickButtonBox?.height || 0}px`);

await quickButton.click();
await page.waitForTimeout(150);

const addState = await page.evaluate(() => {
  const add = document.querySelector('.screen[data-screen="add"]');
  const tripSelect = document.getElementById('expenseTrip');
  const save = add?.querySelector('.expense-form-actions > .primary-btn');
  return {
    active: Boolean(add?.classList.contains('active')),
    tripValue: tripSelect?.value || '',
    selectedTripText: tripSelect?.selectedOptions?.[0]?.textContent?.trim() || '',
    saveVisible: Boolean(save && getComputedStyle(save).display !== 'none'),
    saveText: save?.textContent?.trim() || '',
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});

assert.equal(addState.active, true, 'Travel Add Expense must open the normal Add screen');
assert.equal(addState.tripValue, 'qa-trip', 'Travel Add Expense must preset the selected trip');
assert.equal(addState.selectedTripText, 'QA Japan Trip');
assert.equal(addState.saveVisible, true, 'Save Expense must remain visible');
assert.equal(addState.saveText, 'Save Expense');
assert.ok(addState.overflow <= 1, `Add screen horizontal overflow: ${addState.overflow}px`);
assert.deepEqual(errors, []);

console.log(`PASS real trip quick expense + converter priority; tap target ${Math.round(quickButtonBox.height)}px`);
await browser.close();
