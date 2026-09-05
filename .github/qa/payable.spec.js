const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 844 } });

async function dismissTips(page) {
  for (let i = 0; i < 5; i += 1) {
    const gotIt = page.getByRole('button', { name: /got it/i });
    if (await gotIt.isVisible().catch(() => false)) {
      await gotIt.click({ force: true }).catch(() => {});
      await page.waitForTimeout(120);
    }
  }
}

async function readCard(page, id) {
  return page.evaluate(async (cardId) => new Promise((resolve, reject) => {
    const request = indexedDB.open('momo_database', 4);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('cards', 'readonly');
      const get = tx.objectStore('cards').get(cardId);
      get.onsuccess = () => { const value = get.result; db.close(); resolve(value); };
      get.onerror = () => reject(get.error);
    };
  }), id);
}

test('existing credit-card payable saves due date and keeps monthly anchor', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.addInitScript(() => {
    localStorage.setItem('momo_welcome_tour_complete_v1', 'yes');
  });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('momo_database', 4);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('cards', 'readwrite');
        tx.objectStore('cards').put({
          id: 'qa-card', type: 'credit-card', customType: '', name: 'QA Rewards Card', provider: 'QA Bank',
          originalAmount: 14930.46, balance: 11199.999999999998, currency: 'PHP', dueDate: '',
          regularPayment: 3730.46, frequency: 'monthly', creditLimit: 0, statementBalance: 0,
          minimumDue: 0, interestAPR: 0, statementDay: 16, installmentCount: 0, installmentsPaid: 0,
          notes: '', payments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await dismissTips(page);

  await page.locator('#menuButton').click();
  await page.locator('#sideDrawer [data-drawer-nav="payables"]').click();
  await dismissTips(page);

  const payablesScreen = page.locator('section.screen[data-screen="payables"]');
  await expect(payablesScreen).toHaveClass(/active/, { timeout: 5000 });
  const card = payablesScreen.locator('[data-payable-open="qa-card"]');
  await expect(card).toBeVisible({ timeout: 5000 });
  await card.click();
  await page.locator('[data-payable-edit="qa-card"]').click();

  await expect(page.locator('#payableStatementDay')).toHaveValue('16');
  await expect(page.locator('#payableInstallmentCount')).toHaveValue('');
  await expect(page.locator('#payableBalance')).toHaveValue('11200');

  await page.locator('#payableDueDate').fill('2026-10-06');
  expect(await page.locator('#payableForm').evaluate((form) => form.checkValidity())).toBeTruthy();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBeFalsy();

  await page.getByRole('button', { name: 'Save Payable' }).click();
  await expect(page.locator('#payableModal')).toBeHidden();

  let saved = await readCard(page, 'qa-card');
  expect(saved.dueDate).toBe('2026-10-06');
  expect(saved.dueDayOfMonth).toBe(6);
  expect(saved.balance).toBe(11200);
  expect(saved.statementDay).toBe(16);

  await payablesScreen.locator('[data-payable-open="qa-card"]').click();
  await page.locator('[data-payable-pay="qa-card"]').click();
  await page.locator('#payablePaymentAmount').fill('3730.46');
  await page.locator('#payablePaymentDate').fill('2026-10-06');
  await page.getByRole('button', { name: 'Record Payment' }).click();
  await expect(page.locator('#payablePaymentModal')).toBeHidden();

  saved = await readCard(page, 'qa-card');
  expect(saved.dueDate).toBe('2026-11-06');
  expect(saved.dueDayOfMonth).toBe(6);
  expect(saved.balance).toBe(7469.54);

  const edgeDates = await page.evaluate(() => ({
    feb: nextPayableDueDate('2026-01-31', 'monthly', 31),
    mar: nextPayableDueDate('2026-02-28', 'monthly', 31)
  }));
  expect(edgeDates).toEqual({ feb: '2026-02-28', mar: '2026-03-31' });
  expect(pageErrors).toEqual([]);
});
