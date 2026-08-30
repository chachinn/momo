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
await page.waitForTimeout(500);

await page.evaluate(() => {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  const add = document.querySelector('[data-screen="add"]');
  add?.classList.add('active');
  if (add) add.hidden = false;
  for (const selector of ['#welcomeTour', '#contextTipModal']) {
    const el = document.querySelector(selector);
    if (el) {
      el.hidden = true;
      el.style.display = 'none';
    }
  }
  document.body.classList.remove('tutorial-open', 'modal-open', 'drawer-open');
});

const layout = await page.evaluate(() => {
  const screen = document.querySelector('[data-screen="add"]');
  const primary = screen?.querySelector('.expense-form-actions > .primary-btn');
  const template = screen?.querySelector('.favorite-save-btn');
  const actions = screen?.querySelector('.expense-form-actions');
  const topSave = document.getElementById('saveExpenseTop');
  const primaryBox = primary?.getBoundingClientRect();
  const templateBox = template?.getBoundingClientRect();
  return {
    screenHeight: screen?.scrollHeight || 0,
    primaryText: primary?.textContent?.trim() || '',
    primaryType: primary?.getAttribute('type') || '',
    primaryDisplay: primary ? getComputedStyle(primary).display : 'missing',
    primaryHeight: primaryBox?.height || 0,
    templateText: template?.textContent?.trim() || '',
    templateDisplay: template ? getComputedStyle(template).display : 'missing',
    templateHeight: templateBox?.height || 0,
    actionsDisplay: actions ? getComputedStyle(actions).display : 'missing',
    topSaveExists: Boolean(topSave),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});

assert.equal(layout.primaryText, 'Save Expense');
assert.equal(layout.primaryType, 'submit');
assert.notEqual(layout.primaryDisplay, 'none');
assert.ok(layout.primaryHeight >= 36);
assert.match(layout.templateText, /Save as Template/);
assert.notEqual(layout.templateDisplay, 'none');
assert.ok(layout.templateHeight >= 36);
assert.equal(layout.actionsDisplay, 'grid');
assert.equal(layout.topSaveExists, true);
assert.ok(layout.overflow <= 1);
assert.ok(layout.screenHeight <= 680, `Add Expense core screen is too tall: ${layout.screenHeight}px`);
assert.deepEqual(errors, []);

console.log(`PASS Add Expense save hierarchy: ${layout.screenHeight}px core screen`);
await browser.close();
