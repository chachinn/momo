import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = 'http://127.0.0.1:4173';
const OWNER_UID = 'owner-qa-uid';
const PARTNER_UID = 'martin-qa-uid';
const TOKEN = 'ABCDEFGHJKLMNP';
const CODE = 'MT1.b3duZXItcWEtdWlk.ABCDEFGHJKLMNP';

const tripMeta = {
  name: 'Japan October 2026',
  destination: 'Tokyo',
  startDate: '2026-10-18',
  endDate: '2026-10-25',
  budget: 200000,
  currency: 'PHP',
  dailyBudget: 0
};

const firebaseStub = `
(() => {
  const role = new URL(location.href).searchParams.get('qaUser') || 'owner';
  const ownerUid = ${JSON.stringify(OWNER_UID)};
  const partnerUid = ${JSON.stringify(PARTNER_UID)};
  const token = ${JSON.stringify(TOKEN)};
  const code = ${JSON.stringify(CODE)};
  const trip = ${JSON.stringify(tripMeta)};
  const user = role === 'partner'
    ? { uid: partnerUid, email: 'martin@example.com', displayName: 'Martin', photoURL: '' }
    : { uid: ownerUid, email: 'cha@example.com', displayName: 'Cha', photoURL: '' };

  let invite = {
    schemaVersion: 1,
    status: role === 'partner' ? 'open' : 'open',
    code,
    token,
    ownerUid,
    ownerName: 'Cha',
    ownerEmail: 'cha@example.com',
    partnerUid: '',
    partnerName: '',
    partnerEmail: '',
    trip: { ...trip },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: '2026-10-30T00:00:00.000Z'
  };
  let remoteDocs = [];
  const inviteWatchers = new Set();
  const expenseWatchers = new Set();

  const calls = {
    createInvite: 0,
    acceptInvite: 0,
    upserts: [],
    tombstones: [],
    tripMeta: [],
    disconnects: 0
  };
  window.__momoTripCloudCalls = calls;

  function emitInvite() {
    inviteWatchers.forEach((callback) => callback({ ...invite }));
  }
  function emitExpenses() {
    expenseWatchers.forEach((callback) => callback({ docs: remoteDocs.map((item) => structuredClone(item)) }));
  }

  window.__momoTripCloudTest = {
    code,
    getInvite: () => structuredClone(invite),
    emitInvite(update = {}) {
      invite = { ...invite, ...structuredClone(update) };
      emitInvite();
    },
    emitExpenses(docs = []) {
      remoteDocs = structuredClone(docs);
      emitExpenses();
    }
  };

  window.MomoTripCloud = {
    getUser: () => ({ ...user }),
    validateCode: (raw) => String(raw || '').includes('MT1.')
      ? { valid: true, code, token, ownerUid, message: 'Valid Momo trip invite ✓' }
      : { valid: false, message: 'Invalid invite' },
    async createInvite(meta) {
      calls.createInvite += 1;
      invite = { ...invite, status: 'open', trip: { ...meta } };
      return structuredClone(invite);
    },
    async acceptInvite(raw) {
      calls.acceptInvite += 1;
      if (!String(raw || '').includes('MT1.')) throw new Error('Invalid invite');
      invite = {
        ...invite,
        status: 'active',
        partnerUid,
        partnerName: 'Martin',
        partnerEmail: 'martin@example.com',
        acceptedAt: new Date().toISOString()
      };
      emitInvite();
      return structuredClone(invite);
    },
    watchInvite(raw, callback) {
      inviteWatchers.add(callback);
      queueMicrotask(() => callback(structuredClone(invite)));
      return () => inviteWatchers.delete(callback);
    },
    watchExpenses(raw, callback) {
      expenseWatchers.add(callback);
      queueMicrotask(() => callback({ docs: remoteDocs.map((item) => structuredClone(item)) }));
      return () => expenseWatchers.delete(callback);
    },
    async upsertExpense(raw, payload) {
      calls.upserts.push(structuredClone(payload));
      const index = remoteDocs.findIndex((item) => item.expenseId === payload.expenseId);
      if (index >= 0) remoteDocs[index] = structuredClone(payload);
      else remoteDocs.push(structuredClone(payload));
      return true;
    },
    async tombstoneExpense(raw, expenseId, payload = {}) {
      calls.tombstones.push({ expenseId, payload: structuredClone(payload) });
      const existing = remoteDocs.find((item) => item.expenseId === expenseId) || {};
      const tombstone = {
        ...existing,
        ...structuredClone(payload),
        expenseId,
        deleted: true,
        updatedAtMs: Number(payload.updatedAtMs || Date.now()),
        updatedAt: payload.updatedAt || new Date().toISOString()
      };
      const index = remoteDocs.findIndex((item) => item.expenseId === expenseId);
      if (index >= 0) remoteDocs[index] = tombstone;
      else remoteDocs.push(tombstone);
      return true;
    },
    async updateTripMeta(raw, meta) {
      calls.tripMeta.push(structuredClone(meta));
      invite = { ...invite, trip: { ...meta } };
      emitInvite();
      return true;
    },
    async disconnectInvite() {
      calls.disconnects += 1;
      invite = { ...invite, status: 'disconnected' };
      emitInvite();
      return true;
    }
  };

  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('momo-cloud-auth-change', { detail: { user: { ...user } } }));
  }, 0);
})();
`;

async function clickVisibleNav(page, name) {
  await page.evaluate((target) => {
    const elements = [...document.querySelectorAll(`[data-nav="${target}"]`)];
    const item = elements.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && style.visibility !== 'hidden' && style.display !== 'none';
    });
    if (!item) throw new Error(`No visible nav target for ${target}`);
    item.click();
  }, name);
}

async function dismissContextTip(page) {
  for (let i = 0; i < 5; i += 1) {
    const gotIt = page.getByRole('button', { name: /got it/i });
    if (await gotIt.count()) {
      const visible = gotIt.filter({ visible: true });
      if (await visible.count()) {
        await visible.first().click().catch(() => {});
        await page.waitForTimeout(80);
        continue;
      }
    }
    break;
  }
}

async function createContext(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block'
  });
  await context.addInitScript(() => {
    localStorage.setItem('momo_welcome_tour_complete_v1', 'yes');
    localStorage.setItem('momo_clean_start_v1', 'yes');
  });
  await context.route('**/firebase-momo.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: firebaseStub });
  });
  return context;
}

async function waitReady(page) {
  await page.waitForFunction(() => Boolean(window.MomoLocalTripShare && window.MomoTripSharing && window.MomoTripCloud), null, { timeout: 15000 });
  await page.waitForTimeout(250);
  await dismissContextTip(page);
}

async function seedOwner(page) {
  await page.evaluate(async () => {
    const trip = {
      id: 'trip-qa-japan',
      name: 'Japan October 2026',
      destination: 'Tokyo',
      startDate: '2026-10-18',
      endDate: '2026-10-25',
      budget: 200000,
      currency: 'PHP',
      dailyBudget: 0,
      notes: 'PRIVATE TRIP NOTE MUST NOT GO TO CLOUD',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    };
    await window.MomoLocalTripShare.upsertTrip(trip, { refresh: false });

    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('momo_database');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');

    for (let i = 0; i < 2500; i += 1) {
      const month = String((i % 8) + 1).padStart(2, '0');
      const day = String((i % 27) + 1).padStart(2, '0');
      store.put({
        id: `history-${i}`,
        type: 'expense',
        title: `History ${i}`,
        amount: 100 + (i % 500),
        currency: 'PHP',
        category: i % 2 ? 'Food & Drinks' : 'Shopping',
        otherCategory: '',
        budgetId: '',
        budgetName: '',
        paymentMethod: 'Cash',
        otherPaymentMethod: '',
        date: `2026-${month}-${day}`,
        location: '',
        notes: '',
        tags: [],
        photo: '',
        tripId: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      });
    }

    store.put({
      id: 'trip-existing-1', type: 'expense', title: 'Narita train', amount: 5200, currency: 'JPY',
      category: 'Transportation', otherCategory: '', budgetId: '', budgetName: '', paymentMethod: 'Credit Card',
      otherPaymentMethod: '', date: '2026-10-18', location: 'Narita', notes: 'NEX', tags: ['travel'],
      photo: 'data:image/png;base64,SECRET_RECEIPT_SHOULD_STAY_LOCAL', tripId: 'trip-qa-japan',
      createdAt: '2026-10-18T10:00:00.000Z', updatedAt: '2026-10-18T10:00:00.000Z'
    });
    store.put({
      id: 'trip-existing-2', type: 'expense', title: 'Konbini', amount: 980, currency: 'JPY',
      category: 'Food & Drinks', otherCategory: '', budgetId: '', budgetName: '', paymentMethod: 'Cash',
      otherPaymentMethod: '', date: '2026-10-18', location: 'Tokyo', notes: '', tags: [], photo: '',
      tripId: 'trip-qa-japan', createdAt: '2026-10-18T11:00:00.000Z', updatedAt: '2026-10-18T11:00:00.000Z'
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    await window.MomoLocalTripShare.refresh();
  });
}

async function ownerQA(browser) {
  const context = await createContext(browser);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${BASE}/?qaUser=owner`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await seedOwner(page);

  assert.equal(await page.evaluate(() => window.MomoLocalTripShare.getExpenses().length), 2502, 'Owner populated history should be 2,502 expenses');

  await clickVisibleNav(page, 'trips');
  await page.waitForTimeout(100);
  await dismissContextTip(page);

  const shareButton = page.locator('[data-trip-share-id="trip-qa-japan"]');
  await shareButton.waitFor({ state: 'visible' });
  const shareBox = await shareButton.boundingBox();
  assert.ok(shareBox && shareBox.width >= 30 && shareBox.height >= 30, 'Trip share control must be tappable');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'Trips must not overflow horizontally');

  await shareButton.click();
  await page.getByRole('button', { name: /create private invite/i }).click();
  await page.waitForFunction(() => document.querySelector('#tripShareInviteCode')?.textContent?.includes('MT1.'));
  assert.equal((await page.locator('#tripShareInviteCode').textContent()).trim(), CODE);
  assert.equal(await page.getByRole('button', { name: /share with martin/i }).isVisible(), true, 'Owner should have obvious Share with Martin action');

  await page.waitForFunction(() => window.__momoTripCloudCalls.upserts.length >= 2, null, { timeout: 5000 });
  const ownerSeed = await page.evaluate(() => structuredClone(window.__momoTripCloudCalls.upserts));
  assert.equal(ownerSeed.length, 2, 'Only the two existing trip expenses should seed to shared cloud');
  assert.ok(ownerSeed.every((item) => !('photo' in (item.expense || {}))), 'Receipt photos must never enter shared payload');
  assert.ok(ownerSeed.every((item) => !('paymentMethod' in (item.expense || {}))), 'Private payment methods must never enter shared payload');
  assert.ok(ownerSeed.every((item) => !JSON.stringify(item).includes('PRIVATE TRIP NOTE')), 'Private trip note must not enter shared payload');
  assert.ok(ownerSeed.every((item) => !String(item.expense?.title || '').startsWith('History ')), 'Non-trip history must never be shared');

  const sharedTrip = await page.evaluate(() => window.MomoLocalTripShare.getTrips().find((item) => item.id === 'trip-qa-japan'));
  assert.equal(sharedTrip.sharedTripRole, 'owner');
  assert.equal(sharedTrip.sharedTripCode, CODE);

  await page.locator('#closeTripShareModal').click();
  await context.setOffline(true);
  await page.locator('[data-trip-expense-id="trip-qa-japan"]').click();
  await page.waitForFunction(() => document.querySelector('[data-screen="add"]')?.classList.contains('active'));
  assert.equal(await page.locator('#expenseTrip').inputValue(), 'trip-qa-japan', 'Travel Add Expense must still preset the shared trip');
  await page.locator('#amount').fill('1280');
  await page.locator('#currency').selectOption('JPY');
  await page.locator('#expenseTitle').fill('Ramen offline');
  await page.locator('#expenseCategory').selectOption('Food & Drinks');
  await page.locator('#expenseForm button.primary-btn[type="submit"]').click();
  await page.waitForFunction(() => window.MomoLocalTripShare.getExpenses().some((item) => item.title === 'Ramen offline'));

  const offlineExpense = await page.evaluate(() => window.MomoLocalTripShare.getExpenses().find((item) => item.title === 'Ramen offline'));
  assert.equal(offlineExpense.sharedTripExpense, true, 'Offline shared trip expense must keep collaboration metadata locally');
  assert.equal(offlineExpense.sharedTripCode, CODE);
  const outboxText = await page.evaluate(() => localStorage.getItem('momo_shared_trip_outbox_v1') || '');
  assert.ok(outboxText.includes(offlineExpense.sharedExpenseId), 'Offline operation must be queued');
  assert.ok(!outboxText.includes('Ramen offline') && !outboxText.includes('1280'), 'Retry queue must not persist financial content in localStorage');

  await context.setOffline(false);
  await page.evaluate(() => window.MomoTripSharing.flushOutbox());
  await page.waitForFunction((id) => window.__momoTripCloudCalls.upserts.some((item) => item.expenseId === id), offlineExpense.sharedExpenseId);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('momo_shared_trip_outbox_v1') || '[]').length), 0, 'Outbox should clear after reconnect');

  const remoteBase = {
    schemaVersion: 1,
    expenseId: 'martin-remote-1',
    tripShareOwnerUid: OWNER_UID,
    tripShareToken: TOKEN,
    deleted: false,
    createdByUid: PARTNER_UID,
    createdByName: 'Martin',
    lastEditedByUid: PARTNER_UID,
    lastEditedByName: 'Martin',
    updatedAtMs: Date.now() + 1000,
    updatedAt: new Date().toISOString(),
    expense: {
      title: 'Martin sushi', amount: 1500, currency: 'JPY', category: 'Food & Drinks', otherCategory: '',
      date: '2026-10-19', location: 'Kamakura', notes: '', tags: [], createdAt: new Date().toISOString()
    }
  };

  const startRemote = Date.now();
  await page.evaluate((doc) => window.__momoTripCloudTest.emitExpenses([doc]), remoteBase);
  await page.waitForFunction(() => window.MomoLocalTripShare.getExpenses().some((item) => item.sharedExpenseId === 'martin-remote-1'));
  const remoteApplyMs = Date.now() - startRemote;
  const remoteLocal = await page.evaluate(() => window.MomoLocalTripShare.getExpenses().find((item) => item.sharedExpenseId === 'martin-remote-1'));
  assert.equal(remoteLocal.tripId, 'trip-qa-japan');
  assert.equal(remoteLocal.sharedCreatedByName, 'Martin');
  assert.equal(remoteLocal.paymentMethod, 'Cash', 'Partner private card/payment method must not be imported');
  assert.ok(remoteApplyMs < 1000, `Remote merge should stay responsive; took ${remoteApplyMs}ms`);

  await page.evaluate((doc) => window.__momoTripCloudTest.emitExpenses([{ ...doc, updatedAtMs: doc.updatedAtMs + 1000, expense: { ...doc.expense, amount: 1750 } }]), remoteBase);
  await page.waitForFunction(() => window.MomoLocalTripShare.getExpenses().find((item) => item.sharedExpenseId === 'martin-remote-1')?.amount === 1750);

  await page.evaluate((doc) => window.__momoTripCloudTest.emitExpenses([{ ...doc, deleted: true, updatedAtMs: doc.updatedAtMs + 3000 }]), remoteBase);
  await page.waitForFunction(() => !window.MomoLocalTripShare.getExpenses().some((item) => item.sharedExpenseId === 'martin-remote-1'));

  assert.deepEqual(errors, [], `Owner browser page errors: ${errors.join(' | ')}`);
  await context.close();
  return { remoteApplyMs };
}

async function partnerQA(browser) {
  const context = await createContext(browser);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${BASE}/?qaUser=partner`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await clickVisibleNav(page, 'trips');
  await dismissContextTip(page);

  const joinButton = page.locator('#joinSharedTripButton');
  await joinButton.waitFor({ state: 'visible' });
  const joinBox = await joinButton.boundingBox();
  assert.ok(joinBox && joinBox.width >= 38 && joinBox.height >= 38, 'Join shared trip control must be easy to tap');
  await joinButton.click();
  await page.locator('#tripShareJoinCode').fill(`Join us in Momo: ${CODE}`);
  await page.locator('#connectTripShare').click();
  await page.waitForFunction(() => window.MomoLocalTripShare.getTrips().some((item) => item.sharedTripCode === window.__momoTripCloudTest.code));

  const trip = await page.evaluate(() => window.MomoLocalTripShare.getTrips().find((item) => item.sharedTripCode === window.__momoTripCloudTest.code));
  assert.equal(trip.sharedTripRole, 'partner');
  assert.equal(trip.name, 'Japan October 2026');
  assert.equal(trip.budget, 200000);

  await page.evaluate((codeParts) => {
    window.__momoTripCloudTest.emitExpenses([{
      schemaVersion: 1,
      expenseId: 'owner-remote-1',
      tripShareOwnerUid: codeParts.owner,
      tripShareToken: codeParts.token,
      deleted: false,
      createdByUid: codeParts.owner,
      createdByName: 'Cha',
      lastEditedByUid: codeParts.owner,
      lastEditedByName: 'Cha',
      updatedAtMs: Date.now() + 1000,
      updatedAt: new Date().toISOString(),
      expense: {
        title: 'Cha train', amount: 5200, currency: 'JPY', category: 'Transportation', otherCategory: '',
        date: '2026-10-18', location: 'Narita', notes: '', tags: [], createdAt: new Date().toISOString()
      }
    }]);
  }, { owner: OWNER_UID, token: TOKEN });
  await page.waitForFunction(() => window.MomoLocalTripShare.getExpenses().some((item) => item.sharedExpenseId === 'owner-remote-1'));

  await clickVisibleNav(page, 'trips');
  await page.waitForTimeout(80);
  const partnerTripId = trip.id;
  await page.locator(`[data-trip-expense-id="${partnerTripId}"]`).click();
  await page.waitForFunction(() => document.querySelector('[data-screen="add"]')?.classList.contains('active'));
  assert.equal(await page.locator('#expenseTrip').inputValue(), partnerTripId);
  await page.locator('#amount').fill('850');
  await page.locator('#currency').selectOption('JPY');
  await page.locator('#expenseTitle').fill('Martin coffee');
  await page.locator('#expenseCategory').selectOption('Food & Drinks');
  await page.locator('#expenseForm button.primary-btn[type="submit"]').click();
  await page.waitForFunction(() => window.__momoTripCloudCalls.upserts.some((item) => item.expense?.title === 'Martin coffee'));
  const martinPayload = await page.evaluate(() => window.__momoTripCloudCalls.upserts.find((item) => item.expense?.title === 'Martin coffee'));
  assert.equal(martinPayload.createdByUid, PARTNER_UID);
  assert.ok(!('paymentMethod' in martinPayload.expense));
  assert.ok(!('photo' in martinPayload.expense));

  await clickVisibleNav(page, 'trips');
  await page.waitForTimeout(80);
  const shareIcon = page.locator(`[data-trip-share-id="${partnerTripId}"]`);
  assert.equal(await shareIcon.isVisible(), true);
  await page.locator(`[data-trip-id="${partnerTripId}"].edit-trip`).click();
  await page.waitForTimeout(80);
  assert.ok((await page.locator('#toast').textContent()).includes('Trip details are managed'), 'Partner should be kept in expense-collaboration scope');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'Partner Trips must not overflow horizontally');
  assert.deepEqual(errors, [], `Partner browser page errors: ${errors.join(' | ')}`);

  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  const owner = await ownerQA(browser);
  await partnerQA(browser);
  console.log(`PASS shared trip QA; 2,502 owner expenses; remote merge ${owner.remoteApplyMs}ms; owner + Martin flows passed`);
} finally {
  await browser.close();
}
