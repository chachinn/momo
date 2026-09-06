import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  ['#welcomeTour', '#tutorialTip', '.tutorial-overlay', '.tutorial-backdrop', '.tutorial-tip-backdrop', '.help-topic-backdrop']
    .forEach((selector) => document.querySelectorAll(selector).forEach((el) => {
      el.hidden = true;
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    }));
  if (typeof showScreen === 'function') showScreen('payables');
});

const dateParts = await page.evaluate(() => {
  const today = getTodayString();
  const [year, month, day] = today.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  const dueDay = Math.min(last, day + 5);
  return {
    today,
    statementDay: day,
    dueDate: `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`
  };
});

async function openNew() {
  await page.evaluate(() => openPayableEditor());
  await page.locator('#payableModal').waitFor({ state: 'visible' });
}

async function submitAndWait() {
  await page.locator('#payableForm').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.getElementById('payableModal')?.hidden === true);
}

async function readCardByName(name) {
  return await page.evaluate(async (target) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('momo_database');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction('cards', 'readonly');
      const req = tx.objectStore('cards').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.find((row) => row.name === target) || null;
  }, name);
}

// Fixed monthly by remaining months: 5 × 1000 = 5000.
await openNew();
await page.locator('#payableType').selectOption('loan');
await page.locator('#payableName').fill('Months Plan');
await page.locator('#payableDueDate').fill(dateParts.dueDate);
await page.locator('#payableRegularPayment').fill('1000');
await page.locator('#payableFrequency').selectOption('monthly');
await page.locator('#payablePaymentMode').selectOption('fixed');
await page.locator('#payableBalanceMode').selectOption('months');
await page.locator('#payableRemainingMonths').fill('5');
const monthsPreview = await page.locator('#payableCalculatedBalance').textContent();
if (!monthsPreview.includes('5,000')) throw new Error(`Remaining-month preview incorrect: ${monthsPreview}`);
await submitAndWait();
let monthsPlan = await readCardByName('Months Plan');
if (!monthsPlan || monthsPlan.balance !== 5000 || monthsPlan.remainingMonths !== 5 || monthsPlan.balanceMode !== 'months') {
  throw new Error(`Remaining-month save failed: ${JSON.stringify(monthsPlan)}`);
}

// Fixed monthly by 1 of 24 progress: 23 × 750 = 17,250.
await openNew();
await page.locator('#payableType').selectOption('installment');
await page.locator('#payableName').fill('Progress Plan');
await page.locator('#payableDueDate').fill(dateParts.dueDate);
await page.locator('#payableRegularPayment').fill('750');
await page.locator('#payableFrequency').selectOption('monthly');
await page.locator('#payablePaymentMode').selectOption('fixed');
await page.locator('#payableBalanceMode').selectOption('progress');
await page.locator('#payablePaymentsCompleted').fill('1');
await page.locator('#payablePaymentsTotal').fill('24');
const progressPreview = await page.locator('#payableProgressBalance').textContent();
if (!progressPreview.includes('17,250')) throw new Error(`1-of-24 preview incorrect: ${progressPreview}`);
await submitAndWait();
let progressPlan = await readCardByName('Progress Plan');
if (!progressPlan || progressPlan.balance !== 17250 || progressPlan.paymentsCompleted !== 1 || progressPlan.paymentsTotal !== 24) {
  throw new Error(`Progress save failed: ${JSON.stringify(progressPlan)}`);
}
if (progressPlan.installmentCount !== 24 || progressPlan.installmentsPaid !== 1) {
  throw new Error(`Legacy installment sync failed: ${JSON.stringify(progressPlan)}`);
}

// Variable monthly amount with statement-day reminder.
await openNew();
await page.locator('#payableType').selectOption('credit-card');
await page.locator('#payableName').fill('Variable Card');
await page.locator('#payableDueDate').fill(dateParts.dueDate);
await page.locator('#payableRegularPayment').fill('2800');
await page.locator('#payableFrequency').selectOption('monthly');
await page.locator('#payablePaymentMode').selectOption('variable');
if (await page.locator('#payableVariableFields').isHidden()) throw new Error('Variable monthly fields did not appear');
await page.locator('#payableStatementDay').fill(String(dateParts.statementDay));
await page.locator('#payableStatementReminder').check();
await submitAndWait();
let variable = await readCardByName('Variable Card');
if (!variable || variable.paymentMode !== 'variable' || variable.balance !== 0 || variable.regularPayment !== 2800 || !variable.statementReminder) {
  throw new Error(`Variable monthly save failed: ${JSON.stringify(variable)}`);
}

// All Payables shows the full monthly obligation, not just unpaid items.
await page.evaluate(() => { activePayablesView = 'all'; renderPayables(); });
let hero = await page.locator('#payablesTotal').textContent();
let heroLabel = await page.locator('#payablesHeroLabel').textContent();
if (!hero.includes('4,550')) throw new Error(`All Payables monthly total should be 4550 before payments: ${hero}`);
if (!heroLabel.includes('Total for this month')) throw new Error(`All Payables hero label incorrect: ${heroLabel}`);

// Monthly checklist payment decrements calculated remaining months.
await page.evaluate(async () => {
  const item = cards.find((row) => row.name === 'Months Plan');
  await markPayablePaidForCurrentMonth(item.id);
});
monthsPlan = await readCardByName('Months Plan');
if (monthsPlan.balance !== 4000 || monthsPlan.remainingMonths !== 4) {
  throw new Error(`Remaining months did not decrement with payment: ${JSON.stringify(monthsPlan)}`);
}

// Variable monthly payment clears this month's amount but keeps the template active for next month.
await page.evaluate(async () => {
  const item = cards.find((row) => row.name === 'Variable Card');
  await markPayablePaidForCurrentMonth(item.id);
});
variable = await readCardByName('Variable Card');
if (variable.regularPayment !== 0 || variable.paymentMode !== 'variable') {
  throw new Error(`Variable monthly amount was not cleared after paid: ${JSON.stringify(variable)}`);
}
const variableState = await page.evaluate(() => {
  const item = cards.find((row) => row.name === 'Variable Card');
  return { active: isPayableActive(item), dueDate: item.dueDate, reminders: buildSmartReminders().map((r) => r.id) };
});
if (!variableState.active) throw new Error(`Variable template became inactive after one month: ${JSON.stringify(variableState)}`);
if (!variableState.dueDate || variableState.dueDate.slice(0, 7) === dateParts.today.slice(0, 7)) {
  throw new Error(`Variable due date did not advance to the next month: ${JSON.stringify(variableState)}`);
}
if (!variableState.reminders.some((id) => id.startsWith('payable-statement:'))) {
  throw new Error(`Statement reminder was not generated after amount reset: ${JSON.stringify(variableState)}`);
}

// All Payables total must still include amounts already paid this month.
await page.evaluate(() => { activePayablesView = 'all'; renderPayables(); });
hero = await page.locator('#payablesTotal').textContent();
if (!hero.includes('4,550')) throw new Error(`Paid items disappeared from All Payables monthly total: ${hero}`);
const allText = await page.locator('#payablesList').textContent();
if (!allText.includes('Variable Card') || !allText.includes('Set amount')) {
  throw new Error(`Variable template should remain visible in All Payables: ${allText}`);
}

// Undo restores the variable amount and cycle.
await page.evaluate(async () => {
  const item = cards.find((row) => row.name === 'Variable Card');
  await undoPayablePaidForCurrentMonth(item.id);
});
variable = await readCardByName('Variable Card');
if (variable.regularPayment !== 2800) throw new Error(`Undo did not restore variable amount: ${JSON.stringify(variable)}`);

const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
if (overflow > 1) throw new Error(`Horizontal overflow detected: ${overflow}px`);
if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);

console.log('Combined payables monthly QA passed');
await browser.close();
