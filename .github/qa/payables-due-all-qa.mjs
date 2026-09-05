import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('momo_database');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const records = [
    {
      id: 'bpi-monthly', type: 'credit-card', name: 'BPI', provider: 'BPI',
      originalAmount: 50000, balance: 41044.47, currency: 'PHP',
      dueDate: '2026-09-20', dueDayOfMonth: 20, regularPayment: 3730.46,
      frequency: 'monthly', creditLimit: 0, statementBalance: 0,
      minimumDue: 0, interestAPR: 0, statementDay: 16, payments: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    },
    {
      id: 'future-loan', type: 'loan', name: 'Future Loan', provider: 'Sample',
      originalAmount: 12000, balance: 9000, currency: 'PHP',
      dueDate: '2026-10-12', dueDayOfMonth: 12, regularPayment: 1500,
      frequency: 'monthly', payments: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }
  ];
  await new Promise((resolve, reject) => {
    const tx = db.transaction('cards', 'readwrite');
    const store = tx.objectStore('cards');
    records.forEach((record) => store.put(record));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
});

await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => {
  const overlays = [
    '#welcomeTour',
    '#tutorialTip',
    '.tutorial-overlay',
    '.tutorial-backdrop',
    '.tutorial-tip-backdrop',
    '.help-topic-backdrop'
  ];
  overlays.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.hidden = true;
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    });
  });
  if (typeof showScreen === 'function') showScreen('payables');
  if (typeof renderPayables === 'function') renderPayables();
});

const dueButton = page.locator('[data-payables-view="due"]');
const allButton = page.locator('[data-payables-view="all"]');
await dueButton.waitFor({ state: 'visible' });

if ((await dueButton.getAttribute('aria-selected')) !== 'true') throw new Error('Due view should be default');
let text = await page.locator('#payablesList').innerText();
if (!text.includes('BPI')) throw new Error('September BPI payable should appear in Due');
if (text.includes('Future Loan')) throw new Error('Future payable should not appear in Due');

await allButton.click();
if ((await allButton.getAttribute('aria-selected')) !== 'true') throw new Error('All Payables tab did not activate');
text = await page.locator('#payablesList').innerText();
if (!text.includes('BPI') || !text.includes('Future Loan')) throw new Error('All Payables should show both current and future payables');
if (!text.includes('₱3,730.46')) throw new Error('All Payables should emphasize the monthly payment amount');

await dueButton.click();
await page.evaluate(() => openPayableEditor('bpi-monthly'));
await page.locator('#payableDueDate').fill('2026-10-06');
await page.locator('#payableForm').evaluate((form) => form.requestSubmit());
await page.waitForFunction(() => document.querySelector('[data-payables-view="all"]')?.getAttribute('aria-selected') === 'true');
text = await page.locator('#payablesList').innerText();
if (!text.includes('BPI')) throw new Error('Edited payable should remain visible by switching to All Payables');
if (!text.includes('Oct')) throw new Error('Edited future due date should be visible in All Payables');

const savedDue = await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('momo_database');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction('cards', 'readonly');
    const request = tx.objectStore('cards').get('bpi-monthly');
    request.onsuccess = () => resolve(request.result?.dueDate || '');
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
});
if (savedDue !== '2026-10-06') throw new Error(`Expected saved due date 2026-10-06, got ${savedDue}`);

await dueButton.click();
text = await page.locator('#payablesList').innerText();
if (text.includes('BPI')) throw new Error('BPI should leave Due after its due date moves to October');
await allButton.click();
text = await page.locator('#payablesList').innerText();
if (!text.includes('BPI')) throw new Error('BPI must remain visible in All Payables');

const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
if (overflow > 1) throw new Error(`Horizontal overflow detected: ${overflow}px`);
if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);

console.log('Payables Due / All mobile QA passed');
await browser.close();
