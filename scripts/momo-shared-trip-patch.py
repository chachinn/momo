from pathlib import Path
import re

# -------------------------------------------------
# app.js — tiny local-first collaboration hooks
# -------------------------------------------------
app_path = Path("app.js")
app = app_path.read_text()

if "MOMO SHARED TRIP LOCAL ADAPTER" not in app:
    card_anchor = '''          <div class="trip-entry-actions">\n\n            <button\n              class="trip-banner-btn edit-trip"'''
    card_replacement = '''          <div class="trip-entry-actions">\n\n            ${window.MomoTripSharing?.tripShareIconHTML?.(trip) || ""}\n\n            <button\n              class="trip-banner-btn edit-trip"'''
    if card_anchor not in app:
        raise SystemExit("Trip card actions anchor not found")
    app = app.replace(card_anchor, card_replacement, 1)

    # Trip save: preserve collaboration metadata and sync metadata after the local write.
    trip_start = app.index("// SAVE TRIP")
    trip_end = app.index("// TRIP DASHBOARD", trip_start)
    trip_block = app[trip_start:trip_end]
    if "    const trip = {" not in trip_block:
        raise SystemExit("Trip save object anchor not found")
    trip_block = trip_block.replace("    const trip = {", "    let trip = {", 1)
    trip_put_anchor = '''    };\n\n\n    await putRecord(\n      STORES.trips,\n      trip\n    );'''
    trip_put_replacement = '''    };\n\n\n    trip =\n      window.MomoTripSharing\n        ?.decorateTripBeforeSave\n        ?.(\n          trip,\n          previous\n        ) ||\n      trip;\n\n\n    await putRecord(\n      STORES.trips,\n      trip\n    );\n\n\n    const sharedTripMetaSync =\n      window.MomoTripSharing\n        ?.onTripSaved\n        ?.(\n          trip\n        );\n\n\n    sharedTripMetaSync\n      ?.catch\n      ?.(\n        (error) =>\n          console.warn(\n            "Shared trip metadata will retry later:",\n            error\n          )\n      );'''
    if trip_put_anchor not in trip_block:
        raise SystemExit("Trip putRecord anchor not found")
    trip_block = trip_block.replace(trip_put_anchor, trip_put_replacement, 1)
    app = app[:trip_start] + trip_block + app[trip_end:]

    # Main expense save only (do not touch recurring-generated expenses).
    expense_start = app.index("// SAVE EXPENSE")
    expense_end = app.index("// TRANSACTION RENDERING", expense_start)
    expense_block = app[expense_start:expense_end]
    if "    const expense = {" not in expense_block:
        raise SystemExit("Expense save object anchor not found")
    expense_block = expense_block.replace("    const expense = {", "    let expense = {", 1)
    expense_put_anchor = '''    };\n\n\n    await putRecord(\n      STORES.expenses,\n      expense\n    );'''
    expense_put_replacement = '''    };\n\n\n    expense =\n      window.MomoTripSharing\n        ?.decorateExpenseBeforeSave\n        ?.(\n          expense,\n          previous\n        ) ||\n      expense;\n\n\n    await putRecord(\n      STORES.expenses,\n      expense\n    );\n\n\n    const sharedExpenseSync =\n      window.MomoTripSharing\n        ?.onExpenseSaved\n        ?.(\n          expense,\n          previous\n        );\n\n\n    sharedExpenseSync\n      ?.catch\n      ?.(\n        (error) =>\n          console.warn(\n            "Shared trip expense will retry later:",\n            error\n          )\n      );'''
    if expense_put_anchor not in expense_block:
        raise SystemExit("Expense putRecord anchor not found")
    expense_block = expense_block.replace(expense_put_anchor, expense_put_replacement, 1)
    app = app[:expense_start] + expense_block + app[expense_end:]

    # Local delete first, then a non-blocking shared tombstone.
    delete_anchor = '''      await deleteRecord(\n        STORES.expenses,\n        expensePendingDelete\n      );\n\n\n      expensePendingDelete =\n        null;'''
    delete_replacement = '''      const deletedExpense =\n        expenses.find(\n          (item) =>\n            item.id ===\n            expensePendingDelete\n        ) ||\n        null;\n\n\n      await deleteRecord(\n        STORES.expenses,\n        expensePendingDelete\n      );\n\n\n      const sharedExpenseDeleteSync =\n        window.MomoTripSharing\n          ?.onExpenseDeleted\n          ?.(\n            deletedExpense\n          );\n\n\n      sharedExpenseDeleteSync\n        ?.catch\n        ?.(\n          (error) =>\n            console.warn(\n              "Shared trip expense deletion will retry later:",\n              error\n            )\n        );\n\n\n      expensePendingDelete =\n        null;'''
    if delete_anchor not in app:
        raise SystemExit("Expense delete anchor not found")
    app = app.replace(delete_anchor, delete_replacement, 1)

    app += '''\n\n\n// ========================================\n// MOMO SHARED TRIP LOCAL ADAPTER\n// Keeps collaboration outside the core finance database architecture.\n// ========================================\n\nwindow.MomoLocalTripShare = {\n  getTrips: () =>\n    trips.map(\n      (item) => ({\n        ...item\n      })\n    ),\n\n  getExpenses: () =>\n    expenses.map(\n      (item) => ({\n        ...item\n      })\n    ),\n\n  async upsertTrip(\n    record,\n    {\n      refresh = true\n    } = {}\n  ) {\n    await putRecord(\n      STORES.trips,\n      record\n    );\n\n    if (refresh) {\n      await loadAppData();\n      renderAll();\n    }\n  },\n\n  async upsertExpense(\n    record,\n    {\n      refresh = true\n    } = {}\n  ) {\n    await putRecord(\n      STORES.expenses,\n      record\n    );\n\n    if (refresh) {\n      await loadAppData();\n      renderAll();\n    }\n  },\n\n  async deleteExpense(\n    id,\n    {\n      refresh = true\n    } = {}\n  ) {\n    await deleteRecord(\n      STORES.expenses,\n      id\n    );\n\n    if (refresh) {\n      await loadAppData();\n      renderAll();\n    }\n  },\n\n  async refresh() {\n    await loadAppData();\n    renderAll();\n  },\n\n  refreshUI() {\n    renderAll();\n  },\n\n  toast: showToast\n};\n\nwindow.dispatchEvent(\n  new Event(\n    "momo-local-trip-share-ready"\n  )\n);\n'''

app_path.write_text(app)

# -------------------------------------------------
# trip-sharing.js — keep retry queue metadata-only
# -------------------------------------------------
share_path = Path("trip-sharing.js")
share = share_path.read_text()

queue_start = share.index("  function queueOperation(operation) {")
queue_end = share.index("  function permissionMessage(error) {", queue_start)
share = share[:queue_start] + '''  function queueOperation(operation) {\n    if (!operation?.code || !operation?.kind) return;\n    const outbox = readOutbox();\n    const key = `${operation.kind}:${operation.code}:${operation.expenseId || operation.tripId || "meta"}`;\n    const filtered = outbox.filter((item) => item.key !== key);\n\n    // Keep the persistent retry queue metadata-only. Titles, amounts and notes\n    // remain in IndexedDB; they are reconstructed only when a retry actually runs.\n    filtered.push({\n      key,\n      kind: operation.kind,\n      code: operation.code,\n      expenseId: operation.expenseId || "",\n      tripId: operation.tripId || "",\n      queuedAt: Date.now()\n    });\n\n    writeOutbox(filtered);\n  }\n\n'''+ share[queue_end:]

flush_start = share.index("  async function flushOutbox() {")
flush_end = share.index("  function stripShareFields(record) {", flush_start)
share = share[:flush_start] + '''  async function flushOutbox() {\n    if (flushInFlight || !navigator.onLine || !isSignedIn()) return;\n    const cloud = cloudApi();\n    const api = localApi();\n    if (!cloud?.upsertExpense || !cloud?.tombstoneExpense || !api) return;\n\n    flushInFlight = true;\n    try {\n      const pending = readOutbox();\n      if (!pending.length) return;\n      const remaining = [];\n\n      for (const item of pending) {\n        try {\n          if (item.kind === "expense") {\n            const expense = (api.getExpenses?.() || []).find(\n              (entry) =>\n                entry.sharedTripCode === item.code &&\n                (entry.sharedExpenseId || entry.id) === item.expenseId\n            );\n\n            if (expense?.sharedTripExpense) {\n              await cloud.upsertExpense(\n                item.code,\n                cloudExpensePayload(expense)\n              );\n            }\n          } else if (item.kind === "tombstone") {\n            await cloud.tombstoneExpense(\n              item.code,\n              item.expenseId,\n              {\n                updatedAtMs: Date.now(),\n                updatedAt: nowISO()\n              }\n            );\n          } else if (item.kind === "tripMeta") {\n            const trip = (api.getTrips?.() || []).find(\n              (entry) => entry.sharedTripCode === item.code\n            );\n            if (trip?.sharedTripRole === "owner") {\n              await cloud.updateTripMeta(\n                item.code,\n                tripMetaPayload(trip)\n              );\n            }\n          }\n        } catch (error) {\n          remaining.push(item);\n          maybeShowSyncError(error);\n        }\n      }\n\n      writeOutbox(remaining);\n    } finally {\n      flushInFlight = false;\n    }\n  }\n\n'''+ share[flush_end:]

save_start = share.index("  async function onExpenseSaved(expense, previous) {")
save_end = share.index("  function tripMetaPayload(trip) {", save_start)
share = share[:save_start] + '''  async function sendTombstoneOrQueue(expense) {\n    if (!expense?.sharedTripCode) return;\n    const code = expense.sharedTripCode;\n    const expenseId = expense.sharedExpenseId || expense.id;\n\n    if (navigator.onLine && isSignedIn()) {\n      try {\n        await cloudApi()?.tombstoneExpense?.(\n          code,\n          expenseId,\n          tombstonePayload(expense)\n        );\n        return;\n      } catch (error) {\n        maybeShowSyncError(error);\n      }\n    }\n\n    queueOperation({\n      kind: "tombstone",\n      code,\n      expenseId\n    });\n  }\n\n  async function onExpenseSaved(expense, previous) {\n    if (remoteApplyInFlight) return;\n\n    if (previous?.sharedTripCode && previous.sharedTripCode !== expense?.sharedTripCode) {\n      await sendTombstoneOrQueue(previous);\n    }\n\n    if (!expense?.sharedTripExpense || !expense?.sharedTripCode) return;\n\n    if (navigator.onLine && isSignedIn()) {\n      try {\n        await cloudApi()?.upsertExpense?.(\n          expense.sharedTripCode,\n          cloudExpensePayload(expense)\n        );\n        return;\n      } catch (error) {\n        maybeShowSyncError(error);\n      }\n    }\n\n    queueOperation({\n      kind: "expense",\n      code: expense.sharedTripCode,\n      expenseId: expense.sharedExpenseId || expense.id\n    });\n  }\n\n  async function onExpenseDeleted(expense) {\n    if (remoteApplyInFlight || !expense?.sharedTripCode) return;\n    await sendTombstoneOrQueue(expense);\n  }\n\n'''+ share[save_end:]

trip_save_start = share.index("  async function onTripSaved(trip) {")
trip_save_end = share.index("  function remoteLocalId", trip_save_start)
share = share[:trip_save_start] + '''  async function onTripSaved(trip) {\n    if (remoteApplyInFlight || trip?.sharedTripRole !== "owner" || !trip?.sharedTripCode) return;\n\n    if (navigator.onLine && isSignedIn()) {\n      try {\n        await cloudApi()?.updateTripMeta?.(\n          trip.sharedTripCode,\n          tripMetaPayload(trip)\n        );\n        return;\n      } catch (error) {\n        maybeShowSyncError(error);\n      }\n    }\n\n    queueOperation({\n      kind: "tripMeta",\n      code: trip.sharedTripCode,\n      tripId: trip.id\n    });\n  }\n\n'''+ share[trip_save_end:]

seed_start = share.index("  async function seedTripExpenses(trip) {")
seed_end = share.index("  async function detachShareLocally", seed_start)
share = share[:seed_start] + '''  async function seedTripExpenses(trip) {\n    const api = localApi();\n    if (!api || !trip?.sharedTripCode) return;\n    const candidates = (api.getExpenses?.() || []).filter((expense) => expense.tripId === trip.id);\n    let changed = false;\n\n    for (const expense of candidates) {\n      const decorated = decorateExpenseForTrip(expense, expense, trip);\n      await api.upsertExpense?.(decorated, { refresh: false });\n      queueOperation({\n        kind: "expense",\n        code: trip.sharedTripCode,\n        expenseId: decorated.sharedExpenseId || decorated.id\n      });\n      changed = true;\n    }\n\n    if (changed) await api.refresh?.();\n    flushOutbox().catch(() => {});\n  }\n\n'''+ share[seed_end:]

# Received shared trips are expense-collaboration spaces; the owner controls trip details.
edit_capture_anchor = '''      const deleteButton = event.target.closest?.(".delete-trip");\n        if (!deleteButton) return;'''
edit_capture_replacement = '''      const editButton = event.target.closest?.(".edit-trip");\n      if (editButton) {\n        const trip = getTripById(editButton.dataset.tripId);\n        if (trip?.sharedTripCode && trip.sharedTripRole === "partner") {\n          event.preventDefault();\n          event.stopImmediatePropagation();\n          localApi()?.toast?.("Trip details are managed by the person who shared it. You can update the trip expenses together.");\n          return;\n        }\n      }\n\n      const deleteButton = event.target.closest?.(".delete-trip");\n        if (!deleteButton) return;'''
if edit_capture_anchor not in share:
    raise SystemExit("Trip sharing edit/delete capture anchor not found")
share = share.replace(edit_capture_anchor, edit_capture_replacement, 1)

share_path.write_text(share)

# -------------------------------------------------
# firebase-momo.js — use PRIMARY Account & Cloud session only
# -------------------------------------------------
fb_path = Path("firebase-momo.js")
fb = fb_path.read_text()

if "MOMO SHARED TRIP CLOUD BRIDGE" not in fb:
    import_anchor = '''  query,\n  where\n} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";'''
    import_replacement = '''  query,\n  where,\n  onSnapshot\n} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";'''
    if import_anchor not in fb:
        raise SystemExit("Firestore import anchor not found")
    fb = fb.replace(import_anchor, import_replacement, 1)

    cloud_anchor = '''window.MomoPush = {\n  enable: enablePush,'''
    cloud_bridge = r'''// =====================================================
// MOMO SHARED TRIP CLOUD BRIDGE
// Uses the visible Account & Cloud auth session only. The anonymous
// momo-notifications session remains completely separate.
// =====================================================

const TRIP_SHARE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function tripShareBytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function tripShareBase64ToBytes(value) {
  const binary = atob(value || "");
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeTripShareUid(uid) {
  return tripShareBytesToBase64(
    new TextEncoder().encode(String(uid || ""))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeTripShareUid(encoded) {
  let value = String(encoded || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  while (value.length % 4) value += "=";
  return new TextDecoder().decode(
    tripShareBase64ToBytes(value)
  );
}

function cleanTripShareToken(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function generateTripShareToken() {
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (value) => TRIP_SHARE_ALPHABET[value % TRIP_SHARE_ALPHABET.length]
  ).join("");
}

function makeTripShareCode(ownerUid, token) {
  return `MT1.${encodeTripShareUid(ownerUid)}.${cleanTripShareToken(token)}`;
}

function normalizeTripShareInput(raw) {
  let value = String(raw || "")
    .trim()
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[。．]/g, ".");

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      value = parsed.searchParams.get("momoTrip") || parsed.searchParams.get("tripShare") || value;
    } catch {}
  }

  const embedded = value.match(/MT1\s*\.\s*([A-Za-z0-9_-]{6,})\s*\.\s*([A-Za-z0-9]{10,})/i);
  if (embedded) return `MT1.${embedded[1]}.${embedded[2]}`;
  return value.replace(/\s+/g, "");
}

function parseTripShareCode(raw) {
  const value = normalizeTripShareInput(raw);
  const parts = value.split(".");
  if (parts[0]?.toUpperCase() !== "MT1" || parts.length !== 3) {
    throw new Error("Momo could not find a complete shared-trip invite in what was pasted.");
  }

  let ownerUid = "";
  try {
    ownerUid = decodeTripShareUid(parts[1]);
  } catch {}
  const token = cleanTripShareToken(parts[2]);
  if (!ownerUid || token.length < 10) {
    throw new Error("That shared-trip invite is not valid. Copy it again directly from Momo.");
  }

  return {
    ownerUid,
    token,
    code: makeTripShareCode(ownerUid, token)
  };
}

function validateTripShareCode(raw) {
  try {
    const parsed = parseTripShareCode(raw);
    return {
      valid: true,
      ...parsed,
      message: "Valid Momo trip invite ✓"
    };
  } catch (error) {
    return {
      valid: false,
      message: String(error?.message || error || "Invalid Momo trip invite")
    };
  }
}

function requireTripShareUser() {
  if (!isRealAccountUser()) {
    throw new Error("Sign in to your Momo Account & Cloud profile first.");
  }
  return currentUser;
}

const tripInviteRef = (ownerUid, token) =>
  doc(cloudDb, "users", ownerUid, "momoTripInvites", token);

const tripSharedExpensesRef = (ownerUid, token) =>
  collection(cloudDb, "users", ownerUid, "momoTripShared", token, "expenses");

const tripSharedExpenseRef = (ownerUid, token, expenseId) =>
  doc(cloudDb, "users", ownerUid, "momoTripShared", token, "expenses", String(expenseId));

function publicTripShareUser(user = currentUser) {
  return isRealAccountUser(user)
    ? {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || ""
      }
    : null;
}

async function createTripShareInvite(trip = {}) {
  const user = requireTripShareUser();
  const token = generateTripShareToken();
  const code = makeTripShareCode(user.uid, token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const data = {
    schemaVersion: 1,
    status: "open",
    code,
    token,
    ownerUid: user.uid,
    ownerName: user.displayName || "",
    ownerEmail: user.email || "",
    partnerUid: "",
    partnerName: "",
    partnerEmail: "",
    trip: {
      name: String(trip.name || "Trip"),
      destination: String(trip.destination || ""),
      startDate: String(trip.startDate || ""),
      endDate: String(trip.endDate || ""),
      budget: Number(trip.budget || 0),
      currency: String(trip.currency || "PHP"),
      dailyBudget: Number(trip.dailyBudget || 0)
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt
  };

  await setDoc(tripInviteRef(user.uid, token), data);
  return data;
}

async function acceptTripShareInvite(rawCode) {
  const user = requireTripShareUser();
  const parsed = parseTripShareCode(rawCode);
  if (parsed.ownerUid === user.uid) {
    throw new Error("Open this trip invite on Martin’s Momo account, not the account that created it.");
  }

  const ref = tripInviteRef(parsed.ownerUid, parsed.token);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    throw new Error("This Momo trip invite no longer exists.");
  }

  const invite = snapshot.data() || {};
  if (invite.status === "active") {
    if (invite.partnerUid === user.uid) return { ...invite, ...parsed };
    throw new Error("This trip invite is already connected to another account.");
  }
  if (invite.status !== "open") {
    throw new Error("This Momo trip invite is no longer active.");
  }
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error("This trip invite has expired. Ask for a fresh invite from Momo.");
  }

  const accepted = {
    status: "active",
    partnerUid: user.uid,
    partnerName: user.displayName || "",
    partnerEmail: user.email || "",
    acceptedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(ref, accepted, { merge: true });
  return {
    ...invite,
    ...accepted,
    ...parsed
  };
}

function watchTripShareInvite(rawCode, callback) {
  requireTripShareUser();
  const parsed = parseTripShareCode(rawCode);
  return onSnapshot(
    tripInviteRef(parsed.ownerUid, parsed.token),
    (snapshot) => {
      callback?.(
        snapshot.exists()
          ? { ...snapshot.data(), ...parsed }
          : null
      );
    },
    (error) => {
      console.warn("Momo shared trip invite listener:", error);
    }
  );
}

function watchTripSharedExpenses(rawCode, callback) {
  requireTripShareUser();
  const parsed = parseTripShareCode(rawCode);
  return onSnapshot(
    tripSharedExpensesRef(parsed.ownerUid, parsed.token),
    (snapshot) => {
      callback?.({
        docs: snapshot.docs.map((item) => ({
          ...item.data(),
          expenseId: item.data()?.expenseId || item.id
        }))
      });
    },
    (error) => {
      console.warn("Momo shared trip expense listener:", error);
    }
  );
}

async function upsertTripSharedExpense(rawCode, payload = {}) {
  const user = requireTripShareUser();
  const parsed = parseTripShareCode(rawCode);
  const expenseId = String(payload.expenseId || "");
  if (!expenseId) throw new Error("This shared expense is missing its ID.");

  await setDoc(
    tripSharedExpenseRef(parsed.ownerUid, parsed.token, expenseId),
    {
      ...payload,
      schemaVersion: 1,
      expenseId,
      tripShareOwnerUid: parsed.ownerUid,
      tripShareToken: parsed.token,
      deleted: false,
      lastEditedByUid: user.uid,
      lastEditedByName: user.displayName || user.email || "Momo partner"
    }
  );
  return true;
}

async function tombstoneTripSharedExpense(rawCode, expenseId, payload = {}) {
  const user = requireTripShareUser();
  const parsed = parseTripShareCode(rawCode);
  const id = String(expenseId || "");
  if (!id) return false;

  await setDoc(
    tripSharedExpenseRef(parsed.ownerUid, parsed.token, id),
    {
      schemaVersion: 1,
      expenseId: id,
      tripShareOwnerUid: parsed.ownerUid,
      tripShareToken: parsed.token,
      deleted: true,
      lastEditedByUid: user.uid,
      lastEditedByName: user.displayName || user.email || "Momo partner",
      updatedAtMs: Number(payload.updatedAtMs || Date.now()),
      updatedAt: String(payload.updatedAt || new Date().toISOString()),
      createdByUid: String(payload.createdByUid || ""),
      createdByName: String(payload.createdByName || "")
    },
    { merge: true }
  );
  return true;
}

async function updateTripShareMeta(rawCode, trip = {}) {
  const user = requireTripShareUser();
  const parsed = parseTripShareCode(rawCode);
  if (user.uid !== parsed.ownerUid) return false;

  await setDoc(
    tripInviteRef(parsed.ownerUid, parsed.token),
    {
      trip: {
        name: String(trip.name || "Trip"),
        destination: String(trip.destination || ""),
        startDate: String(trip.startDate || ""),
        endDate: String(trip.endDate || ""),
        budget: Number(trip.budget || 0),
        currency: String(trip.currency || "PHP"),
        dailyBudget: Number(trip.dailyBudget || 0)
      },
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
  return true;
}

async function disconnectTripShare(rawCode) {
  const user = requireTripShareUser();
  const parsed = parseTripShareCode(rawCode);
  const ref = tripInviteRef(parsed.ownerUid, parsed.token);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return true;
  const invite = snapshot.data() || {};

  if (user.uid !== parsed.ownerUid && user.uid !== invite.partnerUid) {
    throw new Error("This Momo account is not part of that shared trip.");
  }

  const nextStatus = invite.status === "open" && user.uid === parsed.ownerUid
    ? "cancelled"
    : "disconnected";

  await setDoc(
    ref,
    {
      status: nextStatus,
      disconnectedAt: new Date().toISOString(),
      disconnectedBy: user.uid,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
  return true;
}

window.MomoTripCloud = {
  getUser: () => publicTripShareUser(),
  validateCode: validateTripShareCode,
  createInvite: createTripShareInvite,
  acceptInvite: acceptTripShareInvite,
  watchInvite: watchTripShareInvite,
  watchExpenses: watchTripSharedExpenses,
  upsertExpense: upsertTripSharedExpense,
  tombstoneExpense: tombstoneTripSharedExpense,
  updateTripMeta: updateTripShareMeta,
  disconnectInvite: disconnectTripShare
};

window.dispatchEvent(new Event("momo-trip-cloud-ready"));

'''
    if cloud_anchor not in fb:
        raise SystemExit("MomoPush anchor not found")
    fb = fb.replace(cloud_anchor, cloud_bridge + cloud_anchor, 1)

    auth_anchor = '''  onAuthStateChanged(auth, async (user) => {\n    currentUser = user;\n    cloudMetadata = null;'''
    auth_replacement = '''  onAuthStateChanged(auth, async (user) => {\n    currentUser = user;\n    cloudMetadata = null;\n\n    window.dispatchEvent(\n      new CustomEvent(\n        "momo-cloud-auth-change",\n        {\n          detail: {\n            user: publicTripShareUser(\n              user\n            )\n          }\n        }\n      )\n    );'''
    if auth_anchor not in fb:
        raise SystemExit("Primary auth state anchor not found")
    fb = fb.replace(auth_anchor, auth_replacement, 1)

fb_path.write_text(fb)

# -------------------------------------------------
# index.html — load the collaboration layer
# -------------------------------------------------
index_path = Path("index.html")
html = index_path.read_text()
if 'src="trip-sharing.js"' not in html:
    script_anchor = '''  <script src="app.js"></script>\n  <script type="module" src="firebase-momo.js"></script>'''
    script_replacement = '''  <script src="app.js"></script>\n  <script type="module" src="firebase-momo.js"></script>\n  <script src="trip-sharing.js"></script>'''
    if script_anchor not in html:
        raise SystemExit("Index app/firebase script anchor not found")
    html = html.replace(script_anchor, script_replacement, 1)
index_path.write_text(html)

# -------------------------------------------------
# styles.css — small, mobile-first sharing UI
# -------------------------------------------------
styles_path = Path("styles.css")
styles = styles_path.read_text()
if "MOMO SHARED TRIP EXPENSES" not in styles:
    styles += r'''

/* MOMO SHARED TRIP EXPENSES */
.trip-share-icon.is-shared {
  background: linear-gradient(135deg, rgba(255, 220, 232, 0.98), rgba(255, 238, 226, 0.98));
  border-color: rgba(222, 143, 155, 0.34);
  box-shadow: 0 4px 12px rgba(222, 143, 155, 0.16);
}

.trip-join-shared-btn {
  font-size: 16px;
}

.trip-share-modal .modal-card {
  width: min(92vw, 430px);
  max-height: min(82vh, 700px);
  overflow: auto;
}

.trip-share-card {
  padding-bottom: max(18px, env(safe-area-inset-bottom));
}

.trip-share-empty {
  padding: 18px 14px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(255, 249, 250, 0.98), rgba(255, 241, 238, 0.94));
  text-align: center;
}

.trip-share-empty.compact {
  padding: 14px;
  margin-bottom: 14px;
}

.trip-share-hero {
  margin-bottom: 7px;
  font-size: 28px;
}

.trip-share-empty h3,
.trip-share-state strong {
  margin: 0;
  color: var(--text);
}

.trip-share-empty p,
.trip-share-empty small,
.trip-share-state small,
.trip-share-status-text {
  color: var(--text-soft);
}

.trip-share-empty p {
  margin: 7px 0;
  font-size: 12px;
  line-height: 1.5;
}

.trip-share-empty small {
  display: block;
  font-size: 9px;
  line-height: 1.45;
}

.trip-share-connect {
  width: 100%;
  min-height: 50px;
  margin-top: 14px;
}

.trip-share-code-input {
  width: 100%;
  min-height: 76px;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: white;
  color: var(--text);
  resize: vertical;
  font: inherit;
}

.trip-share-state {
  display: grid;
  gap: 3px;
  margin-bottom: 14px;
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(255, 249, 247, 0.86);
}

.trip-share-state.is-active {
  border-color: rgba(121, 169, 133, 0.28);
  background: linear-gradient(145deg, rgba(247, 255, 249, 0.98), rgba(255, 247, 246, 0.92));
}

.trip-share-state > span {
  color: var(--rose);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.trip-share-state strong {
  font-size: 16px;
}

.trip-share-state small {
  font-size: 9px;
}

.trip-share-code-wrap {
  display: grid;
  gap: 6px;
  margin: 12px 0;
  padding: 12px;
  border-radius: 16px;
  background: var(--blush);
}

.trip-share-code-wrap > span {
  color: var(--text-soft);
  font-size: 9px;
}

.trip-share-code-wrap code {
  overflow-wrap: anywhere;
  color: var(--text);
  font-size: 11px;
  font-weight: 750;
  line-height: 1.45;
}

.trip-share-button-row {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 8px;
}

.trip-share-button-row > button {
  min-height: 46px;
  margin: 0;
}

.text-danger-btn {
  width: 100%;
  min-height: 42px;
  margin-top: 14px;
  border: 0;
  background: transparent;
  color: var(--danger);
  font: inherit;
  font-size: 10px;
  font-weight: 700;
}

.trip-share-status-text {
  min-height: 18px;
  margin: 8px 0 0;
  font-size: 9px;
}

@media (max-width: 390px) {
  .trip-share-button-row {
    grid-template-columns: 1fr;
  }
}
'''
styles_path.write_text(styles)

# -------------------------------------------------
# service-worker.js — offline shell includes collaboration module
# -------------------------------------------------
sw_path = Path("service-worker.js")
sw = sw_path.read_text()
if '"./trip-sharing.js"' not in sw:
    sw = sw.replace(
        '`momo-runtime-shell-v${APP_VERSION}-travel-compact-r1`',
        '`momo-runtime-shell-v${APP_VERSION}-shared-trip-r1`',
        1
    )
    shell_anchor = '''  "./firebase-momo.js",\n  "./smart-money.js"'''
    shell_replacement = '''  "./firebase-momo.js",\n  "./smart-money.js",\n  "./trip-sharing.js"'''
    if shell_anchor not in sw:
        raise SystemExit("Service worker shell anchor not found")
    sw = sw.replace(shell_anchor, shell_replacement, 1)
sw_path.write_text(sw)
