import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('momo_welcome_tour_complete_v1', 'yes');
  document.querySelectorAll('#welcomeTour,.tutorial-overlay,.tutorial-backdrop').forEach((el) => el.remove());
  document.querySelectorAll('section.screen').forEach((el) => el.classList.remove('active'));
  document.querySelector('section.screen[data-screen="payables"]')?.classList.add('active');
});
await page.waitForFunction(() => typeof renderPayables === 'function');

const rows = [
  {
    id:'a', type:'loan', name:'A', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress',
    balance:20000, regularPayment:3730.46, paymentsCompleted:1, paymentsTotal:12, dueDate:'2026-10-06', dueDayOfMonth:6,
    payments:[{id:'p1', amount:3730.46, date:'2026-09-05', paidMonth:'2026-09', cycleMonth:'2026-09', cycleTargetAmount:3730.46, source:'month-check'}]
  },
  {
    id:'b', type:'installment', name:'B', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress',
    balance:18000, regularPayment:3541.67, paymentsCompleted:1, paymentsTotal:12, dueDate:'2026-10-06', dueDayOfMonth:6,
    payments:[{id:'p2', amount:3541.67, date:'2026-09-06', paidMonth:'2026-09', cycleMonth:'2026-09', cycleTargetAmount:3541.67, source:'month-check'}]
  },
  {
    id:'c', type:'loan', name:'C', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress',
    balance:30000, regularPayment:6055.55, paymentsCompleted:1, paymentsTotal:12, dueDate:'2026-10-13', dueDayOfMonth:13,
    payments:[{id:'p3', amount:6055.55, date:'2026-09-07', paidMonth:'2026-09', cycleMonth:'2026-09', cycleTargetAmount:6055.55, source:'month-check'}]
  },
  {
    id:'partial', type:'loan', name:'Partial Future', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress',
    balance:50000, regularPayment:10000, paymentsCompleted:0, paymentsTotal:10, dueDate:'2026-09-20', dueDayOfMonth:20,
    payments:[{id:'p4', amount:5000, date:'2026-09-07', cycleMonth:'2026-09', cycleTargetAmount:10000, source:'manual'}]
  },
  {
    id:'track', type:'installment', name:'Tracked Child', currency:'PHP', frequency:'monthly', paymentMode:'fixed', balanceMode:'progress',
    balance:10000, regularPayment:2000, paymentsCompleted:2, paymentsTotal:12, dueDate:'2026-10-10', dueDayOfMonth:10,
    paymentGroup:'Card', paymentGroupRole:'breakdown',
    payments:[{id:'p5', amount:2000, date:'2026-09-07', cycleMonth:'2026-09', cycleTargetAmount:2000, source:'group-breakdown-track'}]
  }
];

await page.evaluate(async (rows) => {
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('momo_database', 4);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('cards', 'readwrite');
      const store = tx.objectStore('cards');
      store.clear();
      rows.forEach((r) => store.put(r));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
  cards = rows;
  renderPayables();
}, rows);

const paid = await page.locator('#payablesPaidMonth').textContent();
assert.match(paid, /13,327\.68/);
const doneList = page.locator('.payables-cycle-done-list .payable-paid-cycle-card');
assert.equal(await doneList.count(), 3);
const listedAmounts = await doneList.locator('b').allTextContents();
assert.deepEqual(listedAmounts.map((s) => s.replace(/[^0-9.]/g,'')), ['3730.46','3541.67','6055.55']);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
await browser.close();
console.log('Paid total reconciliation QA passed');
