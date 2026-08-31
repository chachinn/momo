/* =====================================================
   MOMO 🍑 Shared Trip Expenses
   Local-first, per-trip collaboration only.
   No account-wide finance sync; no receipt/photo sharing.
   ===================================================== */

(() => {
  "use strict";

  const OUTBOX_KEY = "momo_shared_trip_outbox_v1";
  const SHARE_SCHEMA = 1;
  const REMOTE_PREFIX = "shared-trip";
  const SHARE_FIELDS = [
    "sharedTripExpense",
    "sharedTripCode",
    "sharedTripToken",
    "sharedTripOwnerUid",
    "sharedTripRole",
    "sharedExpenseId",
    "sharedCreatedByUid",
    "sharedCreatedByName",
    "sharedUpdatedAtMs",
    "sharedUpdatedAt"
  ];
  const TRIP_SHARE_FIELDS = [
    "sharedTripCode",
    "sharedTripToken",
    "sharedTripOwnerUid",
    "sharedTripRole",
    "sharedTripStatus",
    "sharedPartnerUid",
    "sharedPartnerName",
    "sharedPartnerEmail",
    "sharedTripCreatedAt"
  ];

  const expenseWatchStops = new Map();
  const inviteWatchStops = new Map();
  let remoteApplyInFlight = false;
  let flushInFlight = false;
  let lastPermissionToastAt = 0;

  const localApi = () => window.MomoLocalTripShare || null;
  const cloudApi = () => window.MomoTripCloud || null;

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function currentUser() {
    return cloudApi()?.getUser?.() || null;
  }

  function isSignedIn() {
    return Boolean(currentUser()?.uid);
  }

  function readOutbox() {
    try {
      const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeOutbox(items) {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-500)));
    } catch (error) {
      console.warn("Momo shared trip outbox could not be saved:", error);
    }
  }

  function queueOperation(operation) {
    if (!operation?.code || !operation?.kind) return;
    const outbox = readOutbox();
    const key = `${operation.kind}:${operation.code}:${operation.expenseId || operation.tripId || "meta"}`;
    const filtered = outbox.filter((item) => item.key !== key);

    // Keep the persistent retry queue metadata-only. Titles, amounts and notes
    // remain in IndexedDB; they are reconstructed only when a retry actually runs.
    filtered.push({
      key,
      kind: operation.kind,
      code: operation.code,
      expenseId: operation.expenseId || "",
      tripId: operation.tripId || "",
      queuedAt: Date.now()
    });

    writeOutbox(filtered);
  }

  function permissionMessage(error) {
    const code = String(error?.code || "").toLowerCase();
    const text = String(error?.message || error || "");
    if (code.includes("permission-denied") || /missing or insufficient permissions/i.test(text)) {
      return "Trip sharing is waiting for the Momo Firestore sharing rules to be published.";
    }
    return "Shared trip changes will retry when Momo can reach the cloud.";
  }

  function maybeShowSyncError(error) {
    const now = Date.now();
    if (now - lastPermissionToastAt < 15000) return;
    lastPermissionToastAt = now;
    localApi()?.toast?.(permissionMessage(error));
  }

  async function flushOutbox() {
    if (flushInFlight || !navigator.onLine || !isSignedIn()) return;
    const cloud = cloudApi();
    const api = localApi();
    if (!cloud?.upsertExpense || !cloud?.tombstoneExpense || !api) return;

    flushInFlight = true;
    try {
      const pending = readOutbox();
      if (!pending.length) return;
      const remaining = [];

      for (const item of pending) {
        try {
          if (item.kind === "expense") {
            const expense = (api.getExpenses?.() || []).find(
              (entry) =>
                entry.sharedTripCode === item.code &&
                (entry.sharedExpenseId || entry.id) === item.expenseId
            );

            if (expense?.sharedTripExpense) {
              await cloud.upsertExpense(
                item.code,
                cloudExpensePayload(expense)
              );
            }
          } else if (item.kind === "tombstone") {
            await cloud.tombstoneExpense(
              item.code,
              item.expenseId,
              {
                updatedAtMs: Date.now(),
                updatedAt: nowISO()
              }
            );
          } else if (item.kind === "tripMeta") {
            const trip = (api.getTrips?.() || []).find(
              (entry) => entry.sharedTripCode === item.code
            );
            if (trip?.sharedTripRole === "owner") {
              await cloud.updateTripMeta(
                item.code,
                tripMetaPayload(trip)
              );
            }
          }
        } catch (error) {
          remaining.push(item);
          maybeShowSyncError(error);
        }
      }

      writeOutbox(remaining);
    } finally {
      flushInFlight = false;
    }
  }

  function stripShareFields(record) {
    const output = { ...(record || {}) };
    SHARE_FIELDS.forEach((key) => delete output[key]);
    return output;
  }

  function stripTripShareFields(record) {
    const output = { ...(record || {}) };
    TRIP_SHARE_FIELDS.forEach((key) => delete output[key]);
    return output;
  }

  function getTripById(id) {
    return localApi()?.getTrips?.().find((trip) => trip.id === id) || null;
  }

  function getTripByCode(code) {
    return localApi()?.getTrips?.().find((trip) => trip.sharedTripCode === code) || null;
  }

  function shareMetaForTrip(trip) {
    if (!trip?.sharedTripCode || !trip?.sharedTripToken || !trip?.sharedTripOwnerUid) return null;
    return {
      code: trip.sharedTripCode,
      token: trip.sharedTripToken,
      ownerUid: trip.sharedTripOwnerUid,
      role: trip.sharedTripRole || "owner",
      status: trip.sharedTripStatus || "open"
    };
  }

  function decorateTripBeforeSave(trip, previous) {
    if (!previous?.sharedTripCode) return trip;
    const output = { ...trip };
    TRIP_SHARE_FIELDS.forEach((key) => {
      if (previous[key] !== undefined) output[key] = previous[key];
    });
    return output;
  }

  function decorateExpenseForTrip(expense, previous, trip) {
    const share = shareMetaForTrip(trip);
    if (!share) return stripShareFields(expense);

    const user = currentUser();
    const sameShare = previous?.sharedTripCode === share.code;
    const clean = stripShareFields(expense);
    return {
      ...clean,
      sharedTripExpense: true,
      sharedTripCode: share.code,
      sharedTripToken: share.token,
      sharedTripOwnerUid: share.ownerUid,
      sharedTripRole: share.role,
      sharedExpenseId:
        sameShare && previous?.sharedExpenseId
          ? previous.sharedExpenseId
          : expense.id,
      sharedCreatedByUid:
        sameShare && previous?.sharedCreatedByUid
          ? previous.sharedCreatedByUid
          : user?.uid || "",
      sharedCreatedByName:
        sameShare && previous?.sharedCreatedByName
          ? previous.sharedCreatedByName
          : user?.displayName || user?.email || "Momo partner",
      sharedUpdatedAtMs: Date.now(),
      sharedUpdatedAt: nowISO()
    };
  }

  function decorateExpenseBeforeSave(expense, previous) {
    const trip = getTripById(expense?.tripId);
    return decorateExpenseForTrip(expense, previous, trip);
  }

  function cloudExpensePayload(expense) {
    const user = currentUser();
    return {
      schemaVersion: SHARE_SCHEMA,
      expenseId: expense.sharedExpenseId || expense.id,
      tripShareOwnerUid: expense.sharedTripOwnerUid,
      tripShareToken: expense.sharedTripToken,
      deleted: false,
      createdByUid: expense.sharedCreatedByUid || user?.uid || "",
      createdByName: expense.sharedCreatedByName || user?.displayName || user?.email || "Momo partner",
      lastEditedByUid: user?.uid || "",
      lastEditedByName: user?.displayName || user?.email || "Momo partner",
      updatedAtMs: Number(expense.sharedUpdatedAtMs || Date.now()),
      updatedAt: expense.sharedUpdatedAt || nowISO(),
      expense: {
        title: String(expense.title || ""),
        amount: Number(expense.amount || 0),
        currency: String(expense.currency || "PHP"),
        category: String(expense.category || "Other"),
        otherCategory: String(expense.otherCategory || ""),
        date: String(expense.date || ""),
        location: String(expense.location || ""),
        notes: String(expense.notes || ""),
        tags: Array.isArray(expense.tags) ? expense.tags.map(String).slice(0, 20) : [],
        createdAt: String(expense.createdAt || nowISO())
      }
    };
  }

  function tombstonePayload(expense) {
    const user = currentUser();
    return {
      schemaVersion: SHARE_SCHEMA,
      expenseId: expense.sharedExpenseId || expense.id,
      tripShareOwnerUid: expense.sharedTripOwnerUid,
      tripShareToken: expense.sharedTripToken,
      deleted: true,
      createdByUid: expense.sharedCreatedByUid || "",
      createdByName: expense.sharedCreatedByName || "",
      lastEditedByUid: user?.uid || "",
      lastEditedByName: user?.displayName || user?.email || "Momo partner",
      updatedAtMs: Date.now(),
      updatedAt: nowISO()
    };
  }

  async function sendTombstoneOrQueue(expense) {
    if (!expense?.sharedTripCode) return;
    const code = expense.sharedTripCode;
    const expenseId = expense.sharedExpenseId || expense.id;

    if (navigator.onLine && isSignedIn()) {
      try {
        await cloudApi()?.tombstoneExpense?.(
          code,
          expenseId,
          tombstonePayload(expense)
        );
        return;
      } catch (error) {
        maybeShowSyncError(error);
      }
    }

    queueOperation({
      kind: "tombstone",
      code,
      expenseId
    });
  }

  async function onExpenseSaved(expense, previous) {
    if (remoteApplyInFlight) return;

    if (previous?.sharedTripCode && previous.sharedTripCode !== expense?.sharedTripCode) {
      await sendTombstoneOrQueue(previous);
    }

    if (!expense?.sharedTripExpense || !expense?.sharedTripCode) return;

    if (navigator.onLine && isSignedIn()) {
      try {
        await cloudApi()?.upsertExpense?.(
          expense.sharedTripCode,
          cloudExpensePayload(expense)
        );
        return;
      } catch (error) {
        maybeShowSyncError(error);
      }
    }

    queueOperation({
      kind: "expense",
      code: expense.sharedTripCode,
      expenseId: expense.sharedExpenseId || expense.id
    });
  }

  async function onExpenseDeleted(expense) {
    if (remoteApplyInFlight || !expense?.sharedTripCode) return;
    await sendTombstoneOrQueue(expense);
  }

  function tripMetaPayload(trip) {
    return {
      name: String(trip.name || "Trip"),
      destination: String(trip.destination || ""),
      startDate: String(trip.startDate || ""),
      endDate: String(trip.endDate || ""),
      budget: Number(trip.budget || 0),
      currency: String(trip.currency || "PHP"),
      dailyBudget: Number(trip.dailyBudget || 0),
      updatedAt: nowISO()
    };
  }

  async function onTripSaved(trip) {
    if (remoteApplyInFlight || trip?.sharedTripRole !== "owner" || !trip?.sharedTripCode) return;

    if (navigator.onLine && isSignedIn()) {
      try {
        await cloudApi()?.updateTripMeta?.(
          trip.sharedTripCode,
          tripMetaPayload(trip)
        );
        return;
      } catch (error) {
        maybeShowSyncError(error);
      }
    }

    queueOperation({
      kind: "tripMeta",
      code: trip.sharedTripCode,
      tripId: trip.id
    });
  }

  function remoteLocalId(trip, sharedExpenseId) {
    return `${REMOTE_PREFIX}-${trip.sharedTripToken}-${sharedExpenseId}`;
  }

  function remoteToLocalExpense(remote, trip, existing) {
    const data = remote?.expense || {};
    const sharedExpenseId = String(remote?.expenseId || "");
    const localId = existing?.id || remoteLocalId(trip, sharedExpenseId);
    return {
      ...(existing || {}),
      id: localId,
      type: "expense",
      title: String(data.title || ""),
      amount: Number(data.amount || 0),
      currency: String(data.currency || "PHP"),
      category: String(data.category || "Other"),
      otherCategory: String(data.otherCategory || ""),
      budgetId: "",
      budgetName: "",
      paymentMethod: existing?.paymentMethod || "Cash",
      otherPaymentMethod: existing?.otherPaymentMethod || "",
      date: String(data.date || ""),
      location: String(data.location || ""),
      notes: String(data.notes || ""),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      photo: existing?.photo || "",
      tripId: trip.id,
      sourceRecurringId: "",
      settlementShared: false,
      createdAt: String(data.createdAt || existing?.createdAt || nowISO()),
      updatedAt: String(remote.updatedAt || nowISO()),
      sharedTripExpense: true,
      sharedTripCode: trip.sharedTripCode,
      sharedTripToken: trip.sharedTripToken,
      sharedTripOwnerUid: trip.sharedTripOwnerUid,
      sharedTripRole: trip.sharedTripRole || "partner",
      sharedExpenseId,
      sharedCreatedByUid: String(remote.createdByUid || ""),
      sharedCreatedByName: String(remote.createdByName || "Momo partner"),
      sharedUpdatedAtMs: Number(remote.updatedAtMs || 0),
      sharedUpdatedAt: String(remote.updatedAt || nowISO())
    };
  }

  async function applyRemoteExpenses(trip, docs) {
    const api = localApi();
    if (!api || !trip?.sharedTripCode) return;
    const allExpenses = api.getExpenses?.() || [];
    const bySharedId = new Map(
      allExpenses
        .filter((expense) => expense.sharedTripCode === trip.sharedTripCode && expense.sharedExpenseId)
        .map((expense) => [expense.sharedExpenseId, expense])
    );

    remoteApplyInFlight = true;
    let changed = false;
    try {
      for (const remote of docs || []) {
        const sharedExpenseId = String(remote?.expenseId || "");
        if (!sharedExpenseId) continue;
        const existing = bySharedId.get(sharedExpenseId) || null;
        const remoteTime = Number(remote.updatedAtMs || 0);
        const localTime = Number(existing?.sharedUpdatedAtMs || 0);
        if (existing && localTime > remoteTime) continue;

        if (remote.deleted) {
          if (existing) {
            await api.deleteExpense?.(existing.id, { refresh: false });
            changed = true;
          }
          continue;
        }

        const record = remoteToLocalExpense(remote, trip, existing);
        await api.upsertExpense?.(record, { refresh: false });
        bySharedId.set(sharedExpenseId, record);
        changed = true;
      }
    } finally {
      remoteApplyInFlight = false;
    }

    if (changed) await api.refresh?.();
  }

  async function updateTripFromInvite(trip, invite) {
    const api = localApi();
    if (!api || !trip || !invite) return;

    if (invite.status === "disconnected" || invite.status === "cancelled") {
      await detachShareLocally(trip);
      api.toast?.("Trip sharing ended. Your local trip history is still here.");
      return;
    }

    const partnerUid = trip.sharedTripRole === "owner" ? invite.partnerUid || "" : invite.ownerUid || "";
    const partnerName = trip.sharedTripRole === "owner"
      ? invite.partnerName || invite.partnerEmail || ""
      : invite.ownerName || invite.ownerEmail || "";
    const partnerEmail = trip.sharedTripRole === "owner" ? invite.partnerEmail || "" : invite.ownerEmail || "";
    const meta = invite.trip || {};
    const next = {
      ...trip,
      ...(trip.sharedTripRole === "partner"
        ? {
            name: meta.name || trip.name,
            destination: meta.destination || trip.destination,
            startDate: meta.startDate || trip.startDate,
            endDate: meta.endDate || trip.endDate,
            budget: Number(meta.budget ?? trip.budget ?? 0),
            currency: meta.currency || trip.currency,
            dailyBudget: Number(meta.dailyBudget ?? trip.dailyBudget ?? 0)
          }
        : {}),
      sharedTripStatus: invite.status || trip.sharedTripStatus || "open",
      sharedPartnerUid: partnerUid,
      sharedPartnerName: partnerName,
      sharedPartnerEmail: partnerEmail
    };

    const materiallyChanged = JSON.stringify(next) !== JSON.stringify(trip);
    if (materiallyChanged) await api.upsertTrip?.(next, { refresh: true });
  }

  function stopWatchers(code) {
    try { expenseWatchStops.get(code)?.(); } catch {}
    try { inviteWatchStops.get(code)?.(); } catch {}
    expenseWatchStops.delete(code);
    inviteWatchStops.delete(code);
  }

  function watchTrip(trip) {
    const cloud = cloudApi();
    const code = trip?.sharedTripCode;
    if (!cloud || !code || !isSignedIn()) return;

    stopWatchers(code);

    try {
      const stopInvite = cloud.watchInvite?.(code, (invite) => {
        const currentTrip = getTripByCode(code);
        if (currentTrip && invite) updateTripFromInvite(currentTrip, invite).catch(console.warn);
      });
      if (typeof stopInvite === "function") inviteWatchStops.set(code, stopInvite);

      const stopExpenses = cloud.watchExpenses?.(code, (payload) => {
        const currentTrip = getTripByCode(code);
        if (currentTrip) applyRemoteExpenses(currentTrip, payload?.docs || []).catch(console.warn);
      });
      if (typeof stopExpenses === "function") expenseWatchStops.set(code, stopExpenses);
    } catch (error) {
      maybeShowSyncError(error);
    }
  }

  function watchAllSharedTrips() {
    if (!isSignedIn()) return;
    (localApi()?.getTrips?.() || [])
      .filter((trip) => trip.sharedTripCode && trip.sharedTripStatus !== "disconnected")
      .forEach(watchTrip);
  }

  async function seedTripExpenses(trip) {
    const api = localApi();
    if (!api || !trip?.sharedTripCode) return;
    const candidates = (api.getExpenses?.() || []).filter((expense) => expense.tripId === trip.id);
    let changed = false;

    for (const expense of candidates) {
      const decorated = decorateExpenseForTrip(expense, expense, trip);
      await api.upsertExpense?.(decorated, { refresh: false });
      queueOperation({
        kind: "expense",
        code: trip.sharedTripCode,
        expenseId: decorated.sharedExpenseId || decorated.id
      });
      changed = true;
    }

    if (changed) await api.refresh?.();
    flushOutbox().catch(() => {});
  }

  async function detachShareLocally(trip) {
    const api = localApi();
    if (!api || !trip?.sharedTripCode) return;
    const code = trip.sharedTripCode;
    stopWatchers(code);

    const nextTrip = stripTripShareFields(trip);
    await api.upsertTrip?.(nextTrip, { refresh: false });

    const sharedExpenses = (api.getExpenses?.() || []).filter((expense) => expense.sharedTripCode === code);
    for (const expense of sharedExpenses) {
      await api.upsertExpense?.(stripShareFields(expense), { refresh: false });
    }
    await api.refresh?.();
  }

  function ensureModal() {
    if (document.getElementById("tripShareModal")) return;
    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div id="tripShareModal" class="modal-backdrop trip-share-modal" hidden>
          <div class="modal-card trip-share-card" role="dialog" aria-modal="true" aria-labelledby="tripShareTitle">
            <div class="modal-header">
              <div>
                <p class="eyebrow">Together on the trip</p>
                <h2 id="tripShareTitle">Share Trip Expenses</h2>
              </div>
              <button id="closeTripShareModal" class="icon-btn soft" type="button" aria-label="Close">×</button>
            </div>
            <div id="tripShareBody"></div>
          </div>
        </div>
      `
    );

    const modal = document.getElementById("tripShareModal");
    document.getElementById("closeTripShareModal")?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
  }

  function closeModal() {
    const modal = document.getElementById("tripShareModal");
    if (modal) modal.hidden = true;
  }

  function signedOutHTML() {
    return `
      <div class="trip-share-empty">
        <div class="trip-share-hero">💕</div>
        <h3>Sign in on both phones first</h3>
        <p>Trip collaboration uses each person’s own Momo Account & Cloud login. Your normal Momo data stays local and private.</p>
        <small>Only the trip you explicitly share and its expense entries are sent to the shared space.</small>
      </div>
    `;
  }

  function inviteCodeHTML(code) {
    return `
      <div class="trip-share-code-wrap">
        <span>Private invite</span>
        <code id="tripShareInviteCode">${escapeHTML(code)}</code>
      </div>
      <div class="trip-share-button-row">
        <button id="copyTripShareCode" class="secondary-btn" type="button">Copy invite</button>
        <button id="sendTripShareCode" class="primary-btn" type="button">Share invite</button>
      </div>
    `;
  }

  async function copyInvite(code) {
    try {
      await navigator.clipboard.writeText(code);
      localApi()?.toast?.("Trip invite copied 💕");
    } catch {
      window.prompt("Copy this Momo trip invite:", code);
    }
  }

  async function sendInvite(code, trip) {
    const text = `Join my ${trip.name || "Momo"} trip expenses in Momo. Open Trips, tap 💕, then paste this invite:\n\n${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Momo shared trip", text });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    await copyInvite(code);
  }

  function bindInviteButtons(code, trip) {
    document.getElementById("copyTripShareCode")?.addEventListener("click", () => copyInvite(code));
    document.getElementById("sendTripShareCode")?.addEventListener("click", () => sendInvite(code, trip));
  }

  async function createShareForTrip(trip) {
    const cloud = cloudApi();
    const api = localApi();
    if (!cloud || !api || !isSignedIn()) return;

    try {
      const invite = await cloud.createInvite(tripMetaPayload(trip));
      const nextTrip = {
        ...trip,
        sharedTripCode: invite.code,
        sharedTripToken: invite.token,
        sharedTripOwnerUid: invite.ownerUid,
        sharedTripRole: "owner",
        sharedTripStatus: invite.status || "open",
        sharedPartnerUid: invite.partnerUid || "",
        sharedPartnerName: invite.partnerName || "",
        sharedPartnerEmail: invite.partnerEmail || "",
        sharedTripCreatedAt: nowISO()
      };
      await api.upsertTrip?.(nextTrip, { refresh: true });
      await seedTripExpenses(nextTrip);
      watchTrip(nextTrip);
      openTripModal(nextTrip);
    } catch (error) {
      console.error("Could not create Momo trip invite:", error);
      maybeShowSyncError(error);
    }
  }

  function openTripModal(trip) {
    ensureModal();
    const modal = document.getElementById("tripShareModal");
    const title = document.getElementById("tripShareTitle");
    const body = document.getElementById("tripShareBody");
    if (!modal || !title || !body) return;
    modal.hidden = false;
    title.textContent = trip ? `Share ${trip.name || "Trip"}` : "Join a Shared Trip";

    if (!isSignedIn()) {
      body.innerHTML = signedOutHTML();
      return;
    }

    if (!trip) {
      body.innerHTML = `
        <div class="trip-share-empty compact">
          <div class="trip-share-hero">✈️💕</div>
          <h3>Join a trip</h3>
          <p>Paste the private Momo invite from your travel partner.</p>
        </div>
        <label class="form-label" for="tripShareJoinCode">Trip invite</label>
        <textarea id="tripShareJoinCode" class="trip-share-code-input" rows="3" placeholder="MT1.…"></textarea>
        <button id="connectTripShare" class="primary-btn trip-share-connect" type="button">Connect this trip</button>
        <p id="tripShareJoinStatus" class="trip-share-status-text"></p>
      `;
      document.getElementById("connectTripShare")?.addEventListener("click", connectFromInput);
      return;
    }

    if (!trip.sharedTripCode) {
      body.innerHTML = `
        <div class="trip-share-empty compact">
          <div class="trip-share-hero">💕</div>
          <h3>Share only this trip</h3>
          <p>Your travel partner will be able to add, edit and delete expenses linked to <strong>${escapeHTML(trip.name)}</strong>. Both phones will see the same trip spending total.</p>
          <small>Other expenses, cards, payables, savings, Smart Money history, receipts and settings stay private.</small>
        </div>
        <button id="createTripShareInvite" class="primary-btn trip-share-connect" type="button">Create private invite</button>
      `;
      document.getElementById("createTripShareInvite")?.addEventListener("click", () => createShareForTrip(trip));
      return;
    }

    const partner = trip.sharedPartnerName || trip.sharedPartnerEmail || "your partner";
    const active = trip.sharedTripStatus === "active";
    body.innerHTML = `
      <div class="trip-share-state ${active ? "is-active" : ""}">
        <span>${active ? "Connected" : "Invite ready"}</span>
        <strong>${active ? `💕 ${escapeHTML(partner)}` : "Waiting for your partner"}</strong>
        <small>${active ? "Trip expenses update on both phones." : "Send the invite below. Nothing else in Momo is shared."}</small>
      </div>
      ${inviteCodeHTML(trip.sharedTripCode)}
      <button id="stopTripSharing" class="text-danger-btn" type="button">${active ? "Stop sharing this trip" : "Cancel this invite"}</button>
    `;
    bindInviteButtons(trip.sharedTripCode, trip);
    document.getElementById("stopTripSharing")?.addEventListener("click", () => stopSharing(trip));
  }

  async function connectFromInput() {
    const codeInput = document.getElementById("tripShareJoinCode");
    const status = document.getElementById("tripShareJoinStatus");
    const raw = codeInput?.value || "";
    const cloud = cloudApi();
    const api = localApi();
    if (!cloud || !api) return;

    const validation = cloud.validateCode?.(raw) || { valid: false, message: "That invite is not valid." };
    if (!validation.valid) {
      if (status) status.textContent = validation.message || "That invite is not valid.";
      return;
    }

    try {
      if (status) status.textContent = "Connecting…";
      const invite = await cloud.acceptInvite(raw);
      const existing = getTripByCode(invite.code);
      const meta = invite.trip || {};
      const trip = {
        ...(existing || {}),
        id: existing?.id || `${REMOTE_PREFIX}-${invite.token}`,
        name: meta.name || "Shared Trip",
        destination: meta.destination || "",
        startDate: meta.startDate || "",
        endDate: meta.endDate || meta.startDate || "",
        budget: Number(meta.budget || 0),
        currency: meta.currency || "PHP",
        dailyBudget: Number(meta.dailyBudget || 0),
        notes: existing?.notes || "",
        createdAt: existing?.createdAt || nowISO(),
        updatedAt: nowISO(),
        sharedTripCode: invite.code,
        sharedTripToken: invite.token,
        sharedTripOwnerUid: invite.ownerUid,
        sharedTripRole: "partner",
        sharedTripStatus: "active",
        sharedPartnerUid: invite.ownerUid,
        sharedPartnerName: invite.ownerName || invite.ownerEmail || "Trip owner",
        sharedPartnerEmail: invite.ownerEmail || "",
        sharedTripCreatedAt: nowISO()
      };
      await api.upsertTrip?.(trip, { refresh: true });
      watchTrip(trip);
      closeModal();
      api.toast?.(`Connected to ${trip.name} 💕`);
    } catch (error) {
      console.error("Could not join Momo shared trip:", error);
      if (status) status.textContent = String(error?.message || "Could not connect this trip.");
      maybeShowSyncError(error);
    }
  }

  async function stopSharing(trip) {
    const cloud = cloudApi();
    if (!cloud || !trip?.sharedTripCode) return;
    const label = trip.sharedTripStatus === "active" ? "Stop sharing this trip? Both phones will keep their local trip history, but future changes will no longer sync." : "Cancel this trip invite?";
    if (!window.confirm(label)) return;

    try {
      await cloud.disconnectInvite(trip.sharedTripCode);
      await detachShareLocally(trip);
      closeModal();
      localApi()?.toast?.("Trip sharing stopped. Local expenses were kept.");
    } catch (error) {
      console.error("Could not stop Momo trip sharing:", error);
      maybeShowSyncError(error);
    }
  }

  function tripShareIconHTML(trip) {
    const active = Boolean(trip?.sharedTripCode);
    const partner = trip?.sharedPartnerName || trip?.sharedPartnerEmail || "partner";
    const label = active
      ? `Trip expenses shared${trip.sharedTripStatus === "active" ? ` with ${partner}` : "; invite pending"}`
      : "Share trip expenses";
    return `
      <button
        class="trip-banner-btn trip-share-icon${active ? " is-shared" : ""}"
        type="button"
        data-trip-share-id="${escapeHTML(trip?.id || "")}"
        aria-label="${escapeHTML(label)}"
        title="${escapeHTML(label)}"
      >💕</button>
    `;
  }

  function injectJoinButton() {
    const heading = document.querySelector('[data-screen="trips"] .page-heading-actions');
    if (!heading || document.getElementById("joinSharedTripButton")) return;
    const button = document.createElement("button");
    button.id = "joinSharedTripButton";
    button.className = "context-help-btn trip-join-shared-btn";
    button.type = "button";
    button.setAttribute("aria-label", "Join a shared trip");
    button.title = "Join a shared trip";
    button.textContent = "💕";
    heading.insertBefore(button, document.getElementById("addTripButton") || null);
  }

  function bindGlobalEvents() {
    document.addEventListener("click", (event) => {
      const shareButton = event.target.closest?.("[data-trip-share-id]");
      if (shareButton) {
        event.preventDefault();
        const trip = getTripById(shareButton.dataset.tripShareId);
        if (trip) openTripModal(trip);
        return;
      }

      if (event.target.closest?.("#joinSharedTripButton")) {
        event.preventDefault();
        openTripModal(null);
      }
    });

    document.addEventListener(
      "click",
      (event) => {
        const editButton = event.target.closest?.(".edit-trip");
      if (editButton) {
        const trip = getTripById(editButton.dataset.tripId);
        if (trip?.sharedTripCode && trip.sharedTripRole === "partner") {
          event.preventDefault();
          event.stopImmediatePropagation();
          localApi()?.toast?.("Trip details are managed by the person who shared it. You can update the trip expenses together.");
          return;
        }
      }

      const deleteButton = event.target.closest?.(".delete-trip");
        if (!deleteButton) return;
        const trip = getTripById(deleteButton.dataset.tripId);
        if (!trip?.sharedTripCode) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        localApi()?.toast?.("Stop sharing this trip before deleting it, so neither phone loses the collaboration unexpectedly.");
      },
      true
    );

    window.addEventListener("online", () => {
      flushOutbox().catch(() => {});
      watchAllSharedTrips();
    });

    window.addEventListener("momo-cloud-auth-change", () => {
      flushOutbox().catch(() => {});
      watchAllSharedTrips();
      localApi()?.refreshUI?.();
    });
  }

  async function init() {
    ensureModal();
    injectJoinButton();
    bindGlobalEvents();
    localApi()?.refreshUI?.();
    watchAllSharedTrips();
    flushOutbox().catch(() => {});
  }

  window.MomoTripSharing = {
    decorateTripBeforeSave,
    decorateExpenseBeforeSave,
    onExpenseSaved,
    onExpenseDeleted,
    onTripSaved,
    tripShareIconHTML,
    openTripModal,
    flushOutbox,
    watchAllSharedTrips
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
