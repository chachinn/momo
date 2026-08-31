import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  signOut,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA_ilbegzsUstD2hp-94Ym2Hy82MIpPQ5U",
  authDomain: "momo-153f5.firebaseapp.com",
  projectId: "momo-153f5",
  storageBucket: "momo-153f5.firebasestorage.app",
  messagingSenderId: "203733258491",
  appId: "1:203733258491:web:8b25ca857bc57a4247205e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const cloudDb = getFirestore(app);

// Phone reminders intentionally use a SECOND Firebase app/auth session.
// This keeps Momo's invisible anonymous notification identity completely
// separate from the user's optional Google/email cloud-backup account.
const notificationApp = initializeApp(firebaseConfig, "momo-notifications");
const notificationAuth = getAuth(notificationApp);
const notificationDb = getFirestore(notificationApp);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });

const DB_NAME = "momo_database";
const MEDIA_KEYS = new Set([
  "photo",
  "photoData",
  "receiptData",
  "imageData",
  "wallpaperData",
  "tripShoppingPhotoData"
]);
const LOCAL_STORAGE_PREFIX = "momo_";

const MOMO_VAPID_PUBLIC_KEY = "BHl9Crz0RRKBkb6h-dNQ9r7mxeyXj_laLEgkO0B72uKdDHtb_uSp4Y8o9Fe_iTCxv8zlRZUqrRaZLdbBTlzg-Ck";
const PUSH_SUBSCRIPTION_COLLECTION = "pushSubscriptions";
const NOTIFICATION_QUEUE_COLLECTION = "notificationQueue";
const PENDING_PUSH_DELETIONS_KEY = "momo_pending_push_deletions_v1";
const LAST_PUSH_UID_KEY = "momo_last_push_uid";
const NOTIFICATION_AUTH_SEPARATED_KEY = "momo_notification_auth_separated_v1";

// Daily cloud backup uses the device's local time. A PWA cannot reliably wake
// from a fully closed state on every platform, so a missed 8:00 AM backup is
// caught up automatically when Momo next opens, resumes, or reconnects.
const CLOUD_AUTO_BACKUP_HOUR = 8;
const CLOUD_AUTO_BACKUP_MINUTE = 0;
const CLOUD_AUTO_BACKUP_KEY_PREFIX = "momo_cloud_auto_backup_v1";
const CLOUD_AUTO_BACKUP_RETRY_MS = 5 * 60 * 1000;

// Device-specific settings stay on this device even when the user signs in.
const DEVICE_LOCAL_SETTING_KEYS = new Set([
  "appearance_preferences"
]);

let currentUser = null;
let notificationUser = null;
let cloudMetadata = null;
let busy = false;
let legacyNotificationMigrationRunning = false;
let cloudAutoBackupTimer = null;
let cloudAutoBackupRunning = false;

const byId = (id) => document.getElementById(id);


function isRealAccountUser(user = currentUser) {
  return Boolean(user && !user.isAnonymous);
}

async function ensureNotificationIdentity() {
  if (notificationUser) return notificationUser;

  if (notificationAuth.currentUser) {
    notificationUser = notificationAuth.currentUser;
  } else {
    const credential = await signInAnonymously(notificationAuth);
    notificationUser = credential.user;
  }

  if (notificationUser?.uid) {
    localStorage.setItem(LAST_PUSH_UID_KEY, notificationUser.uid);
  }

  return notificationUser;
}

function toast(message) {
  const el = byId("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => el.classList.remove("show"), 2600);
}

function setStatus(message, tone = "neutral") {
  const status = byId("cloudAccountStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  document.querySelectorAll("[data-cloud-action]").forEach((button) => {
    button.disabled = nextBusy;
  });
}

function isMobileApplePwa() {
  const ua = navigator.userAgent || "";
  const appleMobile = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
  return appleMobile || standalone;
}

function openLocalDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function clearAndWriteStore(db, storeName, records) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    records.forEach((record) => store.put(record));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Restore transaction was aborted."));
  });
}

function sanitizeForCloud(value, key = "") {
  if (MEDIA_KEYS.has(key)) return "";
  if (Array.isArray(value)) return value.map((item) => sanitizeForCloud(item));
  if (value && typeof value === "object") {
    const output = {};
    Object.entries(value).forEach(([childKey, childValue]) => {
      output[childKey] = sanitizeForCloud(childValue, childKey);
    });
    return output;
  }
  return value;
}

function recordKey(record, index) {
  const raw = record?.id ?? record?.key ?? `record-${index}`;
  return encodeURIComponent(String(raw)).replaceAll(".", "%2E");
}

async function snapshotMomoData() {
  const db = await openLocalDatabase();
  try {
    const storeNames = Array.from(db.objectStoreNames);
    const stores = {};
    for (const storeName of storeNames) {
      const records = await readStore(db, storeName);
      const cloudRecords =
        storeName === "settings"
          ? records.filter((record) => !DEVICE_LOCAL_SETTING_KEYS.has(record?.key))
          : records;

      stores[storeName] = cloudRecords.map((record) => sanitizeForCloud(record));
    }
    return {
      stores,
      storeNames,
      omittedMedia: true,
      devicePreferencesLocalOnly: true
    };
  } finally {
    db.close();
  }
}

async function commitOperations(operations) {
  const CHUNK = 450;
  for (let start = 0; start < operations.length; start += CHUNK) {
    const batch = writeBatch(cloudDb);
    operations.slice(start, start + CHUNK).forEach((op) => {
      if (op.type === "delete") batch.delete(op.ref);
      else batch.set(op.ref, op.data);
    });
    await batch.commit();
  }
}

async function writeCurrentDeviceToCloud({ automatic = false } = {}) {
  if (!isRealAccountUser()) return false;

  const snapshot = await snapshotMomoData();
  const uid = currentUser.uid;
  const operations = [];

  for (const storeName of snapshot.storeNames) {
    const recordsRef = collection(cloudDb, "users", uid, "stores", storeName, "records");
    const existing = await getDocs(recordsRef);
    existing.forEach((cloudDoc) => operations.push({ type: "delete", ref: cloudDoc.ref }));

    snapshot.stores[storeName].forEach((record, index) => {
      operations.push({ type: "set", ref: doc(recordsRef, recordKey(record, index)), data: { payload: record } });
    });

    operations.push({
      type: "set",
      ref: doc(cloudDb, "users", uid, "stores", storeName),
      data: { count: snapshot.stores[storeName].length }
    });
  }

  await commitOperations(operations);

  const metadata = {
    email: currentUser.email || "",
    displayName: currentUser.displayName || "",
    updatedAt: serverTimestamp(),
    cloudBackupVersion: 1,
    storeNames: snapshot.storeNames,
    mediaPolicy: "local-only",
    devicePreferencesPolicy: "local-only"
  };

  if (automatic) {
    metadata.lastAutoBackupAt = serverTimestamp();
    metadata.autoBackupSchedule = "08:00-local";
    metadata.autoBackupTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }

  await setDoc(doc(cloudDb, "users", uid), metadata, { merge: true });
  await refreshCloudMetadata();
  return true;
}

async function uploadCloudBackup() {
  if (!isRealAccountUser() || busy || cloudAutoBackupRunning) return;
  const ok = window.confirm(
    "Replace your existing cloud copy with the Momo data currently on this device?\n\nThis overwrites the previous cloud backup. Receipt photos and custom wallpaper images stay on this device and are not uploaded."
  );
  if (!ok) return;

  setBusy(true);
  setStatus("Uploading your Momo…");
  try {
    await writeCurrentDeviceToCloud({ automatic: false });
    setStatus("Cloud backup updated", "success");
    toast("Momo cloud backup updated ☁️");
  } catch (error) {
    console.error("Momo cloud upload failed:", error);
    setStatus("Cloud backup failed", "error");
    toast("Could not upload Momo to cloud.");
  } finally {
    setBusy(false);
  }
}

async function readCloudStores(uid, storeNames) {
  const output = {};
  for (const storeName of storeNames) {
    const snapshot = await getDocs(collection(cloudDb, "users", uid, "stores", storeName, "records"));
    output[storeName] = snapshot.docs.map((item) => item.data()?.payload).filter(Boolean);
  }
  return output;
}

async function existingLocalPhotos(db) {
  if (!db.objectStoreNames.contains("expenses")) return new Map();
  const expenses = await readStore(db, "expenses");
  return new Map(expenses.filter((item) => item?.photo).map((item) => [String(item.id), item.photo]));
}

async function restoreCloudBackup() {
  if (!isRealAccountUser() || busy) return;

  // Login and restore are deliberately separate actions. Nothing is restored automatically.
  if (!cloudMetadata?.exists) {
    toast("There is no cloud backup to restore yet.");
    return;
  }

  const ok = window.confirm(
    "Replace this device's current Momo records with your cloud copy?\n\nThis overwrites the local database records on this device. Existing receipt photos are preserved when their expense still exists. If this device has newer changes, upload them first before restoring."
  );
  if (!ok) return;

  setBusy(true);
  setStatus("Restoring cloud backup…");
  try {
    const uid = currentUser.uid;
    const storeNames = Array.isArray(cloudMetadata.data?.storeNames) ? cloudMetadata.data.storeNames : [];
    const cloudStores = await readCloudStores(uid, storeNames);
    const db = await openLocalDatabase();

    try {
      const photoMap = await existingLocalPhotos(db);
      for (const storeName of storeNames) {
        if (!db.objectStoreNames.contains(storeName)) continue;
        let records = cloudStores[storeName] || [];
        if (storeName === "expenses") {
          records = records.map((record) => ({
            ...record,
            photo: photoMap.get(String(record.id)) || record.photo || ""
          }));
        }

        if (storeName === "settings") {
          const currentSettings = await readStore(db, "settings");
          const localOnly = currentSettings.filter((record) => DEVICE_LOCAL_SETTING_KEYS.has(record?.key));
          const cloudSafe = records.filter((record) => !DEVICE_LOCAL_SETTING_KEYS.has(record?.key));
          records = [...cloudSafe, ...localOnly];
        }

        await clearAndWriteStore(db, storeName, records);
      }
    } finally {
      db.close();
    }

    toast("Cloud copy restored. Device appearance and preferences were kept local. Reloading Momo…");

// Give Safari/iOS enough time to fully release IndexedDB
// after the restore transactions and database connection have closed.
window.setTimeout(() => {
  window.location.reload();
}, 2500);

  } catch (error) {
    console.error("Momo cloud restore failed:", error);
    setStatus("Restore failed", "error");
    toast("Could not restore the cloud backup.");
    setBusy(false);
  }
}

function formatCloudDate(data) {
  const timestamp = data?.updatedAt;
  if (!timestamp?.toDate) return "Not backed up yet";
  return timestamp.toDate().toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function refreshCloudMetadata() {
  if (!isRealAccountUser()) return;

  const copyStatus = byId("cloudCopyStatus");
  const last = byId("cloudLastBackup");
  const owner = byId("cloudBackupOwner");
  const restoreButton = byId("restoreCloudBackup");

  if (copyStatus) copyStatus.textContent = "Checking…";
  if (last) last.textContent = "Checking…";
  if (owner) owner.textContent = currentUser.email || currentUser.displayName || "This account";

  try {
    const snap = await getDoc(doc(cloudDb, "users", currentUser.uid));
    cloudMetadata = { exists: snap.exists(), data: snap.exists() ? snap.data() : null };

    if (copyStatus) copyStatus.textContent = snap.exists() ? "Cloud copy available ✓" : "No cloud copy yet";
    if (last) last.textContent = snap.exists() ? formatCloudDate(snap.data()) : "Not backed up yet";

    if (owner) {
      const data = snap.exists() ? snap.data() : null;
      owner.textContent = data?.email || data?.displayName || currentUser.email || currentUser.displayName || "This account";
    }

    if (restoreButton) restoreButton.disabled = !snap.exists();
  } catch (error) {
    console.error("Could not read cloud metadata:", error);
    if (copyStatus) copyStatus.textContent = "Could not check cloud copy";
    if (last) last.textContent = "Status unavailable";
  }
}


function localCloudBackupDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cloudAutoBackupStorageKey(user = currentUser) {
  return user?.uid ? `${CLOUD_AUTO_BACKUP_KEY_PREFIX}:${user.uid}` : "";
}

function cloudAutoBackupCompletedToday(user = currentUser, now = new Date()) {
  const key = cloudAutoBackupStorageKey(user);
  return Boolean(key && localStorage.getItem(key) === localCloudBackupDayKey(now));
}

function cloudAutoBackupDueTime(now = new Date()) {
  const due = new Date(now);
  due.setHours(CLOUD_AUTO_BACKUP_HOUR, CLOUD_AUTO_BACKUP_MINUTE, 0, 0);
  return due;
}

function clearCloudAutoBackupTimer() {
  if (cloudAutoBackupTimer) {
    window.clearTimeout(cloudAutoBackupTimer);
    cloudAutoBackupTimer = null;
  }
}

function scheduleCloudAutoBackupCheck(delayMs) {
  clearCloudAutoBackupTimer();
  cloudAutoBackupTimer = window.setTimeout(() => {
    cloudAutoBackupTimer = null;
    runCloudAutoBackupIfDue("timer").catch((error) => {
      console.warn("Momo daily cloud backup check failed:", error);
    });
  }, Math.max(1000, delayMs));
}

function scheduleDailyCloudBackup() {
  clearCloudAutoBackupTimer();
  if (!isRealAccountUser()) return;

  const now = new Date();
  const dueToday = cloudAutoBackupDueTime(now);
  const completedToday = cloudAutoBackupCompletedToday(currentUser, now);

  if (!completedToday && now >= dueToday) {
    scheduleCloudAutoBackupCheck(1200);
    return;
  }

  const next = new Date(dueToday);
  if (completedToday || now >= dueToday) next.setDate(next.getDate() + 1);
  scheduleCloudAutoBackupCheck(next.getTime() - now.getTime());
}

async function runCloudAutoBackupIfDue(trigger = "scheduled") {
  if (!isRealAccountUser()) {
    clearCloudAutoBackupTimer();
    return false;
  }

  const now = new Date();
  const dueToday = cloudAutoBackupDueTime(now);

  if (now < dueToday || cloudAutoBackupCompletedToday(currentUser, now)) {
    scheduleDailyCloudBackup();
    return false;
  }

  if (!navigator.onLine || busy || cloudAutoBackupRunning) {
    scheduleCloudAutoBackupCheck(60 * 1000);
    return false;
  }

  cloudAutoBackupRunning = true;
  setBusy(true);
  setStatus("Saving daily cloud backup…");
  let completed = false;

  try {
    await writeCurrentDeviceToCloud({ automatic: true });
    const key = cloudAutoBackupStorageKey(currentUser);
    if (key) localStorage.setItem(key, localCloudBackupDayKey(now));
    completed = true;
    setStatus("Daily cloud backup saved", "success");
    console.info(`Momo daily cloud backup completed (${trigger}).`);
    return true;
  } catch (error) {
    console.error("Momo daily cloud backup failed:", error);
    setStatus("Daily backup will retry", "error");
    scheduleCloudAutoBackupCheck(CLOUD_AUTO_BACKUP_RETRY_MS);
    return false;
  } finally {
    cloudAutoBackupRunning = false;
    setBusy(false);
    if (completed) scheduleDailyCloudBackup();
  }
}

function updateEmailVerificationUI(user) {
  const row = byId("cloudEmailVerificationRow");
  const status = byId("cloudEmailVerificationStatus");
  const resend = byId("cloudResendVerification");

  if (!row || !status || !resend) return;

  const hasPasswordProvider = user.providerData?.some((provider) => provider.providerId === "password");

  if (!hasPasswordProvider || !user.email) {
    row.hidden = true;
    resend.hidden = true;
    return;
  }

  row.hidden = false;

  if (user.emailVerified) {
    status.textContent = "✓ Email verified";
    status.dataset.tone = "success";
    resend.hidden = true;
  } else {
    status.textContent = "⚠ Email not verified";
    status.dataset.tone = "warning";
    resend.hidden = false;
  }
}

async function resendVerificationEmail() {
  if (!isRealAccountUser() || busy) return;

  if (currentUser.emailVerified) {
    toast("Your email is already verified.");
    updateEmailVerificationUI(currentUser);
    return;
  }

  setBusy(true);

  try {
    await sendEmailVerification(currentUser);
    toast("Verification email sent. Check your inbox or spam folder.");
  } catch (error) {
    console.error("Verification email could not be sent:", error);
    toast("Could not send the verification email yet.");
  } finally {
    setBusy(false);
  }
}

function showSignedOut() {
  byId("cloudSignedOut")?.removeAttribute("hidden");
  byId("cloudSignedIn")?.setAttribute("hidden", "");
  const drawerTitle = byId("drawerAccountTitle");
  const drawerSubtitle = byId("drawerAccountSubtitle");
  if (drawerTitle) drawerTitle.textContent = "Account & Cloud";
  if (drawerSubtitle) drawerSubtitle.textContent = "Using Momo on this device.";
  const verificationRow = byId("cloudEmailVerificationRow");
  if (verificationRow) verificationRow.hidden = true;
  setStatus("Local mode", "success");
}

function showSignedIn(user) {
  byId("cloudSignedOut")?.setAttribute("hidden", "");
  byId("cloudSignedIn")?.removeAttribute("hidden");

  const name = user.displayName || user.email || "Momo account";
  const email = user.email || "Google account";
  const avatar = byId("cloudAccountAvatar");
  if (avatar) avatar.textContent = name.trim().charAt(0).toUpperCase() || "🍑";
  if (byId("cloudAccountName")) byId("cloudAccountName").textContent = name;
  if (byId("cloudAccountEmail")) byId("cloudAccountEmail").textContent = email;
  if (byId("drawerAccountTitle")) byId("drawerAccountTitle").textContent = name;
  if (byId("drawerAccountSubtitle")) byId("drawerAccountSubtitle").textContent = "Auto backup daily · 8:00 AM";
  updateEmailVerificationUI(user);
  setStatus("Signed in · auto backup at 8:00 AM", "success");

  const copyStatus = byId("cloudCopyStatus");
  const last = byId("cloudLastBackup");
  const owner = byId("cloudBackupOwner");
  const restoreButton = byId("restoreCloudBackup");
  if (copyStatus) copyStatus.textContent = "Tap ↻ to check";
  if (last) last.textContent = "Not checked yet";
  if (owner) owner.textContent = user.email || user.displayName || "This account";
  if (restoreButton) restoreButton.disabled = true;
}

async function googleSignIn() {
  if (busy) return;

  setBusy(true);

  try {
    // The real account auth session is now completely separate from Momo's
    // anonymous phone-reminder identity, so Google can open immediately from
    // the user's tap with no anonymous-account linking/cleanup in the way.
    const signedIn = await signInWithPopup(auth, googleProvider);
    currentUser = signedIn.user;
    toast("Welcome to Momo 🍑");
  } catch (error) {
    console.error("Google sign-in failed:", error);

    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
      toast("Google sign-in was cancelled.");
    } else if (error.code === "auth/popup-blocked") {
      toast("Your browser blocked the Google sign-in window. Please allow pop-ups and try again.");
    } else if (error.code === "auth/unauthorized-domain") {
      toast("This Momo website is not yet authorized for Google sign-in in Firebase.");
    } else if (error.code === "auth/network-request-failed") {
      toast("Google sign-in could not reach Firebase. Check your connection and try again.");
    } else if (error.code === "auth/operation-not-allowed") {
      toast("Google sign-in is not enabled for this Firebase project.");
    } else {
      const code = String(error?.code || "unknown error").replace(/^auth\//, "");
      toast(`Google sign-in failed (${code}).`);
    }
  } finally {
    setBusy(false);
  }
}

async function emailSignIn(mode) {
  if (busy) return;
  const email = byId("cloudEmail")?.value.trim() || "";
  const password = byId("cloudPassword")?.value || "";
  if (!email || !password) {
    toast("Enter your email and password first.");
    return;
  }

  setBusy(true);
  try {
    if (mode === "create") {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      try { await sendEmailVerification(credential.user); } catch (error) { console.warn("Verification email could not be sent:", error); }
      toast("Account created. Check your email for verification.");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      toast("Welcome back to Momo 🍑");
    }
    if (byId("cloudPassword")) byId("cloudPassword").value = "";
  } catch (error) {
    console.error("Email authentication failed:", error);
    const friendly = {
      "auth/email-already-in-use": "That email already has a Momo account.",
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/weak-password": "Please use a stronger password.",
      "auth/invalid-email": "That email address does not look valid."
    }[error.code] || "Could not complete email sign-in.";
    toast(friendly);
  } finally {
    setBusy(false);
  }
}

async function resetPassword() {
  const email = byId("cloudEmail")?.value.trim() || window.prompt("Email address for your Momo account:")?.trim();
  if (!email) return;
  try {
    await sendPasswordResetEmail(auth, email);
    toast("Password reset email sent.");
  } catch (error) {
    console.error("Password reset failed:", error);
    toast("Could not send the reset email.");
  }
}

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isIosLike() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
}

async function getPushRegistration() {
  if (!("serviceWorker" in navigator)) throw new Error("This browser does not support Momo phone notifications.");
  return navigator.serviceWorker.ready;
}

async function currentPushSubscription() {
  try {
    const registration = await getPushRegistration();
    return registration.pushManager?.getSubscription?.() || null;
  } catch {
    return null;
  }
}

async function savePushSubscription(subscription) {
  const owner = await ensureNotificationIdentity();
  if (!owner) throw new Error("Momo could not create a notification identity on this phone.");

  const json = subscription.toJSON();
  const id = await sha256Text(json.endpoint || subscription.endpoint);
  await setDoc(doc(notificationDb, "users", owner.uid, PUSH_SUBSCRIPTION_COLLECTION, id), {
    endpoint: json.endpoint || subscription.endpoint,
    keys: json.keys || {},
    userAgent: navigator.userAgent || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    notificationOnly: true,
    updatedAt: serverTimestamp()
  }, { merge: true });

  localStorage.setItem(LAST_PUSH_UID_KEY, owner.uid);
  return id;
}

async function enablePush() {
  if (!("Notification" in window) || !("PushManager" in window)) {
    if (isIosLike() && !isStandalonePwa()) {
      throw new Error("On iPhone, install Momo to your Home Screen first, then enable notifications inside the installed app.");
    }
    throw new Error("Phone notifications are not supported by this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications were not allowed. You can change this in your phone settings.");
  }

  const registration = await getPushRegistration();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(MOMO_VAPID_PUBLIC_KEY)
    });
  }

  // Notification auth is deliberately separate from Account & Cloud auth.
  await ensureNotificationIdentity();
  await savePushSubscription(subscription);
  await flushPendingPushDeletions();
  return subscription;
}

async function clearLegacyPrimaryNotificationOwnership(uid) {
  if (!uid) return true;

  let queueCleared = true;
  let subscriptionDetached = true;
  const subscription = await currentPushSubscription();

  if (subscription) {
    try {
      const json = subscription.toJSON();
      const id = await sha256Text(json.endpoint || subscription.endpoint);
      await deleteDoc(doc(cloudDb, "users", uid, PUSH_SUBSCRIPTION_COLLECTION, id));
    } catch (error) {
      subscriptionDetached = false;
      console.warn("Could not detach the legacy notification subscription:", error);
    }
  }

  try {
    const queueQuery = query(
      collection(cloudDb, NOTIFICATION_QUEUE_COLLECTION),
      where("uid", "==", uid)
    );
    const snapshot = await getDocs(queueQuery);
    const results = await Promise.allSettled(snapshot.docs.map((item) => deleteDoc(item.ref)));
    queueCleared = results.every((result) => result.status === "fulfilled");
  } catch (error) {
    queueCleared = false;
    console.warn("Could not clear the legacy notification queue:", error);
  }

  return queueCleared && subscriptionDetached;
}

async function migrateLegacyPrimaryNotificationOwnership(user) {
  if (!user || legacyNotificationMigrationRunning) return false;
  legacyNotificationMigrationRunning = true;

  try {
    const subscription = await currentPushSubscription();
    const cleaned = await clearLegacyPrimaryNotificationOwnership(user.uid);

    // Do not abandon the old UID while it still owns queue entries, otherwise
    // those entries could continue sending duplicate reminders. Retry online.
    if (!cleaned) {
      console.warn("Momo will retry the one-time notification identity migration later.");
      return false;
    }

    // Anonymous users existed only for the old notification implementation.
    // Real Google/email users stay signed in; only their old push ownership moves.
    if (user.isAnonymous) {
      await signOut(auth);
    }

    if (subscription && Notification.permission === "granted") {
      await ensureNotificationIdentity();
      await savePushSubscription(subscription);
    }

    localStorage.setItem(NOTIFICATION_AUTH_SEPARATED_KEY, "yes");
    window.dispatchEvent(new Event("momo-push-ready"));
    return true;
  } finally {
    legacyNotificationMigrationRunning = false;
  }
}

async function disablePush() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  const json = subscription.toJSON();
  const id = await sha256Text(json.endpoint || subscription.endpoint);
  const owner = notificationUser || notificationAuth.currentUser;
  if (owner) {
    try {
      await deleteDoc(doc(notificationDb, "users", owner.uid, PUSH_SUBSCRIPTION_COLLECTION, id));
    } catch (error) {
      console.warn("Could not remove cloud push subscription:", error);
    }
  }
  await subscription.unsubscribe();
}

function readPendingPushDeletions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_PUSH_DELETIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingPushDeletions(items) {
  localStorage.setItem(PENDING_PUSH_DELETIONS_KEY, JSON.stringify(items));
}

function rememberPendingPushDeletion(uid, type, id) {
  if (!uid || !type || !id) return;
  const items = readPendingPushDeletions();
  if (!items.some((item) => item.uid === uid && item.type === type && item.id === id)) {
    items.push({ uid, type, id });
    writePendingPushDeletions(items);
  }
}

function forgetPendingPushDeletion(uid, type, id) {
  const items = readPendingPushDeletions().filter(
    (item) => !(item.uid === uid && item.type === type && item.id === id)
  );
  writePendingPushDeletions(items);
}

async function flushPendingPushDeletions() {
  const owner = notificationUser || notificationAuth.currentUser;
  if (!owner) return;
  const uid = owner.uid;
  const items = readPendingPushDeletions();
  const remaining = [];

  for (const item of items) {
    if (item.uid !== uid) {
      remaining.push(item);
      continue;
    }

    const queueId = `${uid}__${item.type}__${item.id}`;
    try {
      await deleteDoc(doc(notificationDb, NOTIFICATION_QUEUE_COLLECTION, queueId));
    } catch (error) {
      remaining.push(item);
      console.warn("Could not finish a pending Momo reminder deletion:", error);
    }
  }

  writePendingPushDeletions(remaining);
}

function reminderDueAt(item, type) {
  const dateString = type === "recurring" ? item.nextDueDate : (type === "custom" || type === "gentle") ? item.date : item.targetDate;
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute] = String(item.remindTime || "09:00").split(":").map(Number);
  const due = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
  due.setDate(due.getDate() - Number(item.remindDaysBefore || 0));
  return due.toISOString();
}

async function syncReminder(type, item) {
  if (!item?.id) return false;

  if (!item.phoneReminder) {
    await deleteReminder(type, item.id);
    return false;
  }

  const existingSubscription = await currentPushSubscription();
  if (!existingSubscription || Notification.permission !== "granted") return false;

  const owner = await ensureNotificationIdentity();
  if (!owner) return false;

  const subscription = existingSubscription;
  await savePushSubscription(subscription);

  const dateString = type === "recurring" ? item.nextDueDate : (type === "custom" || type === "gentle") ? item.date : item.targetDate;
  if (!dateString) return false;
  const queueId = `${owner.uid}__${type}__${item.id}`;
  forgetPendingPushDeletion(owner.uid, type, item.id);
  const title = type === "recurring" ? (item.name || "Recurring expense") : (type === "custom" || type === "gentle") ? (item.title || "Reminder") : (item.title || "Planned expense");
  const amount = Number(item.amount || 0);
  const currency = item.currency || "PHP";

  await setDoc(doc(notificationDb, NOTIFICATION_QUEUE_COLLECTION, queueId), {
    uid: owner.uid,
    localId: item.id,
    type,
    title,
    amount,
    currency,
    note: (type === "custom" || type === "gentle") ? (item.note || "") : "",
    repeat: type === "custom" ? (item.repeat || "none") : "none",
    dueDate: dateString,
    remindDaysBefore: Number(item.remindDaysBefore || 0),
    remindTime: item.remindTime || "09:00",
    dueAt: reminderDueAt(item, type),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    enabled: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return true;
}

async function deleteReminder(type, id) {
  if (!id) return false;

  const owner = notificationUser || notificationAuth.currentUser;
  const uid =
    owner?.uid ||
    localStorage.getItem(LAST_PUSH_UID_KEY) ||
    "";

  if (!uid) return false;

  if (!owner || owner.uid !== uid) {
    rememberPendingPushDeletion(uid, type, id);
    return false;
  }

  const queueId = `${uid}__${type}__${id}`;

  try {
    await deleteDoc(doc(notificationDb, NOTIFICATION_QUEUE_COLLECTION, queueId));
    forgetPendingPushDeletion(uid, type, id);
    return true;
  } catch (error) {
    rememberPendingPushDeletion(uid, type, id);
    throw error;
  }
}

async function getPushStatus() {
  if (isIosLike() && !isStandalonePwa()) {
    return { enabled: false, message: "On iPhone, open the installed Home Screen version of Momo to enable notifications." };
  }
  if (!("Notification" in window) || !("PushManager" in window)) {
    return { enabled: false, message: "This browser does not support phone notifications." };
  }
  if (Notification.permission === "denied") {
    return { enabled: false, message: "Notifications are blocked in your phone settings." };
  }

  const subscription = await currentPushSubscription();
  return subscription
    ? { enabled: true, message: "Notifications are enabled on this phone. No Momo account is required; only reminders you switch on will alert you." }
    : { enabled: false, message: "Optional. No account needed. Enable alerts on this phone, then choose which Gentle Reminders may notify you." };
}

// =====================================================
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
    throw new Error("Open this trip invite on your travel partner’s Momo account, not the account that created it.");
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

window.MomoPush = {
  enable: enablePush,
  disable: disablePush,
  getStatus: getPushStatus,
  syncReminder,
  deleteReminder
};
window.dispatchEvent(new Event("momo-push-ready"));

function bindEvents() {
  byId("googleCloudSignIn")?.addEventListener("click", googleSignIn);
  byId("emailCloudSignIn")?.addEventListener("click", () => emailSignIn("signin"));
  byId("emailCloudCreate")?.addEventListener("click", () => emailSignIn("create"));
  byId("cloudForgotPassword")?.addEventListener("click", resetPassword);
  byId("cloudResendVerification")?.addEventListener("click", resendVerificationEmail);
  byId("uploadCloudBackup")?.addEventListener("click", uploadCloudBackup);
  byId("restoreCloudBackup")?.addEventListener("click", restoreCloudBackup);
  byId("refreshCloudStatus")?.addEventListener("click", async () => {
    if (isRealAccountUser()) {
      try {
        await reload(currentUser);
        currentUser = auth.currentUser;
        if (currentUser) {
          showSignedIn(currentUser);
        }
      } catch (error) {
        console.warn("Could not refresh account verification state:", error);
      }
    }
    await refreshCloudMetadata();
  });
  byId("cloudSignOut")?.addEventListener("click", async () => {
    if (!window.confirm("Sign out of your Momo account? Your local Momo data will stay on this device.")) {
      return;
    }

    await signOut(auth);
    toast("Signed out. Local Momo data and your selected phone reminders stay on this device.");
  });
}

async function init() {
  bindEvents();
  setBusy(true);

  try {
    await Promise.all([
      setPersistence(auth, browserLocalPersistence),
      setPersistence(notificationAuth, browserLocalPersistence)
    ]);
  } catch (error) {
    console.warn("Could not set Firebase auth persistence:", error);
  }

  onAuthStateChanged(notificationAuth, async (user) => {
    notificationUser = user;

    if (user?.uid) {
      localStorage.setItem(LAST_PUSH_UID_KEY, user.uid);
      try {
        await flushPendingPushDeletions();
      } catch (error) {
        console.warn("Could not flush pending phone reminder deletions:", error);
      }
    }

    window.dispatchEvent(new Event("momo-push-ready"));
  });

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    cloudMetadata = null;

    window.dispatchEvent(
      new CustomEvent(
        "momo-cloud-auth-change",
        {
          detail: {
            user: publicTripShareUser(
              user
            )
          }
        }
      )
    );

    // One-time migration for older notification builds. Push ownership used to
    // share the Account & Cloud Auth instance. Move it to the dedicated hidden
    // notification Auth instance so Google/email login can never conflict again.
    if (user && localStorage.getItem(NOTIFICATION_AUTH_SEPARATED_KEY) !== "yes") {
      if (user.isAnonymous) showSignedOut();
      else showSignedIn(user);

      try {
        const migrated = await migrateLegacyPrimaryNotificationOwnership(user);
        if (!migrated) setBusy(false);
      } catch (error) {
        console.warn("Could not migrate the old Momo notification ownership:", error);
        setBusy(false);
      }

      if (user.isAnonymous) return;
    }

    if (!user) {
      clearCloudAutoBackupTimer();
      showSignedOut();
    } else if (!user.isAnonymous) {
      showSignedIn(user);
    }

    setBusy(false);

    if (isRealAccountUser(user)) {
      refreshCloudMetadata().catch((error) => {
        console.warn("Could not refresh cloud status after sign-in:", error);
      });
      scheduleDailyCloudBackup();
    }
  });

  // If this device already has a Web Push subscription but the new dedicated
  // notification Auth session has not been created yet, create it quietly.
  try {
    const subscription = await currentPushSubscription();
    if (subscription && Notification.permission === "granted") {
      await ensureNotificationIdentity();
      await savePushSubscription(subscription);
    }
  } catch (error) {
    console.warn("Could not initialize Momo phone reminder identity:", error);
  }
}

window.addEventListener("online", () => {
  if (currentUser && localStorage.getItem(NOTIFICATION_AUTH_SEPARATED_KEY) !== "yes") {
    migrateLegacyPrimaryNotificationOwnership(currentUser).catch((error) => {
      console.warn("Could not retry legacy notification ownership migration:", error);
    });
  }

  flushPendingPushDeletions().catch((error) => {
    console.warn("Could not flush Momo reminder deletions after reconnecting:", error);
  });

  if (isRealAccountUser()) {
    runCloudAutoBackupIfDue("online").catch((error) => {
      console.warn("Could not run Momo daily backup after reconnecting:", error);
    });
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isRealAccountUser()) {
    runCloudAutoBackupIfDue("resume").catch((error) => {
      console.warn("Could not run Momo daily backup after resume:", error);
    });
  }
});

init();