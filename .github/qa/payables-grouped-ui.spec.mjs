import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));

await page.addInitScript(() => {
  localStorage.setItem('momo_welcome_tour_complete_v1', 'yes');
});

await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  const req = indexedDB.open('momo_database', 4);
  const db = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  const tx = db.transaction('cards', 'readwrite');
  const store = tx.objectStore('cards');
  store.clear();
  const put = (x) => store.put(x);
  put({id:'bpi-ctc',type:'loan',name:'Credit to Cash',provider:'Credit to Cash',balance:20000,originalAmount:24000,currency:'PHP',dueDate:'2026-09-20',dueDayOfMonth:20,regularPayment:2000,frequency:'monthly',paymentMode:'fixed',balanceMode:'progress',paymentsCompleted:2,paymentsTotal:12,paydaySlot:'first',paymentGroup:'Main Card',paymentGroupRole:'counts',payments:[]});
  put({id:'bpi-pm',type:'installment',name:'PowerMac',provider:'PowerMac',balance:9000,originalAmount:12000,currency:'PHP',dueDate:'2026-09-20',dueDayOfMonth:20,regularPayment:1000,frequency:'monthly',paymentMode:'fixed',balanceMode:'progress',paymentsCompleted:3,paymentsTotal:12,paydaySlot:'first',paymentGroup:'Main Card',paymentGroupRole:'counts',payments:[]});
  put({id:'card-total',type:'credit-card',name:'Other Card',provider:'Other Card',balance:50000,originalAmount:50000,currency:'PHP',dueDate:'2026-09-25',dueDayOfMonth:25,regularPayment:10000,frequency:'monthly',paymentMode:'fixed',balanceMode:'balance',paydaySlot:'second',paymentGroup:'Other Card',paymentGroupRole:'counts',payments:[]});
  put({id:'inst-a',type:'installment',name:'Laptop installment',provider:'Laptop',balance:10000,originalAmount:12000,currency:'PHP',dueDate:'2026-09-25',dueDayOfMonth:25,regularPayment:2000,frequency:'monthly',paymentMode:'fixed',balanceMode:'progress',paymentsCompleted:1,paymentsTotal:6,paydaySlot:'second',paymentGroup:'Other Card',paymentGroupRole:'breakdown',payments:[]});
  put({id:'inst-b',type:'installment',name:'Phone installment',provider:'Phone',balance:9000,originalAmount:12000,currency:'PHP',dueDate:'2026-09-25',dueDayOfMonth:25,regularPayment:1000,frequency:'monthly',paymentMode:'fixed',balanceMode:'progress',paymentsCompleted:3,paymentsTotal:12,paydaySlot:'second',paymentGroup:'Other Card',paymentGroupRole:'breakdown',payments:[]});
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  location.reload();
});
await page.waitForLoadState('networkidle');

await page.locator('#menuButton').click();
await page.locator('#sideDrawer [data-drawer-nav="payables"]').click();
await page.waitForTimeout(250);

await page.locator('[data-payables-view="all"]').click();
await page.waitForTimeout(150);

const bodyText = await page.locator('section.screen[data-screen="payables"]').innerText();
assert.match(bodyText, /Main Card/);
assert.match(bodyText, /Credit to Cash/);
assert.match(bodyText, /PowerMac/);
assert.match(bodyText, /Other Card/);
assert.match(bodyText, /Laptop/);
assert.match(bodyText, /Phone/);
assert.doesNotMatch(bodyText, /Paid together/);

// All Payables total counts Main Card children (3000) + Other Card parent (10000), but not breakdown-only 3000.
assert.equal((await page.locator('#payablesTotal').innerText()).replace(/\s/g,''), '₱13,000.00');
assert.equal((await page.locator('#payablesPaydayOne').innerText()).replace(/\s/g,''), '₱3,000.00');
assert.equal((await page.locator('#payablesPaydayTwo').innerText()).replace(/\s/g,''), '₱10,000.00');

// Remaining total excludes tracking-only balances: 20k + 9k + 50k = 79k.
await page.locator('#payablesRemainingToggle').click();
assert.equal((await page.locator('#payablesRemainingTotal').innerText()).replace(/\s/g,''), '₱79,000.00');

// Check grouped header amount for the parent-total style account.
const otherGroup = page.locator('.payable-account-group').filter({ hasText: 'Other Card' }).first();
assert.match(await otherGroup.innerText(), /₱10,000\.00/);
assert.match(await otherGroup.innerText(), /tracking only/);

// Mobile overflow.
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
assert.equal(overflow, false);
assert.deepEqual(errors, []);

await browser.close();
console.log('Grouped Payables UI QA passed');
