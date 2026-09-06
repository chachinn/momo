import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('momo_welcome_tour_complete_v1', 'yes');
  document.querySelectorAll('#welcomeTour,.tutorial-overlay,.tutorial-backdrop').forEach((el) => el.remove());
});

await page.waitForFunction(() => window.indexedDB && document.querySelector('[data-screen="payables"]'));

await page.evaluate(async () => {
  const open = indexedDB.open('momo_database', 4);
  const db = await new Promise((resolve, reject) => {
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const tx = db.transaction('cards', 'readwrite');
  const store = tx.objectStore('cards');
  store.clear();
  const base = {
    currency: 'PHP', frequency: 'monthly', paymentMode: 'fixed', balanceMode: 'progress',
    dueDate: '2026-09-28', dueDayOfMonth: 28, paydaySlot: 'second', payments: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  const records = [
    { ...base, id:'parent', type:'credit-card', name:'Everyday Card', provider:'Bank A', regularPayment:10000, balance:30000, paymentsCompleted:0, paymentsTotal:3, paymentGroup:'Everyday Card', paymentGroupRole:'parent' },
    { ...base, id:'break1', type:'installment', name:'Phone installment', provider:'Store', regularPayment:2000, balance:12000, paymentsCompleted:6, paymentsTotal:12, paymentGroup:'Everyday Card', paymentGroupRole:'breakdown' },
    { ...base, id:'break2', type:'loan', name:'Appliance installment', provider:'Store', regularPayment:1000, balance:6000, paymentsCompleted:3, paymentsTotal:9, paymentGroup:'Everyday Card', paymentGroupRole:'breakdown' },
    { ...base, id:'count1', type:'loan', name:'Cash loan', provider:'Bank B', regularPayment:3000, balance:18000, paymentsCompleted:2, paymentsTotal:8, paymentGroup:'Travel Card', paymentGroupRole:'counts', paydaySlot:'first' },
    { ...base, id:'count2', type:'installment', name:'Laptop', provider:'Shop', regularPayment:2000, balance:10000, paymentsCompleted:1, paymentsTotal:6, paymentGroup:'Travel Card', paymentGroupRole:'counts', paydaySlot:'first' }
  ];
  records.forEach((record) => store.put(record));
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  db.close();
  location.reload();
});

await page.waitForLoadState('domcontentloaded');
await page.evaluate(() => {
  localStorage.setItem('momo_welcome_tour_complete_v1', 'yes');
  document.querySelectorAll('#welcomeTour,.tutorial-overlay,.tutorial-backdrop').forEach((el) => el.remove());
});

await page.waitForTimeout(900);
const payablesNav = page.locator('[data-drawer-nav="payables"], [data-nav="payables"]').first();
if (await payablesNav.count()) {
  await payablesNav.evaluate((el) => el.click());
} else {
  await page.evaluate(() => {
    document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
    document.querySelector('[data-screen="payables"]')?.classList.add('active');
  });
}
await page.waitForTimeout(300);
await page.locator('[data-payables-view="all"]').click({ force: true });
await page.waitForTimeout(250);

const screen = page.locator('section.screen[data-screen="payables"]');
const text = await screen.textContent();
if (!text.includes('Everyday Card') || !text.includes('Phone installment') || !text.includes('Appliance installment')) throw new Error('Explicit parent hierarchy did not render');
if (!text.includes('Travel Card') || !text.includes('Cash loan') || !text.includes('Laptop')) throw new Error('Synthetic group hierarchy did not render');
if (!text.includes('Breakdown total') || !text.includes('₱3,000.00')) throw new Error('Breakdown-only total missing or wrong');
if (text.includes('Paid together')) throw new Error('Old Paid together section/copy is still visible');

const heroTotal = await page.locator('#payablesTotal').textContent();
if (!heroTotal.includes('15,000.00')) throw new Error(`Expected financial monthly total 15,000 without breakdown double count, got ${heroTotal}`);

await page.locator('#payablesRemainingToggle').click();
await page.waitForTimeout(100);
const remainingText = await page.locator('#payablesRemainingReveal').textContent();
if (!remainingText.includes('58,000.00')) throw new Error(`Expected remaining financial total 58,000, got ${remainingText}`);

const firstPayday = await page.locator('#payablesPaydayOne').textContent();
const secondPayday = await page.locator('#payablesPaydayTwo').textContent();
if (!firstPayday.includes('5,000.00')) throw new Error(`Expected first payday 5,000, got ${firstPayday}`);
if (!secondPayday.includes('10,000.00')) throw new Error(`Expected second payday 10,000 excluding breakdown-only, got ${secondPayday}`);

const bodyWidth = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
if (bodyWidth.sw > bodyWidth.cw + 1) throw new Error(`Horizontal overflow: ${bodyWidth.sw} > ${bodyWidth.cw}`);
if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);

console.log('Grouped Payables QA passed');
await browser.close();
