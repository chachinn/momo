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

await page.evaluate(() => {
  for (const selector of ['#welcomeTour', '#contextTipModal']) {
    const el = document.querySelector(selector);
    if (el) {
      el.hidden = true;
      el.style.display = 'none';
    }
  }
  document.body.classList.remove('tutorial-open', 'modal-open', 'drawer-open');
  showScreen('trips');
});

const travelLayout = await page.evaluate(() => {
  const converter = document.getElementById('inlineConverter');
  const tripList = document.getElementById('tripList');
  const converterBeforeTrips = Boolean(
    converter && tripList &&
    (converter.compareDocumentPosition(tripList) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  return {
    converterBeforeTrips,
    converterVisible: Boolean(converter && getComputedStyle(converter).display !== 'none'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});

assert.equal(travelLayout.converterBeforeTrips, true, 'Currency Converter must be above the trip list');
assert.equal(travelLayout.converterVisible, true);
assert.ok(travelLayout.overflow <= 1, `Trips screen horizontal overflow: ${travelLayout.overflow}px`);

await page.evaluate(() => {
  const tripList = document.getElementById('tripList');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'trip-quick-expense-btn';
  button.dataset.tripExpenseId = 'qa-trip';
  button.innerHTML = `
    <span class="trip-quick-expense-icon">＋</span>
    <span class="trip-quick-expense-copy"><strong>Add Expense</strong><small>Automatically add it to this trip</small></span>
    <span class="trip-quick-expense-arrow">›</span>`;
  tripList.prepend(button);

  const tripSelect = document.getElementById('expenseTrip');
  const option = document.createElement('option');
  option.value = 'qa-trip';
  option.textContent = 'QA Trip';
  tripSelect.append(option);
});

const quickButtonBox = await page.locator('.trip-quick-expense-btn').first().boundingBox();
assert.ok(quickButtonBox && quickButtonBox.height >= 54, `Trip Add Expense tap target too small: ${quickButtonBox?.height || 0}px`);

await page.locator('.trip-quick-expense-btn').first().click();
await page.waitForTimeout(150);

const addState = await page.evaluate(() => {
  const add = document.querySelector('.screen[data-screen="add"]');
  const tripSelect = document.getElementById('expenseTrip');
  const save = add?.querySelector('.expense-form-actions > .primary-btn');
  return {
    active: Boolean(add?.classList.contains('active')),
    tripValue: tripSelect?.value || '',
    saveVisible: Boolean(save && getComputedStyle(save).display !== 'none'),
    saveText: save?.textContent?.trim() || '',
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});

assert.equal(addState.active, true, 'Travel Add Expense must open the normal Add screen');
assert.equal(addState.tripValue, 'qa-trip', 'Travel Add Expense must preset the selected trip');
assert.equal(addState.saveVisible, true, 'Save Expense must remain visible');
assert.equal(addState.saveText, 'Save Expense');
assert.ok(addState.overflow <= 1, `Add screen horizontal overflow: ${addState.overflow}px`);
assert.deepEqual(errors, []);

console.log(`PASS trip quick expense + converter priority; tap target ${Math.round(quickButtonBox.height)}px`);
await browser.close();
