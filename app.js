// ========================================
// MOMO
// Momo 1.11.0 — Smart Money + Local Intelligence
// CLEAN FOUNDATION + FUNCTIONAL TRIPS
// ========================================


// ========================================
// DATABASE
// ========================================

const DB_NAME = "momo_database";

const DB_VERSION = 4;


const STORES = {

  expenses: "expenses",

  budgets: "budgets",

  trips: "trips",

  cards: "cards",


  recurring: "recurring",

  planned: "planned",


  settings: "settings"

};


let db = null;


// ========================================
// STATE
// ========================================

let expenses = [];

let budgets = [];

let trips = [];

let cards = [];


let recurringExpenses = [];


let plannedExpenses = [];


let favoriteExpenses = [];


const MONTHLY_INCOME_SETTING_KEY =
  "monthly_income";


let monthlyIncomeByMonth = {};


const SAVINGS_GOALS_SETTING_KEY =
  "savings_goals";


let savingsGoals = [];


let selectedSavingsGoalId =
  "";


const PAYDAY_PLAN_SETTING_KEY =
  "payday_plan_v1";

const PAYDAY_PLAN_DEFAULTS = {
  nextPayday: "",
  expectedAmount: 0,
  bills: 0,
  savings: 0,
  payables: 0,
  wants: 0,
  notes: ""
};

let paydayPlan = {
  ...PAYDAY_PLAN_DEFAULTS
};


const TRIP_SHOPPING_SETTING_KEY =
  "trip_shopping_lists";


let tripShoppingItems = [];


let tripShoppingPhotoData =
  "";


let tripShoppingPhotoPromise =
  null;


const TRAVEL_SETTLEMENT_SETTING_KEY =
  "travel_settlements";

const DAILY_LIFE_SETTLEMENT_ID =
  "__momo_daily_life__";


const SETTLEMENT_CATEGORY_PREFIX =
  "__momo_category__";


function isSettlementCategoryId(
  id
) {

  return String(
    id ||
    ""
  ).startsWith(
    SETTLEMENT_CATEGORY_PREFIX
  );

}



let travelSettlements = [];


let activeSettlementTripId =
  "";


let editingSharedExpenseId =
  "";


let plannedPendingDelete =
  null;


let pendingPlannedConversionId =
  "";


let pendingRecurringLogId =
  "";


let activeBudgetFilter =
  "all";


let budgetPendingDelete =
  null;


let tripPendingDelete =
  null;


let expensePendingDelete =
  null;


let recurringPendingDelete =
  null;


let pendingBackupRestore =
  null;


let selectedExpenseDetailId =
  "";


let editingExpenseId =
  "";


let openingExpenseEditor =
  false;


let pendingTripExpenseId =
  "";


let currentPhotoData =
  "";


let photoProcessingPromise =
  null;


const PHOTO_MAX_DIMENSION =
  1600;


const PHOTO_JPEG_QUALITY =
  0.8;


// ========================================
// CURRENCY
// ========================================

const EXCHANGE_RATES = {

  PHP: 1,

  JPY: 2.56,

  USD: 0.0175,

  GBP: 0.0132,

  HKD: 0.136,

  SGD: 0.0224,

  CNY: 0.125

};


const CURRENCY_INFO = {

  PHP: {
    symbol: "₱"
  },

  JPY: {
    symbol: "¥"
  },

  USD: {
    symbol: "$"
  },

  GBP: {
    symbol: "£"
  },

  HKD: {
    symbol: "HK$"
  },

  SGD: {
    symbol: "S$"
  },

  CNY: {
    symbol: "¥"
  }

};


const LOCAL_KEYS = {

  converterA:
    "momo_converter_currency_a",

  converterB:
    "momo_converter_currency_b",

  expenseCurrency:
    "momo_expense_last_currency",

  appearanceTheme:
    "momo_appearance_theme",

  appearanceWallpaperEnabled:
    "momo_appearance_wallpaper_enabled",

  appearanceOverlay:
    "momo_appearance_overlay",

  appearanceLocalMigrated:
    "momo_appearance_local_v1",

  cleanStart:
    "momo_clean_start_v1"

};



// ========================================
// PHONE PUSH REMINDERS
// ========================================

function getMomoPush() {
  return window.MomoPush || null;
}

async function syncPhoneReminder(type, item) {
  const push = getMomoPush();
  if (!push || !item) return false;

  try {
    const hasReminderDate = Boolean(
      item.nextDueDate ||
      item.targetDate ||
      item.date
    );

    if (item.phoneReminder && hasReminderDate) {
      return Boolean(
        await push.syncReminder(
          type,
          item
        )
      );
    }

    await push.deleteReminder(
      type,
      item.id
    );

    return false;
  } catch (error) {
    console.warn(
      "Momo phone reminder sync skipped:",
      error
    );
    return false;
  }
}

async function resolvePhoneReminderPreference(
  requested
) {
  if (!requested) {
    return false;
  }

  const push = getMomoPush();

  if (!push) {
    showToast(
      "Reminder saved, but Phone stayed Off. Phone notification setup is still loading."
    );
    return false;
  }

  try {
    const status =
      await push.getStatus();

    if (!status.enabled) {
      showToast(
        "Reminder saved, but Phone stayed Off. Enable phone notifications first."
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn(
      "Could not confirm phone notification status:",
      error
    );
    showToast(
      "Reminder saved, but Phone stayed Off."
    );
    return false;
  }
}

async function removePhoneReminder(type, id) {
  const push = getMomoPush();
  if (!push || !id) return;
  try {
    await push.deleteReminder(type, id);
  } catch (error) {
    console.warn("Momo phone reminder delete skipped:", error);
  }
}

const CUSTOM_REMINDERS_SETTING_KEY =
  "custom_reminders";

const GENTLE_PUSH_SETTING_KEY =
  "gentle_push_preferences";

let customReminders = [];
let gentlePushPreferences = {};
let editingCustomReminderId = "";


const APPEARANCE_SETTING_KEY =
  "appearance_preferences";


const APPEARANCE_DEFAULTS = {
  theme: "peach",
  wallpaperData: "",
  wallpaperEnabled: false,
  overlay: "medium"
};


let appearancePreferences = {
  ...APPEARANCE_DEFAULTS
};


let converterEditingSide =
  "A";


let converterIsUpdating =
  false;


// ========================================
// OPEN DATABASE
// ========================================

function openDatabase() {

  return new Promise(
    (resolve, reject) => {

      const request =
        indexedDB.open(
          DB_NAME,
          DB_VERSION
        );


      request.onupgradeneeded =
        (event) => {

          const database =
            event.target.result;


          // EXPENSES

          if (
            !database.objectStoreNames.contains(
              STORES.expenses
            )
          ) {

            const store =
              database.createObjectStore(
                STORES.expenses,
                {
                  keyPath: "id"
                }
              );


            store.createIndex(
              "date",
              "date",
              {
                unique: false
              }
            );


            store.createIndex(
              "category",
              "category",
              {
                unique: false
              }
            );


            store.createIndex(
              "budgetId",
              "budgetId",
              {
                unique: false
              }
            );


            store.createIndex(
              "tripId",
              "tripId",
              {
                unique: false
              }
            );

          }


          // BUDGETS

          if (
            !database.objectStoreNames.contains(
              STORES.budgets
            )
          ) {

            const store =
              database.createObjectStore(
                STORES.budgets,
                {
                  keyPath: "id"
                }
              );


            store.createIndex(
              "period",
              "period",
              {
                unique: false
              }
            );


            store.createIndex(
              "category",
              "category",
              {
                unique: false
              }
            );

          }


          // TRIPS

          if (
            !database.objectStoreNames.contains(
              STORES.trips
            )
          ) {

            const store =
              database.createObjectStore(
                STORES.trips,
                {
                  keyPath: "id"
                }
              );


            store.createIndex(
              "startDate",
              "startDate",
              {
                unique: false
              }
            );


            store.createIndex(
              "endDate",
              "endDate",
              {
                unique: false
              }
            );

          }


          // CARDS

          if (
            !database.objectStoreNames.contains(
              STORES.cards
            )
          ) {

            database.createObjectStore(
              STORES.cards,
              {
                keyPath: "id"
              }
            );

          }


          // REMOVE LEGACY ACCOUNTS STORE

          if (
            database.objectStoreNames.contains(
              "accounts"
            )
          ) {

            database.deleteObjectStore(
              "accounts"
            );

          }


          // RECURRING

          if (
            !database.objectStoreNames.contains(
              STORES.recurring
            )
          ) {

            database.createObjectStore(
              STORES.recurring,
              {
                keyPath: "id"
              }
            );

          }


          // PLANNED EXPENSES

          if (
            !database.objectStoreNames.contains(
              STORES.planned
            )
          ) {

            const store =
              database.createObjectStore(
                STORES.planned,
                {
                  keyPath: "id"
                }
              );


            store.createIndex(
              "targetDate",
              "targetDate",
              {
                unique: false
              }
            );


            store.createIndex(
              "tripId",
              "tripId",
              {
                unique: false
              }
            );


            store.createIndex(
              "status",
              "status",
              {
                unique: false
              }
            );

          }


          // SETTINGS

          if (
            !database.objectStoreNames.contains(
              STORES.settings
            )
          ) {

            database.createObjectStore(
              STORES.settings,
              {
                keyPath: "key"
              }
            );

          }

        };


      request.onsuccess =
        () => {

          db =
            request.result;


          db.onversionchange =
            () => {

              db.close();

            };


          resolve(db);

        };


      request.onerror =
        () => {

          reject(
            request.error
          );

        };

    }
  );

}


// ========================================
// INDEXEDDB HELPERS
// ========================================

function getAllRecords(
  storeName
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readonly"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.getAll();


      request.onsuccess =
        () => {

          resolve(
            request.result || []
          );

        };


      request.onerror =
        () => {

          reject(
            request.error
          );

        };

    }
  );

}


function putRecord(
  storeName,
  record
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readwrite"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.put(
          record
        );


      request.onsuccess =
        () => {

          resolve(
            record
          );

        };


      request.onerror =
        () => {

          reject(
            request.error
          );

        };

    }
  );

}


function deleteRecord(
  storeName,
  id
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readwrite"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.delete(
          id
        );


      request.onsuccess =
        () => {

          resolve();

        };


      request.onerror =
        () => {

          reject(
            request.error
          );

        };

    }
  );

}


function clearStore(
  storeName
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readwrite"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.clear();


      request.onsuccess =
        () => {

          resolve();

        };


      request.onerror =
        () => {

          reject(
            request.error
          );

        };

    }
  );

}


// ========================================
// CLEAN OLD DEMO DATA ONCE
// ========================================

async function performCleanStartIfNeeded() {

  const alreadyCleaned =
    localStorage.getItem(
      LOCAL_KEYS.cleanStart
    );


  if (
    alreadyCleaned ===
    "yes"
  ) {

    return;

  }


  // Legacy localStorage cleanup only.
  // Never clear IndexedDB here: live Momo financial data
  // must survive normal app updates and launches.

  localStorage.removeItem(
    "momo_budgets"
  );


  localStorage.removeItem(
    "momo_expenses"
  );


  localStorage.setItem(
    LOCAL_KEYS.cleanStart,
    "yes"
  );

}


// ========================================
// LOAD ALL DATA
// ========================================

async function loadAppData() {

  let settingsRecords = [];

  [

    expenses,

    budgets,

    trips,

    cards,

    recurringExpenses,

    plannedExpenses,

    settingsRecords

  ] = await Promise.all([

    getAllRecords(
      STORES.expenses
    ),

    getAllRecords(
      STORES.budgets
    ),

    getAllRecords(
      STORES.trips
    ),

    getAllRecords(
      STORES.cards
    ),

    getAllRecords(
      STORES.recurring
    ),

    getAllRecords(
      STORES.planned
    ),

    getAllRecords(
      STORES.settings
    )

  ]);


  const favoriteSetting =
    settingsRecords.find(
      (item) =>
        item?.key ===
        "favorite_expenses"
    );


  favoriteExpenses =
    Array.isArray(
      favoriteSetting?.value
    )
      ? favoriteSetting.value
      : [];


  const customReminderSetting =
    settingsRecords.find(
      (item) =>
        item?.key ===
        CUSTOM_REMINDERS_SETTING_KEY
    );

  customReminders =
    Array.isArray(customReminderSetting?.value)
      ? customReminderSetting.value
      : [];

  const gentlePushSetting =
    settingsRecords.find(
      (item) => item?.key === GENTLE_PUSH_SETTING_KEY
    );

  gentlePushPreferences =
    gentlePushSetting?.value && typeof gentlePushSetting.value === "object"
      ? gentlePushSetting.value
      : {};


  const appearanceSetting =
    settingsRecords.find(
      (item) =>
        item?.key ===
        APPEARANCE_SETTING_KEY
    );


  const legacyAppearance =
    appearanceSetting?.value &&
    typeof appearanceSetting.value ===
      "object"
      ? appearanceSetting.value
      : {};


  const savedTheme =
    localStorage.getItem(
      LOCAL_KEYS.appearanceTheme
    );


  const savedWallpaperEnabled =
    localStorage.getItem(
      LOCAL_KEYS.appearanceWallpaperEnabled
    );


  const savedOverlay =
    localStorage.getItem(
      LOCAL_KEYS.appearanceOverlay
    );


  appearancePreferences = {
    ...APPEARANCE_DEFAULTS,
    wallpaperData:
      legacyAppearance.wallpaperData ||
      "",
    theme:
      savedTheme ||
      legacyAppearance.theme ||
      APPEARANCE_DEFAULTS.theme,
    wallpaperEnabled:
      savedWallpaperEnabled ===
        null
        ? Boolean(
            legacyAppearance.wallpaperEnabled
          )
        : savedWallpaperEnabled ===
          "true",
    overlay:
      savedOverlay ||
      legacyAppearance.overlay ||
      APPEARANCE_DEFAULTS.overlay
  };


  /*
    One-time backward-compatible migration:
    small device preferences move to localStorage, while the
    potentially large wallpaper image stays in IndexedDB.
  */
  if (
    localStorage.getItem(
      LOCAL_KEYS.appearanceLocalMigrated
    ) !==
      "yes"
  ) {

    localStorage.setItem(
      LOCAL_KEYS.appearanceTheme,
      appearancePreferences.theme
    );


    localStorage.setItem(
      LOCAL_KEYS.appearanceWallpaperEnabled,
      String(
        Boolean(
          appearancePreferences.wallpaperEnabled
        )
      )
    );


    localStorage.setItem(
      LOCAL_KEYS.appearanceOverlay,
      appearancePreferences.overlay
    );


    localStorage.setItem(
      LOCAL_KEYS.appearanceLocalMigrated,
      "yes"
    );


    if (
      appearanceSetting &&
      (
        Object.hasOwn(
          legacyAppearance,
          "theme"
        ) ||
        Object.hasOwn(
          legacyAppearance,
          "wallpaperEnabled"
        ) ||
        Object.hasOwn(
          legacyAppearance,
          "overlay"
        )
      )
    ) {

      try {

        await putRecord(
          STORES.settings,
          {
            key:
              APPEARANCE_SETTING_KEY,
            value: {
              wallpaperData:
                appearancePreferences.wallpaperData
            },
            updatedAt:
              new Date()
                .toISOString()
          }
        );

      } catch (
        error
      ) {

        console.warn(
          "Could not finish local appearance migration:",
          error
        );

      }

    }

  }


  const savingsGoalsSetting =
    settingsRecords.find(
      (item) =>
        item?.key ===
        SAVINGS_GOALS_SETTING_KEY
    );


  savingsGoals =
    Array.isArray(
      savingsGoalsSetting?.value
    )
      ? savingsGoalsSetting.value
      : [];


  const monthlyIncomeSetting =
    settingsRecords.find(
      (item) =>
        item?.key ===
        MONTHLY_INCOME_SETTING_KEY
    );


  monthlyIncomeByMonth =
    monthlyIncomeSetting?.value &&
    typeof monthlyIncomeSetting.value ===
      "object"
      ? monthlyIncomeSetting.value
      : {};


  const paydayPlanSetting =
    settingsRecords.find(
      (item) => item?.key === PAYDAY_PLAN_SETTING_KEY
    );

  paydayPlan = {
    ...PAYDAY_PLAN_DEFAULTS,
    ...(paydayPlanSetting?.value &&
    typeof paydayPlanSetting.value === "object"
      ? paydayPlanSetting.value
      : {})
  };


  const tripShoppingSetting =
    settingsRecords.find(
      (item) =>
        item?.key ===
        TRIP_SHOPPING_SETTING_KEY
    );


  tripShoppingItems =
    Array.isArray(
      tripShoppingSetting?.value
    )
      ? tripShoppingSetting.value
      : [];


  const travelSettlementSetting =
    settingsRecords.find(
      (item) =>
        item?.key ===
        TRAVEL_SETTLEMENT_SETTING_KEY
    );


  travelSettlements =
    Array.isArray(
      travelSettlementSetting?.value
    )
      ? travelSettlementSetting.value
      : [];


  loadMomo18Settings(settingsRecords);


  loadMomo19Settings(settingsRecords);


  loadMomo10Settings(settingsRecords);


  expenses.sort(
    (
      a,
      b
    ) => {

      const dateA =
        new Date(
          a.createdAt ||
          a.date ||
          0
        );


      const dateB =
        new Date(
          b.createdAt ||
          b.date ||
          0
        );


      return (
        dateB -
        dateA
      );

    }
  );


  trips.sort(
    (
      a,
      b
    ) => {

      return (
        new Date(
          a.startDate
        ) -
        new Date(
          b.startDate
        )
      );

    }
  );


  plannedExpenses.sort(
    (
      a,
      b
    ) => {

      const dateA =
        a.targetDate ||
        "9999-12-31";


      const dateB =
        b.targetDate ||
        "9999-12-31";


      return (
        dateA.localeCompare(
          dateB
        ) ||
        String(
          a.createdAt ||
          ""
        ).localeCompare(
          String(
            b.createdAt ||
            ""
          )
        )
      );

    }
  );


  favoriteExpenses.sort(
    (a, b) =>
      String(a.title || "").localeCompare(
        String(b.title || "")
      )
  );

}


// ========================================
// GENERAL HELPERS
// ========================================

function generateId(
  prefix = "item"
) {

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

}


function escapeHTML(
  value = ""
) {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


function getTodayString() {

  const today =
    new Date();


  const year =
    today.getFullYear();


  const month =
    String(
      today.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      today.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


function createLocalDate(
  dateString
) {

  if (
    !dateString
  ) {

    return null;

  }


  return new Date(
    `${dateString}T00:00:00`
  );

}


function formatDate(
  dateString
) {

  if (
    !dateString
  ) {

    return "";

  }


  const date =
    createLocalDate(
      dateString
    );


  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  ).format(
    date
  );

}


function formatShortDate(
  dateString
) {

  if (
    !dateString
  ) {

    return "";

  }


  const date =
    createLocalDate(
      dateString
    );


  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric"
    }
  ).format(
    date
  );

}


// ========================================
// SAFE CALCULATOR
// ========================================

function calculateExpression(
  expression
) {

  if (
    expression === null ||
    expression === undefined
  ) {

    return null;

  }


  let text =
    String(
      expression
    )

      .replaceAll(
        ",",
        ""
      )

      .replaceAll(
        "×",
        "*"
      )

      .replaceAll(
        "÷",
        "/"
      )

      .replace(
        /\s+/g,
        ""
      );


  if (
    !text
  ) {

    return null;

  }


  if (
    !/^[0-9+\-*/().]+$/.test(
      text
    )
  ) {

    return null;

  }


  let position = 0;


  function peek() {

    return text[
      position
    ];

  }


  function consume() {

    return text[
      position++
    ];

  }


  function parseNumber() {

    let numberText =
      "";


    let decimalCount =
      0;


    while (
      position <
      text.length
    ) {

      const character =
        peek();


      if (
        character >=
          "0" &&
        character <=
          "9"
      ) {

        numberText +=
          consume();

        continue;

      }


      if (
        character ===
        "."
      ) {

        decimalCount++;


        if (
          decimalCount >
          1
        ) {

          throw new Error(
            "Invalid number"
          );

        }


        numberText +=
          consume();

        continue;

      }


      break;

    }


    if (
      numberText ===
        "" ||
      numberText ===
        "."
    ) {

      throw new Error(
        "Expected number"
      );

    }


    return Number(
      numberText
    );

  }


  function parseFactor() {

    const current =
      peek();


    if (
      current ===
      "+"
    ) {

      consume();

      return parseFactor();

    }


    if (
      current ===
      "-"
    ) {

      consume();

      return -parseFactor();

    }


    if (
      current ===
      "("
    ) {

      consume();


      const value =
        parseExpression();


      if (
        peek() !==
        ")"
      ) {

        throw new Error(
          "Missing parenthesis"
        );

      }


      consume();


      return value;

    }


    return parseNumber();

  }


  function parseTerm() {

    let value =
      parseFactor();


    while (
      position <
      text.length
    ) {

      const operator =
        peek();


      if (
        operator !==
          "*" &&
        operator !==
          "/"
      ) {

        break;

      }


      consume();


      const right =
        parseFactor();


      if (
        operator ===
        "*"
      ) {

        value *=
          right;

      } else {

        if (
          right ===
          0
        ) {

          throw new Error(
            "Division by zero"
          );

        }


        value /=
          right;

      }

    }


    return value;

  }


  function parseExpression() {

    let value =
      parseTerm();


    while (
      position <
      text.length
    ) {

      const operator =
        peek();


      if (
        operator !==
          "+" &&
        operator !==
          "-"
      ) {

        break;

      }


      consume();


      const right =
        parseTerm();


      if (
        operator ===
        "+"
      ) {

        value +=
          right;

      } else {

        value -=
          right;

      }

    }


    return value;

  }


  try {

    const result =
      parseExpression();


    if (
      position !==
      text.length
    ) {

      return null;

    }


    if (
      !Number.isFinite(
        result
      )
    ) {

      return null;

    }


    return result;

  } catch {

    return null;

  }

}


// ========================================
// CURRENCY HELPERS
// ========================================

function convertCurrency(
  amount,
  fromCurrency,
  toCurrency
) {

  const numericAmount =
    Number(
      amount ||
      0
    );


  if (
    fromCurrency ===
    toCurrency
  ) {

    return numericAmount;

  }


  const fromRate =
    EXCHANGE_RATES[
      fromCurrency
    ];


  const toRate =
    EXCHANGE_RATES[
      toCurrency
    ];


  if (
    !fromRate ||
    !toRate
  ) {

    return 0;

  }


  const amountInPHP =
    numericAmount /
    fromRate;


  return (
    amountInPHP *
    toRate
  );

}


function formatCurrency(
  value,
  currency =
    "PHP"
) {

  const amount =
    Number(
      value ||
      0
    );


  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency,

      minimumFractionDigits:
        currency ===
        "JPY"

          ? 0

          : 2,

      maximumFractionDigits:
        currency ===
        "JPY"

          ? 0

          : 2
    }
  ).format(
    amount
  );

}


function formatPHP(
  value
) {

  return formatCurrency(
    value,
    "PHP"
  );

}


function formatPlainNumber(
  value,
  currency
) {

  return Number(
    value
  ).toLocaleString(
    "en-US",
    {
      maximumFractionDigits:
        currency ===
        "JPY"

          ? 0

          : 2
    }
  );

}



// ========================================
// APPEARANCE
// ========================================

const appearanceButton =
  document.getElementById(
    "appearanceButton"
  );


const appearanceModal =
  document.getElementById(
    "appearanceModal"
  );


const closeAppearanceModalButton =
  document.getElementById(
    "closeAppearanceModal"
  );


const doneAppearanceButton =
  document.getElementById(
    "doneAppearanceButton"
  );


const appearanceThemeName =
  document.getElementById(
    "appearanceThemeName"
  );


const appearanceThemeOptions =
  document.getElementById(
    "appearanceThemeOptions"
  );


const wallpaperInput =
  document.getElementById(
    "wallpaperInput"
  );


const chooseWallpaperButton =
  document.getElementById(
    "chooseWallpaperButton"
  );


const removeWallpaperButton =
  document.getElementById(
    "removeWallpaperButton"
  );


const wallpaperPreview =
  document.getElementById(
    "wallpaperPreview"
  );


const wallpaperToggle =
  document.getElementById(
    "wallpaperToggle"
  );


const wallpaperStatus =
  document.getElementById(
    "wallpaperStatus"
  );


const overlayStrengthOptions =
  document.getElementById(
    "overlayStrengthOptions"
  );


const resetAppearanceButton =
  document.getElementById(
    "resetAppearanceButton"
  );


const appWallpaperLayer =
  document.getElementById(
    "appWallpaperLayer"
  );


const appWallpaperOverlay =
  document.getElementById(
    "appWallpaperOverlay"
  );


const wallpaperCropModal =
  document.getElementById(
    "wallpaperCropModal"
  );


const wallpaperCropViewport =
  document.getElementById(
    "wallpaperCropViewport"
  );


const wallpaperCropImage =
  document.getElementById(
    "wallpaperCropImage"
  );


const wallpaperCropZoom =
  document.getElementById(
    "wallpaperCropZoom"
  );


const wallpaperCropZoomValue =
  document.getElementById(
    "wallpaperCropZoomValue"
  );


const closeWallpaperCropButton =
  document.getElementById(
    "closeWallpaperCrop"
  );


const cancelWallpaperCropButton =
  document.getElementById(
    "cancelWallpaperCrop"
  );


const useWallpaperCropButton =
  document.getElementById(
    "useWallpaperCrop"
  );


const THEME_LABELS = {
  peach: "Peach Pink",
  sakura: "Sakura Pink",
  lavender: "Lavender Purple",
  sky: "Sky Blue",
  mint: "Mint Green",
  butter: "Soft Yellow"
};


function getWallpaperOverlayColor(
  overlay =
    "medium"
) {

  const alphaByStrength = {
    // Enough tint to keep text readable while preserving
    // the wallpaper as a visible background.
    light: 0.28,
    medium: 0.46,
    strong: 0.64
  };


  const alpha =
    alphaByStrength[
      overlay
    ] ??
    alphaByStrength.medium;


  return `rgba(255, 252, 250, ${alpha})`;

}


function applyAppearance() {

  const theme =
    THEME_LABELS[
      appearancePreferences.theme
    ]
      ? appearancePreferences.theme
      : APPEARANCE_DEFAULTS.theme;


  document.body.dataset.theme =
    theme;


  const hasWallpaper =
    Boolean(
      appearancePreferences.wallpaperData
    );


  const wallpaperIsOn =
    hasWallpaper &&
    Boolean(
      appearancePreferences.wallpaperEnabled
    );


  document.body.classList.toggle(
    "wallpaper-enabled",
    wallpaperIsOn
  );


  if (
    appWallpaperLayer
  ) {

    appWallpaperLayer.style.backgroundImage =
      hasWallpaper
        ? `url("${appearancePreferences.wallpaperData}")`
        : "none";


    appWallpaperLayer.classList.toggle(
      "active",
      wallpaperIsOn
    );

  }


  if (
    appWallpaperOverlay
  ) {

    appWallpaperOverlay.style.background =
      getWallpaperOverlayColor(
        appearancePreferences.overlay
      );


    appWallpaperOverlay.classList.toggle(
      "active",
      wallpaperIsOn
    );

  }


  renderAppearanceControls();

}


function renderAppearanceControls() {

  const theme =
    THEME_LABELS[
      appearancePreferences.theme
    ]
      ? appearancePreferences.theme
      : APPEARANCE_DEFAULTS.theme;


  if (
    appearanceThemeName
  ) {

    appearanceThemeName.textContent =
      THEME_LABELS[
        theme
      ];

  }


  appearanceThemeOptions
    ?.querySelectorAll(
      "[data-theme-choice]"
    )
    .forEach(
      (button) => {

        const active =
          button.dataset
            .themeChoice ===
          theme;


        button.classList.toggle(
          "active",
          active
        );


        button.setAttribute(
          "aria-checked",
          String(
            active
          )
        );

      }
    );


  const hasWallpaper =
    Boolean(
      appearancePreferences.wallpaperData
    );


  if (
    wallpaperPreview
  ) {

    wallpaperPreview.classList.toggle(
      "has-image",
      hasWallpaper
    );


    wallpaperPreview.style.backgroundImage =
      hasWallpaper
        ? `linear-gradient(rgba(255,255,255,.18), rgba(255,255,255,.18)), url("${appearancePreferences.wallpaperData}")`
        : "";


    wallpaperPreview.innerHTML =
      hasWallpaper
        ? "<span class=\"visually-hidden\">Selected wallpaper preview</span>"
        : "<span>Choose a photo from this device.<br>It stays private and local to Momo.</span>";

  }


  if (
    removeWallpaperButton
  ) {

    removeWallpaperButton.hidden =
      !hasWallpaper;

  }


  if (
    wallpaperToggle
  ) {

    wallpaperToggle.disabled =
      !hasWallpaper;


    wallpaperToggle.checked =
      hasWallpaper &&
      Boolean(
        appearancePreferences.wallpaperEnabled
      );

  }


  if (
    wallpaperStatus
  ) {

    wallpaperStatus.textContent =
      hasWallpaper &&
      appearancePreferences.wallpaperEnabled
        ? "On"
        : "Off";

  }


  overlayStrengthOptions
    ?.querySelectorAll(
      "[data-overlay-choice]"
    )
    .forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset
            .overlayChoice ===
            appearancePreferences.overlay
        );

      }
    );

}


async function saveAppearancePreferences() {

  /*
    Small device-specific preferences stay in localStorage.
    The wallpaper image can be large, so it remains in IndexedDB.
    Nothing here requires Firebase or Firestore.
  */
  localStorage.setItem(
    LOCAL_KEYS.appearanceTheme,
    appearancePreferences.theme
  );


  localStorage.setItem(
    LOCAL_KEYS.appearanceWallpaperEnabled,
    String(
      Boolean(
        appearancePreferences.wallpaperEnabled
      )
    )
  );


  localStorage.setItem(
    LOCAL_KEYS.appearanceOverlay,
    appearancePreferences.overlay
  );


  localStorage.setItem(
    LOCAL_KEYS.appearanceLocalMigrated,
    "yes"
  );


  await putRecord(
    STORES.settings,
    {
      key:
        APPEARANCE_SETTING_KEY,
      value: {
        wallpaperData:
          appearancePreferences.wallpaperData ||
          ""
      },
      updatedAt:
        new Date()
          .toISOString()
    }
  );

}


function openAppearanceModal() {

  if (
    !appearanceModal
  ) {

    return;

  }


  renderAppearanceControls();


  appearanceModal.hidden =
    false;


  document.body.classList.add(
    "drawer-open"
  );

}


function closeAppearanceModal() {

  if (
    appearanceModal
  ) {

    appearanceModal.hidden =
      true;

  }


  document.body.classList.remove(
    "drawer-open"
  );

}


appearanceButton?.addEventListener(
  "click",
  openAppearanceModal
);


closeAppearanceModalButton
  ?.addEventListener(
    "click",
    closeAppearanceModal
  );


doneAppearanceButton
  ?.addEventListener(
    "click",
    closeAppearanceModal
  );


appearanceModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      appearanceModal
    ) {

      closeAppearanceModal();

    }

  }
);


appearanceThemeOptions
  ?.addEventListener(
    "click",
    async (
      event
    ) => {

      const button =
        event.target.closest(
          "[data-theme-choice]"
        );


      if (
        !button
      ) {

        return;

      }


      const theme =
        button.dataset
          .themeChoice;


      if (
        !THEME_LABELS[
          theme
        ]
      ) {

        return;

      }


      appearancePreferences.theme =
        theme;


      applyAppearance();


      try {

        await saveAppearancePreferences();

      } catch (
        error
      ) {

        console.error(
          "Could not save appearance:",
          error
        );


        showToast(
          "Could not save theme."
        );

      }

    }
  );



let pendingWallpaperSource =
  "";


let pendingWallpaperObjectURL =
  "";


let cropImageNaturalWidth =
  0;


let cropImageNaturalHeight =
  0;


let cropBaseScale =
  1;


let cropZoomFactor =
  1;


let cropOffsetX =
  0;


let cropOffsetY =
  0;


let cropDragPointerId =
  null;


let cropDragStartX =
  0;


let cropDragStartY =
  0;


let cropDragOriginX =
  0;


let cropDragOriginY =
  0;


const cropPointers =
  new Map();


let cropPinchStartDistance =
  0;


let cropPinchStartZoom =
  1;


function getCropViewportSize() {

  if (
    !wallpaperCropViewport
  ) {

    return {
      width: 1,
      height: 1
    };

  }


  const rect =
    wallpaperCropViewport
      .getBoundingClientRect();


  return {
    width:
      Math.max(
        1,
        rect.width
      ),
    height:
      Math.max(
        1,
        rect.height
      )
  };

}


function clampCropOffsets() {

  const viewport =
    getCropViewportSize();


  const scaledWidth =
    cropImageNaturalWidth *
    cropBaseScale *
    cropZoomFactor;


  const scaledHeight =
    cropImageNaturalHeight *
    cropBaseScale *
    cropZoomFactor;


  const maxX =
    Math.max(
      0,
      (
        scaledWidth -
        viewport.width
      ) /
      2
    );


  const maxY =
    Math.max(
      0,
      (
        scaledHeight -
        viewport.height
      ) /
      2
    );


  cropOffsetX =
    Math.max(
      -maxX,
      Math.min(
        maxX,
        cropOffsetX
      )
    );


  cropOffsetY =
    Math.max(
      -maxY,
      Math.min(
        maxY,
        cropOffsetY
      )
    );

}


function renderWallpaperCrop() {

  if (
    !wallpaperCropImage
  ) {

    return;

  }


  clampCropOffsets();


  const scale =
    cropBaseScale *
    cropZoomFactor;


  wallpaperCropImage.style.width =
    `${cropImageNaturalWidth * scale}px`;


  wallpaperCropImage.style.height =
    `${cropImageNaturalHeight * scale}px`;


  wallpaperCropImage.style.transform =
    `translate(calc(-50% + ${cropOffsetX}px), calc(-50% + ${cropOffsetY}px))`;


  if (
    wallpaperCropZoom
  ) {

    wallpaperCropZoom.value =
      String(
        Math.round(
          cropZoomFactor *
          100
        )
      );

  }


  if (
    wallpaperCropZoomValue
  ) {

    wallpaperCropZoomValue.textContent =
      `${Math.round(cropZoomFactor * 100)}%`;

  }

}


function initializeWallpaperCrop() {

  const viewport =
    getCropViewportSize();


  cropBaseScale =
    Math.max(
      viewport.width /
        cropImageNaturalWidth,
      viewport.height /
        cropImageNaturalHeight
    );


  cropZoomFactor =
    1;


  cropOffsetX =
    0;


  cropOffsetY =
    0;


  renderWallpaperCrop();

}


function closeWallpaperCropModal(
  restoreAppearance =
    true
) {

  if (
    wallpaperCropModal
  ) {

    wallpaperCropModal.hidden =
      true;

  }


  if (
    pendingWallpaperObjectURL
  ) {

    URL.revokeObjectURL(
      pendingWallpaperObjectURL
    );


    pendingWallpaperObjectURL =
      "";

  }


  pendingWallpaperSource =
    "";


  cropPointers.clear();


  cropDragPointerId =
    null;


  if (
    restoreAppearance &&
    appearanceModal
  ) {

    appearanceModal.hidden =
      false;

  }

}


function openWallpaperCropModal(
  source
) {

  pendingWallpaperSource =
    source;


  if (
    !wallpaperCropModal ||
    !wallpaperCropImage
  ) {

    return;

  }


  if (
    appearanceModal
  ) {

    appearanceModal.hidden =
      true;

  }


  wallpaperCropModal.hidden =
    false;


  wallpaperCropImage.removeAttribute(
    "src"
  );


  wallpaperCropImage.onload =
    () => {

      cropImageNaturalWidth =
        wallpaperCropImage.naturalWidth;


      cropImageNaturalHeight =
        wallpaperCropImage.naturalHeight;


      if (
        !cropImageNaturalWidth ||
        !cropImageNaturalHeight
      ) {

        showToast(
          "Could not read that photo."
        );


        closeWallpaperCropModal();


        return;

      }


      requestAnimationFrame(
        () => {

          initializeWallpaperCrop();

        }
      );

    };


  wallpaperCropImage.onerror =
    () => {

      showToast(
        "That photo format could not be opened."
      );


      closeWallpaperCropModal();

    };


  wallpaperCropImage.src =
    source;

}


function getPointerDistance() {

  const points =
    Array.from(
      cropPointers.values()
    );


  if (
    points.length <
    2
  ) {

    return 0;

  }


  const dx =
    points[0].x -
    points[1].x;


  const dy =
    points[0].y -
    points[1].y;


  return Math.hypot(
    dx,
    dy
  );

}


wallpaperCropViewport
  ?.addEventListener(
    "pointerdown",
    (event) => {

      event.preventDefault();


      wallpaperCropViewport
        .setPointerCapture?.(
          event.pointerId
        );


      cropPointers.set(
        event.pointerId,
        {
          x: event.clientX,
          y: event.clientY
        }
      );


      if (
        cropPointers.size ===
        1
      ) {

        cropDragPointerId =
          event.pointerId;


        cropDragStartX =
          event.clientX;


        cropDragStartY =
          event.clientY;


        cropDragOriginX =
          cropOffsetX;


        cropDragOriginY =
          cropOffsetY;

      }


      if (
        cropPointers.size ===
        2
      ) {

        cropPinchStartDistance =
          getPointerDistance();


        cropPinchStartZoom =
          cropZoomFactor;

      }

    }
  );


wallpaperCropViewport
  ?.addEventListener(
    "pointermove",
    (event) => {

      if (
        !cropPointers.has(
          event.pointerId
        )
      ) {

        return;

      }


      event.preventDefault();


      cropPointers.set(
        event.pointerId,
        {
          x: event.clientX,
          y: event.clientY
        }
      );


      if (
        cropPointers.size >=
        2
      ) {

        const distance =
          getPointerDistance();


        if (
          cropPinchStartDistance >
          0
        ) {

          cropZoomFactor =
            Math.max(
              1,
              Math.min(
                3,
                cropPinchStartZoom *
                  (
                    distance /
                    cropPinchStartDistance
                  )
              )
            );


          renderWallpaperCrop();

        }


        return;

      }


      if (
        cropDragPointerId ===
        event.pointerId
      ) {

        cropOffsetX =
          cropDragOriginX +
          (
            event.clientX -
            cropDragStartX
          );


        cropOffsetY =
          cropDragOriginY +
          (
            event.clientY -
            cropDragStartY
          );


        renderWallpaperCrop();

      }

    }
  );


function finishCropPointer(
  event
) {

  cropPointers.delete(
    event.pointerId
  );


  if (
    cropDragPointerId ===
    event.pointerId
  ) {

    cropDragPointerId =
      null;

  }


  if (
    cropPointers.size ===
    1
  ) {

    const [
      pointerId,
      point
    ] =
      Array.from(
        cropPointers.entries()
      )[0];


    cropDragPointerId =
      pointerId;


    cropDragStartX =
      point.x;


    cropDragStartY =
      point.y;


    cropDragOriginX =
      cropOffsetX;


    cropDragOriginY =
      cropOffsetY;

  }

}


wallpaperCropViewport
  ?.addEventListener(
    "pointerup",
    finishCropPointer
  );


wallpaperCropViewport
  ?.addEventListener(
    "pointercancel",
    finishCropPointer
  );


wallpaperCropZoom
  ?.addEventListener(
    "input",
    () => {

      cropZoomFactor =
        Math.max(
          1,
          Math.min(
            3,
            Number(
              wallpaperCropZoom.value
            ) /
            100
          )
        );


      renderWallpaperCrop();

    }
  );


[
  closeWallpaperCropButton,
  cancelWallpaperCropButton
].forEach(
  (button) => {

    button?.addEventListener(
      "click",
      closeWallpaperCropModal
    );

  }
);


useWallpaperCropButton
  ?.addEventListener(
    "click",
    async () => {

      if (
        !pendingWallpaperSource
      ) {

        return;

      }


      try {

        const viewport =
          getCropViewportSize();


        const outputWidth =
          Math.max(
            900,
            Math.round(
              window.innerWidth *
              Math.min(
                3,
                window.devicePixelRatio ||
                2
              )
            )
          );


        const outputHeight =
          Math.round(
            outputWidth *
            (
              viewport.height /
              viewport.width
            )
          );


        const canvas =
          document.createElement(
            "canvas"
          );


        canvas.width =
          outputWidth;


        canvas.height =
          outputHeight;


        const context =
          canvas.getContext(
            "2d"
          );


        if (
          !context
        ) {

          throw new Error(
            "Canvas unavailable"
          );

        }


        const displayScale =
          cropBaseScale *
          cropZoomFactor;


        const displayedWidth =
          cropImageNaturalWidth *
          displayScale;


        const displayedHeight =
          cropImageNaturalHeight *
          displayScale;


        const left =
          (
            viewport.width -
            displayedWidth
          ) /
          2 +
          cropOffsetX;


        const top =
          (
            viewport.height -
            displayedHeight
          ) /
          2 +
          cropOffsetY;


        const sourceX =
          Math.max(
            0,
            -left /
            displayScale
          );


        const sourceY =
          Math.max(
            0,
            -top /
            displayScale
          );


        const sourceWidth =
          Math.min(
            cropImageNaturalWidth -
              sourceX,
            viewport.width /
              displayScale
          );


        const sourceHeight =
          Math.min(
            cropImageNaturalHeight -
              sourceY,
            viewport.height /
              displayScale
          );


        context.drawImage(
          wallpaperCropImage,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          outputWidth,
          outputHeight
        );


        const cropped =
          canvas.toDataURL(
            "image/jpeg",
            0.88
          );


        appearancePreferences.wallpaperData =
          cropped;


        appearancePreferences.wallpaperEnabled =
          true;


        applyAppearance();


        await saveAppearancePreferences();


        closeWallpaperCropModal();


        showToast(
          "Wallpaper saved"
        );

      } catch (
        error
      ) {

        console.error(
          "Could not crop wallpaper:",
          error
        );


        showToast(
          "Could not crop that photo."
        );

      }

    }
  );


chooseWallpaperButton
  ?.addEventListener(
    "click",
    () => {

      wallpaperInput?.click();

    }
  );


wallpaperInput?.addEventListener(
  "change",
  () => {

    const file =
      wallpaperInput.files?.[
        0
      ];


    if (
      !file
    ) {

      return;

    }


    if (
      !file.type.startsWith(
        "image/"
      )
    ) {

      showToast(
        "Please choose an image."
      );


      wallpaperInput.value =
        "";


      return;

    }


    try {

      if (
        pendingWallpaperObjectURL
      ) {

        URL.revokeObjectURL(
          pendingWallpaperObjectURL
        );

      }


      pendingWallpaperObjectURL =
        URL.createObjectURL(
          file
        );


      openWallpaperCropModal(
        pendingWallpaperObjectURL
      );

    } catch (
      error
    ) {

      console.error(
        "Could not open wallpaper photo:",
        error
      );


      showToast(
        "Could not use that photo."
      );

    } finally {

      wallpaperInput.value =
        "";

    }

  }
);


removeWallpaperButton
  ?.addEventListener(
    "click",
    async () => {

      appearancePreferences.wallpaperData =
        "";


      appearancePreferences.wallpaperEnabled =
        false;


      applyAppearance();


      try {

        await saveAppearancePreferences();


        showToast(
          "Wallpaper removed"
        );

      } catch (
        error
      ) {

        console.error(
          "Could not remove wallpaper:",
          error
        );

      }

    }
  );


wallpaperToggle?.addEventListener(
  "change",
  async () => {

    appearancePreferences.wallpaperEnabled =
      Boolean(
        wallpaperToggle.checked
      );


    applyAppearance();


    try {

      await saveAppearancePreferences();

    } catch (
      error
    ) {

      console.error(
        "Could not save wallpaper setting:",
        error
      );

    }

  }
);


overlayStrengthOptions
  ?.addEventListener(
    "click",
    async (
      event
    ) => {

      const button =
        event.target.closest(
          "[data-overlay-choice]"
        );


      if (
        !button
      ) {

        return;

      }


      const overlay =
        button.dataset
          .overlayChoice;


      if (
        ![
          "light",
          "medium",
          "strong"
        ].includes(
          overlay
        )
      ) {

        return;

      }


      appearancePreferences.overlay =
        overlay;


      applyAppearance();


      try {

        await saveAppearancePreferences();

      } catch (
        error
      ) {

        console.error(
          "Could not save overlay:",
          error
        );

      }

    }
  );



resetAppearanceButton
  ?.addEventListener(
    "click",
    async () => {

      appearancePreferences = {
        ...APPEARANCE_DEFAULTS
      };


      applyAppearance();


      try {

        await saveAppearancePreferences();


        showToast(
          "Appearance reset"
        );

      } catch (
        error
      ) {

        console.error(
          "Could not reset appearance:",
          error
        );

      }

    }
  );


// ========================================
// DRAWER
// ========================================

const menuButton =
  document.getElementById(
    "menuButton"
  );


const sideDrawer =
  document.getElementById(
    "sideDrawer"
  );


const drawerOverlay =
  document.getElementById(
    "drawerOverlay"
  );


const closeDrawerButton =
  document.getElementById(
    "closeDrawer"
  );


function openDrawer() {


  sideDrawer?.classList.add(
    "open"
  );


  if (
    drawerOverlay
  ) {

    drawerOverlay.hidden =
      false;

  }


  sideDrawer?.setAttribute(
    "aria-hidden",
    "false"
  );


  menuButton?.setAttribute(
    "aria-expanded",
    "true"
  );


  document.body.classList.add(
    "drawer-open"
  );

}


function closeDrawer() {


  sideDrawer?.classList.remove(
    "open"
  );


  sideDrawer?.setAttribute(
    "aria-hidden",
    "true"
  );


  menuButton?.setAttribute(
    "aria-expanded",
    "false"
  );


  document.body.classList.remove(
    "drawer-open"
  );


  setTimeout(
    () => {

      if (
        drawerOverlay &&
        !sideDrawer?.classList.contains(
          "open"
        )
      ) {

        drawerOverlay.hidden =
          true;

      }

    },
    240
  );

}


menuButton?.addEventListener(
  "click",
  openDrawer
);


closeDrawerButton?.addEventListener(
  "click",
  closeDrawer
);


drawerOverlay?.addEventListener(
  "click",
  closeDrawer
);


document
  .querySelectorAll(
    "[data-drawer-nav]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const destination =
            button.dataset
              .drawerNav;


          closeDrawer();


          setTimeout(
            () => {

              showScreen(
                destination
              );

            },
            120
          );

        }
      );

    }
  );


// ========================================
// NAVIGATION
// ========================================

const screens =
  document.querySelectorAll(
    ".screen"
  );


const bottomNavItems =
  document.querySelectorAll(
    ".bottom-nav .nav-item"
  );


const topLevelScreens = [

  "home",

  "budgets",

  "add",

  "trips",

  "calendar"

];



let currentScreenName =
  document.querySelector(
    ".screen.active"
  )?.dataset.screen ||
  "home";


function showScreen(
  name
) {


  currentScreenName =
    name;


  screens.forEach(
    (screen) => {

      screen.classList.toggle(
        "active",
        screen.dataset
          .screen ===
          name
      );

    }
  );


  bottomNavItems.forEach(
    (item) => {

      item.classList.toggle(
        "active",
        item.dataset.nav ===
          name &&
        topLevelScreens.includes(
          name
        )
      );

    }
  );


  if (
    name ===
    "add"
  ) {

    if (
      !openingExpenseEditor
    ) {

      resetExpenseForm();

    }


    prepareExpenseForm();


    if (
      pendingTripExpenseId &&
      document.getElementById(
        "expenseTrip"
      )
    ) {

      const tripSelect =
        document.getElementById(
          "expenseTrip"
        );

      tripSelect.value =
        String(
          pendingTripExpenseId
        );

      tripSelect.dispatchEvent(
        new Event(
          "change",
          { bubbles: true }
        )
      );

      pendingTripExpenseId =
        "";

    }

    renderFavoriteQuickAdd();


    openingExpenseEditor =
      false;

  }


  if (
    name ===
    "budgets"
  ) {

    renderBudgets();

  }


  if (
    name ===
    "trips"
  ) {

    renderTrips();

  }


  if (
    name ===
    "calendar"
  ) {

    renderCalendar();

  }


  if (
    name ===
    "reminders"
  ) {

    renderSmartReminders();

  }


  if (name === "activity") {
    renderActivityTransactions();
  }


  if (name === "receipts") {
    renderReceiptGallery();
  }


  if (name === "savings") {
    renderSavingsGoals();
  }


  if (
    name ===
    "reports"
  ) {

    renderReportSummary();

  }


  if (
    name ===
    "recurring"
  ) {

    renderRecurringExpenses();

  }


  if (
    name ===
    "payday"
  ) {

    renderPaydayPlanner();

  }


  if (
    name ===
    "payables"
  ) {

    renderPayables();

  }


  if (
    name ===
    "backup"
  ) {

    renderBackupStatus();

  }


  if (
    name ===
    "planned"
  ) {

    renderPlannedExpenses();

  }


  if (
    name ===
    "settlement"
  ) {

    renderTravelSettlement();

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  maybeShowFirstUseTip(
    name
  );

}


document.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-nav]"
      );


    if (
      !button
    ) {

      return;

    }


    const destination =
      button.dataset.nav;


    if (
      destination
    ) {

      showScreen(
        destination
      );

    }


    if (
      button.hasAttribute(
        "data-focus-converter"
      )
    ) {

      setTimeout(
        () => {

          document
            .getElementById(
              "inlineConverter"
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });

        },
        250
      );

    }

  }
);


// ========================================
// CONVERTER
// ========================================

const converterCurrencyA =
  document.getElementById(
    "converterCurrencyA"
  );


const converterCurrencyB =
  document.getElementById(
    "converterCurrencyB"
  );


const converterAmountA =
  document.getElementById(
    "converterAmountA"
  );


const converterAmountB =
  document.getElementById(
    "converterAmountB"
  );


const converterTotalA =
  document.getElementById(
    "converterTotalA"
  );


const converterTotalB =
  document.getElementById(
    "converterTotalB"
  );


const converterSymbolA =
  document.getElementById(
    "converterSymbolA"
  );


const converterSymbolB =
  document.getElementById(
    "converterSymbolB"
  );


const converterRateText =
  document.getElementById(
    "converterRateText"
  );


function updateConverterSymbols() {

  converterSymbolA.textContent =
    CURRENCY_INFO[
      converterCurrencyA.value
    ].symbol;


  converterSymbolB.textContent =
    CURRENCY_INFO[
      converterCurrencyB.value
    ].symbol;

}


function updateConverterRateText() {

  const currencyA =
    converterCurrencyA.value;


  const currencyB =
    converterCurrencyB.value;


  const rate =
    convertCurrency(
      1,
      currencyA,
      currencyB
    );


  converterRateText.textContent =
    `${CURRENCY_INFO[currencyA].symbol}1 ≈ ` +
    `${CURRENCY_INFO[currencyB].symbol}` +
    `${formatPlainNumber(
      rate,
      currencyB
    )}`;

}


function setCalculatorTotal(
  element,
  value,
  currency
) {

  const row =
    element.closest(
      ".calculator-total-row"
    );


  if (
    value ===
    null
  ) {

    element.textContent =
      "Enter a valid calculation";


    row?.classList.add(
      "invalid"
    );


    return;

  }


  row?.classList.remove(
    "invalid"
  );


  element.textContent =
    formatCurrency(
      value,
      currency
    );

}


function updateConverterFromA() {

  if (
    converterIsUpdating
  ) {

    return;

  }


  converterEditingSide =
    "A";


  const totalA =
    calculateExpression(
      converterAmountA.value
    );


  setCalculatorTotal(
    converterTotalA,
    totalA,
    converterCurrencyA.value
  );


  if (
    totalA ===
    null
  ) {

    return;

  }


  const converted =
    convertCurrency(
      totalA,
      converterCurrencyA.value,
      converterCurrencyB.value
    );


  converterIsUpdating =
    true;


  converterAmountB.value =
    formatPlainNumber(
      converted,
      converterCurrencyB.value
    ).replaceAll(
      ",",
      ""
    );


  converterIsUpdating =
    false;


  setCalculatorTotal(
    converterTotalB,
    converted,
    converterCurrencyB.value
  );


  updateConverterRateText();

}


function updateConverterFromB() {

  if (
    converterIsUpdating
  ) {

    return;

  }


  converterEditingSide =
    "B";


  const totalB =
    calculateExpression(
      converterAmountB.value
    );


  setCalculatorTotal(
    converterTotalB,
    totalB,
    converterCurrencyB.value
  );


  if (
    totalB ===
    null
  ) {

    return;

  }


  const converted =
    convertCurrency(
      totalB,
      converterCurrencyB.value,
      converterCurrencyA.value
    );


  converterIsUpdating =
    true;


  converterAmountA.value =
    formatPlainNumber(
      converted,
      converterCurrencyA.value
    ).replaceAll(
      ",",
      ""
    );


  converterIsUpdating =
    false;


  setCalculatorTotal(
    converterTotalA,
    converted,
    converterCurrencyA.value
  );


  updateConverterRateText();

}


converterAmountA?.addEventListener(
  "input",
  updateConverterFromA
);


converterAmountB?.addEventListener(
  "input",
  updateConverterFromB
);


// ========================================
// CONVERTER OPERATOR BAR
// ========================================

function getConverterInputBySide(
  side
) {

  return (
    side ===
    "B"
      ? converterAmountB
      : converterAmountA
  );

}


function updateConverterBySide(
  side
) {

  if (
    side ===
    "B"
  ) {

    updateConverterFromB();

  } else {

    updateConverterFromA();

  }

}


function insertIntoConverterInput(
  input,
  value
) {

  if (
    !input
  ) {

    return;

  }


  const start =
    input.selectionStart ??
    input.value.length;


  const end =
    input.selectionEnd ??
    start;


  const before =
    input.value.slice(
      0,
      start
    );


  const after =
    input.value.slice(
      end
    );


  input.value =
    `${before}${value}${after}`;


  const nextPosition =
    start +
    value.length;


  input.focus();


  input.setSelectionRange(
    nextPosition,
    nextPosition
  );

}


function backspaceConverterInput(
  input
) {

  if (
    !input
  ) {

    return;

  }


  const start =
    input.selectionStart ??
    input.value.length;


  const end =
    input.selectionEnd ??
    start;


  if (
    start !==
    end
  ) {

    input.value =
      input.value.slice(
        0,
        start
      ) +
      input.value.slice(
        end
      );


    input.focus();


    input.setSelectionRange(
      start,
      start
    );


    return;

  }


  if (
    start <=
    0
  ) {

    input.focus();

    return;

  }


  const nextPosition =
    start -
    1;


  input.value =
    input.value.slice(
      0,
      nextPosition
    ) +
    input.value.slice(
      start
    );


  input.focus();


  input.setSelectionRange(
    nextPosition,
    nextPosition
  );

}


document
  .querySelectorAll(
    ".calculator-operator-bar"
  )
  .forEach(
    (bar) => {

      bar.addEventListener(
        "pointerdown",
        (event) => {

          /*
            Prevent iOS from moving focus away from
            the amount field when an operator is tapped.
          */

          if (
            event.target.closest(
              "button"
            )
          ) {

            event.preventDefault();

          }

        }
      );


      bar.addEventListener(
        "click",
        (event) => {

          const button =
            event.target.closest(
              "button"
            );


          if (
            !button
          ) {

            return;

          }


          const side =
            bar.dataset
              .calculatorTarget ||
            "A";


          const input =
            getConverterInputBySide(
              side
            );


          if (
            button.dataset
              .calcAction ===
            "backspace"
          ) {

            backspaceConverterInput(
              input
            );

          } else {

            const value =
              button.dataset
                .calcValue;


            if (
              value
            ) {

              insertIntoConverterInput(
                input,
                value
              );

            }

          }


          converterEditingSide =
            side;


          updateConverterBySide(
            side
          );

        }
      );

    }
  );


function handleConverterCurrencyChange() {

  updateConverterSymbols();


  localStorage.setItem(
    LOCAL_KEYS.converterA,
    converterCurrencyA.value
  );


  localStorage.setItem(
    LOCAL_KEYS.converterB,
    converterCurrencyB.value
  );


  if (
    converterEditingSide ===
    "B"
  ) {

    updateConverterFromB();

  } else {

    updateConverterFromA();

  }

}


converterCurrencyA?.addEventListener(
  "change",
  handleConverterCurrencyChange
);


converterCurrencyB?.addEventListener(
  "change",
  handleConverterCurrencyChange
);


document
  .getElementById(
    "swapCurrencies"
  )
  ?.addEventListener(
    "click",
    () => {

      const currencyA =
        converterCurrencyA.value;


      const currencyB =
        converterCurrencyB.value;


      const expressionA =
        converterAmountA.value;


      const expressionB =
        converterAmountB.value;


      converterCurrencyA.value =
        currencyB;


      converterCurrencyB.value =
        currencyA;


      converterAmountA.value =
        expressionB;


      converterAmountB.value =
        expressionA;


      converterEditingSide =
        "A";


      updateConverterSymbols();

      updateConverterFromA();


      localStorage.setItem(
        LOCAL_KEYS.converterA,
        converterCurrencyA.value
      );


      localStorage.setItem(
        LOCAL_KEYS.converterB,
        converterCurrencyB.value
      );

    }
  );


function clearConverter() {

  converterAmountA.value =
    "";


  converterAmountB.value =
    "";


  converterTotalA.textContent =
    formatCurrency(
      0,
      converterCurrencyA.value
    );


  converterTotalB.textContent =
    formatCurrency(
      0,
      converterCurrencyB.value
    );

}


document
  .getElementById(
    "clearConverterA"
  )
  ?.addEventListener(
    "click",
    () => {

      clearConverter();

      converterAmountA.focus();

    }
  );


document
  .getElementById(
    "clearConverterB"
  )
  ?.addEventListener(
    "click",
    () => {

      clearConverter();

      converterAmountB.focus();

    }
  );


function initializeConverter() {

  const savedA =
    localStorage.getItem(
      LOCAL_KEYS.converterA
    );


  const savedB =
    localStorage.getItem(
      LOCAL_KEYS.converterB
    );


  converterCurrencyA.value =
    savedA &&
    EXCHANGE_RATES[
      savedA
    ]

      ? savedA

      : "JPY";


  converterCurrencyB.value =
    savedB &&
    EXCHANGE_RATES[
      savedB
    ]

      ? savedB

      : "PHP";


  if (
    converterCurrencyA.value ===
    converterCurrencyB.value
  ) {

    converterCurrencyA.value =
      "JPY";


    converterCurrencyB.value =
      "PHP";

  }


  converterAmountA.value =
    "";


  converterAmountB.value =
    "";


  updateConverterSymbols();

  updateConverterRateText();

}


// ========================================
// EXPENSE CURRENCY PREVIEW
// ========================================

const amountInput =
  document.getElementById(
    "amount"
  );


const currencySelect =
  document.getElementById(
    "currency"
  );


const convertedAmount =
  document.getElementById(
    "convertedAmount"
  );


function updateExpenseConversion() {

  if (
    !amountInput ||
    !currencySelect ||
    !convertedAmount
  ) {

    return;

  }


  const amount =
    Number(
      amountInput.value ||
      0
    );


  const currency =
    currencySelect.value;


  if (
    currency ===
    "PHP"
  ) {

    convertedAmount.textContent =
      "Home currency";


    return;

  }


  const converted =
    convertCurrency(
      amount,
      currency,
      "PHP"
    );


  convertedAmount.textContent =
    `≈ ${formatPHP(
      converted
    )}`;

}


amountInput?.addEventListener(
  "input",
  updateExpenseConversion
);


currencySelect?.addEventListener(
  "change",
  () => {

    if (
      currencySelect.value &&
      EXCHANGE_RATES[
        currencySelect.value
      ]
    ) {

      localStorage.setItem(
        LOCAL_KEYS.expenseCurrency,
        currencySelect.value
      );

    }

    updateExpenseConversion();

  }
);


// ========================================
// BUDGET PERIOD LOGIC
// ========================================

function isExpenseInsideBudgetPeriod(
  expense,
  budget
) {

  if (
    !expense?.date
  ) {

    return false;

  }


  const expenseDate =
    createLocalDate(
      expense.date
    );


  if (
    !expenseDate ||
    Number.isNaN(
      expenseDate.getTime()
    )
  ) {

    return false;

  }


  const today =
    new Date();


  today.setHours(
    0,
    0,
    0,
    0
  );


  if (
    budget.period ===
    "daily"
  ) {

    return (

      expenseDate.getFullYear() ===
        today.getFullYear() &&

      expenseDate.getMonth() ===
        today.getMonth() &&

      expenseDate.getDate() ===
        today.getDate()

    );

  }


  if (
    budget.period ===
    "weekly"
  ) {

    const start =
      new Date(
        today
      );


    const weekday =
      start.getDay();


    start.setDate(
      start.getDate() +
      (
        weekday ===
        0

          ? -6

          : 1 -
            weekday
      )
    );


    const end =
      new Date(
        start
      );


    end.setDate(
      start.getDate() +
      6
    );


    return (
      expenseDate >=
        start &&
      expenseDate <=
        end
    );

  }


  if (
    budget.period ===
    "monthly"
  ) {

    return (

      expenseDate.getFullYear() ===
        today.getFullYear() &&

      expenseDate.getMonth() ===
        today.getMonth()

    );

  }


  if (
    budget.period ===
    "yearly"
  ) {

    return (
      expenseDate.getFullYear() ===
      today.getFullYear()
    );

  }


  if (
    budget.period ===
    "custom"
  ) {

    if (
      !budget.startDate ||
      !budget.endDate
    ) {

      return false;

    }


    let start =
      createLocalDate(
        budget.startDate
      );


    let end =
      createLocalDate(
        budget.endDate
      );


    if (
      !start ||
      !end ||
      Number.isNaN(
        start.getTime()
      ) ||
      Number.isNaN(
        end.getTime()
      )
    ) {

      return false;

    }


    if (
      start >
      end
    ) {

      [
        start,
        end
      ] = [
        end,
        start
      ];

    }


    start.setHours(
      0,
      0,
      0,
      0
    );


    end.setHours(
      23,
      59,
      59,
      999
    );


    return (
      expenseDate >=
        start &&
      expenseDate <=
        end
    );

  }


  return false;

}


// ========================================
// BUDGET CALCULATIONS
// ========================================

function getBudgetUsagePercent(
  budget
) {

  const limit =
    Number(
      budget.amount ||
      0
    );


  if (
    limit <=
    0
  ) {

    return 0;

  }


  return (
    getBudgetSpent(
      budget
    ) /
    limit
  ) *
  100;

}


function getBudgetAlertState(
  budget
) {

  const spent =
    getBudgetSpent(
      budget
    );


  const limit =
    Number(
      budget.amount ||
      0
    );


  const percent =
    limit >
    0

      ? (
          spent /
          limit
        ) *
        100

      : 0;


  const overAmount =
    Math.max(
      spent -
      limit,
      0
    );


  if (
    percent >=
    100
  ) {

    return {

      level:
        "over",

      threshold:
        100,

      percent,

      icon:
        "!",

      title:
        overAmount >
        0

          ? `${budget.name} is over budget`

          : `${budget.name} reached its limit`,

      message:
        overAmount >
        0

          ? `${formatCurrency(
              overAmount,
              budget.currency
            )} over the ${formatCurrency(
              limit,
              budget.currency
            )} limit`

          : `You've used the full ${formatCurrency(
              limit,
              budget.currency
            )} budget`

    };

  }


  if (
    percent >=
    90
  ) {

    return {

      level:
        "critical",

      threshold:
        90,

      percent,

      icon:
        "!",

      title:
        `${budget.name} is almost full`,

      message:
        `${percent.toFixed(
          0
        )}% used · ${formatCurrency(
          Math.max(
            limit -
            spent,
            0
          ),
          budget.currency
        )} left`

    };

  }


  if (
    percent >=
    75
  ) {

    return {

      level:
        "warning",

      threshold:
        75,

      percent,

      icon:
        "◔",

      title:
        `${budget.name} is getting close`,

      message:
        `${percent.toFixed(
          0
        )}% used · ${formatCurrency(
          Math.max(
            limit -
            spent,
            0
          ),
          budget.currency
        )} left`

    };

  }


  if (
    percent >=
    50
  ) {

    return {

      level:
        "notice",

      threshold:
        50,

      percent,

      icon:
        "♡",

      title:
        `${budget.name} passed halfway`,

      message:
        `${percent.toFixed(
          0
        )}% of this budget has been used`

    };

  }


  return null;

}


function getActiveBudgetAlerts() {

  return budgets

    .map(
      (budget) => {

        const alert =
          getBudgetAlertState(
            budget
          );


        if (
          !alert
        ) {

          return null;

        }


        return {
          budget,
          alert
        };

      }
    )

    .filter(
      Boolean
    )

    .sort(
      (
        a,
        b
      ) => {

        const levelOrder = {

          over:
            4,

          critical:
            3,

          warning:
            2,

          notice:
            1

        };


        return (
          (
            levelOrder[
              b.alert.level
            ] ||
            0
          ) -
          (
            levelOrder[
              a.alert.level
            ] ||
            0
          ) ||
          b.alert.percent -
          a.alert.percent
        );

      }
    );

}


function renderBudgetAlerts() {

  const panel =
    document.getElementById(
      "budgetAlertsPanel"
    );


  const list =
    document.getElementById(
      "budgetAlertsList"
    );


  const count =
    document.getElementById(
      "budgetAlertsCount"
    );


  if (
    !panel ||
    !list
  ) {

    return;

  }


  const alerts =
    getActiveBudgetAlerts();


  if (
    count
  ) {

    count.textContent =
      String(
        alerts.length
      );

  }


  if (
    alerts.length ===
    0
  ) {

    panel.hidden =
      true;


    list.innerHTML =
      "";


    return;

  }


  panel.hidden =
    false;


  list.innerHTML =
    alerts

      .map(
        (
          {
            budget,
            alert
          }
        ) => `

          <article
            class="budget-alert-item ${alert.level}"
          >

            <div class="budget-alert-icon">
              ${alert.icon}
            </div>


            <div class="budget-alert-copy">

              <strong>
                ${escapeHTML(
                  alert.title
                )}
              </strong>

              <p>
                ${escapeHTML(
                  alert.message
                )}
              </p>

            </div>


            <span class="budget-alert-percent">
              ${Math.round(
                alert.percent
              )}%
            </span>

          </article>

        `
      )

      .join("");

}


function getBudgetSpent(
  budget
) {

  return expenses

    .filter(
      (expense) => {

        const explicitlyLinked =
          expense.budgetId ===
          budget.id;


        const autoMatchedByCategory =
          !expense.budgetId &&
          (
            expense.category ||
            "Other"
          ) ===
          (
            budget.category ||
            "Other"
          );


        return (
          (
            explicitlyLinked ||
            autoMatchedByCategory
          ) &&
          isExpenseInsideBudgetPeriod(
            expense,
            budget
          )
        );

      }
    )

    .reduce(
      (
        total,
        expense
      ) => {

        return (
          total +
          convertCurrency(
            expense.amount,
            expense.currency,
            budget.currency
          )
        );

      },
      0
    );

}


function getPeriodLabel(
  budget
) {

  switch (
    budget.period
  ) {

    case "daily":

      return "Daily";


    case "weekly":

      return "Weekly";


    case "monthly":

      return "Monthly";


    case "yearly":

      return "Yearly";


    case "custom":

      if (
        budget.startDate &&
        budget.endDate
      ) {

        if (
          budget.startDate ===
          budget.endDate
        ) {

          return formatDate(
            budget.startDate
          );

        }


        return `${formatDate(
          budget.startDate
        )} – ${formatDate(
          budget.endDate
        )}`;

      }


      return "Custom";


    default:

      return "";

  }

}


function getMomoPeachIconHTML(
  extraClass = ""
) {

  return `<span class="momo-peach-icon${extraClass ? ` ${extraClass}` : ""}" aria-hidden="true"></span>`;

}


function getCategoryEmoji(
  category
) {

  const map = {

    Transportation:
      "🚗",

    "Food & Drinks":
      "🍜",

    Groceries:
      "🛒",

    Shopping:
      "🛍️",

    Beauty:
      "🧴",

    Entertainment:
      "🎬",

    Bills:
      "🧾",

    Subscriptions:
      "📱",

    Travel:
      "✈️",

    Education:
      "📚",

    Other:
      "✿"

  };


  return (
    map[
      category
    ] ||
    "✿"
  );

}


// ========================================
// BUDGET CARD HTML
// ========================================

function createBudgetCardHTML(
  budget,
  compact =
    false
) {

  const spent =
    getBudgetSpent(
      budget
    );


  const effectiveLimit =
    getEffectiveBudgetLimit(
      budget
    );


  const remaining =
    effectiveLimit -
    spent;


  const rawPercent =
    getBudgetUsagePercent(
      budget
    );


  const percent =
    Math.min(
      rawPercent,
      100
    );


  const alert =
    getBudgetAlertState(
      budget
    );


  return `

    <article
      class="budget-card ${
        alert
          ? `budget-alert-${alert.level}`
          : ""
      }"
    >

      <div class="budget-card-top">

        <div class="budget-card-title">

          <div class="budget-emoji">

            ${getCategoryEmoji(
              budget.category
            )}

          </div>


          <div>

            <h3>

              ${escapeHTML(
                budget.name
              )}

            </h3>


            <span class="budget-card-meta">

              ${escapeHTML(
                budget.category
              )}

              •

              ${escapeHTML(
                getPeriodLabel(
                  budget
                )
              )}

            </span>


            ${
              alert

                ? `

                    <span
                      class="budget-card-alert-badge ${alert.level}"
                    >
                      ${escapeHTML(
                        alert.title
                      )}
                    </span>

                  `

                : ""
            }

          </div>

        </div>


        ${
          compact

            ? ""

            : `

              <div class="budget-actions">

                <button
                  class="tiny-btn edit-budget"
                  type="button"
                  data-budget-id="${escapeHTML(
                    budget.id
                  )}"
                >
                  ✎
                </button>


                <button
                  class="tiny-btn delete-budget"
                  type="button"
                  data-budget-id="${escapeHTML(
                    budget.id
                  )}"
                >
                  🗑
                </button>

              </div>

            `
        }

      </div>


      <div class="budget-numbers">

        <div>

          <span>
            Spent
          </span>

          <strong>

            ${formatCurrency(
              spent,
              budget.currency
            )}

          </strong>

        </div>


        <div>

          <span>
            ${
              remaining <
              0
                ? "Over"
                : "Left"
            }
          </span>

          <strong class="${
            remaining <
            0
              ? "danger"
              : "positive"
          }">

            ${formatCurrency(
              Math.abs(
                remaining
              ),
              budget.currency
            )}

          </strong>

        </div>

      </div>


      <div class="progress-track">

        <div
          class="progress-fill ${
            alert
              ? `budget-progress-${alert.level}`
              : ""
          }"
          style="width:${percent}%"
        ></div>

      </div>


      <div class="budget-period-label">

        ${formatCurrency(
          effectiveLimit,
          budget.currency
        )}

        ${effectiveLimit !== Number(budget.amount || 0) ? "effective " : ""}limit

      </div>

    </article>

  `;

}


// ========================================
// RENDER BUDGETS
// ========================================

const budgetList =
  document.getElementById(
    "budgetList"
  );


const homeBudgetList =
  document.getElementById(
    "homeBudgetList"
  );


function renderBudgets() {

  let visibleBudgets =
    budgets;


  if (
    activeBudgetFilter !==
    "all"
  ) {

    visibleBudgets =
      budgets.filter(
        (budget) =>
          budget.period ===
          activeBudgetFilter
      );

  }


  if (
    budgetList
  ) {

    if (
      visibleBudgets.length ===
      0
    ) {

      budgetList.innerHTML = `

        <div class="empty-panel">

          <span class="empty-icon">
            ♡
          </span>

          <h3>
            ${
              budgets.length
                ? "No matching budgets"
                : "No budgets yet"
            }
          </h3>

          <p>
            ${
              budgets.length
                ? "Try another budget period."
                : "Tap + to create your first budget."
            }
          </p>

        </div>

      `;

    } else {

      budgetList.innerHTML =
        visibleBudgets

          .map(
            (budget) =>
              createBudgetCardHTML(
                budget,
                false
              )
          )

          .join("");

    }

  }


  if (
    homeBudgetList
  ) {

    if (
      budgets.length ===
      0
    ) {

      homeBudgetList.innerHTML = `

        <div class="empty-panel compact-empty">

          <span class="empty-icon">
            ♡
          </span>

          <h3>
            No budgets yet
          </h3>

          <p>
            Create one when you're ready to set a spending limit.
          </p>

        </div>

      `;

    } else {

      const homeBudgets =
        [
          ...budgets
        ]
          .sort(
            (
              a,
              b
            ) =>
              getBudgetUsagePercent(
                b
              ) -
              getBudgetUsagePercent(
                a
              )
          )
          .slice(
            0,
            3
          );


      homeBudgetList.innerHTML =
        homeBudgets

          .map(
            (budget) =>
              createBudgetCardHTML(
                budget,
                true
              )
          )

          .join("");

    }

  }


  attachBudgetActions();

  populateExpenseBudgetDropdown();

  renderBudgetAlerts();

}


// ========================================
// BUDGET FILTERS
// ========================================

document
  .querySelectorAll(
    "[data-budget-filter]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              "[data-budget-filter]"
            )
            .forEach(
              (item) => {

                item.classList.remove(
                  "active"
                );

              }
            );


          button.classList.add(
            "active"
          );


          activeBudgetFilter =
            button.dataset
              .budgetFilter;


          renderBudgets();

        }
      );

    }
  );


// ========================================
// EXPENSE BUDGET DROPDOWN
// ========================================

const expenseBudget =
  document.getElementById(
    "expenseBudget"
  );


const expenseCategory =
  document.getElementById(
    "expenseCategory"
  );


const expenseOtherCategoryRow =
  document.getElementById(
    "expenseOtherCategoryRow"
  );


const expenseOtherCategory =
  document.getElementById(
    "expenseOtherCategory"
  );


function updateExpenseOtherCategoryVisibility() {

  const isOther =
    expenseCategory?.value ===
    "Other";


  if (
    expenseOtherCategoryRow
  ) {

    expenseOtherCategoryRow.hidden =
      !isOther;

  }


  if (
    !isOther &&
    expenseOtherCategory
  ) {

    expenseOtherCategory.value =
      "";

  }

}


function updateOptionalOtherField(
  select,
  row,
  input
) {

  const isOther =
    select?.value ===
    "Other";


  if (
    row
  ) {

    row.hidden =
      !isOther;

  }


  if (
    !isOther &&
    input
  ) {

    input.value =
      "";

  }

}


const expenseOtherPaymentRow =
  document.getElementById(
    "expenseOtherPaymentRow"
  );


const expenseOtherPaymentMethod =
  document.getElementById(
    "expenseOtherPaymentMethod"
  );


function updateExpenseOtherPaymentVisibility() {

  updateOptionalOtherField(
    document.getElementById(
      "paymentMethod"
    ),
    expenseOtherPaymentRow,
    expenseOtherPaymentMethod
  );

}



// ========================================
// MERCHANT / PLACE MEMORY
// ========================================

const expenseLocation =
  document.getElementById(
    "expenseLocation"
  );


const merchantMemorySuggestions =
  document.getElementById(
    "merchantMemorySuggestions"
  );


function getMerchantMemoryProfiles() {

  const profiles =
    new Map();


  expenses.forEach(
    (
      expense,
      index
    ) => {

      const name =
        String(
          expense.location ||
          ""
        ).trim();


      if (
        !name
      ) {

        return;

      }


      const key =
        name.toLowerCase();


      if (
        !profiles.has(
          key
        )
      ) {

        profiles.set(
          key,
          {
            name,
            count: 0,
            latestDate: "",
            categories: {},
            payments: {}
          }
        );

      }


      const profile =
        profiles.get(
          key
        );


      profile.count++;


      if (
        String(
          expense.date ||
          ""
        ) >
        profile.latestDate
      ) {

        profile.latestDate =
          expense.date ||
          "";


        profile.name =
          name;

      }


      const categoryKey =
        JSON.stringify(
          {
            category:
              expense.category ||
              "Other",
            otherCategory:
              expense.otherCategory ||
              ""
          }
        );


      const paymentKey =
        JSON.stringify(
          {
            paymentMethod:
              expense.paymentMethod ||
              "Cash",
            otherPaymentMethod:
              expense.otherPaymentMethod ||
              ""
          }
        );


      profile.categories[
        categoryKey
      ] =
        (
          profile.categories[
            categoryKey
          ] ||
          0
        ) +
        1;


      profile.payments[
        paymentKey
      ] =
        (
          profile.payments[
            paymentKey
          ] ||
          0
        ) +
        1;

    }
  );


  return Array.from(
    profiles.values()
  ).map(
    (
      profile
    ) => {

      const mostCommon =
        (
          counts
        ) =>
          Object.entries(
            counts
          )
            .sort(
              (
                a,
                b
              ) =>
                b[
                  1
                ] -
                a[
                  1
                ]
            )[
              0
            ]?.[
              0
            ] ||
          "{}";


      return {
        ...profile,
        ...JSON.parse(
          mostCommon(
            profile.categories
          )
        ),
        ...JSON.parse(
          mostCommon(
            profile.payments
          )
        )
      };

    }
  );

}


function getMerchantMemoryMatches(
  query
) {

  const normalized =
    String(
      query ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    normalized.length <
    2
  ) {

    return [];

  }


  return getMerchantMemoryProfiles()
    .filter(
      (
        profile
      ) =>
        profile.name
          .toLowerCase()
          .includes(
            normalized
          )
    )
    .sort(
      (
        a,
        b
      ) => {

        const aStarts =
          a.name
            .toLowerCase()
            .startsWith(
              normalized
            )
            ? 1
            : 0;


        const bStarts =
          b.name
            .toLowerCase()
            .startsWith(
              normalized
            )
            ? 1
            : 0;


        return (
          bStarts -
          aStarts ||
          b.count -
          a.count ||
          String(
            b.latestDate
          ).localeCompare(
            String(
              a.latestDate
            )
          )
        );

      }
    )
    .slice(
      0,
      5
    );

}


function closeMerchantMemorySuggestions() {

  if (
    merchantMemorySuggestions
  ) {

    merchantMemorySuggestions.hidden =
      true;


    merchantMemorySuggestions.innerHTML =
      "";

  }

}


function renderMerchantMemorySuggestions() {

  if (
    !expenseLocation ||
    !merchantMemorySuggestions
  ) {

    return;

  }


  const matches =
    getMerchantMemoryMatches(
      expenseLocation.value
    );


  if (
    matches.length ===
    0
  ) {

    closeMerchantMemorySuggestions();


    return;

  }


  merchantMemorySuggestions.innerHTML =
    matches
      .map(
        (
          profile
        ) => {

          const categoryLabel =
            profile.category ===
              "Other" &&
            profile.otherCategory
              ? `Other · ${profile.otherCategory}`
              : profile.category;


          const paymentLabel =
            profile.paymentMethod ===
              "Other" &&
            profile.otherPaymentMethod
              ? `Other · ${profile.otherPaymentMethod}`
              : profile.paymentMethod;


          return `
            <button
              type="button"
              data-merchant-memory="${escapeHTML(
                profile.name
              )}"
            >
              <span class="merchant-memory-icon">🏪</span>

              <span class="merchant-memory-copy">
                <strong>
                  ${escapeHTML(
                    profile.name
                  )}
                </strong>

                <small>
                  ${escapeHTML(
                    categoryLabel ||
                    "Other"
                  )}
                  ·
                  ${escapeHTML(
                    paymentLabel ||
                    "Cash"
                  )}
                  ${
                    profile.count >
                    1
                      ? ` · used ${profile.count}×`
                      : ""
                  }
                </small>
              </span>

              <span class="merchant-memory-arrow">›</span>
            </button>
          `;

        }
      )
      .join("");


  merchantMemorySuggestions.hidden =
    false;


  merchantMemorySuggestions
    .querySelectorAll(
      "[data-merchant-memory]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            const profile =
              matches.find(
                (
                  item
                ) =>
                  item.name ===
                  button.dataset
                    .merchantMemory
              );


            if (
              !profile
            ) {

              return;

            }


            expenseLocation.value =
              profile.name;


            expenseCategory.value =
              profile.category ||
              "Other";


            if (
              expenseOtherCategory
            ) {

              expenseOtherCategory.value =
                profile.otherCategory ||
                "";

            }


            updateExpenseOtherCategoryVisibility();


            const payment =
              document.getElementById(
                "paymentMethod"
              );


            if (
              payment
            ) {

              payment.value =
                profile.paymentMethod ||
                "Cash";

            }


            if (
              expenseOtherPaymentMethod
            ) {

              expenseOtherPaymentMethod.value =
                profile.otherPaymentMethod ||
                "";

            }


            updateExpenseOtherPaymentVisibility();


            closeMerchantMemorySuggestions();


            showToast(
              `${profile.name} remembered ✨`
            );

          }
        );

      }
    );

}


expenseLocation
  ?.addEventListener(
    "input",
    renderMerchantMemorySuggestions
  );


expenseLocation
  ?.addEventListener(
    "focus",
    renderMerchantMemorySuggestions
  );


document.addEventListener(
  "click",
  (
    event
  ) => {

    if (
      event.target.closest(
        ".merchant-memory-field"
      )
    ) {

      return;

    }


    closeMerchantMemorySuggestions();

  }
);


function populateExpenseBudgetDropdown() {

  if (
    !expenseBudget
  ) {

    return;

  }


  const options =
    budgets

      .map(
        (budget) => `

          <option
            value="${escapeHTML(
              budget.id
            )}"
          >

            ${escapeHTML(
              budget.name
            )}

            —

            ${formatCurrency(
              budget.amount,
              budget.currency
            )}

          </option>

        `
      )

      .join("");


  expenseBudget.innerHTML = `

    <option value="">
      No budget
    </option>

    ${options}

  `;

}


// ========================================
// EXPENSE TRIP DROPDOWN
// ========================================

const expenseTrip =
  document.getElementById(
    "expenseTrip"
  );


function populateExpenseTripDropdown() {

  if (
    !expenseTrip
  ) {

    return;

  }


  const currentValue =
    expenseTrip.value;


  const options =
    trips

      .map(
        (trip) => `

          <option
            value="${escapeHTML(
              trip.id
            )}"
          >

            ${escapeHTML(
              trip.name
            )}

            ${
              trip.destination
                ? `— ${escapeHTML(
                    trip.destination
                  )}`
                : ""
            }

          </option>

        `
      )

      .join("");


  expenseTrip.innerHTML = `

    <option value="">
      Personal / No Trip
    </option>

    ${options}

  `;


  if (
    currentValue &&
    trips.some(
      (trip) =>
        trip.id ===
        currentValue
    )
  ) {

    expenseTrip.value =
      currentValue;

  }

}



const expenseSettlementSection =
  document.getElementById(
    "expenseSettlementSection"
  );


const expenseSharedToggle =
  document.getElementById(
    "expenseSharedToggle"
  );


const expenseSettlementFields =
  document.getElementById(
    "expenseSettlementFields"
  );


const expenseSettlementPayer =
  document.getElementById(
    "expenseSettlementPayer"
  );


const expenseSettlementSplitMode =
  document.getElementById(
    "expenseSettlementSplitMode"
  );


const expenseSettlementParticipants =
  document.getElementById(
    "expenseSettlementParticipants"
  );


function getExpenseSettlementTrip() {

  return trips.find(
    (
      trip
    ) =>
      trip.id ===
      expenseTrip?.value
  ) ||
    null;

}


function getExpenseSettlementContext(
  createIfMissing =
    false
) {

  const trip =
    getExpenseSettlementTrip();


  if (
    !trip
  ) {

    return {
      trip: null,
      settlement: null
    };

  }


  return {
    trip,
    settlement:
      getSettlementForTrip(
        trip.id,
        createIfMissing
      )
  };

}


function getExpenseSettlementAmount(
  trip
) {

  if (
    !trip
  ) {

    return 0;

  }


  return convertCurrency(
    Number(
      amountInput?.value ||
      0
    ),
    currencySelect?.value ||
      "PHP",
    trip.currency ||
      "PHP"
  );

}


function renderExpenseSettlementParticipants(
  expense =
    null
) {

  if (
    !expenseSettlementParticipants
  ) {

    return;

  }


  const {
    trip,
    settlement
  } =
    getExpenseSettlementContext(
      true
    );


  if (
    !trip ||
    !settlement
  ) {

    expenseSettlementParticipants.innerHTML =
      "";


    return;

  }


  const splitMode =
    expenseSettlementSplitMode?.value ||
    "equal";


  const existingShares =
    new Map(
      (
        Array.isArray(
          expense?.settlementShares
        )
          ? expense.settlementShares
          : []
      ).map(
        (
          share
        ) => [
          share.personId,
          Number(
            share.amount ||
            0
          )
        ]
      )
    );


  const hasStoredShares =
    existingShares.size >
    0;


  expenseSettlementParticipants.innerHTML =
    settlement.people
      .map(
        (
          person
        ) => {

          const selected =
            hasStoredShares
              ? existingShares.has(
                  person.id
                )
              : true;


          return `
            <label class="shared-participant-row expense-linked-participant">

              <input
                type="checkbox"
                data-expense-settlement-person="${escapeHTML(
                  person.id
                )}"
                ${
                  selected
                    ? "checked"
                    : ""
                }
              >

              <span class="shared-participant-avatar">
                ${escapeHTML(
                  person.name
                    .slice(
                      0,
                      1
                    )
                    .toUpperCase()
                )}
              </span>

              <strong>
                ${escapeHTML(
                  person.name
                )}
              </strong>

              ${
                splitMode ===
                "exact"
                  ? `
                      <input
                        class="shared-exact-amount"
                        type="number"
                        inputmode="decimal"
                        min="0"
                        step="0.01"
                        data-expense-settlement-exact="${escapeHTML(
                          person.id
                        )}"
                        value="${
                          existingShares.has(
                            person.id
                          )
                            ? existingShares.get(
                                person.id
                              )
                            : ""
                        }"
                        placeholder="0"
                      >
                    `
                  : `
                      <span class="shared-equal-label">
                        Equal
                      </span>
                    `
              }

            </label>
          `;

        }
      )
      .join("");

}


function updateExpenseSettlementValidation() {

  const validation =
    document.getElementById(
      "expenseSettlementValidation"
    );


  if (
    !validation
  ) {

    return;

  }


  if (
    !expenseSharedToggle?.checked
  ) {

    validation.textContent =
      "";


    validation.classList.remove(
      "error"
    );


    return;

  }


  const {
    trip,
    settlement
  } =
    getExpenseSettlementContext(
      true
    );


  if (
    !trip ||
    !settlement
  ) {

    validation.textContent =
      "Choose a trip first.";


    validation.classList.add(
      "error"
    );


    return;

  }


  const selected =
    Array.from(
      document.querySelectorAll(
        "#expenseSettlementParticipants [data-expense-settlement-person]:checked"
      )
    );


  if (
    selected.length ===
    0
  ) {

    validation.textContent =
      "Choose at least one person.";


    validation.classList.add(
      "error"
    );


    return;

  }


  const settlementAmount =
    getExpenseSettlementAmount(
      trip
    );


  const splitMode =
    expenseSettlementSplitMode?.value ||
    "equal";


  if (
    splitMode ===
    "equal"
  ) {

    validation.classList.remove(
      "error"
    );


    validation.textContent =
      `${selected.length} ${
        selected.length ===
        1
          ? "person"
          : "people"
      } · ${formatSettlementAmount(
        settlementAmount,
        trip.currency
      )} split equally.`;

    return;

  }


  const exactTotal =
    selected.reduce(
      (
        total,
        checkbox
      ) => {

        const personId =
          checkbox.dataset
            .expenseSettlementPerson;


        const input =
          document.querySelector(
            `[data-expense-settlement-exact="${CSS.escape(
              personId
            )}"]`
          );


        return total +
          Number(
            input?.value ||
            0
          );

      },
      0
    );


  const invalid =
    Math.abs(
      exactTotal -
      settlementAmount
    ) >
    0.01;


  validation.classList.toggle(
    "error",
    invalid
  );


  validation.textContent =
    `Assigned ${formatSettlementAmount(
      exactTotal,
      trip.currency
    )} of ${formatSettlementAmount(
      settlementAmount,
      trip.currency
    )}.`;

}


function renderExpenseSettlementControls(
  expense =
    null,
  preserveToggle =
    false
) {

  if (
    !expenseSettlementSection ||
    !expenseSharedToggle ||
    !expenseSettlementFields
  ) {

    return;

  }


  const trip =
    getExpenseSettlementTrip();


  if (
    !trip
  ) {

    expenseSettlementSection.hidden =
      true;


    expenseSharedToggle.checked =
      false;


    expenseSettlementFields.hidden =
      true;


    return;

  }


  expenseSettlementSection.hidden =
    false;


  const settlement =
    getSettlementForTrip(
      trip.id,
      true
    );


  const editingSameTrip =
    Boolean(
      expense &&
      expense.tripId ===
        trip.id
    );


  if (
    !preserveToggle
  ) {

    expenseSharedToggle.checked =
      editingSameTrip
        ? Boolean(
            expense.settlementShared
          )
        : false;

  }


  expenseSettlementFields.hidden =
    !expenseSharedToggle.checked;


  const tripName =
    document.getElementById(
      "expenseSettlementTripName"
    );


  const currencyNote =
    document.getElementById(
      "expenseSettlementCurrencyNote"
    );


  if (
    tripName
  ) {

    tripName.textContent =
      `${trip.name} settlement`;

  }


  if (
    currencyNote
  ) {

    currencyNote.textContent =
      currencySelect?.value &&
      currencySelect.value !==
        trip.currency
        ? `Settlement uses ${trip.currency}; Momo converts this ${currencySelect.value} expense automatically.`
        : `Settlement currency: ${trip.currency}`;

  }


  if (
    expenseSettlementPayer
  ) {

    expenseSettlementPayer.innerHTML =
      settlement.people
        .map(
          (
            person
          ) =>
            `
              <option value="${escapeHTML(
                person.id
              )}">
                ${escapeHTML(
                  person.name
                )}
              </option>
            `
        )
        .join("");


    const storedPayer =
      editingSameTrip
        ? expense.settlementPayerId
        : "";


    expenseSettlementPayer.value =
      settlement.people.some(
        (
          person
        ) =>
          person.id ===
          storedPayer
      )
        ? storedPayer
        : (
            settlement.people.find(
              (
                person
              ) =>
                person.isYou
            )?.id ||
            settlement.people[
              0
            ]?.id ||
            ""
          );

  }


  if (
    expenseSettlementSplitMode
  ) {

    expenseSettlementSplitMode.value =
      editingSameTrip &&
      expense.settlementSplitMode ===
        "exact"
        ? "exact"
        : "equal";

  }


  renderExpenseSettlementParticipants(
    editingSameTrip
      ? expense
      : null
  );


  updateExpenseSettlementValidation();

}


function collectExpenseSettlementData(
  selectedTrip,
  previous =
    null
) {

  if (
    !selectedTrip ||
    !expenseSharedToggle?.checked
  ) {

    return {
      settlementShared:
        false,
      settlementPayerId:
        "",
      settlementSplitMode:
        "",
      settlementShares:
        [],
      settlementAmount:
        0,
      settlementCurrency:
        ""
    };

  }


  const settlement =
    getSettlementForTrip(
      selectedTrip.id,
      true
    );


  const payerId =
    expenseSettlementPayer?.value ||
    "";


  const checkedIds =
    Array.from(
      document.querySelectorAll(
        "#expenseSettlementParticipants [data-expense-settlement-person]:checked"
      )
    ).map(
      (
        checkbox
      ) =>
        checkbox.dataset
          .expenseSettlementPerson
    );


  if (
    !settlement ||
    !settlement.people.some(
      (
        person
      ) =>
        person.id ===
        payerId
    )
  ) {

    throw new Error(
      "Choose who paid this expense."
    );

  }


  if (
    checkedIds.length ===
    0
  ) {

    throw new Error(
      "Choose at least one person to split this expense with."
    );

  }


  const settlementAmount =
    getExpenseSettlementAmount(
      selectedTrip
    );


  if (
    !Number.isFinite(
      settlementAmount
    ) ||
    settlementAmount <=
    0
  ) {

    throw new Error(
      "Enter a valid expense amount."
    );

  }


  const splitMode =
    expenseSettlementSplitMode?.value ===
      "exact"
      ? "exact"
      : "equal";


  let shares =
    [];


  if (
    splitMode ===
    "equal"
  ) {

    const rawShare =
      settlementAmount /
      checkedIds.length;


    let assigned =
      0;


    shares =
      checkedIds.map(
        (
          personId,
          index
        ) => {

          const shareAmount =
            index ===
              checkedIds.length -
              1
              ? settlementAmount -
                assigned
              : Math.round(
                  rawShare *
                  100
                ) /
                100;


          assigned +=
            shareAmount;


          return {
            personId,
            amount:
              shareAmount
          };

        }
      );

  } else {

    shares =
      checkedIds.map(
        (
          personId
        ) => {

          const input =
            document.querySelector(
              `[data-expense-settlement-exact="${CSS.escape(
                personId
              )}"]`
            );


          return {
            personId,
            amount:
              Number(
                input?.value ||
                0
              )
          };

        }
      );


    const total =
      shares.reduce(
        (
          sum,
          share
        ) =>
          sum +
          share.amount,
        0
      );


    if (
      Math.abs(
        total -
        settlementAmount
      ) >
      0.01
    ) {

      throw new Error(
        "Exact settlement shares must add up to the expense amount."
      );

    }

  }


  return {
    settlementShared:
      true,
    settlementPayerId:
      payerId,
    settlementSplitMode:
      splitMode,
    settlementShares:
      shares,
    settlementAmount:
      settlementAmount,
    settlementCurrency:
      selectedTrip.currency ||
      "PHP",
    settlementLinkedAt:
      previous?.settlementLinkedAt ||
      new Date()
        .toISOString()
  };

}


expenseTrip?.addEventListener(
  "change",
  () => {

    renderExpenseSettlementControls();

  }
);


expenseSharedToggle
  ?.addEventListener(
    "change",
    async () => {

      expenseSettlementFields.hidden =
        !expenseSharedToggle.checked;


      if (
        expenseSharedToggle.checked
      ) {

        const {
          settlement
        } =
          getExpenseSettlementContext(
            true
          );


        if (
          settlement
        ) {

          await saveTravelSettlements();


          const currentExpense =
            expenses.find(
              (
                expense
              ) =>
                expense.id ===
                (
                  expenseIdInput?.value ||
                  editingExpenseId
                )
            ) ||
            null;


          /*
            Important:
            preserveToggle=true keeps the switch ON while the
            settlement controls are populated for a new expense.
            Previously this rerender reset new expenses to OFF.
          */
          renderExpenseSettlementControls(
            currentExpense,
            true
          );

        }

      }


      updateExpenseSettlementValidation();

    }
  );


expenseSettlementSplitMode
  ?.addEventListener(
    "change",
    () => {

      const currentExpense =
        expenses.find(
          (
            expense
          ) =>
            expense.id ===
            (
              expenseIdInput?.value ||
              editingExpenseId
            )
        );


      renderExpenseSettlementParticipants(
        currentExpense
      );


      updateExpenseSettlementValidation();

    }
  );


expenseSettlementParticipants
  ?.addEventListener(
    "change",
    updateExpenseSettlementValidation
  );


expenseSettlementParticipants
  ?.addEventListener(
    "input",
    updateExpenseSettlementValidation
  );


amountInput?.addEventListener(
  "input",
  updateExpenseSettlementValidation
);


currencySelect?.addEventListener(
  "change",
  () => {

    const currentExpense =
      expenses.find(
        (
          expense
        ) =>
          expense.id ===
          (
            expenseIdInput?.value ||
            editingExpenseId
          )
      );


    renderExpenseSettlementControls(
      currentExpense
    );

  }
);


document
  .getElementById(
    "openTravelSettlementFromExpense"
  )
  ?.addEventListener(
    "click",
    () => {

      activeSettlementTripId =
        expenseTrip?.value ||
        "";


      showScreen(
        "settlement"
      );

    }
  );


expenseCategory?.addEventListener(
  "change",
  updateExpenseOtherCategoryVisibility
);


document
  .getElementById(
    "paymentMethod"
  )
  ?.addEventListener(
    "change",
    updateExpenseOtherPaymentVisibility
  );


expenseBudget?.addEventListener(
  "change",
  () => {

    const budget =
      budgets.find(
        (item) =>
          item.id ===
          expenseBudget.value
      );


    if (
      !budget
    ) {

      return;

    }


    expenseCategory.value =
      budget.category;


    if (
      expenseOtherCategory
    ) {

      expenseOtherCategory.value =
        budget.otherCategory ||
        "";

    }


    updateExpenseOtherCategoryVisibility();


    currencySelect.value =
      budget.currency;


    updateExpenseConversion();

  }
);


// ========================================
// BUDGET MODAL
// ========================================

const budgetModal =
  document.getElementById(
    "budgetModal"
  );


const budgetForm =
  document.getElementById(
    "budgetForm"
  );


const budgetId =
  document.getElementById(
    "budgetId"
  );


const budgetName =
  document.getElementById(
    "budgetName"
  );


const budgetCategory =
  document.getElementById(
    "budgetCategory"
  );


const budgetOtherCategoryRow =
  document.getElementById(
    "budgetOtherCategoryRow"
  );


const budgetOtherCategory =
  document.getElementById(
    "budgetOtherCategory"
  );


function updateBudgetOtherCategoryVisibility() {

  updateOptionalOtherField(
    budgetCategory,
    budgetOtherCategoryRow,
    budgetOtherCategory
  );

}


budgetCategory?.addEventListener(
  "change",
  updateBudgetOtherCategoryVisibility
);


const budgetAmount =
  document.getElementById(
    "budgetAmount"
  );


const budgetCurrency =
  document.getElementById(
    "budgetCurrency"
  );


const budgetPeriod =
  document.getElementById(
    "budgetPeriod"
  );


const budgetStartDate =
  document.getElementById(
    "budgetStartDate"
  );


const budgetEndDate =
  document.getElementById(
    "budgetEndDate"
  );


const customDateFields =
  document.getElementById(
    "customDateFields"
  );


const budgetDateRangeButton =
  document.getElementById(
    "budgetDateRangeButton"
  );


const budgetDateCalendar =
  document.getElementById(
    "budgetDateCalendar"
  );


const budgetDateRangePrimary =
  document.getElementById(
    "budgetDateRangePrimary"
  );


const budgetDateRangeSecondary =
  document.getElementById(
    "budgetDateRangeSecondary"
  );


const budgetCalendarMonth =
  document.getElementById(
    "budgetCalendarMonth"
  );


const budgetCalendarGrid =
  document.getElementById(
    "budgetCalendarGrid"
  );


let budgetCalendarViewDate =
  new Date();


function updateBudgetDateRangeSummary() {

  if (
    !budgetDateRangePrimary ||
    !budgetDateRangeSecondary
  ) {

    return;

  }


  const start =
    budgetStartDate?.value ||
    "";


  const end =
    budgetEndDate?.value ||
    "";


  if (
    !start
  ) {

    budgetDateRangePrimary.textContent =
      "Choose dates";


    budgetDateRangeSecondary.textContent =
      "Tap one day, or tap another date to make a range";


    return;

  }


  if (
    !end ||
    end ===
      start
  ) {

    budgetDateRangePrimary.textContent =
      formatTripRangeDisplayDate(
        start
      );


    budgetDateRangeSecondary.textContent =
      "1 day · tap another date to extend";


    return;

  }


  budgetDateRangePrimary.textContent =
    `${formatTripRangeDisplayDate(
      start
    )} – ${formatTripRangeDisplayDate(
      end
    )}`;


  const startDate =
    createLocalDate(
      start
    );


  const endDate =
    createLocalDate(
      end
    );


  const days =
    Math.round(
      (
        endDate -
        startDate
      ) /
      86400000
    ) +
    1;


  budgetDateRangeSecondary.textContent =
    `${days} days · tap a new date to start over`;

}


function setBudgetCalendarViewFromDate(
  dateString
) {

  const date =
    createLocalDate(
      dateString
    ) ||
    new Date();


  budgetCalendarViewDate =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    );

}


function isDateInsideBudgetRange(
  dateString
) {

  const start =
    budgetStartDate?.value ||
    "";


  const end =
    budgetEndDate?.value ||
    "";


  return Boolean(
    start &&
    end &&
    start !==
      end &&
    dateString >
      start &&
    dateString <
      end
  );

}


function renderBudgetCalendar() {

  if (
    !budgetCalendarGrid ||
    !budgetCalendarMonth
  ) {

    return;

  }


  const year =
    budgetCalendarViewDate
      .getFullYear();


  const month =
    budgetCalendarViewDate
      .getMonth();


  budgetCalendarMonth.textContent =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    ).format(
      budgetCalendarViewDate
    );


  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();


  const daysInMonth =
    new Date(
      year,
      month +
        1,
      0
    ).getDate();


  const today =
    getTodayString();


  const cells =
    [];


  for (
    let i = 0;
    i <
    firstDay;
    i++
  ) {

    cells.push(
      `<span class="trip-calendar-blank"></span>`
    );

  }


  for (
    let day = 1;
    day <=
    daysInMonth;
    day++
  ) {

    const dateString =
      `${year}-${String(
        month +
        1
      ).padStart(
        2,
        "0"
      )}-${String(
        day
      ).padStart(
        2,
        "0"
      )}`;


    const classes =
      [
        "trip-calendar-day"
      ];


    if (
      dateString ===
      today
    ) {

      classes.push(
        "today"
      );

    }


    if (
      dateString ===
      budgetStartDate?.value
    ) {

      classes.push(
        "start"
      );

    }


    if (
      dateString ===
        budgetEndDate?.value &&
      dateString !==
        budgetStartDate?.value
    ) {

      classes.push(
        "end"
      );

    }


    if (
      isDateInsideBudgetRange(
        dateString
      )
    ) {

      classes.push(
        "in-range"
      );

    }


    cells.push(
      `
        <button
          type="button"
          class="${classes.join(
            " "
          )}"
          data-budget-calendar-date="${dateString}"
          aria-label="${dateString}"
        >
          ${day}
        </button>
      `
    );

  }


  budgetCalendarGrid.innerHTML =
    cells.join(
      ""
    );


  budgetCalendarGrid
    .querySelectorAll(
      "[data-budget-calendar-date]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const dateString =
              button.dataset
                .budgetCalendarDate;


            const start =
              budgetStartDate.value;


            const end =
              budgetEndDate.value;


            if (
              !start ||
              (
                start &&
                end &&
                start !==
                  end
              )
            ) {

              budgetStartDate.value =
                dateString;


              budgetEndDate.value =
                dateString;

            } else if (
              dateString <
              start
            ) {

              budgetEndDate.value =
                start;


              budgetStartDate.value =
                dateString;

            } else {

              budgetEndDate.value =
                dateString;

            }


            updateBudgetDateRangeSummary();


            renderBudgetCalendar();

          }
        );

      }
    );

}


function openBudgetDateCalendar() {

  if (
    !budgetDateCalendar
  ) {

    return;

  }


  const willOpen =
    budgetDateCalendar.hidden;


  budgetDateCalendar.hidden =
    !willOpen;


  budgetDateRangeButton
    ?.setAttribute(
      "aria-expanded",
      String(
        willOpen
      )
    );


  if (
    willOpen
  ) {

    setBudgetCalendarViewFromDate(
      budgetStartDate.value ||
      getTodayString()
    );


    renderBudgetCalendar();

  }

}


budgetDateRangeButton
  ?.addEventListener(
    "click",
    openBudgetDateCalendar
  );


document
  .getElementById(
    "budgetCalendarPrev"
  )
  ?.addEventListener(
    "click",
    () => {

      budgetCalendarViewDate =
        new Date(
          budgetCalendarViewDate
            .getFullYear(),
          budgetCalendarViewDate
            .getMonth() -
            1,
          1
        );


      renderBudgetCalendar();

    }
  );


document
  .getElementById(
    "budgetCalendarNext"
  )
  ?.addEventListener(
    "click",
    () => {

      budgetCalendarViewDate =
        new Date(
          budgetCalendarViewDate
            .getFullYear(),
          budgetCalendarViewDate
            .getMonth() +
            1,
          1
        );


      renderBudgetCalendar();

    }
  );


function updateCustomDateVisibility() {

  const custom =
    budgetPeriod.value ===
    "custom";


  customDateFields.hidden =
    !custom;


  if (
    custom
  ) {

    updateBudgetDateRangeSummary();

  } else if (
    budgetDateCalendar
  ) {

    budgetDateCalendar.hidden =
      true;


    budgetDateRangeButton
      ?.setAttribute(
        "aria-expanded",
        "false"
      );

  }

}


function openBudgetModal(
  budget =
    null
) {

  budgetModal.hidden =
    false;


  if (
    budget
  ) {

    document
      .getElementById(
        "budgetModalTitle"
      )
      .textContent =
      "Edit Budget";


    budgetId.value =
      budget.id;


    budgetName.value =
      budget.name;


    budgetCategory.value =
      budget.category;


    budgetOtherCategory.value =
      budget.otherCategory ||
      "";


    updateBudgetOtherCategoryVisibility();


    budgetAmount.value =
      budget.amount;


    budgetCurrency.value =
      budget.currency;


    budgetPeriod.value =
      budget.period;


    budgetStartDate.value =
      budget.startDate ||
      "";


    budgetEndDate.value =
      budget.endDate ||
      "";

  } else {

    budgetForm.reset();


    document
      .getElementById(
        "budgetModalTitle"
      )
      .textContent =
      "Add Budget";


    budgetId.value =
      "";


    budgetCurrency.value =
      "PHP";


    budgetPeriod.value =
      "monthly";

  }


  updateCustomDateVisibility();

  updateBudgetDateRangeSummary();

  if (
    budgetDateCalendar
  ) {

    budgetDateCalendar.hidden =
      true;

  }

  budgetDateRangeButton
    ?.setAttribute(
      "aria-expanded",
      "false"
    );

}


function closeBudgetModal() {

  budgetModal.hidden =
    true;

}


document
  .getElementById(
    "addBudgetButton"
  )
  ?.addEventListener(
    "click",
    () => {

      openBudgetModal();

    }
  );


document
  .getElementById(
    "closeBudgetModal"
  )
  ?.addEventListener(
    "click",
    closeBudgetModal
  );


budgetModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      budgetModal
    ) {

      closeBudgetModal();

    }

  }
);


budgetPeriod?.addEventListener(
  "change",
  updateCustomDateVisibility
);


// ========================================
// SAVE BUDGET
// ========================================

budgetForm?.addEventListener(
  "submit",
  async (
    event
  ) => {

    event.preventDefault();


    const budgetNameValue =
      budgetName?.value
        .trim() ||
      "";


    const budgetAmountValue =
      Number(
        budgetAmount?.value ||
        0
      );


    if (
      !budgetNameValue
    ) {

      showToast(
        "Give this budget a name."
      );


      budgetName?.focus();


      return;

    }


    if (
      !Number.isFinite(
        budgetAmountValue
      ) ||
      budgetAmountValue <=
        0
    ) {

      showToast(
        "Enter a budget amount greater than 0."
      );


      budgetAmount?.focus();


      return;

    }


    if (
      budgetPeriod.value ===
        "custom" &&
      (
        !budgetStartDate.value ||
        !budgetEndDate.value
      )
    ) {

      showToast(
        "Choose a budget date. One day is okay."
      );


      openBudgetDateCalendar();


      return;

    }


    if (
      budgetPeriod.value ===
        "custom" &&
      budgetStartDate.value >
        budgetEndDate.value
    ) {

      showToast(
        "The budget end date can't be before the start date."
      );


      openBudgetDateCalendar();


      return;

    }


    const existingId =
      budgetId.value;


    const previous =
      budgets.find(
        (item) =>
          item.id ===
          existingId
      );


    const budget = {

      id:
        existingId ||
        generateId(
          "budget"
        ),

      name:
        budgetNameValue,

      category:
        budgetCategory.value,

      otherCategory:
        budgetCategory.value ===
          "Other"
          ? (
              budgetOtherCategory?.value
                .trim() ||
              ""
            )
          : "",

      amount:
        budgetAmountValue,

      currency:
        budgetCurrency.value,

      period:
        budgetPeriod.value,

      startDate:
        budgetPeriod.value ===
        "custom"

          ? budgetStartDate.value

          : "",

      endDate:
        budgetPeriod.value ===
        "custom"

          ? budgetEndDate.value

          : "",

      createdAt:
        previous?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    await putRecord(
      STORES.budgets,
      budget
    );


    await loadAppData();


    closeBudgetModal();

    renderAll();


    showToast(
      existingId

        ? "Budget updated ✨"

        : "Budget added ✿"
    );

  }
);


// ========================================
// EDIT / DELETE BUDGET
// ========================================

function attachBudgetActions() {

  document
    .querySelectorAll(
      ".edit-budget"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          (event) => {

            event.stopPropagation();

            const budget =
              budgets.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .budgetId
              );


            if (
              budget
            ) {

              openBudgetModal(
                budget
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-budget"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          (event) => {

            event.stopPropagation();

            budgetPendingDelete =
              button.dataset
                .budgetId;


            document
              .getElementById(
                "deleteModal"
              )
              .hidden =
              false;

          }
        );

      }
    );

}


document
  .getElementById(
    "cancelDelete"
  )
  ?.addEventListener(
    "click",
    () => {

      budgetPendingDelete =
        null;


      document
        .getElementById(
          "deleteModal"
        )
        .hidden =
        true;

    }
  );


document
  .getElementById(
    "confirmDelete"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !budgetPendingDelete
      ) {

        return;

      }


      await deleteRecord(
        STORES.budgets,
        budgetPendingDelete
      );


      budgetPendingDelete =
        null;


      document
        .getElementById(
          "deleteModal"
        )
        .hidden =
        true;


      await loadAppData();


      renderAll();


      showToast(
        "Budget deleted"
      );

    }
  );


// ========================================
// TRIP HELPERS
// ========================================

function getTripStatus(
  trip
) {

  const today =
    new Date();


  today.setHours(
    0,
    0,
    0,
    0
  );


  const start =
    createLocalDate(
      trip.startDate
    );


  const end =
    createLocalDate(
      trip.endDate
    );


  end.setHours(
    23,
    59,
    59,
    999
  );


  if (
    today <
    start
  ) {

    return "Upcoming";

  }


  if (
    today >
    end
  ) {

    return "Past";

  }


  return "Current";

}


function getTripDuration(
  trip
) {

  const start =
    createLocalDate(
      trip.startDate
    );


  const end =
    createLocalDate(
      trip.endDate
    );


  const difference =
    end -
    start;


  const days =
    Math.floor(
      difference /
      (
        1000 *
        60 *
        60 *
        24
      )
    ) +
    1;


  return Math.max(
    days,
    1
  );

}


function getTripSpent(
  trip
) {

  /*
    Trip spending is calculated from expenses
    linked to this trip through tripId.
  */

  return expenses

    .filter(
      (expense) =>
        expense.tripId ===
        trip.id
    )

    .reduce(
      (
        total,
        expense
      ) => {

        return (
          total +
          convertCurrency(
            expense.amount,
            expense.currency,
            trip.currency
          )
        );

      },
      0
    );

}


function createTripCardHTML(
  trip
) {

  const status =
    getTripStatus(
      trip
    );


  const duration =
    getTripDuration(
      trip
    );


  const spent =
    getTripSpent(
      trip
    );


  const remaining =
    Math.max(
      Number(
        trip.budget
      ) -
      spent,
      0
    );


  const percentage =
    Number(
      trip.budget
    ) >
    0

      ? Math.min(
          (
            spent /
            Number(
              trip.budget
            )
          ) *
            100,
          100
        )

      : 0;


  const dailyBudget =
    Number(
      trip.dailyBudget ||
      0
    );


  return `

    <article class="trip-entry-card">

      <div class="trip-entry-banner">

        <div class="trip-entry-top">

          <span class="trip-status-pill">

            ${escapeHTML(
              status
            )}

          </span>


          <div class="trip-entry-actions">

            <button
              class="trip-banner-btn edit-trip"
              type="button"
              data-trip-id="${escapeHTML(
                trip.id
              )}"
              aria-label="Edit trip"
            >
              ✎
            </button>


            <button
              class="trip-banner-btn delete-trip"
              type="button"
              data-trip-id="${escapeHTML(
                trip.id
              )}"
              aria-label="Delete trip"
            >
              🗑
            </button>

          </div>

        </div>


        <div class="trip-entry-copy">

          <p class="eyebrow light">

            ${escapeHTML(
              trip.destination
            )}

          </p>


          <h2>

            ${escapeHTML(
              trip.name
            )}

            ✈️

          </h2>


          <p>

            ${formatDate(
              trip.startDate
            )}

            –

            ${formatDate(
              trip.endDate
            )}

          </p>

        </div>

      </div>


      <div class="trip-entry-body">

        <button
          class="trip-quick-expense-btn"
          type="button"
          data-trip-expense-id="${escapeHTML(
            trip.id
          )}"
          aria-label="Add expense to ${escapeHTML(
            trip.name ||
            "this trip"
          )}"
        >
          <span class="trip-quick-expense-icon" aria-hidden="true">＋</span>
          <span class="trip-quick-expense-copy">
            <strong>Add Expense</strong>
            <small>Automatically add it to this trip</small>
          </span>
          <span class="trip-quick-expense-arrow" aria-hidden="true">›</span>
        </button>


        <button
          class="trip-dashboard-open"
          type="button"
          data-trip-id="${escapeHTML(
            trip.id
          )}"
        >
          <span>
            View Trip Dashboard
          </span>

          <span aria-hidden="true">
            ›
          </span>
        </button>


        <div class="trip-info-row">

          <div class="trip-info-cell">

            <span>
              Budget
            </span>

            <strong>

              ${formatCurrency(
                trip.budget,
                trip.currency
              )}

            </strong>

          </div>


          <div class="trip-info-cell">

            <span>
              Spent
            </span>

            <strong>

              ${formatCurrency(
                spent,
                trip.currency
              )}

            </strong>

          </div>


          <div class="trip-info-cell">

            <span>
              Left
            </span>

            <strong class="positive">

              ${formatCurrency(
                remaining,
                trip.currency
              )}

            </strong>

          </div>

        </div>


        <div class="progress-track">

          <div
            class="progress-fill"
            style="width:${percentage}%"
          ></div>

        </div>


        <div class="trip-daily-row">

          <span>

            ${duration}
            ${duration === 1 ? "day" : "days"}

          </span>


          <span>

            Daily budget:

            <strong>

              ${
                dailyBudget >
                0

                  ? formatCurrency(
                      dailyBudget,
                      trip.currency
                    )

                  : "Not set"
              }

            </strong>

          </span>

        </div>


        ${
          trip.notes

            ? `

              <p class="trip-notes-preview">

                ${escapeHTML(
                  trip.notes
                )}

              </p>

            `

            : ""
        }

      </div>

    </article>

  `;

}


// ========================================
// RENDER TRIPS
// ========================================

const tripList =
  document.getElementById(
    "tripList"
  );


const homeTripSnapshot =
  document.getElementById(
    "homeTripSnapshot"
  );


function renderTrips() {

  if (
    tripList
  ) {

    if (
      trips.length ===
      0
    ) {

      tripList.innerHTML = `

        <div class="empty-panel">

          <span class="empty-icon">
            ✈️
          </span>

          <h3>
            No trips yet
          </h3>

          <p>
            Tap + to add your first trip.
          </p>

        </div>

      `;

    } else {

      tripList.innerHTML =
        trips

          .map(
            createTripCardHTML
          )

          .join("");

    }

  }


  renderHomeTripSnapshot();


  attachTripActions();

  attachTripDashboardActions();

}


// ========================================
// HOME TRIP SNAPSHOT
// ========================================

function renderHomeTripSnapshot() {

  if (
    !homeTripSnapshot
  ) {

    return;

  }


  if (
    trips.length ===
    0
  ) {

    homeTripSnapshot.innerHTML = `

      <button
        class="momo-adventure-empty"
        type="button"
        data-nav="trips"
      >
        <span class="momo-adventure-empty-icon">✈️</span>

        <span>
          <strong>Your next adventure starts here.</strong>
          <small>Add a trip whenever you're ready to wander.</small>
        </span>

        <b>＋</b>
      </button>

    `;


    return;

  }


  const today =
    new Date();


  today.setHours(
    0,
    0,
    0,
    0
  );


  const currentTrips =
    trips.filter(
      (
        trip
      ) =>
        getTripStatus(
          trip
        ) ===
        "Current"
    );


  const upcomingTrips =
    trips
      .filter(
        (
          trip
        ) =>
          createLocalDate(
            trip.startDate
          ) >=
          today
      )
      .sort(
        (
          a,
          b
        ) =>
          String(
            a.startDate
          ).localeCompare(
            String(
              b.startDate
            )
          )
      );


  const trip =
    currentTrips[
      0
    ] ||
    upcomingTrips[
      0
    ] ||
    trips[
      trips.length -
      1
    ];


  const spent =
    getTripSpent(
      trip
    );


  const remaining =
    Number(
      trip.budget ||
      0
    ) -
    spent;


  const start =
    createLocalDate(
      trip.startDate
    );


  const status =
    getTripStatus(
      trip
    );


  const daysUntil =
    start
      ? Math.ceil(
          (
            start -
            today
          ) /
          86400000
        )
      : 0;


  let countdownText =
    "";


  if (
    status ===
    "Current"
  ) {

    countdownText =
      "You're there! ✨";

  } else if (
    daysUntil >
    1
  ) {

    countdownText =
      `${daysUntil} days to go ♡`;

  } else if (
    daysUntil ===
    1
  ) {

    countdownText =
      "Tomorrow! ♡";

  } else {

    countdownText =
      "A sweet little memory ♡";

  }


  homeTripSnapshot.innerHTML = `

    <button
      class="momo-adventure-card"
      type="button"
      data-nav="trips"
    >

      <div class="momo-adventure-top">

        <div class="momo-adventure-icon">
          ✈
        </div>

        <div class="momo-adventure-copy">

          <span class="momo-adventure-status">
            ${escapeHTML(
              status
            )}
          </span>

          <h3>
            ${escapeHTML(
              trip.name
            )}
          </h3>

          <p>
            ${escapeHTML(
              trip.destination ||
              "Adventure"
            )}
          </p>

        </div>

        <span class="momo-adventure-arrow">
          ›
        </span>

      </div>


      <div class="momo-adventure-date">

        <span>
          ${
            trip.startDate &&
            trip.endDate &&
            trip.startDate ===
              trip.endDate

              ? formatShortDate(
                  trip.startDate
                )

              : `${formatShortDate(
                  trip.startDate
                )} – ${formatShortDate(
                  trip.endDate
                )}`
          }
        </span>

        <strong>
          ${escapeHTML(
            countdownText
          )}
        </strong>

      </div>


      <div class="momo-adventure-money">

        <div>
          <small>Budget</small>
          <strong>
            ${formatCurrency(
              trip.budget,
              trip.currency
            )}
          </strong>
        </div>

        <div>
          <small>Spent</small>
          <strong>
            ${formatCurrency(
              spent,
              trip.currency
            )}
          </strong>
        </div>

        <div>
          <small>
            ${
              remaining >=
              0
                ? "Left"
                : "Over"
            }
          </small>

          <strong class="${
            remaining >=
            0
              ? "positive"
              : "danger"
          }">
            ${formatCurrency(
              Math.abs(
                remaining
              ),
              trip.currency
            )}
          </strong>
        </div>

      </div>

    </button>

  `;

}


// ========================================
// TRIP MODAL
// ========================================

const tripModal =
  document.getElementById(
    "tripModal"
  );


const tripForm =
  document.getElementById(
    "tripForm"
  );


const tripId =
  document.getElementById(
    "tripId"
  );


const tripName =
  document.getElementById(
    "tripName"
  );


const tripDestination =
  document.getElementById(
    "tripDestination"
  );


const tripStartDate =
  document.getElementById(
    "tripStartDate"
  );


const tripEndDate =
  document.getElementById(
    "tripEndDate"
  );


const tripDateRangeButton =
  document.getElementById(
    "tripDateRangeButton"
  );


const tripDateCalendar =
  document.getElementById(
    "tripDateCalendar"
  );


const tripDateRangePrimary =
  document.getElementById(
    "tripDateRangePrimary"
  );


const tripDateRangeSecondary =
  document.getElementById(
    "tripDateRangeSecondary"
  );


const tripCalendarMonth =
  document.getElementById(
    "tripCalendarMonth"
  );


const tripCalendarGrid =
  document.getElementById(
    "tripCalendarGrid"
  );


let tripCalendarViewDate =
  new Date();


const tripBudget =
  document.getElementById(
    "tripBudget"
  );


const tripCurrency =
  document.getElementById(
    "tripCurrency"
  );


const tripDailyBudget =
  document.getElementById(
    "tripDailyBudget"
  );


const tripNotes =
  document.getElementById(
    "tripNotes"
  );



function formatTripRangeDisplayDate(
  dateString
) {

  if (
    !dateString
  ) {

    return "";

  }


  const date =
    createLocalDate(
      dateString
    );


  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  ).format(
    date
  );

}


function setTripCalendarViewFromDate(
  dateString
) {

  const date =
    createLocalDate(
      dateString
    ) ||
    new Date();


  tripCalendarViewDate =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    );

}


function updateTripDateRangeSummary() {

  if (
    !tripDateRangePrimary ||
    !tripDateRangeSecondary
  ) {

    return;

  }


  const start =
    tripStartDate?.value ||
    "";


  const end =
    tripEndDate?.value ||
    "";


  if (
    !start
  ) {

    tripDateRangePrimary.textContent =
      "Choose dates";


    tripDateRangeSecondary.textContent =
      "One tap = one day · tap another date to extend";


    return;

  }


  if (
    !end ||
    end ===
      start
  ) {

    tripDateRangePrimary.textContent =
      formatTripRangeDisplayDate(
        start
      );


    tripDateRangeSecondary.textContent =
      "1 day · tap another date to extend";


    return;

  }


  tripDateRangePrimary.textContent =
    `${formatTripRangeDisplayDate(
      start
    )} – ${formatTripRangeDisplayDate(
      end
    )}`;


  const startDate =
    createLocalDate(
      start
    );


  const endDate =
    createLocalDate(
      end
    );


  const days =
    Math.round(
      (
        endDate -
        startDate
      ) /
      86400000
    ) +
    1;


  tripDateRangeSecondary.textContent =
    `${days} ${
      days ===
      1
        ? "day"
        : "days"
    } · double-tap a selected date to remove it`;

}


function isDateInsideTripRange(
  dateString
) {

  const start =
    tripStartDate?.value ||
    "";


  const end =
    tripEndDate?.value ||
    "";


  return Boolean(
    start &&
    end &&
    dateString >
      start &&
    dateString <
      end
  );

}


function renderTripCalendar() {

  if (
    !tripCalendarGrid ||
    !tripCalendarMonth
  ) {

    return;

  }


  const year =
    tripCalendarViewDate
      .getFullYear();


  const month =
    tripCalendarViewDate
      .getMonth();


  tripCalendarMonth.textContent =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    ).format(
      tripCalendarViewDate
    );


  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();


  const daysInMonth =
    new Date(
      year,
      month +
        1,
      0
    ).getDate();


  const today =
    getTodayString();


  const cells =
    [];


  for (
    let i = 0;
    i <
    firstDay;
    i++
  ) {

    cells.push(
      `<span class="trip-calendar-blank"></span>`
    );

  }


  for (
    let day = 1;
    day <=
    daysInMonth;
    day++
  ) {

    const dateString =
      `${year}-${String(
        month +
        1
      ).padStart(
        2,
        "0"
      )}-${String(
        day
      ).padStart(
        2,
        "0"
      )}`;


    const classes =
      [
        "trip-calendar-day"
      ];


    if (
      dateString ===
      today
    ) {

      classes.push(
        "today"
      );

    }


    if (
      dateString ===
      tripStartDate?.value
    ) {

      classes.push(
        "start"
      );

    }


    if (
      dateString ===
      tripEndDate?.value
    ) {

      classes.push(
        "end"
      );

    }


    if (
      isDateInsideTripRange(
        dateString
      )
    ) {

      classes.push(
        "in-range"
      );

    }


    cells.push(
      `
        <button
          type="button"
          class="${classes.join(
            " "
          )}"
          data-trip-calendar-date="${dateString}"
          aria-label="${dateString}"
        >
          ${day}
        </button>
      `
    );

  }


  tripCalendarGrid.innerHTML =
    cells.join("");


  tripCalendarGrid
    .querySelectorAll(
      "[data-trip-calendar-date]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            const dateString =
              button.dataset
                .tripCalendarDate;


            if (
              !tripStartDate.value ||
              (
                tripStartDate.value &&
                tripEndDate.value &&
                tripStartDate.value !==
                  tripEndDate.value
              )
            ) {

              tripStartDate.value =
                dateString;


              tripEndDate.value =
                dateString;

            } else if (
              dateString <
              tripStartDate.value
            ) {

              tripEndDate.value =
                tripStartDate.value;


              tripStartDate.value =
                dateString;

            } else {

              tripEndDate.value =
                dateString;

            }


            updateTripDateRangeSummary();


            renderTripCalendar();

          }
        );

      }
    );

}


function openTripDateCalendar() {

  if (
    !tripDateCalendar
  ) {

    return;

  }


  const willOpen =
    tripDateCalendar.hidden;


  tripDateCalendar.hidden =
    !willOpen;


  tripDateRangeButton
    ?.setAttribute(
      "aria-expanded",
      String(
        willOpen
      )
    );


  if (
    willOpen
  ) {

    setTripCalendarViewFromDate(
      tripStartDate.value ||
      getTodayString()
    );


    renderTripCalendar();

  }

}


function closeTripDateCalendar() {

  if (
    !tripDateCalendar
  ) {

    return;

  }


  tripDateCalendar.hidden =
    true;


  tripDateRangeButton
    ?.setAttribute(
      "aria-expanded",
      "false"
    );

}


tripDateRangeButton
  ?.addEventListener(
    "click",
    openTripDateCalendar
  );


document
  .getElementById(
    "tripCalendarPrev"
  )
  ?.addEventListener(
    "click",
    () => {

      tripCalendarViewDate =
        new Date(
          tripCalendarViewDate
            .getFullYear(),
          tripCalendarViewDate
            .getMonth() -
            1,
          1
        );


      renderTripCalendar();

    }
  );


document
  .getElementById(
    "tripCalendarNext"
  )
  ?.addEventListener(
    "click",
    () => {

      tripCalendarViewDate =
        new Date(
          tripCalendarViewDate
            .getFullYear(),
          tripCalendarViewDate
            .getMonth() +
            1,
          1
        );


      renderTripCalendar();

    }
  );


function openTripModal(
  trip =
    null
) {

  tripModal.hidden =
    false;


  closeTripDateCalendar();


  tripCalendarLastTapDate =
    "";


  tripCalendarLastTapTime =
    0;


  if (
    trip
  ) {

    document
      .getElementById(
        "tripModalTitle"
      )
      .textContent =
      "Edit Trip";


    tripId.value =
      trip.id;


    tripName.value =
      trip.name;


    tripDestination.value =
      trip.destination;


    tripStartDate.value =
      trip.startDate;


    tripEndDate.value =
      trip.endDate;


    tripBudget.value =
      trip.budget;


    tripCurrency.value =
      trip.currency;


    tripDailyBudget.value =
      trip.dailyBudget ||
      "";


    tripNotes.value =
      trip.notes ||
      "";

  } else {

    tripForm.reset();


    document
      .getElementById(
        "tripModalTitle"
      )
      .textContent =
      "Add Trip";


    tripId.value =
      "";


    tripCurrency.value =
      "JPY";


    tripStartDate.value =
      "";


    tripEndDate.value =
      "";

  }


  updateTripDateRangeSummary();


  setTripCalendarViewFromDate(
    tripStartDate.value ||
    getTodayString()
  );

}


function closeTripModal() {

  closeTripDateCalendar();


  tripModal.hidden =
    true;

}


document
  .getElementById(
    "addTripButton"
  )
  ?.addEventListener(
    "click",
    () => {

      openTripModal();

    }
  );


document
  .getElementById(
    "closeTripModal"
  )
  ?.addEventListener(
    "click",
    closeTripModal
  );


tripModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      tripModal
    ) {

      closeTripModal();

    }

  }
);


// ========================================
// SAVE TRIP
// ========================================

tripForm?.addEventListener(
  "submit",
  async (
    event
  ) => {

    event.preventDefault();


    const tripNameValue =
      tripName?.value
        .trim() ||
      "";


    const tripDestinationValue =
      tripDestination?.value
        .trim() ||
      "";


    const tripBudgetValue =
      Number(
        tripBudget?.value ||
        0
      );


    const tripDailyBudgetValue =
      tripDailyBudget?.value
        ? Number(
            tripDailyBudget.value
          )
        : 0;


    if (
      !tripNameValue
    ) {

      showToast(
        "Give this trip a name."
      );


      tripName?.focus();


      return;

    }


    if (
      !tripDestinationValue
    ) {

      showToast(
        "Add a destination for this trip."
      );


      tripDestination?.focus();


      return;

    }


    if (
      !Number.isFinite(
        tripBudgetValue
      ) ||
      tripBudgetValue <
        0
    ) {

      showToast(
        "Enter a valid trip budget."
      );


      tripBudget?.focus();


      return;

    }


    if (
      !Number.isFinite(
        tripDailyBudgetValue
      ) ||
      tripDailyBudgetValue <
        0
    ) {

      showToast(
        "Enter a valid daily budget."
      );


      tripDailyBudget?.focus();


      return;

    }


    if (
      tripStartDate.value &&
      !tripEndDate.value
    ) {

      tripEndDate.value =
        tripStartDate.value;

    }


    if (
      !tripStartDate.value
    ) {

      showToast(
        "Choose a travel date. One day is okay."
      );


      openTripDateCalendar();


      return;

    }


    const start =
      createLocalDate(
        tripStartDate.value
      );


    const end =
      createLocalDate(
        tripEndDate.value
      );


    if (
      end <
      start
    ) {

      showToast(
        "End date can't be before the start date."
      );


      return;

    }


    const existingId =
      tripId.value;


    const previous =
      trips.find(
        (item) =>
          item.id ===
          existingId
      );


    const trip = {

      id:
        existingId ||
        generateId(
          "trip"
        ),

      name:
        tripNameValue,

      destination:
        tripDestinationValue,

      startDate:
        tripStartDate.value,

      endDate:
        tripEndDate.value,

      budget:
        tripBudgetValue,

      currency:
        tripCurrency.value,

      dailyBudget:
        tripDailyBudgetValue,

      notes:
        tripNotes.value
          .trim(),

      createdAt:
        previous?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    await putRecord(
      STORES.trips,
      trip
    );


    await loadAppData();


    closeTripModal();


    renderAll();


    showToast(
      existingId

        ? "Trip updated ✨"

        : "Trip added ✈️"
    );

  }
);



// ========================================
// TRIP DASHBOARD 2.0
// ========================================

const tripDashboardModal =
  document.getElementById(
    "tripDashboardModal"
  );


const tripDashboardBody =
  document.getElementById(
    "tripDashboardBody"
  );


let activeTripDashboardId =
  "";


function getTripExpenses(
  trip
) {

  return expenses.filter(
    (expense) =>
      expense.tripId ===
      trip.id
  );

}


function getTripPlannedExpenses(
  trip
) {

  return plannedExpenses.filter(
    (planned) =>
      planned.tripId ===
        trip.id &&
      planned.status ===
        "planned"
  );

}


function getTripPlannedTotal(
  trip
) {

  return getTripPlannedExpenses(
    trip
  ).reduce(
    (
      total,
      planned
    ) => {

      return (
        total +
        convertCurrency(
          planned.amount,
          planned.currency,
          trip.currency
        )
      );

    },
    0
  );

}


function getTripTodaySpent(
  trip
) {

  const today =
    getTodayString();


  return getTripExpenses(
    trip
  )

    .filter(
      (expense) =>
        expense.date ===
        today
    )

    .reduce(
      (
        total,
        expense
      ) => {

        return (
          total +
          convertCurrency(
            expense.amount,
            expense.currency,
            trip.currency
          )
        );

      },
      0
    );

}


function getTripDaysRemaining(
  trip
) {

  const today =
    createLocalDate(
      getTodayString()
    );


  const start =
    createLocalDate(
      trip.startDate
    );


  const end =
    createLocalDate(
      trip.endDate
    );


  if (
    !today ||
    !start ||
    !end
  ) {

    return 0;

  }


  if (
    today >
    end
  ) {

    return 0;

  }


  const effectiveStart =
    today <
    start
      ? start
      : today;


  return Math.max(
    Math.floor(
      (
        end -
        effectiveStart
      ) /
      86400000
    ) +
    1,
    1
  );

}


function getTripTopCategory(
  trip
) {

  const categoryTotals =
    new Map();


  getTripExpenses(
    trip
  ).forEach(
    (expense) => {

      const category =
        expense.category ||
        "Other";


      const amount =
        convertCurrency(
          expense.amount,
          expense.currency,
          trip.currency
        );


      categoryTotals.set(
        category,
        (
          categoryTotals.get(
            category
          ) ||
          0
        ) +
        amount
      );

    }
  );


  const sorted =
    Array.from(
      categoryTotals.entries()
    )

      .map(
        (
          [
            category,
            amount
          ]
        ) => ({
          category,
          amount
        })
      )

      .sort(
        (
          a,
          b
        ) =>
          b.amount -
          a.amount
      );


  return (
    sorted[
      0
    ] ||
    null
  );

}


function getTripCategoryBreakdown(
  trip
) {

  const tripExpenses =
    getTripExpenses(
      trip
    );


  const total =
    getTripSpent(
      trip
    );


  const grouped =
    new Map();


  tripExpenses.forEach(
    (expense) => {

      const category =
        expense.category ||
        "Other";


      const amount =
        convertCurrency(
          expense.amount,
          expense.currency,
          trip.currency
        );


      grouped.set(
        category,
        (
          grouped.get(
            category
          ) ||
          0
        ) +
        amount
      );

    }
  );


  return Array.from(
    grouped.entries()
  )

    .map(
      (
        [
          category,
          amount
        ]
      ) => ({
        category,
        amount,
        percent:
          total >
          0
            ? (
                amount /
                total
              ) *
              100
            : 0
      })
    )

    .sort(
      (
        a,
        b
      ) =>
        b.amount -
        a.amount
    );

}



async function saveTripShoppingItems() {

  await putRecord(
    STORES.settings,
    {
      key:
        TRIP_SHOPPING_SETTING_KEY,
      value:
        tripShoppingItems,
      updatedAt:
        new Date()
          .toISOString()
    }
  );

}


function getTripShoppingItems(
  tripId
) {

  return tripShoppingItems
    .filter(
      (
        item
      ) =>
        item.tripId ===
        tripId
    )
    .sort(
      (
        a,
        b
      ) => {

        if (
          Boolean(
            a.bought
          ) !==
          Boolean(
            b.bought
          )
        ) {

          return a.bought
            ? 1
            : -1;

        }


        return String(
          b.updatedAt ||
          b.createdAt ||
          ""
        ).localeCompare(
          String(
            a.updatedAt ||
            a.createdAt ||
            ""
          )
        );

      }
    );

}


function renderTripShoppingSection(
  trip
) {

  const items =
    getTripShoppingItems(
      trip.id
    );


  const bought =
    items.filter(
      (
        item
      ) =>
        item.bought
    );


  const targetTotal =
    items.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.targetPrice ||
          0
        ),
      0
    );


  const actualTotal =
    bought.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.actualPrice ||
          0
        ),
      0
    );


  return `

    <section class="trip-dashboard-section trip-shopping-section">

      <div class="trip-dashboard-section-heading">

        <div>
          <p class="eyebrow">Shopping list</p>
          <h3>Things I Want to Buy</h3>
        </div>

        <button
          class="text-btn trip-shopping-add"
          type="button"
        >
          ＋ Add
        </button>

      </div>


      <div class="trip-shopping-summary">

        <span>
          <small>Items</small>
          <strong>
            ${bought.length}/${items.length} bought
          </strong>
        </span>

        <span>
          <small>Target</small>
          <strong>
            ${formatCurrency(
              targetTotal,
              trip.currency
            )}
          </strong>
        </span>

        <span>
          <small>Actual</small>
          <strong>
            ${formatCurrency(
              actualTotal,
              trip.currency
            )}
          </strong>
        </span>

      </div>


      ${
        items.length
          ? `
              <div class="trip-shopping-list">

                ${items
                  .map(
                    (
                      item
                    ) => `

                      <article
                        class="trip-shopping-item ${
                          item.bought
                            ? "bought"
                            : ""
                        }"
                      >

                        <button
                          class="trip-shopping-item-main"
                          type="button"
                          data-edit-trip-shopping="${escapeHTML(
                            item.id
                          )}"
                        >

                          <span class="trip-shopping-thumb">

                            ${
                              item.photo
                                ? `
                                    <img
                                      src="${item.photo}"
                                      alt=""
                                    >
                                  `
                                : "🛍️"
                            }

                          </span>


                          <span class="trip-shopping-item-copy">

                            <strong>
                              ${escapeHTML(
                                item.name
                              )}
                            </strong>

                            ${
                              item.store
                                ? `
                                    <small>
                                      ⌖ ${escapeHTML(
                                        item.store
                                      )}
                                    </small>
                                  `
                                : ""
                            }

                            <em>
                              ${
                                item.bought
                                  ? (
                                      Number(
                                        item.actualPrice ||
                                        0
                                      ) >
                                      0
                                        ? `Bought · ${formatCurrency(
                                            item.actualPrice,
                                            trip.currency
                                          )}`
                                        : "Bought"
                                    )
                                  : (
                                      Number(
                                        item.targetPrice ||
                                        0
                                      ) >
                                      0
                                        ? `Target ${formatCurrency(
                                            item.targetPrice,
                                            trip.currency
                                          )}`
                                        : "Price not set"
                                    )
                              }
                            </em>

                          </span>

                          <span class="trip-shopping-chevron">
                            ›
                          </span>

                        </button>


                        <button
                          class="trip-shopping-toggle ${
                            item.bought
                              ? "done"
                              : ""
                          }"
                          type="button"
                          data-toggle-trip-shopping="${escapeHTML(
                            item.id
                          )}"
                        >
                          ${
                            item.bought
                              ? "✓ Bought"
                              : "○ Mark Bought"
                          }
                        </button>

                      </article>

                    `
                  )
                  .join("")}

              </div>
            `
          : `
              <button
                class="trip-shopping-empty trip-shopping-add"
                type="button"
              >
                <span>🛒</span>
                <strong>Start your shopping list</strong>
                <small>
                  Save things you want to look for during this trip.
                </small>
              </button>
            `
      }

    </section>

  `;

}


function renderTripDashboard(
  trip
) {

  if (
    !tripDashboardBody ||
    !tripDashboardModal
  ) {

    return;

  }


  activeTripDashboardId =
    trip.id;


  const title =
    document.getElementById(
      "tripDashboardTitle"
    );


  if (
    title
  ) {

    title.textContent =
      trip.name;

  }


  const spent =
    getTripSpent(
      trip
    );


  const planned =
    getTripPlannedTotal(
      trip
    );


  const budget =
    Number(
      trip.budget ||
      0
    );


  const projectedTotal =
    spent +
    planned;


  const projectedRemaining =
    budget -
    projectedTotal;


  const actualRemaining =
    budget -
    spent;


  const daysRemaining =
    getTripDaysRemaining(
      trip
    );


  const dailyAllowance =
    daysRemaining >
    0

      ? Math.max(
          projectedRemaining,
          0
        ) /
        daysRemaining

      : 0;


  const todaySpent =
    getTripTodaySpent(
      trip
    );


  const topCategory =
    getTripTopCategory(
      trip
    );


  const tripExpenses =
    getTripExpenses(
      trip
    );


  const plannedItems =
    getTripPlannedExpenses(
      trip
    );


  const categoryBreakdown =
    getTripCategoryBreakdown(
      trip
    );


  const receiptExpenses =
    tripExpenses.filter(
      (
        expense
      ) =>
        Boolean(
          expense.photo
        )
    );


  const tripSettlement =
    getSettlementForTrip(
      trip.id,
      false
    );


  const settlementTransfers =
    tripSettlement
      ? calculateSettlementTransfers(
          tripSettlement
        )
      : [];


  const settlementPeople =
    tripSettlement?.people?.length ||
    0;


  const budgetPercent =
    budget >
    0

      ? Math.min(
          (
            spent /
            budget
          ) *
          100,
          100
        )

      : 0;


  const projectedPercent =
    budget >
    0

      ? Math.min(
          (
            projectedTotal /
            budget
          ) *
          100,
          100
        )

      : 0;


  tripDashboardBody.innerHTML = `

    <section class="trip-dashboard-hero">

      <div class="trip-dashboard-hero-copy">

        <span class="trip-dashboard-status">
          ${escapeHTML(
            getTripStatus(
              trip
            )
          )}
        </span>

        <p>
          ${escapeHTML(
            trip.destination
          )}
        </p>

        <h3>
          ${escapeHTML(
            trip.name
          )}
        </h3>

        <small>
          ${formatDate(
            trip.startDate
          )}
          –
          ${formatDate(
            trip.endDate
          )}
          ·
          ${getTripDuration(
            trip
          )}
          ${
            getTripDuration(
              trip
            ) ===
            1
              ? "day"
              : "days"
          }
        </small>

      </div>

      <div class="trip-dashboard-hero-mark">
        旅
      </div>

    </section>


    <section class="trip-dashboard-budget-card">

      <div class="trip-dashboard-budget-top">

        <div>

          <span>
            Trip Budget
          </span>

          <strong>
            ${formatCurrency(
              budget,
              trip.currency
            )}
          </strong>

        </div>


        <div class="trip-dashboard-budget-left">

          <span>
            Actual Left
          </span>

          <strong class="${
            actualRemaining >=
            0
              ? "positive"
              : "danger"
          }">
            ${formatCurrency(
              actualRemaining,
              trip.currency
            )}
          </strong>

        </div>

      </div>


      <div class="trip-dashboard-progress">

        <div
          class="trip-dashboard-progress-spent"
          style="width:${budgetPercent}%"
        ></div>

        <div
          class="trip-dashboard-progress-planned"
          style="width:${Math.max(
            projectedPercent -
            budgetPercent,
            0
          )}%"
        ></div>

      </div>


      <div class="trip-dashboard-progress-legend">

        <span>
          <i class="spent"></i>
          Spent
          ${formatCurrency(
            spent,
            trip.currency
          )}
        </span>

        <span>
          <i class="planned"></i>
          Planned
          ${formatCurrency(
            planned,
            trip.currency
          )}
        </span>

      </div>

    </section>


    <section class="trip-dashboard-metrics">

      <article>

        <span>
          Spent
        </span>

        <strong>
          ${formatCurrency(
            spent,
            trip.currency
          )}
        </strong>

        <small>
          ${tripExpenses.length}
          ${
            tripExpenses.length ===
            1
              ? "expense"
              : "expenses"
          }
        </small>

      </article>


      <article>

        <span>
          Planned
        </span>

        <strong>
          ${formatCurrency(
            planned,
            trip.currency
          )}
        </strong>

        <small>
          ${plannedItems.length}
          ${
            plannedItems.length ===
            1
              ? "item"
              : "items"
          }
        </small>

      </article>


      <article>

        <span>
          Projected Left
        </span>

        <strong class="${
          projectedRemaining >=
          0
            ? "positive"
            : "danger"
        }">
          ${formatCurrency(
            projectedRemaining,
            trip.currency
          )}
        </strong>

        <small>
          after planned spending
        </small>

      </article>


      <article>

        <span>
          Daily Allowance
        </span>

        <strong>
          ${
            daysRemaining >
            0
              ? formatCurrency(
                  dailyAllowance,
                  trip.currency
                )
              : "—"
          }
        </strong>

        <small>
          ${
            daysRemaining >
            0
              ? `${daysRemaining} ${
                  daysRemaining ===
                  1
                    ? "day"
                    : "days"
                } left`
              : "trip ended"
          }
        </small>

      </article>


      <article>

        <span>
          Today
        </span>

        <strong>
          ${formatCurrency(
            todaySpent,
            trip.currency
          )}
        </strong>

        <small>
          today's spending
        </small>

      </article>


      <article>

        <span>
          Top Category
        </span>

        <strong>
          ${
            topCategory
              ? `${getCategoryEmoji(
                  topCategory.category
                )} ${escapeHTML(
                  topCategory.category
                )}`
              : "—"
          }
        </strong>

        <small>
          ${
            topCategory
              ? formatCurrency(
                  topCategory.amount,
                  trip.currency
                )
              : "no spending yet"
          }
        </small>

      </article>

    </section>


    <section class="trip-dashboard-section trip-dashboard-travel-hub">

      <div class="trip-dashboard-section-heading">

        <div>
          <p class="eyebrow">Trip hub</p>
          <h3>Receipts & Settlement</h3>
        </div>

      </div>


      <div class="trip-dashboard-hub-grid">

        <button
          class="trip-dashboard-hub-card trip-dashboard-open-receipts"
          type="button"
        >
          <span class="trip-dashboard-hub-icon">🧾</span>

          <span class="trip-dashboard-hub-copy">
            <small>Receipts</small>
            <strong>
              ${receiptExpenses.length}
              ${
                receiptExpenses.length ===
                  1
                  ? "photo"
                  : "photos"
              }
            </strong>
            <em>
              ${
                receiptExpenses.length
                  ? "View trip receipts"
                  : "Attach photos to expenses"
              }
            </em>
          </span>

          <span class="trip-dashboard-hub-arrow">›</span>
        </button>


        <button
          class="trip-dashboard-hub-card trip-dashboard-open-settlement"
          type="button"
        >
          <span class="trip-dashboard-hub-icon">🤝</span>

          <span class="trip-dashboard-hub-copy">
            <small>Settlement</small>

            ${
              tripSettlement &&
              settlementPeople >
                1
                ? (
                    settlementTransfers.length
                      ? `
                          <strong>
                            ${escapeHTML(
                              getSettlementPerson(
                                tripSettlement,
                                settlementTransfers[0].fromId
                              )?.name ||
                              "Someone"
                            )}
                            owes
                            ${escapeHTML(
                              getSettlementPerson(
                                tripSettlement,
                                settlementTransfers[0].toId
                              )?.name ||
                              "someone"
                            )}
                          </strong>

                          <em>
                            ${formatSettlementAmount(
                              settlementTransfers[0].amount,
                              trip.currency
                            )}
                            ${
                              settlementTransfers.length >
                                1
                                ? ` · ${settlementTransfers.length} balances`
                                : ""
                            }
                          </em>
                        `
                      : `
                          <strong>All settled ✨</strong>
                          <em>${settlementPeople} travelers</em>
                        `
                  )
                : `
                    <strong>Set up travelers</strong>
                    <em>Split shared trip expenses</em>
                  `
            }
          </span>

          <span class="trip-dashboard-hub-arrow">›</span>
        </button>

      </div>

    </section>


    <section class="trip-dashboard-section">

      <div class="trip-dashboard-section-heading">

        <div>

          <p class="eyebrow">
            Spending
          </p>

          <h3>
            Categories
          </h3>

        </div>

      </div>


      ${
        categoryBreakdown.length

          ? `

              <div class="trip-dashboard-category-list">

                ${categoryBreakdown

                  .map(
                    (
                      item
                    ) => `

                      <div class="trip-dashboard-category">

                        <div class="trip-dashboard-category-top">

                          <span>
                            ${getCategoryEmoji(
                              item.category
                            )}
                            ${escapeHTML(
                              item.category
                            )}
                          </span>

                          <strong>
                            ${formatCurrency(
                              item.amount,
                              trip.currency
                            )}
                          </strong>

                        </div>


                        <div class="trip-dashboard-category-track">

                          <div
                            style="width:${Math.min(
                              item.percent,
                              100
                            )}%"
                          ></div>

                        </div>

                      </div>

                    `
                  )

                  .join("")}

              </div>

            `

          : `

              <div class="trip-dashboard-mini-empty">
                Add a trip expense to see category spending.
              </div>

            `
      }

    </section>


    <section class="trip-dashboard-section">

      <div class="trip-dashboard-section-heading">

        <div>

          <p class="eyebrow">
            Wishlist
          </p>

          <h3>
            Planned Spending
          </h3>

        </div>


        <button
          class="text-btn trip-dashboard-open-planned"
          type="button"
        >
          View all
        </button>

      </div>


      ${
        plannedItems.length

          ? `

              <div class="trip-dashboard-planned-list">

                ${plannedItems

                  .slice(
                    0,
                    4
                  )

                  .map(
                    (plannedItem) => `

                      <div class="trip-dashboard-planned-row">

                        <div>

                          <strong>
                            ${escapeHTML(
                              plannedItem.title
                            )}
                          </strong>

                          <span>
                            ${escapeHTML(
                              plannedItem.category
                            )}
                          </span>

                        </div>


                        <strong>
                          ${formatCurrency(
                            convertCurrency(
                              plannedItem.amount,
                              plannedItem.currency,
                              trip.currency
                            ),
                            trip.currency
                          )}
                        </strong>

                      </div>

                    `
                  )

                  .join("")}

              </div>

            `

          : `

              <div class="trip-dashboard-mini-empty">
                No planned purchases are linked to this trip yet.
              </div>

            `
      }

    </section>


    ${renderTripShoppingSection(
      trip
    )}


    <section class="trip-dashboard-section">

      <div class="trip-dashboard-section-heading">

        <div>

          <p class="eyebrow">
            Recent
          </p>

          <h3>
            Trip Expenses
          </h3>

        </div>

      </div>


      ${
        tripExpenses.length

          ? `

              <div class="trip-dashboard-expense-list">

                ${tripExpenses

                  .slice(
                    0,
                    5
                  )

                  .map(
                    (expense) =>
                      renderTransaction(
                        expense,
                        false
                      )
                  )

                  .join("")}

              </div>

            `

          : `

              <div class="trip-dashboard-mini-empty">
                No expenses have been logged for this trip yet.
              </div>

            `
      }

    </section>


    <div class="trip-dashboard-bottom-actions">

      <button
        class="secondary-btn trip-dashboard-edit-trip"
        type="button"
      >
        ✎ Edit Trip
      </button>

      <button
        class="primary-btn trip-dashboard-add-expense"
        type="button"
      >
        ＋ Add Trip Expense
      </button>

    </div>

  `;


  attachExpenseDetailActions();


  tripDashboardBody
    .querySelectorAll(
      ".trip-shopping-add"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () =>
            openTripShoppingModal(
              trip
            )
        );

      }
    );


  tripDashboardBody
    .querySelectorAll(
      "[data-edit-trip-shopping]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            const item =
              tripShoppingItems.find(
                (
                  shoppingItem
                ) =>
                  shoppingItem.id ===
                  button.dataset
                    .editTripShopping
              );


            if (
              item
            ) {

              openTripShoppingModal(
                trip,
                item
              );

            }

          }
        );

      }
    );


  tripDashboardBody
    .querySelectorAll(
      "[data-toggle-trip-shopping]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          async () => {

            const item =
              tripShoppingItems.find(
                (
                  shoppingItem
                ) =>
                  shoppingItem.id ===
                  button.dataset
                    .toggleTripShopping
              );


            if (
              !item
            ) {

              return;

            }


            item.bought =
              !item.bought;


            if (
              item.bought &&
              !Number(
                item.actualPrice ||
                0
              ) &&
              Number(
                item.targetPrice ||
                0
              )
            ) {

              item.actualPrice =
                Number(
                  item.targetPrice
                );

            }


            item.updatedAt =
              new Date()
                .toISOString();


            await saveTripShoppingItems();


            renderTripDashboard(
              trip
            );


            showToast(
              item.bought
                ? "Marked as bought 🛍️"
                : "Moved back to shopping list"
            );

          }
        );

      }
    );


  tripDashboardBody
    .querySelector(
      ".trip-dashboard-edit-trip"
    )
    ?.addEventListener(
      "click",
      () => {

        closeTripDashboard();


        openTripModal(
          trip
        );

      }
    );


  tripDashboardBody
    .querySelector(
      ".trip-dashboard-add-expense"
    )
    ?.addEventListener(
      "click",
      () => {

        closeTripDashboard();


        openingExpenseEditor =
          true;


        showScreen(
          "add"
        );


        resetExpenseForm();


        if (
          expenseTrip
        ) {

          expenseTrip.value =
            trip.id;

        }


        renderExpenseSettlementControls();


        expenseDate.value =
          getTodayString();


        showToast(
          `${trip.name} selected ✈️`
        );

      }
    );


  tripDashboardBody
    .querySelector(
      ".trip-dashboard-open-receipts"
    )
    ?.addEventListener(
      "click",
      () => {

        closeTripDashboard();


        showScreen(
          "receipts"
        );


        if (
          receiptTripFilter
        ) {

          receiptTripFilter.value =
            trip.id;


          renderReceiptGallery();

        }

      }
    );


  tripDashboardBody
    .querySelector(
      ".trip-dashboard-open-settlement"
    )
    ?.addEventListener(
      "click",
      () => {

        closeTripDashboard();


        activeSettlementTripId =
          trip.id;


        showScreen(
          "settlement"
        );

      }
    );


  tripDashboardBody
    .querySelector(
      ".trip-dashboard-open-planned"
    )
    ?.addEventListener(
      "click",
      () => {

        closeTripDashboard();


        showScreen(
          "planned"
        );

      }
    );


  tripDashboardModal.hidden =
    false;

}


function closeTripDashboard() {

  if (
    tripDashboardModal
  ) {

    tripDashboardModal.hidden =
      true;

  }


  activeTripDashboardId =
    "";

}


document
  .getElementById(
    "closeTripDashboard"
  )
  ?.addEventListener(
    "click",
    closeTripDashboard
  );


tripDashboardModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      tripDashboardModal
    ) {

      closeTripDashboard();

    }

  }
);


function attachTripDashboardActions() {

  document
    .querySelectorAll(
      ".trip-dashboard-open"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const trip =
              trips.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .tripId
              );


            if (
              trip
            ) {

              renderTripDashboard(
                trip
              );

            }

          }
        );

      }
    );

}


// ========================================
// EDIT / DELETE TRIPS
// ========================================

function attachTripActions() {

  document
    .querySelectorAll(
      ".edit-trip"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const trip =
              trips.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .tripId
              );


            if (
              trip
            ) {

              openTripModal(
                trip
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-trip"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            tripPendingDelete =
              button.dataset
                .tripId;


            document
              .getElementById(
                "deleteTripModal"
              )
              .hidden =
              false;

          }
        );

      }
    );

}


document
  .getElementById(
    "cancelDeleteTrip"
  )
  ?.addEventListener(
    "click",
    () => {

      tripPendingDelete =
        null;


      document
        .getElementById(
          "deleteTripModal"
        )
        .hidden =
        true;

    }
  );


document
  .getElementById(
    "confirmDeleteTrip"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !tripPendingDelete
      ) {

        return;

      }


      await deleteRecord(
        STORES.trips,
        tripPendingDelete
      );


      tripPendingDelete =
        null;


      document
        .getElementById(
          "deleteTripModal"
        )
        .hidden =
        true;


      await loadAppData();


      renderAll();


      showToast(
        "Trip deleted"
      );

    }
  );


// ========================================
// PHOTO
// ========================================

const expensePhoto =
  document.getElementById(
    "expensePhoto"
  );


const photoPreview =
  document.getElementById(
    "photoPreview"
  );


function readFileAsDataURL(
  file
) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();


      reader.onload =
        () => {

          resolve(
            reader.result
          );

        };


      reader.onerror =
        () => {

          reject(
            reader.error
          );

        };


      reader.readAsDataURL(
        file
      );

    }
  );

}


function loadImageFromFile(
  file
) {

  return new Promise(
    (resolve, reject) => {

      const image =
        new Image();


      const objectURL =
        URL.createObjectURL(
          file
        );


      image.onload =
        () => {

          URL.revokeObjectURL(
            objectURL
          );


          resolve(
            image
          );

        };


      image.onerror =
        () => {

          URL.revokeObjectURL(
            objectURL
          );


          reject(
            new Error(
              "Could not read image"
            )
          );

        };


      image.src =
        objectURL;

    }
  );

}


async function compressExpensePhoto(
  file
) {

  const image =
    await loadImageFromFile(
      file
    );


  const originalWidth =
    image.naturalWidth ||
    image.width;


  const originalHeight =
    image.naturalHeight ||
    image.height;


  if (
    !originalWidth ||
    !originalHeight
  ) {

    throw new Error(
      "Invalid image dimensions"
    );

  }


  const scale =
    Math.min(
      1,
      PHOTO_MAX_DIMENSION /
        Math.max(
          originalWidth,
          originalHeight
        )
    );


  const targetWidth =
    Math.max(
      1,
      Math.round(
        originalWidth *
        scale
      )
    );


  const targetHeight =
    Math.max(
      1,
      Math.round(
        originalHeight *
        scale
      )
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    targetWidth;


  canvas.height =
    targetHeight;


  const context =
    canvas.getContext(
      "2d",
      {
        alpha: false
      }
    );


  if (
    !context
  ) {

    throw new Error(
      "Canvas is unavailable"
    );

  }


  context.fillStyle =
    "#ffffff";


  context.fillRect(
    0,
    0,
    targetWidth,
    targetHeight
  );


  context.drawImage(
    image,
    0,
    0,
    targetWidth,
    targetHeight
  );


  return canvas.toDataURL(
    "image/jpeg",
    PHOTO_JPEG_QUALITY
  );

}


function renderExpensePhotoPreview(
  photoData =
    ""
) {

  if (
    !photoPreview
  ) {

    return;

  }


  photoPreview.innerHTML =
    photoData

      ? `

          <img
            src="${photoData}"
            alt="Expense photo"
          >

        `

      : `<span class="expense-photo-icon" aria-hidden="true">📸</span><span class="expense-photo-label">Add photo</span>`;

}


expensePhoto?.addEventListener(
  "change",
  () => {

    const file =
      expensePhoto.files?.[
        0
      ];


    if (
      !file
    ) {

      return;

    }


    if (
      !file.type.startsWith(
        "image/"
      )
    ) {

      expensePhoto.value =
        "";


      showToast(
        "Please choose an image."
      );


      return;

    }


    photoProcessingPromise =
      (
        async () => {

          try {

            showToast(
              "Optimizing photo…"
            );


            const compressed =
              await compressExpensePhoto(
                file
              );


            currentPhotoData =
              compressed;


            renderExpensePhotoPreview(
              currentPhotoData
            );


            showToast(
              "Photo ready 📸"
            );

          } catch (
            error
          ) {

            console.error(
              "Photo compression failed:",
              error
            );


            try {

              /*
                Fallback keeps photo attachment usable
                if an iPhone/browser cannot decode a
                particular image format through canvas.
              */

              currentPhotoData =
                await readFileAsDataURL(
                  file
                );


              renderExpensePhotoPreview(
                currentPhotoData
              );


              showToast(
                "Photo ready 📸"
              );

            } catch (
              fallbackError
            ) {

              console.error(
                "Photo fallback failed:",
                fallbackError
              );


              currentPhotoData =
                "";


              expensePhoto.value =
                "";


              renderExpensePhotoPreview();


              showToast(
                "Could not attach that photo."
              );

            }

          } finally {

            photoProcessingPromise =
              null;

          }

        }
      )();

  }
);


// ========================================
// EXPENSE FORM
// ========================================

const expenseDate =
  document.getElementById(
    "expenseDate"
  );


const expenseForm =
  document.getElementById(
    "expenseForm"
  );


const expenseTags =
  document.getElementById(
    "expenseTags"
  );


const expenseTagSuggestions =
  document.getElementById(
    "expenseTagSuggestions"
  );


const expenseIdInput =
  document.getElementById(
    "expenseId"
  );


const expenseFormTitle =
  document.getElementById(
    "expenseFormTitle"
  );


function setExpenseFormMode(
  mode =
    "add"
) {

  const isEditing =
    mode ===
    "edit";


  if (
    expenseFormTitle
  ) {

    expenseFormTitle.textContent =
      isEditing
        ? "Edit Expense"
        : "Add Expense";

  }

}


function normalizeExpenseTags(
  value
) {

  const raw =
    Array.isArray(
      value
    )
      ? value
      : String(
          value ||
          ""
        ).split(
          ","
        );


  const seen =
    new Set();


  return raw
    .map(
      (tag) =>
        String(
          tag
        )
          .trim()
          .replace(
            /\s+/g,
            " "
          )
    )
    .filter(
      (tag) => {

        if (
          !tag
        ) {

          return false;

        }


        const key =
          tag.toLowerCase();


        if (
          seen.has(
            key
          )
        ) {

          return false;

        }


        seen.add(
          key
        );


        return true;

      }
    )
    .slice(
      0,
      12
    );

}


function getAllExpenseTags() {

  const unique =
    new Map();


  expenses.forEach(
    (expense) => {

      normalizeExpenseTags(
        expense.tags
      ).forEach(
        (tag) => {

          const key =
            tag.toLowerCase();


          if (
            !unique.has(
              key
            )
          ) {

            unique.set(
              key,
              tag
            );

          }

        }
      );

    }
  );


  return Array.from(
    unique.values()
  ).sort(
    (
      a,
      b
    ) =>
      a.localeCompare(
        b
      )
  );

}


function renderExpenseTagSuggestions() {

  if (
    !expenseTagSuggestions
  ) {

    return;

  }


  const tags =
    getAllExpenseTags();


  expenseTagSuggestions.hidden =
    tags.length ===
    0;


  expenseTagSuggestions.innerHTML =
    tags.length

      ? `

          <span class="tag-suggestion-label">
            Used before
          </span>

          <div class="tag-suggestion-list">

            ${tags
              .slice(
                0,
                10
              )
              .map(
                (tag) => `

                  <button
                    class="tag-suggestion-chip"
                    type="button"
                    data-tag="${escapeHTML(
                      tag
                    )}"
                  >
                    #${escapeHTML(
                      tag
                    )}
                  </button>

                `
              )
              .join("")}

          </div>

        `

      : "";


  expenseTagSuggestions
    .querySelectorAll(
      ".tag-suggestion-chip"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const current =
              normalizeExpenseTags(
                expenseTags?.value
              );


            const selected =
              button.dataset.tag ||
              "";


            if (
              selected &&
              !current.some(
                (tag) =>
                  tag.toLowerCase() ===
                  selected.toLowerCase()
              )
            ) {

              current.push(
                selected
              );

            }


            if (
              expenseTags
            ) {

              expenseTags.value =
                current.join(
                  ", "
                );

            }

          }
        );

      }
    );

}


function renderExpenseTagChips(
  expense
) {

  const tags =
    normalizeExpenseTags(
      expense.tags
    );


  if (
    tags.length ===
    0
  ) {

    return "";

  }


  return `

    <div class="expense-tag-chips">

      ${tags
        .map(
          (tag) => `

            <span class="expense-tag-chip">
              #${escapeHTML(
                tag
              )}
            </span>

          `
        )
        .join("")}

    </div>

  `;

}


function resetExpenseForm() {

  editingExpenseId =
    "";


  if (
    !openingExpenseEditor
  ) {

    pendingPlannedConversionId =
      "";

  }


  pendingRecurringLogId =
    "";


  expenseForm?.reset();


  if (
    expenseIdInput
  ) {

    expenseIdInput.value =
      "";

  }


  currentPhotoData =
    "";


  photoProcessingPromise =
    null;


  if (
    expensePhoto
  ) {

    expensePhoto.value =
      "";

  }


  renderExpensePhotoPreview();


  setExpenseFormMode(
    "add"
  );


  if (
    expenseDate
  ) {

    expenseDate.value =
      getTodayString();

  }


  if (
    currencySelect
  ) {

    const lastExpenseCurrency =
      localStorage.getItem(
        LOCAL_KEYS.expenseCurrency
      );

    currencySelect.value =
      lastExpenseCurrency &&
      EXCHANGE_RATES[
        lastExpenseCurrency
      ]
        ? lastExpenseCurrency
        : "PHP";

  }


  if (
    expenseCategory
  ) {

    expenseCategory.value =
      "Other";

  }


  if (
    expenseOtherCategory
  ) {

    expenseOtherCategory.value =
      "";

  }


  updateExpenseOtherCategoryVisibility();


  if (
    expenseOtherPaymentMethod
  ) {

    expenseOtherPaymentMethod.value =
      "";

  }


  updateExpenseOtherPaymentVisibility();


  updateExpenseConversion();

  closeMerchantMemorySuggestions();

  renderExpenseTagSuggestions();

  renderExpenseSettlementControls();

}


function prepareExpenseForm() {

  populateExpenseBudgetDropdown();

  populateExpenseTripDropdown();


  if (
    expenseDate &&
    !expenseDate.value
  ) {

    expenseDate.value =
      getTodayString();

  }


  const currentExpense =
    expenses.find(
      (
        expense
      ) =>
        expense.id ===
        (
          expenseIdInput?.value ||
          editingExpenseId
        )
    );


  renderExpenseSettlementControls(
    currentExpense
  );


  updateExpenseOtherCategoryVisibility();


  updateExpenseOtherPaymentVisibility();

}


function openExpenseEditor(
  expense
) {

  if (
    !expense
  ) {

    return;

  }


  editingExpenseId =
    expense.id;


  openingExpenseEditor =
    true;


  showScreen(
    "add"
  );


  if (
    expenseIdInput
  ) {

    expenseIdInput.value =
      expense.id;

  }


  setExpenseFormMode(
    "edit"
  );


  document
    .getElementById(
      "expenseTitle"
    )
    .value =
    expense.title ||
    "";


  amountInput.value =
    expense.amount ??
    "";


  currencySelect.value =
    expense.currency ||
    "PHP";


  expenseCategory.value =
    expense.category ||
    "Other";


  if (
    expenseOtherCategory
  ) {

    expenseOtherCategory.value =
      expense.otherCategory ||
      "";

  }


  updateExpenseOtherCategoryVisibility();


  expenseBudget.value =
    expense.budgetId ||
    "";


  if (
    expenseTrip
  ) {

    expenseTrip.value =
      expense.tripId ||
      "";

  }


  document
    .getElementById(
      "paymentMethod"
    )
    .value =
    expense.paymentMethod ||
    "Cash";


  if (
    expenseOtherPaymentMethod
  ) {

    expenseOtherPaymentMethod.value =
      expense.otherPaymentMethod ||
      "";

  }


  updateExpenseOtherPaymentVisibility();


  expenseDate.value =
    expense.date ||
    getTodayString();


  document
    .getElementById(
      "expenseLocation"
    )
    .value =
    expense.location ||
    "";


  document
    .getElementById(
      "expenseNotes"
    )
    .value =
    expense.notes ||
    "";


  if (
    expenseTags
  ) {

    expenseTags.value =
      normalizeExpenseTags(
        expense.tags
      ).join(
        ", "
      );

  }


  renderExpenseTagSuggestions();


  currentPhotoData =
    expense.photo ||
    "";


  renderExpensePhotoPreview(
    currentPhotoData
  );


  updateExpenseConversion();


  renderExpenseSettlementControls(
    expense
  );

}


// ========================================
// FAVORITES / QUICK ADD
// ========================================

async function saveFavoriteExpenses() {

  await putRecord(
    STORES.settings,
    {
      key:
        "favorite_expenses",

      value:
        favoriteExpenses,

      updatedAt:
        new Date()
          .toISOString()
    }
  );

}


const favoriteQuickAddSection =
  document.getElementById(
    "favoriteQuickAddSection"
  );


const favoriteQuickAddList =
  document.getElementById(
    "favoriteQuickAddList"
  );


const saveFavoriteButton =
  document.getElementById(
    "saveFavoriteButton"
  );


function getExpenseFavoriteFormData() {

  return {

    title:
      document
        .getElementById(
          "expenseTitle"
        )
        ?.value
        .trim() ||
      "",

    /*
      Quick Add templates intentionally never store an amount.
      Using a template should always ask for today's amount.
    */
    amount:
      "",

    currency:
      currencySelect?.value ||
      "PHP",

    category:
      expenseCategory?.value ||
      "Other",

    otherCategory:
      expenseCategory?.value ===
        "Other"
        ? (
            expenseOtherCategory?.value
              .trim() ||
            ""
          )
        : "",

    budgetId:
      expenseBudget?.value ||
      "",

    tripId:
      expenseTrip?.value ||
      "",

    paymentMethod:
      document
        .getElementById(
          "paymentMethod"
        )
        ?.value ||
      "Cash",

    otherPaymentMethod:
      document
        .getElementById(
          "paymentMethod"
        )
        ?.value ===
        "Other"
        ? (
            expenseOtherPaymentMethod?.value
              .trim() ||
            ""
          )
        : "",

    location:
      document
        .getElementById(
          "expenseLocation"
        )
        ?.value
        .trim() ||
      "",

    notes:
      document
        .getElementById(
          "expenseNotes"
        )
        ?.value
        .trim() ||
      "",

    tags:
      normalizeExpenseTags(
        expenseTags?.value
      )

  };

}


function getFavoriteMetaText(
  favorite
) {

  const category =
    favorite.category ===
      "Other" &&
    favorite.otherCategory
      ? `Other · ${favorite.otherCategory}`
      : (
          favorite.category ||
          "Other"
        );


  const payment =
    favorite.paymentMethod ===
      "Other" &&
    favorite.otherPaymentMethod
      ? `Other · ${favorite.otherPaymentMethod}`
      : (
          favorite.paymentMethod ||
          "Cash"
        );


  return [
    category,
    payment
  ].join(
    " · "
  );

}


function renderFavoriteQuickAdd() {

  if (
    !favoriteQuickAddSection ||
    !favoriteQuickAddList
  ) {

    return;

  }


  favoriteQuickAddSection.hidden =
    favoriteExpenses.length ===
    0;


  if (
    favoriteExpenses.length ===
    0
  ) {

    favoriteQuickAddList.innerHTML =
      "";


    return;

  }


  favoriteQuickAddList.innerHTML =
    favoriteExpenses
      .slice(
        0,
        20
      )
      .map(
        (favorite) => `

          <div class="favorite-quick-item">

            <button
              class="favorite-quick-use"
              type="button"
              data-favorite-use="${escapeHTML(
                favorite.id
              )}"
            >
              <span class="favorite-quick-icon">⚡</span>
              <span class="favorite-quick-copy">
                <strong>${escapeHTML(
                  favorite.title ||
                  "Favorite"
                )}</strong>
                <small>${escapeHTML(
                  getFavoriteMetaText(
                    favorite
                  )
                )}</small>
              </span>
            </button>

            <button
              class="favorite-quick-remove"
              type="button"
              data-favorite-remove="${escapeHTML(
                favorite.id
              )}"
              aria-label="Remove ${escapeHTML(
                favorite.title ||
                "favorite"
              )} from favorites"
            >
              ×
            </button>

          </div>

        `
      )
      .join(
        ""
      );

}


function applyFavoriteToExpenseForm(
  favorite
) {

  if (
    !favorite
  ) {

    return;

  }


  resetExpenseForm();

  prepareExpenseForm();


  const titleInput =
    document.getElementById(
      "expenseTitle"
    );


  if (
    titleInput
  ) {

    titleInput.value =
      favorite.title ||
      "";

  }


  if (
    amountInput
  ) {

    /*
      Templates fill the pattern, never the price.
    */
    amountInput.value =
      "";

  }


  if (
    currencySelect
  ) {

    currencySelect.value =
      favorite.currency ||
      "PHP";

  }


  if (
    expenseCategory
  ) {

    expenseCategory.value =
      favorite.category ||
      "Other";

  }


  if (
    expenseOtherCategory
  ) {

    expenseOtherCategory.value =
      favorite.otherCategory ||
      "";

  }


  updateExpenseOtherCategoryVisibility();


  if (
    expenseBudget
  ) {

    expenseBudget.value =
      budgets.some(
        (budget) =>
          budget.id ===
          favorite.budgetId
      )
        ? favorite.budgetId
        : "";

  }


  if (
    expenseTrip
  ) {

    expenseTrip.value =
      trips.some(
        (trip) =>
          trip.id ===
          favorite.tripId
      )
        ? favorite.tripId
        : "";

  }


  const paymentMethod =
    document.getElementById(
      "paymentMethod"
    );


  if (
    paymentMethod
  ) {

    paymentMethod.value =
      favorite.paymentMethod ||
      "Cash";

  }


  if (
    expenseOtherPaymentMethod
  ) {

    expenseOtherPaymentMethod.value =
      favorite.otherPaymentMethod ||
      "";

  }


  updateExpenseOtherPaymentVisibility();


  const locationInput =
    document.getElementById(
      "expenseLocation"
    );


  if (
    locationInput
  ) {

    locationInput.value =
      favorite.location ||
      "";

  }


  const notesInput =
    document.getElementById(
      "expenseNotes"
    );


  if (
    notesInput
  ) {

    notesInput.value =
      favorite.notes ||
      "";

  }


  if (
    expenseTags
  ) {

    expenseTags.value =
      normalizeExpenseTags(
        favorite.tags
      ).join(
        ", "
      );

  }


  if (
    expenseDate
  ) {

    expenseDate.value =
      getTodayString();

  }


  updateExpenseConversion();

  renderExpenseTagSuggestions();


  showToast(
    "Template loaded ⚡ · enter the amount"
  );


  requestAnimationFrame(
    () =>
      amountInput?.focus()
  );

}


favoriteQuickAddList?.addEventListener(
  "click",
  async (
    event
  ) => {

    const useButton =
      event.target.closest(
        "[data-favorite-use]"
      );


    if (
      useButton
    ) {

      const favorite =
        favoriteExpenses.find(
          (item) =>
            item.id ===
            useButton.dataset
              .favoriteUse
        );


      applyFavoriteToExpenseForm(
        favorite
      );


      return;

    }


    const removeButton =
      event.target.closest(
        "[data-favorite-remove]"
      );


    if (
      !removeButton
    ) {

      return;

    }


    const favorite =
      favoriteExpenses.find(
        (item) =>
          item.id ===
          removeButton.dataset
            .favoriteRemove
      );


    if (
      !favorite
    ) {

      return;

    }


    const shouldRemove =
      window.confirm(
        `Remove “${favorite.title || "Template"}” from Quick Add?`
      );


    if (
      !shouldRemove
    ) {

      return;

    }


    favoriteExpenses =
      favoriteExpenses.filter(
        (item) =>
          item.id !==
          favorite.id
      );


    await saveFavoriteExpenses();


    await loadAppData();

    renderFavoriteQuickAdd();

    renderBackupStatus();


    showToast(
      "Template removed."
    );

  }
);


saveFavoriteButton?.addEventListener(
  "click",
  async () => {

    const template =
      getExpenseFavoriteFormData();


    if (
      !template.title
    ) {

      showToast(
        "Add a title before saving a template."
      );


      document
        .getElementById(
          "expenseTitle"
        )
        ?.focus();


      return;

    }


    if (
      favoriteExpenses.length >=
      20
    ) {

      showToast(
        "Quick Add can keep up to 20 templates."
      );


      return;

    }


    const duplicate =
      favoriteExpenses.find(
        (favorite) =>
          String(
            favorite.title ||
            ""
          )
            .trim()
            .toLowerCase() ===
          template.title
            .toLowerCase()
      );


    if (
      duplicate
    ) {

      showToast(
        "A template with that title already exists."
      );


      return;

    }


    const favorite = {

      id:
        generateId(
          "favorite"
        ),

      ...template,

      createdAt:
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    favoriteExpenses.push(
      favorite
    );


    await saveFavoriteExpenses();


    await loadAppData();

    renderFavoriteQuickAdd();

    renderBackupStatus();


    showToast(
      "Template saved ⚡"
    );

  }
);


// ========================================
// SAVE EXPENSE
// ========================================

expenseForm?.addEventListener(
  "submit",
  async (
    event
  ) => {

    event.preventDefault();


    if (
      photoProcessingPromise
    ) {

      try {

        await photoProcessingPromise;

      } catch (
        error
      ) {

        console.error(
          "Photo processing error:",
          error
        );

      }

    }


    const expenseTitleValue =
      document
        .getElementById(
          "expenseTitle"
        )
        ?.value
        .trim() ||
      "";


    if (
      !expenseTitleValue
    ) {

      const saveWithoutTitle =
        window.confirm(
          "This expense has no title. Save it anyway?"
        );


      if (
        !saveWithoutTitle
      ) {

        document
          .getElementById(
            "expenseTitle"
          )
          ?.focus();


        return;

      }

    }


    const expenseAmountValue =
      Number(
        amountInput?.value ||
        0
      );


    if (
      !Number.isFinite(
        expenseAmountValue
      ) ||
      expenseAmountValue <=
        0
    ) {

      showToast(
        "Enter an expense amount greater than 0."
      );


      amountInput?.focus();


      return;

    }


    if (
      !expenseDate?.value
    ) {

      showToast(
        "Choose a date for this expense."
      );


      expenseDate?.focus();


      return;

    }


    const selectedBudget =
      budgets.find(
        (budget) =>
          budget.id ===
          expenseBudget.value
      );


    const selectedTrip =
      trips.find(
        (trip) =>
          trip.id ===
          expenseTrip?.value
      );


    const existingId =
      expenseIdInput?.value ||
      editingExpenseId;


    const previous =
      expenses.find(
        (item) =>
          item.id ===
          existingId
      );


    let settlementData;


    try {

      settlementData =
        collectExpenseSettlementData(
          selectedTrip,
          previous
        );

    } catch (
      error
    ) {

      showToast(
        error.message ||
        "Check the settlement split."
      );


      return;

    }


    const expense = {

      id:
        existingId ||
        generateId(
          "expense"
        ),

      type:
        "expense",

      title:
        expenseTitleValue,

      amount:
        expenseAmountValue,

      currency:
        currencySelect.value,

      category:
        expenseCategory.value ||
        "Other",

      otherCategory:
        expenseCategory.value ===
          "Other"
          ? (
              expenseOtherCategory?.value
                .trim() ||
              ""
            )
          : "",

      budgetId:
        selectedBudget?.id ||
        "",

      budgetName:
        selectedBudget?.name ||
        "",

      paymentMethod:
        document
          .getElementById(
            "paymentMethod"
          )
          .value,

      otherPaymentMethod:
        document
          .getElementById(
            "paymentMethod"
          )
          .value ===
          "Other"
          ? (
              expenseOtherPaymentMethod?.value
                .trim() ||
              ""
            )
          : "",

      date:
        expenseDate.value,

      location:
        document
          .getElementById(
            "expenseLocation"
          )
          .value
          .trim(),

      notes:
        document
          .getElementById(
            "expenseNotes"
          )
          .value
          .trim(),

      tags:
        normalizeExpenseTags(
          expenseTags?.value
        ),

      photo:
        currentPhotoData,

      tripId:
        selectedTrip?.id ||
        "",

      sourceRecurringId:
        previous?.sourceRecurringId ||
        pendingRecurringLogId ||
        "",

      ...settlementData,

      createdAt:
        previous?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    await putRecord(
      STORES.expenses,
      expense
    );


    if (
      expense.settlementShared
    ) {

      await saveTravelSettlements();

    }


    if (
      pendingPlannedConversionId
    ) {

      const planned =
        plannedExpenses.find(
          (item) =>
            item.id ===
            pendingPlannedConversionId
        );


      if (
        planned
      ) {

        await putRecord(
          STORES.planned,
          {
            ...planned,

            status:
              "purchased",

            convertedExpenseId:
              expense.id,

            purchasedAt:
              new Date()
                .toISOString(),

            updatedAt:
              new Date()
                .toISOString()
          }
        );

      }


      await removePhoneReminder(
        "planned",
        pendingPlannedConversionId
      );


      pendingPlannedConversionId =
        "";

    }


    if (
      pendingRecurringLogId
    ) {

      const recurringSource =
        recurringExpenses.find(
          (item) =>
            item.id ===
            pendingRecurringLogId
        );


      if (
        recurringSource
      ) {

        const nextDate =
          getNextRecurringDate(
            recurringSource.nextDueDate,
            recurringSource.frequency,
            recurringSource.scheduleDay
          );


        const updatedRecurringSource = {
          ...recurringSource,

          nextDueDate:
            nextDate,

          active:
            !(
              recurringSource.endDate &&
              nextDate >
                recurringSource.endDate
            ),

          updatedAt:
            new Date()
              .toISOString()
        };


        await putRecord(
          STORES.recurring,
          updatedRecurringSource
        );


        await syncPhoneReminder(
          "recurring",
          updatedRecurringSource
        );

      }


      pendingRecurringLogId =
        "";

    }


    await loadAppData();


    const wasEditing =
      Boolean(
        existingId
      );


    resetExpenseForm();


    renderAll();


    showToast(
      wasEditing
        ? "Expense updated ✨"
        : "Expense saved ✨"
    );


    setTimeout(
      () => {

        showScreen(
          "home"
        );

      },
      250
    );

  }
);


document
  .getElementById(
    "saveExpenseTop"
  )
  ?.addEventListener(
    "click",
    () => {

      expenseForm
        ?.requestSubmit();

    }
  );


// ========================================
// TRANSACTION RENDERING
// ========================================

function renderTransaction(
  expense,
  showActions =
    false
) {

  const convertedPHP =
    convertCurrency(
      expense.amount,
      expense.currency,
      "PHP"
    );


  const converted =
    expense.currency !==
    "PHP"

      ? `≈ ${formatPHP(
          convertedPHP
        )}`

      : "";


  const thumbnail =
    expense.photo

      ? `

          <img
            src="${expense.photo}"
            alt=""
          >

        `

      : getCategoryEmoji(
          expense.category
        );


  const expenseId =
    escapeHTML(
      expense.id
    );


  return `

    <div
      class="transaction-swipe-shell"
      data-expense-swipe-id="${expenseId}"
    >

      <button
        class="transaction-swipe-action transaction-swipe-edit"
        type="button"
        data-swipe-edit-expense="${expenseId}"
        aria-label="Edit ${escapeHTML(
          expense.title ||
            "expense"
        )}"
      >
        <span>✎</span>
        <strong>Edit</strong>
      </button>


      <button
        class="transaction-swipe-action transaction-swipe-delete"
        type="button"
        data-swipe-delete-expense="${expenseId}"
        aria-label="Delete ${escapeHTML(
          expense.title ||
            "expense"
        )}"
      >
        <span>⌫</span>
        <strong>Delete</strong>
      </button>


      <article
        class="transaction-row transaction-row-openable transaction-swipe-content"
        data-expense-detail-id="${expenseId}"
        tabindex="0"
        aria-label="View ${escapeHTML(
          expense.title ||
            "Untitled"
        )} expense details"
      >

        <div class="thumb">

          ${thumbnail}

        </div>


        <div class="transaction-main">

          <strong>

            ${escapeHTML(
              expense.title ||
                "Untitled expense"
            )}

          </strong>


          <span>

            ${escapeHTML(
              expense.category
            )}

            •

            ${escapeHTML(
              expense.paymentMethod
            )}

          </span>


          ${renderExpenseTagChips(
            expense
          )}

        </div>


        <div class="transaction-value">

          <strong>

            ${formatCurrency(
              expense.amount,
              expense.currency
            )}

          </strong>


          ${
            converted

              ? `

                <span>

                  ${converted}

                </span>

              `

              : ""
          }

        </div>

      </article>

    </div>

  `;

}


// ========================================
// ACTIVITY SEARCH + FILTERS
// ========================================

const activitySearch =
  document.getElementById(
    "activitySearch"
  );

const activityCategoryFilter =
  document.getElementById(
    "activityCategoryFilter"
  );

const activityTripFilter =
  document.getElementById(
    "activityTripFilter"
  );

const activityPaymentFilter =
  document.getElementById(
    "activityPaymentFilter"
  );

const activityCurrencyFilter =
  document.getElementById(
    "activityCurrencyFilter"
  );


const activityTagFilter =
  document.getElementById(
    "activityTagFilter"
  );

const activitySortFilter =
  document.getElementById(
    "activitySortFilter"
  );

const activityPhotoFilter =
  document.getElementById(
    "activityPhotoFilter"
  );

const activityMinAmount =
  document.getElementById(
    "activityMinAmount"
  );

const activityMaxAmount =
  document.getElementById(
    "activityMaxAmount"
  );

const activityDateFrom =
  document.getElementById(
    "activityDateFrom"
  );

const activityDateTo =
  document.getElementById(
    "activityDateTo"
  );

const activityFilteredTotal =
  document.getElementById(
    "activityFilteredTotal"
  );

const activityResultCount =
  document.getElementById(
    "activityResultCount"
  );


const activityFilterPanel =
  document.getElementById(
    "activityFilterPanel"
  );


const activityFilterToggle =
  document.getElementById(
    "activityFilterToggle"
  );


const activityFilterBadge =
  document.getElementById(
    "activityFilterBadge"
  );


const activityActiveFilters =
  document.getElementById(
    "activityActiveFilters"
  );


const activityResultContext =
  document.getElementById(
    "activityResultContext"
  );


const clearActivitySearch =
  document.getElementById(
    "clearActivitySearch"
  );


function populateActivityFilters() {

  const preserveSelect =
    (
      select,
      options,
      firstLabel
    ) => {

      if (
        !select
      ) {

        return;

      }


      const current =
        select.value;


      select.innerHTML =
        `<option value="">${firstLabel}</option>` +
        options.join("");


      const exists =
        Array.from(
          select.options
        )
          .some(
            (option) =>
              option.value ===
              current
          );


      if (
        exists
      ) {

        select.value =
          current;

      }

    };


  const categories =
    [
      ...new Set(
        expenses
          .map(
            (expense) =>
              expense.category
          )
          .filter(
            Boolean
          )
      )
    ].sort();


  preserveSelect(
    activityCategoryFilter,
    categories.map(
      (category) =>
        `<option value="${escapeHTML(
          category
        )}">${escapeHTML(
          category
        )}</option>`
    ),
    "All categories"
  );


  preserveSelect(
    activityTripFilter,
    [
      `<option value="__personal__">Personal / No Trip</option>`,
      ...trips.map(
        (trip) =>
          `<option value="${escapeHTML(
            trip.id
          )}">${escapeHTML(
            trip.name
          )}</option>`
      )
    ],
    "All trips"
  );


  const methods =
    [
      ...new Set(
        expenses
          .map(
            (expense) =>
              expense.paymentMethod
          )
          .filter(
            Boolean
          )
      )
    ].sort();


  preserveSelect(
    activityPaymentFilter,
    methods.map(
      (method) =>
        `<option value="${escapeHTML(
          method
        )}">${escapeHTML(
          method
        )}</option>`
    ),
    "All payment methods"
  );


  const currencies =
    [
      ...new Set(
        expenses
          .map(
            (expense) =>
              expense.currency
          )
          .filter(
            Boolean
          )
      )
    ].sort();


  preserveSelect(
    activityCurrencyFilter,
    currencies.map(
      (currency) =>
        `<option value="${escapeHTML(
          currency
        )}">${escapeHTML(
          currency
        )}</option>`
    ),
    "All currencies"
  );


  const tags =
    getAllExpenseTags();


  preserveSelect(
    activityTagFilter,
    tags.map(
      (tag) =>
        `<option value="${escapeHTML(
          tag
        )}">#${escapeHTML(
          tag
        )}</option>`
    ),
    "All tags"
  );

}


function normalizeActivitySearchText(
  value
) {

  return String(
    value ||
    ""
  )
    .normalize(
      "NFKC"
    )
    .toLowerCase()
    .replace(
      /[,“”"'()]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function getActivitySearchTokens() {

  return normalizeActivitySearchText(
    activitySearch?.value
  )
    .split(
      " "
    )
    .filter(
      Boolean
    );

}


function buildExpenseSearchHaystack(
  expense,
  tripLookup = null,
  budgetLookup = null
) {

  const trip =
    tripLookup
      ? tripLookup.get(
          expense.tripId
        )
      : trips.find(
          (
            item
          ) =>
            item.id ===
            expense.tripId
        );


  const budget =
    budgetLookup
      ? budgetLookup.get(
          expense.budgetId
        )
      : budgets.find(
          (
            item
          ) =>
            item.id ===
            expense.budgetId
        );


  const tags =
    normalizeExpenseTags(
      expense.tags
    );


  const phpAmount =
    convertCurrency(
      expense.amount,
      expense.currency,
      "PHP"
    );


  const categoryText =
    expense.category ===
      "Other" &&
    expense.otherCategory
      ? `Other ${expense.otherCategory}`
      : (
          expense.category ||
          ""
        );


  const paymentText =
    expense.paymentMethod ===
      "Other" &&
    expense.otherPaymentMethod
      ? `Other ${expense.otherPaymentMethod}`
      : (
          expense.paymentMethod ||
          ""
        );


  return normalizeActivitySearchText(
    [
      expense.title,
      expense.location,
      expense.notes,
      categoryText,
      paymentText,
      expense.currency,
      expense.amount,
      formatCurrency(
        expense.amount,
        expense.currency
      ),
      phpAmount,
      formatPHP(
        phpAmount
      ),
      expense.date,
      trip?.name,
      trip?.destination,
      budget?.name,
      expense.tripId
        ? "trip travel"
        : "personal no trip",
      expense.photo
        ? "receipt photo with receipt"
        : "no receipt without receipt",
      ...tags,
      ...tags.map(
        (
          tag
        ) =>
          `#${tag}`
      )
    ]
      .filter(
        (
          value
        ) =>
          value !==
            undefined &&
          value !==
            null &&
          value !==
            ""
      )
      .join(
        " "
      )
  );

}


function getFilteredActivityExpenses() {

  const searchTokens =
    getActivitySearchTokens();


  // Build lookup maps once per search pass instead of scanning all trips
  // and budgets for every expense. This keeps large histories responsive.
  const tripLookup =
    searchTokens.length
      ? new Map(
          trips.map(
            (item) => [
              item.id,
              item
            ]
          )
        )
      : null;


  const budgetLookup =
    searchTokens.length
      ? new Map(
          budgets.map(
            (item) => [
              item.id,
              item
            ]
          )
        )
      : null;


  const category =
    activityCategoryFilter?.value ||
    "";

  const tripId =
    activityTripFilter?.value ||
    "";

  const paymentMethod =
    activityPaymentFilter?.value ||
    "";

  const currency =
    activityCurrencyFilter?.value ||
    "";

  const tag =
    activityTagFilter?.value ||
    "";

  const photo =
    activityPhotoFilter?.value ||
    "";

  const sort =
    activitySortFilter?.value ||
    "newest";

  const rawMinAmount =
    activityMinAmount?.value
      ? Number(
          activityMinAmount.value
        )
      : null;

  const rawMaxAmount =
    activityMaxAmount?.value
      ? Number(
          activityMaxAmount.value
        )
      : null;


  const minAmount =
    rawMinAmount !==
      null &&
    rawMaxAmount !==
      null

      ? Math.min(
          rawMinAmount,
          rawMaxAmount
        )

      : (
          rawMinAmount ??
          0
        );


  const maxAmount =
    rawMinAmount !==
      null &&
    rawMaxAmount !==
      null

      ? Math.max(
          rawMinAmount,
          rawMaxAmount
        )

      : rawMaxAmount;


  const rawDateFrom =
    activityDateFrom?.value ||
    "";

  const rawDateTo =
    activityDateTo?.value ||
    "";


  const dateFrom =
    rawDateFrom &&
    rawDateTo &&
    rawDateFrom >
      rawDateTo

      ? rawDateTo

      : rawDateFrom;


  const dateTo =
    rawDateFrom &&
    rawDateTo &&
    rawDateFrom >
      rawDateTo

      ? rawDateFrom

      : rawDateTo;


  const filtered =
    expenses.filter(
      (
        expense
      ) => {

        if (
          searchTokens.length
        ) {

          const searchable =
            buildExpenseSearchHaystack(
              expense,
              tripLookup,
              budgetLookup
            );


          if (
            !searchTokens.every(
              (
                token
              ) =>
                searchable.includes(
                  token
                )
            )
          ) {

            return false;

          }

        }


        if (
          category &&
          expense.category !==
            category
        ) {

          return false;

        }


        if (
          tripId
        ) {

          if (
            tripId ===
            "__personal__"
          ) {

            if (
              expense.tripId
            ) {

              return false;

            }

          } else if (
            expense.tripId !==
            tripId
          ) {

            return false;

          }

        }


        if (
          paymentMethod &&
          expense.paymentMethod !==
            paymentMethod
        ) {

          return false;

        }


        if (
          currency &&
          expense.currency !==
            currency
        ) {

          return false;

        }


        if (
          tag &&
          !normalizeExpenseTags(
            expense.tags
          ).some(
            (
              expenseTag
            ) =>
              expenseTag
                .toLowerCase() ===
              tag.toLowerCase()
          )
        ) {

          return false;

        }


        if (
          photo ===
            "with" &&
          !expense.photo
        ) {

          return false;

        }


        if (
          photo ===
            "without" &&
          expense.photo
        ) {

          return false;

        }


        if (
          dateFrom &&
          expense.date <
            dateFrom
        ) {

          return false;

        }


        if (
          dateTo &&
          expense.date >
            dateTo
        ) {

          return false;

        }


        const amountPHP =
          convertCurrency(
            expense.amount,
            expense.currency,
            "PHP"
          );


        if (
          minAmount >
            0 &&
          amountPHP <
            minAmount
        ) {

          return false;

        }


        if (
          maxAmount !==
            null &&
          amountPHP >
            maxAmount
        ) {

          return false;

        }


        return true;

      }
    );


  const amountPHP =
    (
      expense
    ) =>
      convertCurrency(
        expense.amount,
        expense.currency,
        "PHP"
      );


  switch (
    sort
  ) {

    case "oldest":
      filtered.sort(
        (
          a,
          b
        ) =>
          String(
            a.date ||
            ""
          ).localeCompare(
            String(
              b.date ||
              ""
            )
          ) ||
          String(
            a.createdAt ||
            a.updatedAt ||
            ""
          ).localeCompare(
            String(
              b.createdAt ||
              b.updatedAt ||
              ""
            )
          )
      );
      break;


    case "highest":
      filtered.sort(
        (
          a,
          b
        ) =>
          amountPHP(
            b
          ) -
          amountPHP(
            a
          )
      );
      break;


    case "lowest":
      filtered.sort(
        (
          a,
          b
        ) =>
          amountPHP(
            a
          ) -
          amountPHP(
            b
          )
      );
      break;


    case "newest":
    default:
      filtered.sort(
        (
          a,
          b
        ) =>
          String(
            b.date ||
            ""
          ).localeCompare(
            String(
              a.date ||
              ""
            )
          ) ||
          String(
            b.createdAt ||
            ""
          ).localeCompare(
            String(
              a.createdAt ||
              ""
            )
          )
      );
      break;

  }


  return filtered;

}


function updateActivityFilteredSummary(
  filteredExpenses
) {

  if (
    activityResultCount
  ) {

    activityResultCount.textContent =
      `${filteredExpenses.length} ${
        filteredExpenses.length ===
        1
          ? "expense"
          : "expenses"
      }`;

  }


  if (
    activityFilteredTotal
  ) {

    const total =
      filteredExpenses.reduce(
        (
          sum,
          expense
        ) =>
          sum +
          convertCurrency(
            expense.amount,
            expense.currency,
            "PHP"
          ),
        0
      );


    activityFilteredTotal.textContent =
      formatPHP(
        total
      );

  }

}



function getActivityFilterDescriptors() {

  const descriptors =
    [];


  const addSelect =
    (
      key,
      prefix,
      select
    ) => {

      if (
        select?.value
      ) {

        descriptors.push(
          {
            key,
            label:
              `${prefix}: ${
                select.options[
                  select.selectedIndex
                ]?.textContent ||
                select.value
              }`
          }
        );

      }

    };


  addSelect(
    "category",
    "Category",
    activityCategoryFilter
  );


  addSelect(
    "payment",
    "Payment",
    activityPaymentFilter
  );


  addSelect(
    "trip",
    "Trip",
    activityTripFilter
  );


  addSelect(
    "tag",
    "Tag",
    activityTagFilter
  );


  addSelect(
    "photo",
    "Receipt",
    activityPhotoFilter
  );


  addSelect(
    "currency",
    "Currency",
    activityCurrencyFilter
  );


  if (
    activityDateFrom?.value
  ) {

    descriptors.push(
      {
        key: "dateFrom",
        label:
          `From ${formatShortDate(
            activityDateFrom.value
          )}`
      }
    );

  }


  if (
    activityDateTo?.value
  ) {

    descriptors.push(
      {
        key: "dateTo",
        label:
          `To ${formatShortDate(
            activityDateTo.value
          )}`
      }
    );

  }


  if (
    activityMinAmount?.value
  ) {

    descriptors.push(
      {
        key: "min",
        label:
          `Min ${formatPHP(
            Number(
              activityMinAmount.value
            )
          )}`
      }
    );

  }


  if (
    activityMaxAmount?.value
  ) {

    descriptors.push(
      {
        key: "max",
        label:
          `Max ${formatPHP(
            Number(
              activityMaxAmount.value
            )
          )}`
      }
    );

  }


  if (
    activitySortFilter?.value &&
    activitySortFilter.value !==
      "newest"
  ) {

    descriptors.push(
      {
        key: "sort",
        label:
          activitySortFilter.options[
            activitySortFilter.selectedIndex
          ]?.textContent ||
          "Sort"
      }
    );

  }


  return descriptors;

}


function clearSingleActivityFilter(
  key
) {

  const controls = {
    category:
      activityCategoryFilter,
    payment:
      activityPaymentFilter,
    trip:
      activityTripFilter,
    tag:
      activityTagFilter,
    photo:
      activityPhotoFilter,
    currency:
      activityCurrencyFilter,
    dateFrom:
      activityDateFrom,
    dateTo:
      activityDateTo,
    min:
      activityMinAmount,
    max:
      activityMaxAmount
  };


  if (
    key ===
    "sort"
  ) {

    activitySortFilter.value =
      "newest";

  } else if (
    controls[
      key
    ]
  ) {

    controls[
      key
    ].value =
      "";

  }


  resetActivityRenderWindow();

}


function updateActivityFilterUI() {

  const descriptors =
    getActivityFilterDescriptors();


  if (
    activityFilterBadge
  ) {

    activityFilterBadge.textContent =
      String(
        descriptors.length
      );


    activityFilterBadge.hidden =
      descriptors.length ===
      0;

  }


  if (
    activityActiveFilters
  ) {

    activityActiveFilters.hidden =
      descriptors.length ===
      0;


    activityActiveFilters.innerHTML =
      descriptors
        .map(
          (
            item
          ) =>
            `
              <button
                type="button"
                data-remove-activity-filter="${escapeHTML(
                  item.key
                )}"
              >
                ${escapeHTML(
                  item.label
                )}
                <span>×</span>
              </button>
            `
        )
        .join("");


    activityActiveFilters
      .querySelectorAll(
        "[data-remove-activity-filter]"
      )
      .forEach(
        (
          button
        ) => {

          button.addEventListener(
            "click",
            () =>
              clearSingleActivityFilter(
                button.dataset
                  .removeActivityFilter
              )
          );

        }
      );

  }


  if (
    clearActivitySearch
  ) {

    clearActivitySearch.hidden =
      !activitySearch?.value;

  }


  if (
    activityResultContext
  ) {

    const hasSearch =
      getActivitySearchTokens()
        .length >
      0;


    if (
      hasSearch &&
      descriptors.length
    ) {

      activityResultContext.textContent =
        "Search + filters";

    } else if (
      hasSearch
    ) {

      activityResultContext.textContent =
        "Smart search";

    } else if (
      descriptors.length
    ) {

      activityResultContext.textContent =
        `${descriptors.length} ${
          descriptors.length ===
          1
            ? "filter"
            : "filters"
        } active`;

    } else {

      activityResultContext.textContent =
        "All spending";

    }

  }

}


const ACTIVITY_RENDER_BATCH = 50;
const FILTER_INPUT_DEBOUNCE_MS = 140;
let activityRenderLimit = ACTIVITY_RENDER_BATCH;
let activityRenderTimer = null;


function resetActivityRenderWindow() {

  activityRenderLimit =
    ACTIVITY_RENDER_BATCH;


  renderActivityTransactions(
    {
      refreshFilters:
        false
    }
  );

}


function scheduleActivityRender() {

  activityRenderLimit =
    ACTIVITY_RENDER_BATCH;


  window.clearTimeout(
    activityRenderTimer
  );


  activityRenderTimer =
    window.setTimeout(
      () =>
        renderActivityTransactions(
          {
            refreshFilters:
              false
          }
        ),
      FILTER_INPUT_DEBOUNCE_MS
    );

}


function renderActivityTransactions(
  {
    refreshFilters = true
  } = {}
) {

  const activity =
    document.getElementById(
      "activityList"
    );

  const empty =
    document.getElementById(
      "activityEmpty"
    );


  if (
    !activity ||
    !empty
  ) {

    return;

  }


  if (
    refreshFilters
  ) {

    populateActivityFilters();

  }


  const filtered =
    getFilteredActivityExpenses();


  updateActivityFilteredSummary(
    filtered
  );


  updateActivityFilterUI();


  if (
    filtered.length ===
    0
  ) {

    activity.innerHTML =
      "";


    empty.hidden =
      false;


    const title =
      empty.querySelector(
        "h3"
      );

    const copy =
      empty.querySelector(
        "p"
      );


    if (
      title
    ) {

      title.textContent =
        expenses.length
          ? "No matching expenses"
          : "No expenses yet";

    }


    if (
      copy
    ) {

      copy.textContent =
        expenses.length
          ? "Try changing or clearing your filters."
          : "Add your first expense and it will appear here.";

    }


    return;

  }


  empty.hidden =
    true;


  const visibleActivityExpenses =
    filtered.slice(0, activityRenderLimit);


  activity.innerHTML =
    visibleActivityExpenses
      .map(
        (expense) =>
          renderTransaction(
            expense
          )
      )
      .join("") +
    (visibleActivityExpenses.length < filtered.length
      ? `<button class="secondary-button momo-load-more" type="button" data-load-more-activity>Load more (${filtered.length - visibleActivityExpenses.length} remaining)</button>`
      : "");


  attachExpenseDetailActions();

}


document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-load-more-activity]")) {
    return;
  }

  activityRenderLimit += ACTIVITY_RENDER_BATCH;
  renderActivityTransactions(
    {
      refreshFilters:
        false
    }
  );
});


activityFilterToggle
  ?.addEventListener(
    "click",
    () => {

      const willOpen =
        activityFilterPanel?.hidden ??
        true;


      if (
        activityFilterPanel
      ) {

        activityFilterPanel.hidden =
          !willOpen;

      }


      activityFilterToggle.setAttribute(
        "aria-expanded",
        String(
          willOpen
        )
      );

    }
  );


clearActivitySearch
  ?.addEventListener(
    "click",
    () => {

      activitySearch.value =
        "";


      activitySearch.focus();


      resetActivityRenderWindow();

    }
  );


document
  .querySelectorAll(
    "[data-activity-preset]"
  )
  .forEach(
    (
      button
    ) => {

      button.addEventListener(
        "click",
        () => {

          const preset =
            button.dataset
              .activityPreset;


          const today =
            getTodayString();


          if (
            preset ===
            "today"
          ) {

            activityDateFrom.value =
              today;


            activityDateTo.value =
              today;

          }


          if (
            preset ===
            "month"
          ) {

            const now =
              new Date();


            activityDateFrom.value =
              `${now.getFullYear()}-${String(
                now.getMonth() +
                1
              ).padStart(
                2,
                "0"
              )}-01`;


            activityDateTo.value =
              today;

          }


          if (
            preset ===
            "receipt"
          ) {

            activityPhotoFilter.value =
              activityPhotoFilter.value ===
              "with"
                ? ""
                : "with";

          }


          if (
            preset ===
            "personal"
          ) {

            activityTripFilter.value =
              activityTripFilter.value ===
              "__personal__"
                ? ""
                : "__personal__";

          }


          resetActivityRenderWindow();

        }
      );

    }
  );


[
  activitySearch,
  activityCategoryFilter,
  activityTripFilter,
  activityPaymentFilter,
  activityCurrencyFilter,
  activityTagFilter,
  activitySortFilter,
  activityPhotoFilter,
  activityMinAmount,
  activityMaxAmount,
  activityDateFrom,
  activityDateTo
]
  .filter(
    Boolean
  )
  .forEach(
    (control) => {

      const eventName =
        (
          control ===
            activitySearch ||
          control ===
            activityMinAmount ||
          control ===
            activityMaxAmount
        )
          ? "input"
          : "change";


      control.addEventListener(
        eventName,
        eventName ===
          "input"
          ? scheduleActivityRender
          : resetActivityRenderWindow
      );

    }
  );


document
  .getElementById(
    "clearActivityFilters"
  )
  ?.addEventListener(
    "click",
    () => {

      [
        activitySearch,
        activityCategoryFilter,
        activityTripFilter,
        activityPaymentFilter,
        activityCurrencyFilter,
        activityTagFilter,
        activityPhotoFilter,
        activityMinAmount,
        activityMaxAmount,
        activityDateFrom,
        activityDateTo
      ]
        .filter(
          Boolean
        )
        .forEach(
          (control) => {

            control.value =
              "";

          }
        );


      if (
        activitySortFilter
      ) {

        activitySortFilter.value =
          "newest";

      }


      resetActivityRenderWindow();

    }
  );


// ========================================
// RENDER TRANSACTIONS
// ========================================

function compareExpensesNewest(
  a,
  b
) {

  const dateCompare =
    String(
      b.date ||
      ""
    ).localeCompare(
      String(
        a.date ||
        ""
      )
    );


  if (
    dateCompare !==
    0
  ) {

    return dateCompare;

  }


  return String(
    b.createdAt ||
    b.updatedAt ||
    ""
  ).localeCompare(
    String(
      a.createdAt ||
      a.updatedAt ||
      ""
    )
  );

}


function getRecentExpenses(
  limit = 4
) {

  if (
    limit <=
    0
  ) {

    return [];

  }


  const recent =
    [];


  for (
    const expense of
    expenses
  ) {

    const insertAt =
      recent.findIndex(
        (item) =>
          compareExpensesNewest(
            expense,
            item
          ) <
          0
      );


    if (
      insertAt ===
      -1
    ) {

      recent.push(
        expense
      );

    } else {

      recent.splice(
        insertAt,
        0,
        expense
      );

    }


    if (
      recent.length >
      limit
    ) {

      recent.pop();

    }

  }


  return recent;

}


function renderTransactions() {

  const home =
    document.getElementById(
      "homeTransactionList"
    );


  const activity =
    document.getElementById(
      "activityList"
    );


  const empty =
    document.getElementById(
      "activityEmpty"
    );


  if (
    expenses.length ===
    0
  ) {

    if (
      home
    ) {

      home.innerHTML = `

        <div class="empty-panel compact-empty">

          <span class="empty-icon">
            ${getMomoPeachIconHTML()}
          </span>

          <h3>
            No spending yet
          </h3>

          <p>
            Your first expense will appear here.
          </p>

        </div>

      `;

    }


    if (
      activity
    ) {

      activity.innerHTML =
        "";

    }


    updateActivityFilteredSummary(
      []
    );


    if (
      empty
    ) {

      empty.hidden =
        false;

    }


    return;

  }


  if (
    empty
  ) {

    empty.hidden =
      true;

  }


  if (
    home
  ) {

    const recentExpenses =
      getRecentExpenses(
        4
      );


    home.innerHTML =
      recentExpenses

        .map(
          renderTransaction
        )

        .join("");


    attachExpenseDetailActions();

  }


  if (
    activity &&
    currentScreenName === "activity"
  ) {

    renderActivityTransactions();

  }

}






// ========================================
// EXPENSE DETAIL VIEW
// ========================================

const expenseDetailModal =
  document.getElementById(
    "expenseDetailModal"
  );


const expenseDetailBody =
  document.getElementById(
    "expenseDetailBody"
  );


function getExpenseBudgetName(
  expense
) {

  if (
    !expense?.budgetId
  ) {

    return "No budget";

  }


  const budget =
    budgets.find(
      (item) =>
        item.id ===
        expense.budgetId
    );


  return (
    budget?.name ||
    "No budget"
  );

}


function getExpenseTripName(
  expense
) {

  if (
    !expense?.tripId
  ) {

    return "Personal / No Trip";

  }


  const trip =
    trips.find(
      (item) =>
        item.id ===
        expense.tripId
    );


  return (
    trip?.name ||
    "Trip unavailable"
  );

}


function createExpenseDetailRow(
  label,
  value
) {

  return `

    <div class="expense-detail-row">

      <span>
        ${escapeHTML(
          label
        )}
      </span>

      <strong>
        ${escapeHTML(
          value ||
          "—"
        )}
      </strong>

    </div>

  `;

}


function getExpensePaymentDisplay(
  expense
) {

  if (
    expense.paymentMethod ===
      "Other" &&
    expense.otherPaymentMethod
  ) {

    return `Other · ${expense.otherPaymentMethod}`;

  }


  return (
    expense.paymentMethod ||
    "—"
  );

}


function getExpenseCategoryDisplay(
  expense
) {

  if (
    expense.category ===
      "Other" &&
    expense.otherCategory
  ) {

    return `Other · ${expense.otherCategory}`;

  }


  return (
    expense.category ||
    "Other"
  );

}


function getExpenseSettlementDetail(
  expense
) {

  if (
    !expense.settlementShared ||
    !expense.tripId
  ) {

    return null;

  }


  const settlement =
    getSettlementForTrip(
      expense.tripId,
      false
    );


  if (
    !settlement
  ) {

    return null;

  }


  const payer =
    getSettlementPerson(
      settlement,
      expense.settlementPayerId
    );


  const shares =
    Array.isArray(
      expense.settlementShares
    )
      ? expense.settlementShares
      : [];


  return {
    settlement,
    payer,
    shares
  };

}


function renderExpenseSettlementDetail(
  expense
) {

  const detail =
    getExpenseSettlementDetail(
      expense
    );


  if (
    !detail
  ) {

    return "";

  }


  const trip =
    trips.find(
      (
        item
      ) =>
        item.id ===
        expense.tripId
    );


  return `

    <section class="expense-history-section expense-shared-detail">

      <div class="expense-history-section-heading">
        <div>
          <span class="expense-history-section-icon">🤝</span>
          <div>
            <small>Shared Settlement</small>
            <strong>Shared expense</strong>
          </div>
        </div>

        <span class="expense-detail-soft-badge">
          ${escapeHTML(
            expense.settlementSplitMode ===
              "exact"
              ? "Exact split"
              : "Equal split"
          )}
        </span>
      </div>


      <div class="expense-shared-paid-by">
        <span>Paid by</span>
        <strong>
          ${escapeHTML(
            detail.payer?.name ||
            "Unknown"
          )}
        </strong>
      </div>


      <div class="expense-shared-people">

        ${detail.shares
          .map(
            (
              share
            ) => {

              const person =
                getSettlementPerson(
                  detail.settlement,
                  share.personId
                );


              return `
                <div class="expense-shared-person">
                  <span class="expense-shared-avatar">
                    ${escapeHTML(
                      (
                        person?.name ||
                        "?"
                      )
                        .slice(
                          0,
                          1
                        )
                        .toUpperCase()
                    )}
                  </span>

                  <span>
                    <strong>
                      ${escapeHTML(
                        person?.name ||
                        "Unknown"
                      )}
                    </strong>
                    <small>
                      ${formatCurrency(
                        share.amount,
                        expense.settlementCurrency ||
                        trip?.currency ||
                        expense.currency
                      )}
                    </small>
                  </span>
                </div>
              `;

            }
          )
          .join("")}

      </div>

    </section>

  `;

}


function openExpenseDetail(
  expense
) {

  if (
    !expense ||
    !expenseDetailModal ||
    !expenseDetailBody
  ) {

    return;

  }


  selectedExpenseDetailId =
    expense.id;


  const convertedPHP =
    convertCurrency(
      expense.amount,
      expense.currency,
      "PHP"
    );


  const convertedText =
    expense.currency !==
      "PHP"
      ? `≈ ${formatPHP(
          convertedPHP
        )}`
      : "";


  const categoryDisplay =
    getExpenseCategoryDisplay(
      expense
    );


  const paymentDisplay =
    getExpensePaymentDisplay(
      expense
    );


  const tags =
    normalizeExpenseTags(
      expense.tags
    );


  const photoHTML =
    expense.photo

      ? `

          <button
            class="expense-detail-photo"
            type="button"
            data-expense-receipt-preview
            aria-label="View receipt photo"
          >

            <img
              src="${expense.photo}"
              alt="Receipt for ${escapeHTML(
                expense.title
              )}"
            >

            <span class="expense-receipt-overlay">
              <b>🧾 Receipt attached</b>
              <small>Tap to view larger</small>
            </span>

          </button>

        `

      : `

          <div class="expense-detail-photo expense-detail-photo-empty">
            <span>
              ${getCategoryEmoji(
                expense.category
              )}
            </span>
            <small>No receipt attached</small>
          </div>

        `;


  expenseDetailBody.innerHTML = `

    ${photoHTML}


    <section class="expense-detail-hero">

      <div class="expense-detail-hero-copy">

        <p class="expense-detail-category">
          ${escapeHTML(
            categoryDisplay
          )}
        </p>

        <h3>
          ${escapeHTML(
            expense.title ||
            "Expense"
          )}
        </h3>

        ${
          expense.location
            ? `
                <p class="expense-detail-location">
                  ⌖ ${escapeHTML(
                    expense.location
                  )}
                </p>
              `
            : ""
        }

      </div>


      <div class="expense-detail-amount">

        <strong>
          ${formatCurrency(
            expense.amount,
            expense.currency
          )}
        </strong>

        ${
          convertedText
            ? `
                <span>
                  ${convertedText}
                </span>
              `
            : ""
        }

      </div>

    </section>


    <section class="expense-detail-info-card">

      ${createExpenseDetailRow(
        "Date",
        formatDate(
          expense.date
        )
      )}

      ${createExpenseDetailRow(
        "Payment",
        paymentDisplay
      )}

      ${createExpenseDetailRow(
        "Budget",
        getExpenseBudgetName(
          expense
        )
      )}

      ${createExpenseDetailRow(
        "Trip",
        getExpenseTripName(
          expense
        )
      )}

      ${createExpenseDetailRow(
        "Currency",
        expense.currency
      )}

      ${createExpenseDetailRow(
        "Receipt",
        expense.photo
          ? "Attached"
          : "None"
      )}

    </section>


    ${
      tags.length
        ? `
            <section class="expense-history-section">
              <div class="expense-history-section-heading">
                <div>
                  <span class="expense-history-section-icon">#</span>
                  <div>
                    <small>Organize</small>
                    <strong>Tags</strong>
                  </div>
                </div>
              </div>

              <div class="expense-detail-tag-list">
                ${tags
                  .map(
                    (
                      tag
                    ) =>
                      `<span>#${escapeHTML(
                        tag
                      )}</span>`
                  )
                  .join("")}
              </div>
            </section>
          `
        : ""
    }


    ${
      expense.notes
        ? `
            <section class="expense-history-section">
              <div class="expense-history-section-heading">
                <div>
                  <span class="expense-history-section-icon">✎</span>
                  <div>
                    <small>Remember</small>
                    <strong>Notes</strong>
                  </div>
                </div>
              </div>

              <p class="expense-detail-note-copy">
                ${escapeHTML(
                  expense.notes
                )}
              </p>
            </section>
          `
        : ""
    }


    ${renderExpenseSettlementDetail(
      expense
    )}


    <section class="expense-history-section expense-record-history">

      <div class="expense-history-section-heading">
        <div>
          <span class="expense-history-section-icon">◷</span>
          <div>
            <small>Record</small>
            <strong>History</strong>
          </div>
        </div>
      </div>

      <div class="expense-record-timeline">

        <div>
          <span></span>
          <p>
            <small>Expense date</small>
            <strong>
              ${escapeHTML(
                formatDate(
                  expense.date
                )
              )}
            </strong>
          </p>
        </div>

        ${
          expense.createdAt
            ? `
                <div>
                  <span></span>
                  <p>
                    <small>Added to Momo</small>
                    <strong>
                      ${escapeHTML(
                        new Intl.DateTimeFormat(
                          "en-US",
                          {
                            month:
                              "short",
                            day:
                              "numeric",
                            year:
                              "numeric",
                            hour:
                              "numeric",
                            minute:
                              "2-digit"
                          }
                        ).format(
                          new Date(
                            expense.createdAt
                          )
                        )
                      )}
                    </strong>
                  </p>
                </div>
              `
            : ""
        }

        ${
          expense.updatedAt &&
          expense.createdAt &&
          expense.updatedAt !==
            expense.createdAt
            ? `
                <div>
                  <span></span>
                  <p>
                    <small>Last edited</small>
                    <strong>
                      ${escapeHTML(
                        new Intl.DateTimeFormat(
                          "en-US",
                          {
                            month:
                              "short",
                            day:
                              "numeric",
                            year:
                              "numeric",
                            hour:
                              "numeric",
                            minute:
                              "2-digit"
                          }
                        ).format(
                          new Date(
                            expense.updatedAt
                          )
                        )
                      )}
                    </strong>
                  </p>
                </div>
              `
            : ""
        }

      </div>

    </section>

  `;


  const receiptPreview =
    expenseDetailBody.querySelector(
      "[data-expense-receipt-preview]"
    );


  receiptPreview?.addEventListener(
    "click",
    () => {

      expenseDetailBody
        .querySelector(
          ".expense-detail-photo"
        )
        ?.classList.toggle(
          "expanded"
        );

    }
  );


  expenseDetailModal.hidden =
    false;


  document.body.classList.add(
    "drawer-open"
  );

}


function closeExpenseDetail() {

  if (
    expenseDetailModal
  ) {

    expenseDetailModal.hidden =
      true;

  }


  selectedExpenseDetailId =
    "";


  document.body.classList.remove(
    "drawer-open"
  );

}


function closeOpenExpenseSwipes(
  exceptShell =
    null
) {

  document
    .querySelectorAll(
      ".transaction-swipe-shell.is-open-left, .transaction-swipe-shell.is-open-right"
    )
    .forEach(
      (
        shell
      ) => {

        if (
          shell ===
          exceptShell
        ) {

          return;

        }


        const content =
          shell.querySelector(
            ".transaction-swipe-content"
          );


        shell.classList.remove(
          "is-open-left",
          "is-open-right"
        );


        if (
          content
        ) {

          content.style.transform =
            "translateX(0px)";

        }

      }
    );

}


function attachExpenseSwipeActions() {

  const REVEAL_DISTANCE =
    82;


  const OPEN_THRESHOLD =
    42;


  document
    .querySelectorAll(
      ".transaction-swipe-shell"
    )
    .forEach(
      (
        shell
      ) => {

        if (
          shell.dataset
            .swipeBound ===
          "yes"
        ) {

          return;

        }


        shell.dataset
          .swipeBound =
          "yes";


        const content =
          shell.querySelector(
            ".transaction-swipe-content"
          );


        if (
          !content
        ) {

          return;

        }


        let pointerId =
          null;


        let startX =
          0;


        let startY =
          0;


        let startOffset =
          0;


        let currentOffset =
          0;


        let horizontalGesture =
          false;


        const getOpenOffset =
          () => {

            if (
              shell.classList.contains(
                "is-open-right"
              )
            ) {

              return -
                REVEAL_DISTANCE;

            }


            if (
              shell.classList.contains(
                "is-open-left"
              )
            ) {

              return REVEAL_DISTANCE;

            }


            return 0;

          };


        const settle =
          (
            offset
          ) => {

            const limited =
              Math.max(
                -REVEAL_DISTANCE,
                Math.min(
                  REVEAL_DISTANCE,
                  offset
                )
              );


            shell.classList.remove(
              "is-open-left",
              "is-open-right"
            );


            if (
              limited >=
              OPEN_THRESHOLD
            ) {

              currentOffset =
                REVEAL_DISTANCE;


              shell.classList.add(
                "is-open-left"
              );

            } else if (
              limited <=
              -OPEN_THRESHOLD
            ) {

              currentOffset =
                -REVEAL_DISTANCE;


              shell.classList.add(
                "is-open-right"
              );

            } else {

              currentOffset =
                0;

            }


            content.style.transform =
              `translateX(${currentOffset}px)`;

          };


        content.addEventListener(
          "pointerdown",
          (
            event
          ) => {

            if (
              event.pointerType ===
                "mouse" &&
              event.button !==
                0
            ) {

              return;

            }


            closeOpenExpenseSwipes(
              shell
            );


            pointerId =
              event.pointerId;


            startX =
              event.clientX;


            startY =
              event.clientY;


            startOffset =
              getOpenOffset();


            currentOffset =
              startOffset;


            horizontalGesture =
              false;


            content.classList.add(
              "is-swiping"
            );


            try {

              content.setPointerCapture(
                pointerId
              );

            } catch (
              error
            ) {

              // Pointer capture is optional on older Safari builds.

            }

          }
        );


        content.addEventListener(
          "pointermove",
          (
            event
          ) => {

            if (
              pointerId ===
                null ||
              event.pointerId !==
                pointerId
            ) {

              return;

            }


            const dx =
              event.clientX -
              startX;


            const dy =
              event.clientY -
              startY;


            if (
              !horizontalGesture
            ) {

              if (
                Math.abs(
                  dx
                ) <
                  7 &&
                Math.abs(
                  dy
                ) <
                  7
              ) {

                return;

              }


              if (
                Math.abs(
                  dy
                ) >
                Math.abs(
                  dx
                )
              ) {

                pointerId =
                  null;


                content.classList.remove(
                  "is-swiping"
                );


                return;

              }


              horizontalGesture =
                true;

            }


            currentOffset =
              Math.max(
                -REVEAL_DISTANCE,
                Math.min(
                  REVEAL_DISTANCE,
                  startOffset +
                    dx
                )
              );


            content.style.transform =
              `translateX(${currentOffset}px)`;

          }
        );


        const finishSwipe =
          (
            event
          ) => {

            if (
              pointerId ===
              null ||
              (
                event.pointerId !==
                undefined &&
                event.pointerId !==
                  pointerId
              )
            ) {

              return;

            }


            const didSwipe =
              horizontalGesture;


            pointerId =
              null;


            content.classList.remove(
              "is-swiping"
            );


            settle(
              currentOffset
            );


            if (
              didSwipe
            ) {

              shell.dataset
                .swipeIgnoreClickUntil =
                String(
                  Date.now() +
                    350
                );

            }

          };


        content.addEventListener(
          "pointerup",
          finishSwipe
        );


        content.addEventListener(
          "pointercancel",
          finishSwipe
        );

      }
    );


  document
    .querySelectorAll(
      "[data-swipe-edit-expense]"
    )
    .forEach(
      (
        button
      ) => {

        if (
          button.dataset
            .swipeActionBound ===
          "yes"
        ) {

          return;

        }


        button.dataset
          .swipeActionBound =
          "yes";


        button.addEventListener(
          "click",
          (
            event
          ) => {

            event.stopPropagation();


            const expense =
              expenses.find(
                (
                  item
                ) =>
                  item.id ===
                  button.dataset
                    .swipeEditExpense
              );


            if (
              expense
            ) {

              closeOpenExpenseSwipes();


              openExpenseEditor(
                expense
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-swipe-delete-expense]"
    )
    .forEach(
      (
        button
      ) => {

        if (
          button.dataset
            .swipeActionBound ===
          "yes"
        ) {

          return;

        }


        button.dataset
          .swipeActionBound =
          "yes";


        button.addEventListener(
          "click",
          (
            event
          ) => {

            event.stopPropagation();


            expensePendingDelete =
              button.dataset
                .swipeDeleteExpense;


            closeOpenExpenseSwipes();


            document
              .getElementById(
                "deleteExpenseModal"
              )
              .hidden =
              false;

          }
        );

      }
    );

}


function attachExpenseDetailActions() {

  attachExpenseSwipeActions();


  document
    .querySelectorAll(
      "[data-expense-detail-id]"
    )
    .forEach(
      (row) => {

        if (
          row.dataset
            .detailBound ===
          "yes"
        ) {

          return;

        }


        row.dataset
          .detailBound =
          "yes";


        const openFromRow =
          (event) => {

            if (
              event.target.closest(
                "button"
              )
            ) {

              return;

            }


            const swipeShell =
              row.closest(
                ".transaction-swipe-shell"
              );


            if (
              Number(
                swipeShell?.dataset
                  .swipeIgnoreClickUntil ||
                  0
              ) >
              Date.now()
            ) {

              return;

            }


            if (
              swipeShell?.classList.contains(
                "is-open-left"
              ) ||
              swipeShell?.classList.contains(
                "is-open-right"
              )
            ) {

              closeOpenExpenseSwipes();


              return;

            }


            const expense =
              expenses.find(
                (item) =>
                  item.id ===
                  row.dataset
                    .expenseDetailId
              );


            if (
              expense
            ) {

              openExpenseDetail(
                expense
              );

            }

          };


        row.addEventListener(
          "click",
          openFromRow
        );


        row.addEventListener(
          "keydown",
          (event) => {

            if (
              event.key !==
              "Enter" &&
              event.key !==
              " "
            ) {

              return;

            }


            if (
              event.target.closest(
                "button"
              )
            ) {

              return;

            }


            event.preventDefault();


            openFromRow(
              event
            );

          }
        );

      }
    );

}


document
  .getElementById(
    "closeExpenseDetail"
  )
  ?.addEventListener(
    "click",
    closeExpenseDetail
  );


expenseDetailModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      expenseDetailModal
    ) {

      closeExpenseDetail();

    }

  }
);


document
  .getElementById(
    "editExpenseFromDetail"
  )
  ?.addEventListener(
    "click",
    () => {

      const expense =
        expenses.find(
          (item) =>
            item.id ===
            selectedExpenseDetailId
        );


      if (
        !expense
      ) {

        return;

      }


      closeExpenseDetail();


      openExpenseEditor(
        expense
      );

    }
  );


document
  .getElementById(
    "deleteExpenseFromDetail"
  )
  ?.addEventListener(
    "click",
    () => {

      if (
        !selectedExpenseDetailId
      ) {

        return;

      }


      expensePendingDelete =
        selectedExpenseDetailId;


      closeExpenseDetail();


      document
        .getElementById(
          "deleteExpenseModal"
        )
        .hidden =
        false;

    }
  );



document.addEventListener(
  "pointerdown",
  (
    event
  ) => {

    if (
      event.target.closest(
        ".transaction-swipe-shell"
      )
    ) {

      return;

    }


    closeOpenExpenseSwipes();

  }
);


// ========================================
// EDIT / DELETE EXPENSES
// ========================================

function attachExpenseActions() {

  document
    .querySelectorAll(
      ".edit-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const expense =
              expenses.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .expenseId
              );


            if (
              expense
            ) {

              openExpenseEditor(
                expense
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            expensePendingDelete =
              button.dataset
                .expenseId;


            document
              .getElementById(
                "deleteExpenseModal"
              )
              .hidden =
              false;

          }
        );

      }
    );

}


document
  .getElementById(
    "cancelDeleteExpense"
  )
  ?.addEventListener(
    "click",
    () => {

      expensePendingDelete =
        null;


      document
        .getElementById(
          "deleteExpenseModal"
        )
        .hidden =
        true;

    }
  );


document
  .getElementById(
    "confirmDeleteExpense"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !expensePendingDelete
      ) {

        return;

      }


      await deleteRecord(
        STORES.expenses,
        expensePendingDelete
      );


      expensePendingDelete =
        null;


      document
        .getElementById(
          "deleteExpenseModal"
        )
        .hidden =
        true;


      selectedExpenseDetailId =
        "";


      closeOpenExpenseSwipes();


      await loadAppData();


      renderAll();


      showToast(
        "Expense deleted"
      );

    }
  );


document
  .getElementById(
    "deleteExpenseModal"
  )
  ?.addEventListener(
    "click",
    (event) => {

      if (
        event.target.id ===
        "deleteExpenseModal"
      ) {

        expensePendingDelete =
          null;


        event.currentTarget.hidden =
          true;

      }

    }
  );

// ========================================
// MONTHLY SPENDING
// ========================================

function isCurrentMonth(
  expense
) {

  if (
    !expense.date
  ) {

    return false;

  }


  const date =
    createLocalDate(
      expense.date
    );


  const today =
    new Date();


  return (

    date.getFullYear() ===
      today.getFullYear() &&

    date.getMonth() ===
      today.getMonth()

  );

}


function getMonthlySpent() {

  return expenses

    .filter(
      isCurrentMonth
    )

    .reduce(
      (
        total,
        expense
      ) => {

        return (
          total +
          convertCurrency(
            expense.amount,
            expense.currency,
            "PHP"
          )
        );

      },
      0
    );

}


// ========================================
// MONTHLY BUDGET TOTAL
// ========================================

function getCurrentMonthlyBudgetTotal() {

  return budgets

    .filter(
      (budget) =>

        budget.period ===
          "monthly" &&

        budget.currency ===
          "PHP"
    )

    .reduce(
      (
        total,
        budget
      ) => {

        return (
          total +
          Number(
            budget.amount ||
            0
          )
        );

      },
      0
    );

}


// ========================================
// HOME DAILY + CATEGORY SPENDING
// ========================================

function getTodayExpenses() {

  const today =
    getTodayString();


  return expenses.filter(
    (expense) =>
      (
        expense.date ||
        (
          expense.createdAt
            ? expense.createdAt.slice(
                0,
                10
              )
            : ""
        )
      ) ===
      today
  );

}


function getTodaySpentPHP() {

  return getTodayExpenses()
    .reduce(
      (
        total,
        expense
      ) => {

        return (
          total +
          convertCurrency(
            expense.amount,
            expense.currency,
            "PHP"
          )
        );

      },
      0
    );

}


function getCurrentMonthExpenses() {

  const now =
    new Date();


  const key =
    `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    )}`;


  return expenses.filter(
    (expense) => {

      const date =
        expense.date ||
        (
          expense.createdAt
            ? expense.createdAt.slice(
                0,
                10
              )
            : ""
        );


      return date.startsWith(
        key
      );

    }
  );

}


function getHomeCategoryBreakdown() {

  const totals =
    new Map();


  getCurrentMonthExpenses()
    .forEach(
      (expense) => {

        const category =
          expense.category ||
          "Other";


        const amount =
          convertCurrency(
            expense.amount,
            expense.currency,
            "PHP"
          );


        totals.set(
          category,
          (
            totals.get(
              category
            ) ||
            0
          ) +
          amount
        );

      }
    );


  return Array.from(
    totals.entries()
  )

    .map(
      (
        [
          category,
          amount
        ]
      ) => ({
        category,
        amount
      })
    )

    .sort(
      (
        a,
        b
      ) =>
        b.amount -
        a.amount
    );

}


function renderHomeSpendingOverview() {

  const todayExpenses =
    getTodayExpenses();


  const todaySpent =
    getTodaySpentPHP();


  const monthExpenses =
    getCurrentMonthExpenses();


  const monthTotal =
    monthExpenses.reduce(
      (
        total,
        expense
      ) =>
        total +
        convertCurrency(
          expense.amount,
          expense.currency,
          "PHP"
        ),
      0
    );


  const todaySpentElement =
    document.getElementById(
      "homeTodaySpent"
    );


  const todayCountElement =
    document.getElementById(
      "homeTodayExpenseCount"
    );


  const categoryTotalElement =
    document.getElementById(
      "homeCategoryTotal"
    );


  const categoryContainer =
    document.getElementById(
      "homeCategoryBreakdown"
    );


  if (
    todaySpentElement
  ) {

    todaySpentElement.textContent =
      formatPHP(
        todaySpent
      );

  }


  if (
    todayCountElement
  ) {

    todayCountElement.textContent =
      `${todayExpenses.length} ${
        todayExpenses.length ===
        1
          ? "expense"
          : "expenses"
      }`;

  }


  if (
    categoryTotalElement
  ) {

    categoryTotalElement.textContent =
      formatPHP(
        monthTotal
      );

  }


  if (
    !categoryContainer
  ) {

    return;

  }


  const categories =
    getHomeCategoryBreakdown();


  if (
    categories.length ===
    0
  ) {

    categoryContainer.innerHTML = `

      <div class="home-category-empty">
        No spending recorded this month yet.
      </div>

    `;


    return;

  }


  const maximum =
    categories[
      0
    ].amount ||
    1;


  categoryContainer.innerHTML =
    categories

      .slice(
        0,
        6
      )

      .map(
        (
          item
        ) => {

          const width =
            Math.max(
              (
                item.amount /
                maximum
              ) *
              100,
              5
            );


          return `

            <div class="home-category-row">

              <div class="home-category-label">

                <span>
                  ${getCategoryEmoji(
                    item.category
                  )}
                </span>

                <strong>
                  ${escapeHTML(
                    item.category ===
                    "Other"
                      ? "General / Other"
                      : item.category
                  )}
                </strong>

              </div>


              <div class="home-category-value">

                <strong>
                  ${formatPHP(
                    item.amount
                  )}
                </strong>

                <div class="home-category-track">

                  <div
                    style="width:${width}%"
                  ></div>

                </div>

              </div>

            </div>

          `;

        }
      )

      .join("");

}


// ========================================
// HOME SUMMARY
// ========================================


function getCurrentMonthKey() {

  const now =
    new Date();


  return `${now.getFullYear()}-${String(
    now.getMonth() +
      1
  ).padStart(
    2,
    "0"
  )}`;

}


function getExpensesForMonthKey(
  monthKey,
  endDay =
    null
) {

  return expenses.filter(
    (
      expense
    ) => {

      if (
        !expense.date ||
        !expense.date.startsWith(
          monthKey
        )
      ) {

        return false;

      }


      if (
        endDay ===
        null
      ) {

        return true;

      }


      return Number(
        expense.date.slice(
          8,
          10
        )
      ) <=
        endDay;

    }
  );

}


function totalExpensesPHP(
  list
) {

  return list.reduce(
    (
      total,
      expense
    ) =>
      total +
      convertCurrency(
        expense.amount,
        expense.currency,
        "PHP"
      ),
    0
  );

}


function getCurrentMonthSavingsPHP() {

  const monthKey =
    getCurrentMonthKey();


  return savingsGoals.reduce(
    (
      grandTotal,
      goal
    ) => {

      const contributions =
        Array.isArray(
          goal.contributions
        )
          ? goal.contributions
          : [];


      const goalTotal =
        contributions
          .filter(
            (
              contribution
            ) =>
              String(
                contribution.date ||
                ""
              ).startsWith(
                monthKey
              )
          )
          .reduce(
            (
              total,
              contribution
            ) =>
              total +
              Number(
                contribution.amount ||
                0
              ),
            0
          );


      return grandTotal +
        convertCurrency(
          goalTotal,
          goal.currency ||
            "PHP",
          "PHP"
        );

    },
    0
  );

}


function getCurrentMonthBiggestCategory() {

  const monthExpenses =
    getExpensesForMonthKey(
      getCurrentMonthKey()
    );


  const totals =
    {};


  monthExpenses.forEach(
    (
      expense
    ) => {

      const label =
        expense.category ===
          "Other" &&
        expense.otherCategory
          ? expense.otherCategory
          : (
              expense.category ||
              "Other"
            );


      totals[
        label
      ] =
        (
          totals[
            label
          ] ||
          0
        ) +
        convertCurrency(
          expense.amount,
          expense.currency,
          "PHP"
        );

    }
  );


  return Object.entries(
    totals
  )
    .sort(
      (
        a,
        b
      ) =>
        b[
          1
        ] -
        a[
          1
        ]
    )[
      0
    ] ||
    null;

}


function getRecurringMonthlyPHP() {

  return recurringExpenses.reduce(
    (
      total,
      recurring
    ) => {

      if (
        recurring.active ===
        false
      ) {

        return total;

      }


      let multiplier =
        1;


      const recurringFrequency =
        String(
          recurring.frequency ||
          ""
        ).toLowerCase();


      if (
        recurringFrequency ===
        "weekly"
      ) {

        multiplier =
          52 /
          12;

      } else if (
        recurringFrequency ===
        "quarterly"
      ) {

        multiplier =
          1 /
          3;

      } else if (
        recurringFrequency ===
        "yearly"
      ) {

        multiplier =
          1 /
          12;

      }


      return total +
        convertCurrency(
          Number(
            recurring.amount ||
            0
          ) *
          multiplier,
          recurring.currency ||
            "PHP",
          "PHP"
        );

    },
    0
  );

}


function getMonthToDateComparison() {

  const now =
    new Date();


  const currentKey =
    getCurrentMonthKey();


  const previousDate =
    new Date(
      now.getFullYear(),
      now.getMonth() -
        1,
      1
    );


  const previousKey =
    `${previousDate.getFullYear()}-${String(
      previousDate.getMonth() +
        1
    ).padStart(
      2,
      "0"
    )}`;


  const currentDay =
    now.getDate();


  const previousMonthLastDay =
    new Date(
      previousDate.getFullYear(),
      previousDate.getMonth() +
        1,
      0
    ).getDate();


  const comparisonDay =
    Math.min(
      currentDay,
      previousMonthLastDay
    );


  const currentSpent =
    totalExpensesPHP(
      getExpensesForMonthKey(
        currentKey,
        currentDay
      )
    );


  const previousSpent =
    totalExpensesPHP(
      getExpensesForMonthKey(
        previousKey,
        comparisonDay
      )
    );


  return {
    currentSpent,
    previousSpent,
    previousLabel:
      new Intl.DateTimeFormat(
        "en-US",
        {
          month:
            "short"
        }
      ).format(
        previousDate
      )
  };

}


async function saveMonthlyIncome() {

  await putRecord(
    STORES.settings,
    {
      key:
        MONTHLY_INCOME_SETTING_KEY,
      value:
        monthlyIncomeByMonth,
      updatedAt:
        new Date()
          .toISOString()
    }
  );

}


// ========================================
// MOMO TODAY + SAFE TO SPEND
// ========================================

function clampMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}


function getPayableScheduledAmountPHP(payable) {
  const balance = getPayableBalance(payable);

  if (balance <= 0) return 0;

  const scheduled =
    Number(payable.regularPayment || 0) ||
    Number(payable.minimumDue || 0) ||
    balance;

  return payablePHPValue(
    payable,
    Math.min(balance, Math.max(0, scheduled))
  );
}


function getRecurringOccurrencesBetween(
  recurring,
  startDate,
  endDate,
  limit = 64
) {
  if (
    !isRecurringActive(recurring) ||
    !recurring.nextDueDate ||
    !startDate ||
    !endDate ||
    startDate > endDate
  ) {
    return [];
  }

  const results = [];
  let cursor = recurring.nextDueDate;
  let guard = 0;

  while (cursor && cursor < startDate && guard < limit) {
    cursor = getNextRecurringDate(
      cursor,
      recurring.frequency,
      recurring.anchorDay
    );
    guard += 1;
  }

  while (
    cursor &&
    cursor <= endDate &&
    guard < limit
  ) {
    if (!recurring.endDate || cursor <= recurring.endDate) {
      results.push(cursor);
    }

    const next = getNextRecurringDate(
      cursor,
      recurring.frequency,
      recurring.anchorDay
    );

    if (!next || next === cursor) break;
    cursor = next;
    guard += 1;
  }

  return results;
}


function buildScheduledCashFlow(
  startDate,
  endDate
) {
  const byDate = new Map();
  let totalPHP = 0;

  const addItem = (date, item) => {
    if (!date || date < startDate || date > endDate) return;

    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(item);
    totalPHP += Number(item.amountPHP || 0);
  };

  for (const recurring of recurringExpenses) {
    const amountPHP = convertCurrency(
      Number(recurring.amount || 0),
      recurring.currency || "PHP",
      "PHP"
    );

    // A variable recurring payment with no usual amount stays visible as a
    // dated commitment but does not invent an amount for Safe to Spend.
    const hasAmount = amountPHP > 0;

    for (const date of getRecurringOccurrencesBetween(
      recurring,
      startDate,
      endDate
    )) {
      addItem(date, {
        type: "recurring",
        icon: "↻",
        title: recurring.name || "Recurring expense",
        amountPHP: hasAmount ? amountPHP : 0,
        amountKnown: hasAmount,
        originalAmount: Number(recurring.amount || 0),
        currency: recurring.currency || "PHP"
      });
    }
  }

  for (const planned of plannedExpenses) {
    if (
      planned.status !== "planned" ||
      !planned.targetDate ||
      planned.targetDate < startDate ||
      planned.targetDate > endDate
    ) {
      continue;
    }

    const amountPHP = convertCurrency(
      Number(planned.amount || 0),
      planned.currency || "PHP",
      "PHP"
    );

    addItem(planned.targetDate, {
      type: "planned",
      icon: "☆",
      title: planned.title || "Planned expense",
      amountPHP,
      amountKnown: amountPHP > 0,
      originalAmount: Number(planned.amount || 0),
      currency: planned.currency || "PHP"
    });
  }

  for (const payable of cards) {
    if (
      getPayableBalance(payable) <= 0 ||
      !payable.dueDate ||
      payable.dueDate < startDate ||
      payable.dueDate > endDate
    ) {
      continue;
    }

    const amountPHP = getPayableScheduledAmountPHP(payable);

    addItem(payable.dueDate, {
      type: "payable",
      icon: "♡",
      title: payable.name || "Payable",
      amountPHP,
      amountKnown: amountPHP > 0,
      originalAmount:
        Number(payable.regularPayment || 0) ||
        Number(payable.minimumDue || 0) ||
        getPayableBalance(payable),
      currency: payable.currency || "PHP"
    });
  }

  return { byDate, totalPHP };
}


function getSavingsGoalMonthContributedPHP(
  goal,
  monthKey = getCurrentMonthKey()
) {
  const contributed = (Array.isArray(goal?.contributions)
    ? goal.contributions
    : [])
    .filter((item) => String(item.date || "").startsWith(monthKey))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return convertCurrency(
    contributed,
    goal?.currency || "PHP",
    "PHP"
  );
}

function getProtectedSavingsRemainingPHP(
  monthKey = getCurrentMonthKey()
) {
  return savingsGoals.reduce((total, goal) => {
    if (!goal?.protectedJar || Number(goal.monthlyPlan || 0) <= 0) {
      return total;
    }

    const plannedPHP = convertCurrency(
      Number(goal.monthlyPlan || 0),
      goal.currency || "PHP",
      "PHP"
    );
    const contributedPHP = getSavingsGoalMonthContributedPHP(goal, monthKey);
    return total + Math.max(0, plannedPHP - contributedPHP);
  }, 0);
}


function getMomoTodaySnapshot() {
  const today = getTodayString();
  const now = createLocalDate(today) || new Date();
  const monthKey = getCurrentMonthKey();
  const monthEnd = `${monthKey}-${String(
    getDaysInMonth(now.getFullYear(), now.getMonth())
  ).padStart(2, "0")}`;
  const sevenDayEnd = addDaysToDateString(today, 7);
  const monthIncome = clampMoney(monthlyIncomeByMonth[monthKey]);
  const monthBudget = clampMoney(getCurrentMonthlyBudgetTotal());
  const baseAmount = monthIncome > 0 ? monthIncome : monthBudget;
  const baseLabel = monthIncome > 0 ? "monthly income" : "monthly budget";
  const spent = getMonthlySpent();
  const saved = getCurrentMonthSavingsPHP();
  const protectedSavingsRemaining = getProtectedSavingsRemainingPHP(monthKey);
  const monthSchedule = buildScheduledCashFlow(today, monthEnd);
  const sevenDaySchedule = buildScheduledCashFlow(today, sevenDayEnd);
  const cushion = baseAmount > 0
    ? baseAmount - spent - saved - protectedSavingsRemaining - monthSchedule.totalPHP
    : null;
  const daysRemaining = Math.max(
    1,
    getDaysInMonth(now.getFullYear(), now.getMonth()) - now.getDate() + 1
  );
  const safePerDay = cushion === null
    ? null
    : Math.max(0, cushion) / daysRemaining;

  return {
    today,
    monthKey,
    monthEnd,
    monthIncome,
    monthBudget,
    baseAmount,
    baseLabel,
    spent,
    saved,
    protectedSavingsRemaining,
    projectedCommitments: monthSchedule.totalPHP,
    dueNext7Days: sevenDaySchedule.totalPHP,
    cushion,
    safePerDay,
    daysRemaining
  };
}


function getActivePayablesForHome(limit = 3) {
  return cards
    .filter((item) => getPayableBalance(item) > 0)
    .sort((a, b) => {
      const aDate = a.dueDate || "9999-12-31";
      const bDate = b.dueDate || "9999-12-31";
      return aDate.localeCompare(bDate);
    })
    .slice(0, limit);
}


function renderMomoToday() {
  const section = document.getElementById("momoTodaySection");
  if (!section) return;

  const snapshot = getMomoTodaySnapshot();
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText(
    "momoSafeToday",
    snapshot.safePerDay === null
      ? "Set income or budget"
      : formatPHP(snapshot.safePerDay)
  );
  setText("momoSpentToday", formatPHP(getTodaySpentPHP()));
  setText("momoDueNext7", formatPHP(snapshot.dueNext7Days));
  setText(
    "momoMonthCushion",
    snapshot.cushion === null
      ? "—"
      : formatPHP(Math.max(0, snapshot.cushion))
  );
  setText(
    "momoProjectedFixed",
    formatPHP(snapshot.projectedCommitments)
  );

  const explanation = document.getElementById("momoSafeExplanation");
  if (explanation) {
    if (snapshot.baseAmount <= 0) {
      explanation.textContent =
        "Add monthly income or a monthly budget and Momo can estimate a gentle daily amount after spending, savings, and known upcoming commitments.";
    } else {
      explanation.textContent =
        `Based on your ${snapshot.baseLabel}, minus ${formatPHP(snapshot.spent)} already spent, ${formatPHP(snapshot.saved)} saved this month, ${formatPHP(snapshot.protectedSavingsRemaining)} still protected for Peach Jars, and ${formatPHP(snapshot.projectedCommitments)} in known upcoming commitments. ${snapshot.daysRemaining} day${snapshot.daysRemaining === 1 ? "" : "s"} remain this month.`;
    }
  }

  const cardList = document.getElementById("momoActivePayables");
  if (cardList) {
    const active = getActivePayablesForHome();
    cardList.innerHTML = active.length
      ? active.map((item) => `
          <button class="momo-today-payable" type="button" data-payable-open="${escapeHTML(item.id)}">
            <span>${item.type === "credit-card" ? "▣" : "♡"}</span>
            <div>
              <strong>${escapeHTML(item.name || "Payable")}</strong>
              <small>${item.dueDate ? `Due ${formatShortDate(item.dueDate)}` : "No due date"}</small>
            </div>
            <b>${formatCurrency(getPayableBalance(item), item.currency || "PHP")}</b>
          </button>
        `).join("")
      : `<div class="momo-today-empty">No active payables waiting on you 🌸</div>`;
  }
}


function renderHomeSummary() {

  const spent =
    getMonthlySpent();


  const monthlyBudget =
    getCurrentMonthlyBudgetTotal();


  const hasBudget =
    monthlyBudget >
    0;


  const remaining =
    hasBudget

      ? Math.max(
          monthlyBudget -
          spent,
          0
        )

      : null;


  const percent =
    hasBudget

      ? Math.min(
          (
            spent /
            monthlyBudget
          ) *
            100,
          100
        )

      : 0;


  const setText =
    (
      id,
      value
    ) => {

      const element =
        document.getElementById(
          id
        );


      if (
        element
      ) {

        element.textContent =
          value;

      }

    };


  setText(
    "homeMonthSpent",
    formatPHP(
      spent
    )
  );


  setText(
    "homeMonthLabel",
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        year: "numeric"
      }
    ).format(
      new Date()
    )
  );


  const homeSavingsPHP =
    savingsGoals.reduce(
      (
        total,
        goal
      ) =>
        total +
        convertCurrency(
          getSavingsGoalSaved(
            goal
          ),
          goal.currency ||
            "PHP",
          "PHP"
        ),
      0
    );


  setText(
    "homeSavingsTotal",
    `${formatPHP(
      homeSavingsPHP
    )} total`
  );


  const monthKey =
    getCurrentMonthKey();


  const monthlyIncome =
    Number(
      monthlyIncomeByMonth[
        monthKey
      ] ||
      0
    );


  setText(
    "homeMonthlyIncome",
    monthlyIncome >
      0
      ? formatPHP(
          monthlyIncome
        )
      : "Add income"
  );


  setText(
    "homeSavingsMonth",
    formatPHP(
      getCurrentMonthSavingsPHP()
    )
  );


  const currentDay =
    new Date()
      .getDate();


  setText(
    "homeDailyAverage",
    formatPHP(
      currentDay >
        0
        ? spent /
          currentDay
        : 0
    )
  );


  const biggestCategory =
    getCurrentMonthBiggestCategory();


  setText(
    "homeBiggestCategory",
    biggestCategory
      ? `${biggestCategory[0]} · ${formatPHP(
          biggestCategory[
            1
          ]
        )}`
      : "—"
  );


  setText(
    "homeRecurringTotal",
    formatPHP(
      getRecurringMonthlyPHP()
    )
  );


  setText(
    "homeDashboardMonthTitle",
    new Intl.DateTimeFormat(
      "en-US",
      {
        month:
          "long",
        year:
          "numeric"
      }
    ).format(
      new Date()
    )
  );


  const comparison =
    getMonthToDateComparison();


  const comparisonElement =
    document.getElementById(
      "homeMonthComparison"
    );


  if (
    comparisonElement
  ) {

    if (
      comparison.previousSpent <=
      0
    ) {

      comparisonElement.textContent =
        `No ${comparison.previousLabel} comparison`;


      comparisonElement.className =
        "momo-month-comparison neutral";

    } else {

      const change =
        (
          (
            comparison.currentSpent -
            comparison.previousSpent
          ) /
          comparison.previousSpent
        ) *
        100;


      const rounded =
        Math.round(
          Math.abs(
            change
          )
        );


      comparisonElement.textContent =
        change ===
        0
          ? `Same as ${comparison.previousLabel}`
          : `${change <
              0
              ? "↓"
              : "↑"} ${rounded}% vs ${comparison.previousLabel}`;


      comparisonElement.className =
        `momo-month-comparison ${
          change <=
          0
            ? "good"
            : "high"
        }`;

    }

  }


  setText(
    "activityMonthTotal",
    formatPHP(
      spent
    )
  );


  if (
    hasBudget
  ) {

    setText(
      "homeMonthBudget",
      formatPHP(
        monthlyBudget
      )
    );


    setText(
      "homeMonthRemaining",
      formatPHP(
        remaining
      )
    );


    setText(
      "budgetPageTotal",
      formatPHP(
        monthlyBudget
      )
    );


    setText(
      "budgetPageRemaining",
      formatPHP(
        remaining
      )
    );


    setText(
      "budgetPercent",
      `${Math.round(
        percent
      )}%`
    );

  } else {

    setText(
      "homeMonthBudget",
      "Not set"
    );


    setText(
      "homeMonthRemaining",
      "—"
    );


    setText(
      "budgetPageTotal",
      "Not set"
    );


    setText(
      "budgetPageRemaining",
      "—"
    );


    setText(
      "budgetPercent",
      "—"
    );

  }


  const budgetSentence =
    document.getElementById(
      "homeBudgetSentence"
    );


  if (
    budgetSentence
  ) {

    budgetSentence.textContent =
      hasBudget
        ? (
            remaining >
            0
              ? `${formatPHP(
                  remaining
                )} left from your ${formatPHP(
                  monthlyBudget
                )} monthly plan.`
              : `You've reached your ${formatPHP(
                  monthlyBudget
                )} monthly plan.`
          )
        : "Set a monthly budget to see your progress.";

  }


  const progress =
    document.getElementById(
      "homeProgress"
    );


  if (
    progress
  ) {

    progress.style.width =
      `${percent}%`;

  }


  const ring =
    document.getElementById(
      "budgetRing"
    );


  if (
    ring
  ) {

    const ringText =
      ring.querySelector(
        "span"
      );


    if (
      ringText
    ) {

      ringText.textContent =
        hasBudget
          ? `${Math.round(
              percent
            )}%`
          : "—";

    }


    ring.style.background = `

      radial-gradient(
        circle,
        white 55%,
        transparent 57%
      ),

      conic-gradient(
        var(--pink)
        0 ${percent}%,
        #f9e8e4
        ${percent}% 100%
      )

    `;

  }


  renderHomeSpendingOverview();

  renderMomoToday();

}




// ========================================
// TRIP SHOPPING LIST
// ========================================

const tripShoppingModal =
  document.getElementById(
    "tripShoppingModal"
  );


const tripShoppingForm =
  document.getElementById(
    "tripShoppingForm"
  );


const tripShoppingPhoto =
  document.getElementById(
    "tripShoppingPhoto"
  );


function renderTripShoppingPhotoPreview() {

  const preview =
    document.getElementById(
      "tripShoppingPhotoPreview"
    );


  if (
    !preview
  ) {

    return;

  }


  preview.innerHTML =
    tripShoppingPhotoData
      ? `
          <img
            src="${tripShoppingPhotoData}"
            alt="Shopping item"
          >
        `
      : "🛍️";

}


function openTripShoppingModal(
  trip,
  item =
    null
) {

  if (
    !trip ||
    !tripShoppingModal
  ) {

    return;

  }


  activeTripDashboardId =
    trip.id;


  document.getElementById(
    "tripShoppingModalTitle"
  ).textContent =
    item
      ? "Edit Shopping Item"
      : "Add Shopping Item";


  document.getElementById(
    "tripShoppingItemId"
  ).value =
    item?.id ||
    "";


  document.getElementById(
    "tripShoppingName"
  ).value =
    item?.name ||
    "";


  document.getElementById(
    "tripShoppingTargetPrice"
  ).value =
    item?.targetPrice ||
    "";


  document.getElementById(
    "tripShoppingActualPrice"
  ).value =
    item?.actualPrice ||
    "";


  document.getElementById(
    "tripShoppingStore"
  ).value =
    item?.store ||
    "";


  document.getElementById(
    "tripShoppingBought"
  ).checked =
    Boolean(
      item?.bought
    );


  const deleteButton =
    document.getElementById(
      "deleteTripShoppingItem"
    );


  if (
    deleteButton
  ) {

    deleteButton.hidden =
      !item;

  }


  tripShoppingPhotoData =
    item?.photo ||
    "";


  if (
    tripShoppingPhoto
  ) {

    tripShoppingPhoto.value =
      "";

  }


  renderTripShoppingPhotoPreview();


  const priceLabels =
    tripShoppingModal
      .querySelectorAll(
        ".trip-shopping-price-grid label > span"
      );


  priceLabels.forEach(
    (
      label
    ) => {

      if (
        !label.dataset
          .currencyAdded
      ) {

        label.append(
          document.createTextNode(
            ` · ${trip.currency}`
          )
        );


        label.dataset.currencyAdded =
          "yes";

      }

    }
  );


  tripShoppingModal.hidden =
    false;


  document.body.classList.add(
    "drawer-open"
  );


  requestAnimationFrame(
    () =>
      document.getElementById(
        "tripShoppingName"
      )?.focus()
  );

}


function closeTripShoppingModal() {

  if (
    tripShoppingModal
  ) {

    tripShoppingModal.hidden =
      true;

  }


  tripShoppingPhotoData =
    "";


  tripShoppingPhotoPromise =
    null;


  document.body.classList.remove(
    "drawer-open"
  );

}


document
  .getElementById(
    "closeTripShoppingModal"
  )
  ?.addEventListener(
    "click",
    closeTripShoppingModal
  );


tripShoppingModal
  ?.addEventListener(
    "click",
    (
      event
    ) => {

      if (
        event.target ===
        tripShoppingModal
      ) {

        closeTripShoppingModal();

      }

    }
  );


tripShoppingPhoto
  ?.addEventListener(
    "change",
    () => {

      const file =
        tripShoppingPhoto.files?.[
          0
        ];


      if (
        !file
      ) {

        return;

      }


      if (
        !file.type.startsWith(
          "image/"
        )
      ) {

        tripShoppingPhoto.value =
          "";


        showToast(
          "Please choose an image."
        );


        return;

      }


      tripShoppingPhotoPromise =
        (
          async () => {

            try {

              tripShoppingPhotoData =
                await compressExpensePhoto(
                  file
                );


              renderTripShoppingPhotoPreview();

            } catch (
              error
            ) {

              try {

                tripShoppingPhotoData =
                  await readFileAsDataURL(
                    file
                  );


                renderTripShoppingPhotoPreview();

              } catch (
                fallbackError
              ) {

                console.error(
                  "Shopping photo failed:",
                  fallbackError
                );


                showToast(
                  "Could not attach that photo."
                );

              }

            } finally {

              tripShoppingPhotoPromise =
                null;

            }

          }
        )();

    }
  );


document
  .getElementById(
    "deleteTripShoppingItem"
  )
  ?.addEventListener(
    "click",
    async () => {

      const id =
        document.getElementById(
          "tripShoppingItemId"
        )?.value;


      if (
        !id
      ) {

        return;

      }


      const item =
        tripShoppingItems.find(
          (
            shoppingItem
          ) =>
            shoppingItem.id ===
            id
        );


      if (
        !item
      ) {

        return;

      }


      const confirmed =
        window.confirm(
          `Delete “${item.name}” from this shopping list?`
        );


      if (
        !confirmed
      ) {

        return;

      }


      const trip =
        trips.find(
          (
            tripItem
          ) =>
            tripItem.id ===
            item.tripId
        );


      tripShoppingItems =
        tripShoppingItems.filter(
          (
            shoppingItem
          ) =>
            shoppingItem.id !==
            id
        );


      await saveTripShoppingItems();


      closeTripShoppingModal();


      if (
        trip
      ) {

        renderTripDashboard(
          trip
        );

      }


      showToast(
        "Shopping item deleted"
      );

    }
  );


tripShoppingForm
  ?.addEventListener(
    "submit",
    async (
      event
    ) => {

      event.preventDefault();


      if (
        tripShoppingPhotoPromise
      ) {

        await tripShoppingPhotoPromise;

      }


      const trip =
        trips.find(
          (
            item
          ) =>
            item.id ===
            activeTripDashboardId
        );


      if (
        !trip
      ) {

        showToast(
          "Could not find this trip."
        );


        return;

      }


      const id =
        document.getElementById(
          "tripShoppingItemId"
        ).value;


      const previous =
        tripShoppingItems.find(
          (
            item
          ) =>
            item.id ===
            id
        );


      const name =
        document.getElementById(
          "tripShoppingName"
        ).value
          .trim();


      if (
        !name
      ) {

        return;

      }


      const now =
        new Date()
          .toISOString();


      const item = {
        id:
          previous?.id ||
          generateId(
            "shopping"
          ),
        tripId:
          trip.id,
        name,
        targetPrice:
          Number(
            document.getElementById(
              "tripShoppingTargetPrice"
            ).value ||
            0
          ),
        actualPrice:
          Number(
            document.getElementById(
              "tripShoppingActualPrice"
            ).value ||
            0
          ),
        store:
          document.getElementById(
            "tripShoppingStore"
          ).value
            .trim(),
        photo:
          tripShoppingPhotoData,
        bought:
          document.getElementById(
            "tripShoppingBought"
          ).checked,
        createdAt:
          previous?.createdAt ||
          now,
        updatedAt:
          now
      };


      if (
        previous
      ) {

        tripShoppingItems =
          tripShoppingItems.map(
            (
              shoppingItem
            ) =>
              shoppingItem.id ===
                previous.id
                ? item
                : shoppingItem
          );

      } else {

        tripShoppingItems.push(
          item
        );

      }


      await saveTripShoppingItems();


      closeTripShoppingModal();


      renderTripDashboard(
        trip
      );


      showToast(
        previous
          ? "Shopping item updated"
          : "Added to trip shopping 🛍️"
      );

    }
  );


// ========================================
// MONTHLY INCOME
// ========================================

const monthlyIncomeModal =
  document.getElementById(
    "monthlyIncomeModal"
  );


const monthlyIncomeForm =
  document.getElementById(
    "monthlyIncomeForm"
  );


function openMonthlyIncomeModal() {

  if (
    !monthlyIncomeModal
  ) {

    return;

  }


  const key =
    getCurrentMonthKey();


  const label =
    document.getElementById(
      "monthlyIncomeMonthLabel"
    );


  const input =
    document.getElementById(
      "monthlyIncomeAmount"
    );


  if (
    label
  ) {

    label.textContent =
      `For ${new Intl.DateTimeFormat(
        "en-US",
        {
          month:
            "long",
          year:
            "numeric"
        }
      ).format(
        new Date()
      )}`;

  }


  if (
    input
  ) {

    input.value =
      monthlyIncomeByMonth[
        key
      ] ||
      "";

  }


  monthlyIncomeModal.hidden =
    false;


  document.body.classList.add(
    "drawer-open"
  );


  requestAnimationFrame(
    () =>
      input?.focus()
  );

}


function closeMonthlyIncomeModal() {

  if (
    monthlyIncomeModal
  ) {

    monthlyIncomeModal.hidden =
      true;

  }


  document.body.classList.remove(
    "drawer-open"
  );

}


document
  .getElementById(
    "editHomeMonthlyIncome"
  )
  ?.addEventListener(
    "click",
    openMonthlyIncomeModal
  );


document
  .getElementById(
    "closeMonthlyIncomeModal"
  )
  ?.addEventListener(
    "click",
    closeMonthlyIncomeModal
  );


monthlyIncomeModal
  ?.addEventListener(
    "click",
    (
      event
    ) => {

      if (
        event.target ===
        monthlyIncomeModal
      ) {

        closeMonthlyIncomeModal();

      }

    }
  );


monthlyIncomeForm
  ?.addEventListener(
    "submit",
    async (
      event
    ) => {

      event.preventDefault();


      const key =
        getCurrentMonthKey();


      const input =
        document.getElementById(
          "monthlyIncomeAmount"
        );


      const raw =
        input?.value
          .trim() ||
        "";


      if (
        raw ===
        ""
      ) {

        delete monthlyIncomeByMonth[
          key
        ];

      } else {

        const amount =
          Number(
            raw
          );


        if (
          !Number.isFinite(
            amount
          ) ||
          amount <
          0
        ) {

          showToast(
            "Enter a valid income amount."
          );


          return;

        }


        monthlyIncomeByMonth[
          key
        ] =
          amount;

      }


      await saveMonthlyIncome();


      closeMonthlyIncomeModal();


      renderHomeSummary();


      showToast(
        raw ===
          ""
          ? "Monthly income cleared"
          : "Monthly income saved ✿"
      );

    }
  );


// ========================================
// REPORTS 2.0
// ========================================

let reportPeriod =
  "this_month";


let reportScope =
  "all";


const reportDateFrom =
  document.getElementById(
    "reportDateFrom"
  );


const reportDateTo =
  document.getElementById(
    "reportDateTo"
  );


const reportCustomDates =
  document.getElementById(
    "reportCustomDates"
  );


const reportTripPickerWrap =
  document.getElementById(
    "reportTripPickerWrap"
  );


const reportTripPicker =
  document.getElementById(
    "reportTripPicker"
  );


function dateToKey(
  date
) {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


function getReportDateRange() {

  const today =
    new Date();


  const year =
    today.getFullYear();


  const month =
    today.getMonth();


  if (
    reportPeriod ===
    "last_month"
  ) {

    const start =
      new Date(
        year,
        month - 1,
        1
      );


    const end =
      new Date(
        year,
        month,
        0
      );


    return {
      start:
        dateToKey(
          start
        ),

      end:
        dateToKey(
          end
        ),

      label:
        new Intl.DateTimeFormat(
          "en-US",
          {
            month:
              "long",

            year:
              "numeric"
          }
        ).format(
          start
        )
    };

  }


  if (
    reportPeriod ===
    "this_year"
  ) {

    return {
      start:
        `${year}-01-01`,

      end:
        getTodayString(),

      label:
        String(
          year
        )
    };

  }


  if (
    reportPeriod ===
    "custom"
  ) {

    const rawFrom =
      reportDateFrom?.value ||
      "";


    const rawTo =
      reportDateTo?.value ||
      "";


    const from =
      rawFrom &&
      rawTo &&
      rawFrom >
        rawTo
        ? rawTo
        : rawFrom;


    const to =
      rawFrom &&
      rawTo &&
      rawFrom >
        rawTo
        ? rawFrom
        : rawTo;


    return {
      start:
        from,

      end:
        to,

      label:
        from &&
        to

          ? (
              from ===
                to
                ? formatShortDate(
                    from
                  )
                : `${formatShortDate(
                    from
                  )} – ${formatShortDate(
                    to
                  )}`
            )

          : "Custom"
    };

  }


  return {
    start:
      `${year}-${String(
        month + 1
      ).padStart(
        2,
        "0"
      )}-01`,

    end:
      getTodayString(),

    label:
      new Intl.DateTimeFormat(
        "en-US",
        {
          month:
            "long",

          year:
            "numeric"
        }
      ).format(
        today
      )
  };

}


function getReportRangeDayCount(
  range
) {

  if (
    !range.start ||
    !range.end
  ) {

    return 0;

  }


  const start =
    createLocalDate(
      range.start
    );


  const end =
    createLocalDate(
      range.end
    );


  if (
    !start ||
    !end ||
    end <
    start
  ) {

    return 0;

  }


  return (
    Math.floor(
      (
        end -
        start
      ) /
      86400000
    ) +
    1
  );

}


function populateReportTripPicker() {

  if (
    !reportTripPicker
  ) {

    return;

  }


  const current =
    reportTripPicker.value;


  reportTripPicker.innerHTML = `

    <option value="">
      Choose a trip
    </option>

    ${trips

      .map(
        (trip) => `

          <option
            value="${escapeHTML(
              trip.id
            )}"
          >
            ${escapeHTML(
              trip.name
            )}
          </option>

        `
      )

      .join("")}

  `;


  if (
    current &&
    trips.some(
      (trip) =>
        trip.id ===
        current
    )
  ) {

    reportTripPicker.value =
      current;

  } else if (
    reportScope ===
      "trip" &&
    trips.length
  ) {

    reportTripPicker.value =
      trips[
        0
      ].id;

  }

}


function getReportExpenses() {

  const range =
    getReportDateRange();


  if (
    !range.start ||
    !range.end ||
    range.end <
      range.start
  ) {

    return [];

  }


  const selectedTripId =
    reportTripPicker?.value ||
    "";


  return expenses.filter(
    (expense) => {

      const date =
        expense.date ||
        (
          expense.createdAt
            ? expense.createdAt.slice(
                0,
                10
              )
            : ""
        );


      if (
        !date ||
        date <
          range.start ||
        date >
          range.end
      ) {

        return false;

      }


      if (
        reportScope ===
        "personal"
      ) {

        return !expense.tripId;

      }


      if (
        reportScope ===
        "trip"
      ) {

        return (
          Boolean(
            selectedTripId
          ) &&
          expense.tripId ===
            selectedTripId
        );

      }


      return true;

    }
  );

}


function sumExpensesPHP(
  items
) {

  return items.reduce(
    (
      total,
      expense
    ) => {

      return (
        total +
        convertCurrency(
          expense.amount,
          expense.currency,
          "PHP"
        )
      );

    },
    0
  );

}


function groupReportExpenses(
  items,
  keyGetter
) {

  const groups =
    new Map();


  items.forEach(
    (expense) => {

      const key =
        keyGetter(
          expense
        ) ||
        "Other";


      const amount =
        convertCurrency(
          expense.amount,
          expense.currency,
          "PHP"
        );


      groups.set(
        key,
        (
          groups.get(
            key
          ) ||
          0
        ) +
        amount
      );

    }
  );


  return Array.from(
    groups.entries()
  )

    .map(
      (
        [
          label,
          amount
        ]
      ) => ({
        label,
        amount
      })
    )

    .sort(
      (
        a,
        b
      ) =>
        b.amount -
        a.amount
    );

}


function renderReportBars(
  container,
  groups,
  total
) {

  if (
    !container
  ) {

    return;

  }


  if (
    groups.length ===
    0
  ) {

    container.innerHTML = `

      <div class="report-mini-empty">
        Nothing to break down yet.
      </div>

    `;


    return;

  }


  container.innerHTML =
    groups

      .map(
        (
          group,
          index
        ) => {

          const percent =
            total >
            0

              ? (
                  group.amount /
                  total
                ) *
                100

              : 0;


          return `

            <div class="report-bar-item">

              <div class="report-bar-top">

                <div class="report-bar-label">

                  <span class="report-bar-rank">
                    ${index + 1}
                  </span>

                  <strong>
                    ${escapeHTML(
                      group.label
                    )}
                  </strong>

                </div>


                <div class="report-bar-value">

                  <strong>
                    ${formatPHP(
                      group.amount
                    )}
                  </strong>

                  <span>
                    ${percent.toFixed(
                      percent >=
                      10
                        ? 0
                        : 1
                    )}%
                  </span>

                </div>

              </div>


              <div class="report-bar-track">

                <div
                  class="report-bar-fill"
                  style="width:${Math.min(
                    percent,
                    100
                  )}%"
                ></div>

              </div>

            </div>

          `;

        }
      )

      .join("");

}


function getReportScopeFilteredExpenses(
  sourceExpenses
) {

  const selectedTripId =
    reportTripPicker?.value ||
    "";


  return sourceExpenses.filter(
    (expense) => {

      if (
        reportScope ===
        "personal"
      ) {

        return !expense.tripId;

      }


      if (
        reportScope ===
        "trip"
      ) {

        return (
          Boolean(
            selectedTripId
          ) &&
          expense.tripId ===
            selectedTripId
        );

      }


      return true;

    }
  );

}


function getLastSixMonths() {

  const today =
    new Date();


  const months =
    [];


  for (
    let offset = 5;
    offset >= 0;
    offset--
  ) {

    const date =
      new Date(
        today.getFullYear(),
        today.getMonth() -
          offset,
        1
      );


    months.push({
      key:
        `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(
          2,
          "0"
        )}`,

      label:
        new Intl.DateTimeFormat(
          "en-US",
          {
            month:
              "short"
          }
        ).format(
          date
        )
    });

  }


  return months;

}


function renderReportTrend() {

  const container =
    document.getElementById(
      "reportMonthlyTrend"
    );


  if (
    !container
  ) {

    return;

  }


  const scopedExpenses =
    getReportScopeFilteredExpenses(
      expenses
    );


  const months =
    getLastSixMonths();


  const data =
    months.map(
      (month) => {

        const monthExpenses =
          scopedExpenses.filter(
            (expense) => {

              const date =
                expense.date ||
                (
                  expense.createdAt
                    ? expense.createdAt.slice(
                        0,
                        10
                      )
                    : ""
                );


              return date.startsWith(
                month.key
              );

            }
          );


        return {
          ...month,

          total:
            sumExpensesPHP(
              monthExpenses
            )
        };

      }
    );


  const maximum =
    Math.max(
      ...data.map(
        (item) =>
          item.total
      ),
      0
    );


  container.innerHTML =
    data

      .map(
        (item) => {

          const height =
            maximum >
            0

              ? Math.max(
                  (
                    item.total /
                    maximum
                  ) *
                    100,
                  item.total >
                    0
                    ? 8
                    : 0
                )

              : 0;


          return `

            <div class="report-trend-column">

              <div class="report-trend-value">
                ${item.total >
                  0
                    ? formatCalendarDayTotal(
                        item.total
                      )
                    : ""}
              </div>

              <div class="report-trend-track">

                <div
                  class="report-trend-fill"
                  style="height:${height}%"
                ></div>

              </div>

              <span>
                ${escapeHTML(
                  item.label
                )}
              </span>

            </div>

          `;

        }
      )

      .join("");

}



function getExpenseDateKey(
  expense
) {

  return (
    expense.date ||
    (
      expense.createdAt
        ? expense.createdAt.slice(
            0,
            10
          )
        : ""
    )
  );

}


function getPreviousReportRange(
  range
) {

  if (
    !range.start ||
    !range.end
  ) {

    return null;

  }


  const start =
    createLocalDate(
      range.start
    );


  const end =
    createLocalDate(
      range.end
    );


  if (
    !start ||
    !end ||
    end <
      start
  ) {

    return null;

  }


  const days =
    Math.floor(
      (
        end -
        start
      ) /
      86400000
    ) +
    1;


  const previousEnd =
    new Date(
      start
    );


  previousEnd.setDate(
    previousEnd.getDate() -
    1
  );


  const previousStart =
    new Date(
      previousEnd
    );


  previousStart.setDate(
    previousStart.getDate() -
    (
      days -
      1
    )
  );


  return {
    start:
      dateToKey(
        previousStart
      ),

    end:
      dateToKey(
        previousEnd
      )
  };

}


function getReportExpensesForRange(
  range
) {

  if (
    !range ||
    !range.start ||
    !range.end
  ) {

    return [];

  }


  const selectedTripId =
    reportTripPicker?.value ||
    "";


  return expenses.filter(
    (expense) => {

      const date =
        getExpenseDateKey(
          expense
        );


      if (
        !date ||
        date <
          range.start ||
        date >
          range.end
      ) {

        return false;

      }


      if (
        reportScope ===
        "personal"
      ) {

        return !expense.tripId;

      }


      if (
        reportScope ===
        "trip"
      ) {

        return (
          Boolean(
            selectedTripId
          ) &&
          expense.tripId ===
            selectedTripId
        );

      }


      return true;

    }
  );

}


function getMostFrequentGroup(
  items,
  keyGetter
) {

  const counts =
    new Map();


  items.forEach(
    (expense) => {

      const key =
        keyGetter(
          expense
        ) ||
        "Other";


      counts.set(
        key,
        (
          counts.get(
            key
          ) ||
          0
        ) +
        1
      );

    }
  );


  return Array.from(
    counts.entries()
  )

    .map(
      (
        [
          label,
          count
        ]
      ) => ({
        label,
        count
      })
    )

    .sort(
      (
        a,
        b
      ) =>
        b.count -
        a.count
    )[
      0
    ] ||
    null;

}


function getMostExpensiveDay(
  items
) {

  const days =
    new Map();


  items.forEach(
    (expense) => {

      const date =
        getExpenseDateKey(
          expense
        );


      if (
        !date
      ) {

        return;

      }


      const amount =
        convertCurrency(
          expense.amount,
          expense.currency,
          "PHP"
        );


      const current =
        days.get(
          date
        ) ||
        {
          total: 0,
          count: 0
        };


      current.total +=
        amount;


      current.count +=
        1;


      days.set(
        date,
        current
      );

    }
  );


  return Array.from(
    days.entries()
  )

    .map(
      (
        [
          date,
          data
        ]
      ) => ({
        date,
        ...data
      })
    )

    .sort(
      (
        a,
        b
      ) =>
        b.total -
        a.total
    )[
      0
    ] ||
    null;

}


function getTripVsPersonalTotals(
  items
) {

  return items.reduce(
    (
      totals,
      expense
    ) => {

      const amount =
        convertCurrency(
          expense.amount,
          expense.currency,
          "PHP"
        );


      if (
        expense.tripId
      ) {

        totals.trip +=
          amount;

      } else {

        totals.personal +=
          amount;

      }


      return totals;

    },
    {
      personal: 0,
      trip: 0
    }
  );

}


function buildSpendingInsights(
  reportExpenses,
  range
) {

  if (
    reportExpenses.length ===
    0
  ) {

    return [];

  }


  const insights =
    [];


  const total =
    sumExpensesPHP(
      reportExpenses
    );


  renderSpendingInsights(
    reportExpenses,
    range
  );


  const categoryGroups =
    groupReportExpenses(
      reportExpenses,
      (expense) =>
        expense.category ||
        "Other"
    );


  const topCategory =
    categoryGroups[
      0
    ];


  if (
    topCategory
  ) {

    const share =
      total >
      0

        ? (
            topCategory.amount /
            total
          ) *
          100

        : 0;


    insights.push({
      icon:
        getCategoryEmoji(
          topCategory.label
        ),

      title:
        `${topCategory.label} is your biggest category`,

      detail:
        `${formatPHP(
          topCategory.amount
        )} · ${share.toFixed(
          0
        )}% of spending`
    });

  }


  const previousRange =
    getPreviousReportRange(
      range
    );


  const previousExpenses =
    getReportExpensesForRange(
      previousRange
    );


  const previousTotal =
    sumExpensesPHP(
      previousExpenses
    );


  if (
    previousTotal >
    0
  ) {

    const change =
      (
        (
          total -
          previousTotal
        ) /
        previousTotal
      ) *
      100;


    const rounded =
      Math.abs(
        change
      ).toFixed(
        0
      );


    insights.push({
      icon:
        change >
        0
          ? "↗"
          : change <
            0
            ? "↘"
            : "→",

      title:
        change >
        0
          ? `Spending is ${rounded}% higher`
          : change <
            0
            ? `Spending is ${rounded}% lower`
            : "Spending is unchanged",

      detail:
        `Compared with the previous ${getReportRangeDayCount(
          range
        )}-day period`
    });

  }


  const frequentCategory =
    getMostFrequentGroup(
      reportExpenses,
      (expense) =>
        expense.category ||
        "Other"
    );


  if (
    frequentCategory
  ) {

    insights.push({
      icon:
        "♡",

      title:
        `${frequentCategory.label} appears most often`,

      detail:
        `${frequentCategory.count} ${
          frequentCategory.count ===
          1
            ? "purchase"
            : "purchases"
        } in this view`
    });

  }


  const expensiveDay =
    getMostExpensiveDay(
      reportExpenses
    );


  if (
    expensiveDay
  ) {

    insights.push({
      icon:
        "☀",

      title:
        `${formatShortDate(
          expensiveDay.date
        )} was your biggest spending day`,

      detail:
        `${formatPHP(
          expensiveDay.total
        )} across ${expensiveDay.count} ${
          expensiveDay.count ===
          1
            ? "expense"
            : "expenses"
        }`
    });

  }


  const biggest =
    reportExpenses

      .map(
        (expense) => ({
          expense,

          amount:
            convertCurrency(
              expense.amount,
              expense.currency,
              "PHP"
            )
        })
      )

      .sort(
        (
          a,
          b
        ) =>
          b.amount -
          a.amount
      )[
        0
      ];


  if (
    biggest
  ) {

    insights.push({
      icon:
        "✦",

      title:
        `${biggest.expense.title ||
          "Expense"} was your largest purchase`,

      detail:
        `${formatPHP(
          biggest.amount
        )} · ${escapeHTML(
          biggest.expense.category ||
          "Other"
        )}`
    });

  }


  const average =
    total /
    reportExpenses.length;


  insights.push({
    icon:
      "≈",

    title:
      `${formatPHP(
        average
      )} average per transaction`,

    detail:
      `Based on ${reportExpenses.length} ${
        reportExpenses.length ===
        1
          ? "expense"
          : "expenses"
      }`
  });


  if (
    reportScope ===
    "all"
  ) {

    const split =
      getTripVsPersonalTotals(
        reportExpenses
      );


    if (
      split.trip >
        0 &&
      split.personal >
        0
    ) {

      const tripShare =
        (
          split.trip /
          total
        ) *
        100;


      insights.push({
        icon:
          "✈",

        title:
          `${tripShare.toFixed(
            0
          )}% of spending is trip-related`,

        detail:
          `${formatPHP(
            split.trip
          )} trips · ${formatPHP(
            split.personal
          )} personal`
      });

    }

  }


  return insights.slice(
    0,
    6
  );

}


function renderSpendingInsights(
  reportExpenses,
  range
) {

  const container =
    document.getElementById(
      "spendingInsightsList"
    );


  const meta =
    document.getElementById(
      "spendingInsightsMeta"
    );


  if (
    !container
  ) {

    return;

  }


  if (
    meta
  ) {

    meta.textContent =
      range.label ||
      "This view";

  }


  const insights =
    buildSpendingInsights(
      reportExpenses,
      range
    );


  if (
    insights.length ===
    0
  ) {

    container.innerHTML = `

      <div class="spending-insights-empty">

        <span>✦</span>

        <div>

          <strong>
            Nothing to analyze yet
          </strong>

          <p>
            Add expenses in this period and Momo will spot patterns here.
          </p>

        </div>

      </div>

    `;


    return;

  }


  container.innerHTML =
    insights

      .map(
        (
          insight,
          index
        ) => `

          <article class="spending-insight-item">

            <div class="spending-insight-icon">
              ${insight.icon}
            </div>

            <div class="spending-insight-copy">

              <strong>
                ${insight.title}
              </strong>

              <p>
                ${insight.detail}
              </p>

            </div>

            <span class="spending-insight-number">
              ${String(
                index + 1
              ).padStart(
                2,
                "0"
              )}
            </span>

          </article>

        `
      )

      .join("");

}


function renderReportSummary() {

  populateReportTripPicker();


  if (
    reportCustomDates
  ) {

    reportCustomDates.hidden =
      reportPeriod !==
      "custom";

  }


  if (
    reportTripPickerWrap
  ) {

    reportTripPickerWrap.hidden =
      reportScope !==
      "trip";

  }


  const range =
    getReportDateRange();


  const reportExpenses =
    getReportExpenses();


  const total =
    sumExpensesPHP(
      reportExpenses
    );


  const dayCount =
    getReportRangeDayCount(
      range
    );


  const averageDaily =
    dayCount >
    0

      ? total /
        dayCount

      : 0;


  const biggest =
    reportExpenses

      .map(
        (expense) => ({
          expense,

          amountPHP:
            convertCurrency(
              expense.amount,
              expense.currency,
              "PHP"
            )
        })
      )

      .sort(
        (
          a,
          b
        ) =>
          b.amountPHP -
          a.amountPHP
      )[
        0
      ];


  const setText =
    (
      id,
      value
    ) => {

      const element =
        document.getElementById(
          id
        );


      if (
        element
      ) {

        element.textContent =
          value;

      }

    };


  setText(
    "reportTotalSpending",
    formatPHP(
      total
    )
  );


  setText(
    "reportExpenseCount",
    String(
      reportExpenses.length
    )
  );


  setText(
    "reportAverageDaily",
    formatPHP(
      averageDaily
    )
  );


  setText(
    "reportDaysLabel",
    `${dayCount} ${
      dayCount ===
      1
        ? "day"
        : "days"
    }`
  );


  setText(
    "reportBiggestExpense",
    biggest
      ? formatPHP(
          biggest.amountPHP
        )
      : "₱0.00"
  );


  setText(
    "reportBiggestExpenseTitle",
    biggest
      ? biggest.expense.title ||
        "Expense"
      : "No expenses yet"
  );


  setText(
    "reportPeriodLabel",
    range.label
  );


  const categoryGroups =
    groupReportExpenses(
      reportExpenses,
      (expense) =>
        expense.category ||
        "Other"
    );


  const paymentGroups =
    groupReportExpenses(
      reportExpenses,
      (expense) =>
        expense.paymentMethod ||
        "Other"
    );


  setText(
    "reportCategoryCount",
    `${categoryGroups.length} ${
      categoryGroups.length ===
      1
        ? "category"
        : "categories"
    }`
  );


  renderReportBars(
    document.getElementById(
      "reportCategoryBreakdown"
    ),
    categoryGroups,
    total
  );


  renderReportBars(
    document.getElementById(
      "reportPaymentBreakdown"
    ),
    paymentGroups,
    total
  );


  renderReportTrend();


  const emptyState =
    document.getElementById(
      "reportEmptyState"
    );


  if (
    emptyState
  ) {

    emptyState.hidden =
      reportExpenses.length !==
      0;

  }

}


document
  .querySelectorAll(
    "[data-report-period]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          reportPeriod =
            button.dataset
              .reportPeriod;


          document
            .querySelectorAll(
              "[data-report-period]"
            )
            .forEach(
              (item) =>
                item.classList.toggle(
                  "active",
                  item ===
                    button
                )
            );


          if (
            reportPeriod ===
            "custom"
          ) {

            const today =
              getTodayString();


            if (
              reportDateFrom &&
              !reportDateFrom.value
            ) {

              reportDateFrom.value =
                today.slice(
                  0,
                  8
                ) +
                "01";

            }


            if (
              reportDateTo &&
              !reportDateTo.value
            ) {

              reportDateTo.value =
                today;

            }

          }


          renderReportSummary();

        }
      );

    }
  );


document
  .querySelectorAll(
    "[data-report-scope]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          reportScope =
            button.dataset
              .reportScope;


          document
            .querySelectorAll(
              "[data-report-scope]"
            )
            .forEach(
              (item) =>
                item.classList.toggle(
                  "active",
                  item ===
                    button
                )
            );


          renderReportSummary();

        }
      );

    }
  );


[
  reportDateFrom,
  reportDateTo,
  reportTripPicker
]

  .filter(
    Boolean
  )

  .forEach(
    (control) => {

      control.addEventListener(
        "change",
        () => {

          renderReportSummary();

        }
      );

    }
  );


// ========================================
// TOAST
// ========================================

const toast =
  document.getElementById(
    "toast"
  );


let toastTimer;


function showToast(
  message
) {

  if (
    !toast
  ) {

    return;

  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      1800
    );

}



// ========================================
// CALENDAR
// ========================================

const calendarMonthLabel =
  document.getElementById("calendarMonthLabel");

const calendarGrid =
  document.getElementById("calendarGrid");

const calendarDayDetails =
  document.getElementById("calendarDayDetails");

let calendarCursor =
  new Date();

let selectedCalendarDate =
  getTodayString();


function getCalendarMonthKey(
  date
) {

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;

}


function getExpensesForDate(
  dateKey
) {

  return expenses.filter(
    (expense) =>
      getExpenseDateKey(expense) ===
      dateKey
  );

}


function getDateExpenseTotalPHP(
  dateKey
) {

  return getExpensesForDate(
    dateKey
  ).reduce(
    (total, expense) =>
      total +
      convertCurrency(
        expense.amount,
        expense.currency,
        "PHP"
      ),
    0
  );

}


function formatCalendarDayTotal(
  amount
) {

  const value =
    Number(amount || 0);


  if (
    value >=
    1000000
  ) {

    return `₱${(
      value /
      1000000
    ).toFixed(
      value >=
      10000000
        ? 0
        : 1
    )}m`;

  }


  if (
    value >=
    1000
  ) {

    return `₱${(
      value /
      1000
    ).toFixed(
      value >=
      10000
        ? 0
        : 1
    )}k`;

  }


  return (
    value >
    0
      ? `₱${Math.round(value)}`
      : ""
  );

}


function getTripsForDate(
  dateKey
) {

  return trips.filter(
    (trip) =>
      trip.startDate &&
      trip.endDate &&
      dateKey >=
        trip.startDate &&
      dateKey <=
        trip.endDate
  );

}


// Build the month lookup once per calendar render. The old calendar filtered
// the entire expense history two times for every visible day, which became
// noticeably expensive on long-lived Momo installs.
function buildCalendarMonthIndex(
  monthKey
) {

  const expenseLists = new Map();
  const expenseTotals = new Map();
  const tripLists = new Map();


  for (const expense of expenses) {
    const dateKey = getExpenseDateKey(expense);

    if (!dateKey || !dateKey.startsWith(monthKey)) {
      continue;
    }

    if (!expenseLists.has(dateKey)) {
      expenseLists.set(dateKey, []);
    }

    expenseLists.get(dateKey).push(expense);
    expenseTotals.set(
      dateKey,
      (expenseTotals.get(dateKey) || 0) +
        convertCurrency(
          expense.amount,
          expense.currency,
          "PHP"
        )
    );
  }


  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-${String(
    getDaysInMonth(year, monthIndex)
  ).padStart(2, "0")}`;


  for (const trip of trips) {
    if (
      !trip.startDate ||
      !trip.endDate ||
      trip.endDate < monthStart ||
      trip.startDate > monthEnd
    ) {
      continue;
    }

    const first = trip.startDate > monthStart
      ? trip.startDate
      : monthStart;
    const last = trip.endDate < monthEnd
      ? trip.endDate
      : monthEnd;

    let cursor = first;

    while (cursor && cursor <= last) {
      if (!tripLists.has(cursor)) {
        tripLists.set(cursor, []);
      }

      tripLists.get(cursor).push(trip);

      const next = addDaysToDateString(cursor, 1);
      if (!next || next === cursor) break;
      cursor = next;
    }
  }


  const scheduled = buildScheduledCashFlow(
    monthStart,
    monthEnd
  );


  return {
    expenseLists,
    expenseTotals,
    tripLists,
    scheduleLists: scheduled.byDate,
    scheduledTotal: scheduled.totalPHP
  };

}


function renderCalendarDayDetails(
  dateKey,
  monthIndex = null
) {

  if (
    !calendarDayDetails
  ) {

    return;

  }


  selectedCalendarDate =
    dateKey;


  const date =
    createLocalDate(dateKey);


  const dayExpenses =
    monthIndex?.expenseLists?.get(dateKey) ||
    getExpensesForDate(dateKey);


  const total =
    monthIndex?.expenseTotals?.get(dateKey) ??
    getDateExpenseTotalPHP(dateKey);


  const dateTitle =
    new Intl.DateTimeFormat(
      "en-US",
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    ).format(date);


  const activeTrips =
    monthIndex?.tripLists?.get(dateKey) ||
    getTripsForDate(dateKey);


  const scheduledItems =
    monthIndex?.scheduleLists?.get(dateKey) ||
    buildScheduledCashFlow(dateKey, dateKey).byDate.get(dateKey) ||
    [];


  const scheduledTotal =
    scheduledItems.reduce(
      (sum, item) => sum + Number(item.amountPHP || 0),
      0
    );


  calendarDayDetails.innerHTML = `

    <div class="calendar-detail-heading">

      <div>

        <p class="eyebrow">
          Selected day
        </p>

        <h2>
          ${escapeHTML(dateTitle)}
        </h2>

      </div>

      <div class="calendar-detail-total">

        <span>Spent</span>

        <strong>
          ${formatPHP(total)}
        </strong>

      </div>

    </div>

    ${
      activeTrips.length

        ? `

            <div class="calendar-trip-pills">

              ${activeTrips
                .map(
                  (trip) => `
                    <span>
                      ✈ ${escapeHTML(trip.name)}
                    </span>
                  `
                )
                .join("")}

            </div>

          `

        : ""
    }

    ${
      scheduledItems.length
        ? `
            <section class="calendar-scheduled-section">
              <div class="calendar-scheduled-heading">
                <div>
                  <p class="eyebrow">Coming up</p>
                  <h3>Known cash flow</h3>
                </div>
                <strong>${formatPHP(scheduledTotal)}</strong>
              </div>
              <div class="calendar-scheduled-list">
                ${scheduledItems.map((item) => `
                  <div class="calendar-scheduled-item">
                    <span>${item.icon}</span>
                    <div>
                      <strong>${escapeHTML(item.title)}</strong>
                      <small>${item.type === "recurring" ? "Recurring" : item.type === "planned" ? "Planned" : "Payable"}</small>
                    </div>
                    <b>${item.amountKnown ? formatPHP(item.amountPHP) : "Amount varies"}</b>
                  </div>
                `).join("")}
              </div>
            </section>
          `
        : ""
    }

    ${
      dayExpenses.length

        ? `

            <div class="calendar-expense-list">

              ${dayExpenses
                .map(
                  (expense) =>
                    renderTransaction(
                      expense,
                      false
                    )
                )
                .join("")}

            </div>

          `

        : `

            <div class="calendar-empty-day">

              <span>🌸</span>

              <strong>
                No spending recorded
              </strong>

              <p>
                A quiet money day.
              </p>

            </div>

          `
    }

  `;


  attachExpenseDetailActions();

}


function renderCalendar() {

  if (
    !calendarGrid ||
    !calendarMonthLabel
  ) {

    return;

  }


  const year =
    calendarCursor.getFullYear();

  const month =
    calendarCursor.getMonth();


  calendarMonthLabel.textContent =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    ).format(calendarCursor);


  const firstDay =
    new Date(
      year,
      month,
      1
    );

  const lastDay =
    new Date(
      year,
      month + 1,
      0
    );

  const leadingDays =
    firstDay.getDay();

  const daysInMonth =
    lastDay.getDate();

  const today =
    getTodayString();

  const monthKey =
    getCalendarMonthKey(
      calendarCursor
    );


  const monthIndex =
    buildCalendarMonthIndex(
      monthKey
    );


  const calendarActual =
    Array.from(monthIndex.expenseTotals.values()).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );

  const calendarActualElement =
    document.getElementById("calendarMonthActual");
  const calendarScheduledElement =
    document.getElementById("calendarMonthScheduled");

  if (calendarActualElement) {
    calendarActualElement.textContent = formatPHP(calendarActual);
  }

  if (calendarScheduledElement) {
    calendarScheduledElement.textContent = formatPHP(monthIndex.scheduledTotal);
  }


  if (
    !selectedCalendarDate.startsWith(
      monthKey
    )
  ) {

    selectedCalendarDate =
      today.startsWith(
        monthKey
      )
        ? today
        : `${monthKey}-01`;

  }


  let cells =
    "";


  for (
    let index = 0;
    index < leadingDays;
    index++
  ) {

    cells += `
      <div
        class="calendar-cell calendar-cell-empty"
        aria-hidden="true"
      ></div>
    `;

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const dateKey =
      `${monthKey}-${String(day).padStart(
        2,
        "0"
      )}`;


    const dailyTotal =
      monthIndex.expenseTotals.get(
        dateKey
      ) || 0;


    const dayExpenses =
      monthIndex.expenseLists.get(
        dateKey
      ) || [];


    const activeTrips =
      monthIndex.tripLists.get(
        dateKey
      ) || [];


    const scheduledItems =
      monthIndex.scheduleLists.get(
        dateKey
      ) || [];


    cells += `

      <button
        class="calendar-cell
          ${dailyTotal > 0 ? "has-spending" : ""}
          ${scheduledItems.length ? "has-scheduled" : ""}
          ${dateKey === today ? "is-today" : ""}
          ${dateKey === selectedCalendarDate ? "is-selected" : ""}"
        type="button"
        data-calendar-date="${dateKey}"
      >

        <span class="calendar-day-number">
          ${day}
        </span>

        ${
          dailyTotal > 0
            ? `
                <span class="calendar-day-total">
                  ${formatCalendarDayTotal(dailyTotal)}
                </span>
              `
            : ""
        }

        <span class="calendar-day-markers">

          ${
            activeTrips.length
              ? `<i>✈</i>`
              : ""
          }

          ${
            dayExpenses.length
              ? `<b></b>`
              : ""
          }

          ${
            scheduledItems.length
              ? `<em>◌</em>`
              : ""
          }

        </span>

      </button>

    `;

  }


  calendarGrid.innerHTML =
    cells;


  calendarGrid
    .querySelectorAll(
      "[data-calendar-date]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            selectedCalendarDate =
              button.dataset
                .calendarDate;


            renderCalendar();

          }
        );

      }
    );


  renderCalendarDayDetails(
    selectedCalendarDate,
    monthIndex
  );

}


document
  .getElementById(
    "calendarPreviousMonth"
  )
  ?.addEventListener(
    "click",
    () => {

      calendarCursor =
        new Date(
          calendarCursor.getFullYear(),
          calendarCursor.getMonth() - 1,
          1
        );


      selectedCalendarDate =
        `${getCalendarMonthKey(
          calendarCursor
        )}-01`;


      renderCalendar();

    }
  );


document
  .getElementById(
    "calendarNextMonth"
  )
  ?.addEventListener(
    "click",
    () => {

      calendarCursor =
        new Date(
          calendarCursor.getFullYear(),
          calendarCursor.getMonth() + 1,
          1
        );


      selectedCalendarDate =
        `${getCalendarMonthKey(
          calendarCursor
        )}-01`;


      renderCalendar();

    }
  );


document
  .getElementById(
    "calendarToday"
  )
  ?.addEventListener(
    "click",
    () => {

      calendarCursor =
        new Date();


      selectedCalendarDate =
        getTodayString();


      renderCalendar();

    }
  );



// ========================================
// RECURRING EXPENSES
// ========================================

const recurringModal =
  document.getElementById(
    "recurringModal"
  );


const recurringForm =
  document.getElementById(
    "recurringForm"
  );


const recurringId =
  document.getElementById(
    "recurringId"
  );


const recurringName =
  document.getElementById(
    "recurringName"
  );


const recurringAmount =
  document.getElementById(
    "recurringAmount"
  );


const recurringVariableAmount =
  document.getElementById(
    "recurringVariableAmount"
  );


const recurringAmountHint =
  document.getElementById(
    "recurringAmountHint"
  );


const recurringCurrency =
  document.getElementById(
    "recurringCurrency"
  );


const recurringCategory =
  document.getElementById(
    "recurringCategory"
  );


const recurringOtherCategoryRow =
  document.getElementById(
    "recurringOtherCategoryRow"
  );


const recurringOtherCategory =
  document.getElementById(
    "recurringOtherCategory"
  );


function updateRecurringOtherCategoryVisibility() {

  updateOptionalOtherField(
    recurringCategory,
    recurringOtherCategoryRow,
    recurringOtherCategory
  );

}


recurringCategory?.addEventListener(
  "change",
  updateRecurringOtherCategoryVisibility
);


const recurringPaymentMethod =
  document.getElementById(
    "recurringPaymentMethod"
  );


const recurringOtherPaymentRow =
  document.getElementById(
    "recurringOtherPaymentRow"
  );


const recurringOtherPaymentMethod =
  document.getElementById(
    "recurringOtherPaymentMethod"
  );


function updateRecurringOtherPaymentVisibility() {

  updateOptionalOtherField(
    recurringPaymentMethod,
    recurringOtherPaymentRow,
    recurringOtherPaymentMethod
  );

}


recurringPaymentMethod?.addEventListener(
  "change",
  updateRecurringOtherPaymentVisibility
);


const recurringFrequency =
  document.getElementById(
    "recurringFrequency"
  );


const recurringNextDueDate =
  document.getElementById(
    "recurringNextDueDate"
  );


const recurringEndDate =
  document.getElementById(
    "recurringEndDate"
  );


const recurringPhoneReminder =
  document.getElementById(
    "recurringPhoneReminder"
  );


const recurringPhoneReminderOptions =
  document.getElementById(
    "recurringPhoneReminderOptions"
  );


const recurringReminderDays =
  document.getElementById(
    "recurringReminderDays"
  );


const recurringReminderTime =
  document.getElementById(
    "recurringReminderTime"
  );


function updateRecurringPhoneReminderVisibility() {
  if (recurringPhoneReminderOptions) {
    recurringPhoneReminderOptions.hidden =
      !recurringPhoneReminder?.checked;
  }
}


recurringPhoneReminder?.addEventListener(
  "change",
  updateRecurringPhoneReminderVisibility
);


const recurringNotes =
  document.getElementById(
    "recurringNotes"
  );


function updateRecurringAmountMode() {

  if (
    !recurringAmount
  ) {

    return;

  }


  const varies =
    Boolean(
      recurringVariableAmount?.checked
    );


  recurringAmount.required =
    !varies;


  recurringAmount.placeholder =
    varies
      ? "Optional usual amount"
      : "0";


  if (
    recurringAmountHint
  ) {

    recurringAmountHint.textContent =
      varies
        ? "You’ll enter the actual amount each time you log this payment."
        : "Momo will use this amount when you log the recurring payment.";

  }

}


recurringVariableAmount?.addEventListener(
  "change",
  updateRecurringAmountMode
);


function getDaysInMonth(
  year,
  monthIndex
) {

  return new Date(
    year,
    monthIndex + 1,
    0
  ).getDate();

}


function addMonthsClamped(
  dateString,
  months,
  anchorDay = null
) {

  const date =
    createLocalDate(
      dateString
    );


  if (
    !date
  ) {

    return "";

  }


  const parsedAnchorDay =
    Number(anchorDay);


  const originalDay =
    Number.isInteger(parsedAnchorDay) &&
    parsedAnchorDay >= 1 &&
    parsedAnchorDay <= 31
      ? parsedAnchorDay
      : date.getDate();


  const targetMonthStart =
    new Date(
      date.getFullYear(),
      date.getMonth() + months,
      1
    );


  const day =
    Math.min(
      originalDay,
      getDaysInMonth(
        targetMonthStart.getFullYear(),
        targetMonthStart.getMonth()
      )
    );


  const next =
    new Date(
      targetMonthStart.getFullYear(),
      targetMonthStart.getMonth(),
      day
    );


  const year =
    next.getFullYear();


  const month =
    String(
      next.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const dateDay =
    String(
      next.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${dateDay}`;

}


function addDaysToDateString(
  dateString,
  days
) {

  const date =
    createLocalDate(
      dateString
    );


  if (
    !date
  ) {

    return "";

  }


  date.setDate(
    date.getDate() +
    days
  );


  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


function getNextRecurringDate(
  dateString,
  frequency,
  anchorDay = null
) {

  switch (
    frequency
  ) {

    case "weekly":
      return addDaysToDateString(
        dateString,
        7
      );


    case "quarterly":
      return addMonthsClamped(
        dateString,
        3,
        anchorDay
      );


    case "yearly":
      return addMonthsClamped(
        dateString,
        12,
        anchorDay
      );


    case "monthly":
    default:
      return addMonthsClamped(
        dateString,
        1,
        anchorDay
      );

  }

}


function getRecurringFrequencyLabel(
  frequency
) {

  const labels = {

    weekly:
      "Weekly",

    monthly:
      "Monthly",

    quarterly:
      "Quarterly",

    yearly:
      "Yearly"

  };


  return (
    labels[
      frequency
    ] ||
    "Monthly"
  );

}


function isRecurringActive(
  recurring
) {

  if (
    recurring.active ===
    false
  ) {

    return false;

  }


  if (
    recurring.endDate &&
    recurring.nextDueDate >
      recurring.endDate
  ) {

    return false;

  }


  return true;

}


function getRecurringStatus(
  recurring
) {

  if (
    !isRecurringActive(
      recurring
    )
  ) {

    return {
      label:
        "Ended",

      className:
        "ended"
    };

  }


  const today =
    getTodayString();


  if (
    recurring.nextDueDate <
    today
  ) {

    return {
      label:
        "Overdue",

      className:
        "overdue"
    };

  }


  const sevenDaysFromToday =
    addDaysToDateString(
      today,
      7
    );


  if (
    recurring.nextDueDate <=
    sevenDaysFromToday
  ) {

    return {
      label:
        "Due soon",

      className:
        "due-soon"
    };

  }


  return {
    label:
      "Upcoming",

    className:
      "upcoming"
  };

}


function getRecurringMonthlyFactor(
  frequency
) {

  switch (
    frequency
  ) {

    case "weekly":
      return 52 / 12;


    case "quarterly":
      return 1 / 3;


    case "yearly":
      return 1 / 12;


    case "monthly":
    default:
      return 1;

  }

}


function getRecurringMonthlyEstimatePHP() {

  return recurringExpenses.reduce(
    (
      total,
      recurring
    ) => {

      if (
        !isRecurringActive(
          recurring
        )
      ) {

        return total;

      }


      const amountPHP =
        convertCurrency(
          recurring.amount,
          recurring.currency,
          "PHP"
        );


      return (
        total +
        amountPHP *
        getRecurringMonthlyFactor(
          recurring.frequency
        )
      );

    },
    0
  );

}


function openRecurringModal(
  recurring =
    null
) {

  if (
    !recurringModal ||
    !recurringForm
  ) {

    return;

  }


  recurringModal.hidden =
    false;


  if (
    recurring
  ) {

    document
      .getElementById(
        "recurringModalTitle"
      )
      .textContent =
      "Edit Recurring Expense";


    recurringId.value =
      recurring.id;


    recurringName.value =
      recurring.name ||
      "";


    recurringAmount.value =
      recurring.amount ??
      "";


    if (
      recurringVariableAmount
    ) {

      recurringVariableAmount.checked =
        Boolean(
          recurring.variableAmount
        );

    }


    updateRecurringAmountMode();


    recurringCurrency.value =
      recurring.currency ||
      "PHP";


    const recurringKind = document.getElementById("recurringKind");
    if (recurringKind) {
      recurringKind.value = recurring.kind ||
        (recurring.category === "Subscriptions" ? "subscription" : "bill");
    }

    const recurringTrialEnd = document.getElementById("recurringTrialEndDate");
    if (recurringTrialEnd) recurringTrialEnd.value = recurring.trialEndDate || "";


    recurringCategory.value =
      recurring.category ||
      "Bills";


    recurringOtherCategory.value =
      recurring.otherCategory ||
      "";


    updateRecurringOtherCategoryVisibility();


    recurringPaymentMethod.value =
      recurring.paymentMethod ||
      "Credit Card";


    recurringOtherPaymentMethod.value =
      recurring.otherPaymentMethod ||
      "";


    updateRecurringOtherPaymentVisibility();


    recurringFrequency.value =
      recurring.frequency ||
      "monthly";


    recurringNextDueDate.value =
      recurring.nextDueDate ||
      getTodayString();


    recurringEndDate.value =
      recurring.endDate ||
      "";


    if (recurringPhoneReminder) {
      recurringPhoneReminder.checked =
        Boolean(recurring.phoneReminder);
    }
    if (recurringReminderDays) {
      recurringReminderDays.value =
        String(recurring.remindDaysBefore ?? 1);
    }
    if (recurringReminderTime) {
      recurringReminderTime.value =
        recurring.remindTime || "09:00";
    }
    updateRecurringPhoneReminderVisibility();


    recurringNotes.value =
      recurring.notes ||
      "";

  } else {

    recurringForm.reset();


    document
      .getElementById(
        "recurringModalTitle"
      )
      .textContent =
      "Add Recurring Expense";


    recurringId.value =
      "";


    if (
      recurringVariableAmount
    ) {

      recurringVariableAmount.checked =
        false;

    }


    updateRecurringAmountMode();


    recurringCurrency.value =
      "PHP";


    const recurringKind = document.getElementById("recurringKind");
    if (recurringKind) recurringKind.value = "bill";

    const recurringTrialEnd = document.getElementById("recurringTrialEndDate");
    if (recurringTrialEnd) recurringTrialEnd.value = "";


    recurringCategory.value =
      "Bills";


    recurringOtherCategory.value =
      "";


    updateRecurringOtherCategoryVisibility();


    recurringPaymentMethod.value =
      "Credit Card";


    recurringOtherPaymentMethod.value =
      "";


    updateRecurringOtherPaymentVisibility();


    recurringFrequency.value =
      "monthly";


    recurringNextDueDate.value =
      getTodayString();


    recurringEndDate.value =
      "";


    if (recurringPhoneReminder) {
      recurringPhoneReminder.checked = false;
    }
    if (recurringReminderDays) {
      recurringReminderDays.value = "1";
    }
    if (recurringReminderTime) {
      recurringReminderTime.value = "09:00";
    }
    updateRecurringPhoneReminderVisibility();

  }

}


function closeRecurringModal() {

  if (
    recurringModal
  ) {

    recurringModal.hidden =
      true;

  }

}


document
  .getElementById(
    "addRecurringButton"
  )
  ?.addEventListener(
    "click",
    () => {

      openRecurringModal();

    }
  );


document
  .getElementById(
    "closeRecurringModal"
  )
  ?.addEventListener(
    "click",
    closeRecurringModal
  );


recurringModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      recurringModal
    ) {

      closeRecurringModal();

    }

  }
);


recurringForm?.addEventListener(
  "submit",
  async (
    event
  ) => {

    event.preventDefault();


    const recurringNameValue =
      recurringName?.value
        .trim() ||
      "";


    const recurringAmountValue =
      Number(
        recurringAmount?.value ||
        0
      );


    if (
      !recurringNameValue
    ) {

      showToast(
        "Give this recurring expense a name."
      );


      recurringName?.focus();


      return;

    }


    const recurringAmountVaries =
      Boolean(
        recurringVariableAmount?.checked
      );


    const recurringAmountWasEntered =
      String(
        recurringAmount?.value ||
        ""
      ).trim() !==
      "";


    if (
      (
        !recurringAmountVaries &&
        (
          !Number.isFinite(
            recurringAmountValue
          ) ||
          recurringAmountValue <=
            0
        )
      ) ||
      (
        recurringAmountVaries &&
        recurringAmountWasEntered &&
        (
          !Number.isFinite(
            recurringAmountValue
          ) ||
          recurringAmountValue <=
            0
        )
      )
    ) {

      showToast(
        recurringAmountVaries
          ? "Enter a usual amount greater than 0, or leave it blank."
          : "Enter a recurring amount greater than 0."
      );


      recurringAmount?.focus();


      return;

    }


    if (
      !recurringNextDueDate?.value
    ) {

      showToast(
        "Choose the next due date."
      );


      recurringNextDueDate?.focus();


      return;

    }


    if (
      recurringEndDate.value &&
      recurringEndDate.value <
        recurringNextDueDate.value
    ) {

      showToast(
        "End date can't be before the next due date."
      );


      return;

    }


    const existingId =
      recurringId.value;


    const previous =
      recurringExpenses.find(
        (item) =>
          item.id ===
          existingId
      );


    const recurring = {

      id:
        existingId ||
        generateId(
          "recurring"
        ),

      name:
        recurringNameValue,

      amount:
        recurringAmountVaries &&
        !recurringAmountWasEntered
          ? 0
          : recurringAmountValue,

      variableAmount:
        recurringAmountVaries,

      kind:
        document.getElementById("recurringKind")?.value || "bill",

      trialEndDate:
        document.getElementById("recurringTrialEndDate")?.value || "",

      currency:
        recurringCurrency.value,

      category:
        recurringCategory.value,

      otherCategory:
        recurringCategory.value ===
          "Other"
          ? (
              recurringOtherCategory?.value
                .trim() ||
              ""
            )
          : "",

      paymentMethod:
        recurringPaymentMethod.value,

      otherPaymentMethod:
        recurringPaymentMethod.value ===
          "Other"
          ? (
              recurringOtherPaymentMethod?.value
                .trim() ||
              ""
            )
          : "",

      frequency:
        recurringFrequency.value,

      nextDueDate:
        recurringNextDueDate.value,

      scheduleDay:
        previous?.nextDueDate ===
          recurringNextDueDate.value &&
        Number(previous?.scheduleDay)
          ? Number(previous.scheduleDay)
          : Number(
              recurringNextDueDate.value
                .split("-")[2] ||
              1
            ),

      endDate:
        recurringEndDate.value,

      phoneReminder:
        await resolvePhoneReminderPreference(
          Boolean(
            recurringPhoneReminder?.checked
          )
        ),

      remindDaysBefore:
        Number(recurringReminderDays?.value || 1),

      remindTime:
        recurringReminderTime?.value || "09:00",

      notes:
        recurringNotes.value
          .trim(),

      active:
        !(
          recurringEndDate.value &&
          recurringNextDueDate.value >
            recurringEndDate.value
        ),

      createdAt:
        previous?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    await putRecord(
      STORES.recurring,
      recurring
    );


    await syncPhoneReminder(
      "recurring",
      recurring
    );


    await loadAppData();


    closeRecurringModal();


    renderAll();


    showToast(
      existingId
        ? "Recurring expense updated ✨"
        : "Recurring expense added ↻"
    );

  }
);


function createRecurringCardHTML(
  recurring
) {

  const status =
    getRecurringStatus(
      recurring
    );


  return `

    <article class="recurring-card">

      <div class="recurring-card-top">

        <div class="recurring-icon">
          ${getCategoryEmoji(
            recurring.category
          )}
        </div>


        <div class="recurring-card-copy">

          <div class="recurring-title-row">

            <h3>
              ${escapeHTML(
                recurring.name
              )}
            </h3>

            <span class="recurring-kind-badge">${escapeHTML(
              recurring.kind === "subscription" ? "Subscription" :
              recurring.kind === "membership" ? "Membership" :
              recurring.kind === "other" ? "Other recurring" : "Bill"
            )}</span>

            <span
              class="recurring-status ${status.className}"
            >
              ${escapeHTML(
                status.label
              )}
            </span>

          </div>


          <p>
            ${escapeHTML(
              recurring.category ===
                "Other" &&
              recurring.otherCategory
                ? `Other · ${recurring.otherCategory}`
                : recurring.category
            )}
            ·
            ${escapeHTML(
              recurring.paymentMethod ===
                "Other" &&
              recurring.otherPaymentMethod
                ? `Other · ${recurring.otherPaymentMethod}`
                : recurring.paymentMethod
            )}
          </p>

        </div>

      </div>


      <div class="recurring-amount-row">

        <div>

          <span>
            Amount
          </span>

          <strong>
            ${
              recurring.variableAmount
                ? (
                    Number(
                      recurring.amount ||
                      0
                    ) >
                    0
                      ? `${formatCurrency(
                          recurring.amount,
                          recurring.currency
                        )} usual`
                      : "Varies"
                  )
                : formatCurrency(
                    recurring.amount,
                    recurring.currency
                  )
            }
          </strong>

        </div>


        <div>

          <span>
            Frequency
          </span>

          <strong>
            ${escapeHTML(
              getRecurringFrequencyLabel(
                recurring.frequency
              )
            )}
          </strong>

        </div>


        <div>

          <span>
            Next due
          </span>

          <strong>
            ${formatShortDate(
              recurring.nextDueDate
            )}
          </strong>

        </div>

      </div>


      ${
        recurring.notes

          ? `

              <p class="recurring-notes">
                ${escapeHTML(
                  recurring.notes
                )}
              </p>

            `

          : ""
      }


      ${
        recurring.phoneReminder
          ? `<p class="phone-reminder-chip">🔔 ${escapeHTML(String(recurring.remindDaysBefore ?? 1))} day${Number(recurring.remindDaysBefore ?? 1) === 1 ? "" : "s"} before · ${escapeHTML(recurring.remindTime || "09:00")}</p>`
          : ""
      }


      <div class="recurring-card-actions">

        <button
          class="secondary-btn log-recurring-expense"
          type="button"
          data-recurring-id="${escapeHTML(
            recurring.id
          )}"
          ${!isRecurringActive(recurring)
            ? "disabled"
            : ""}
        >
          ＋ Log Expense
        </button>


        <button
          class="tiny-icon-btn edit-recurring"
          type="button"
          data-recurring-id="${escapeHTML(
            recurring.id
          )}"
          aria-label="Edit recurring expense"
        >
          ✎
        </button>


        <button
          class="tiny-icon-btn delete-recurring"
          type="button"
          data-recurring-id="${escapeHTML(
            recurring.id
          )}"
          aria-label="Delete recurring expense"
        >
          🗑
        </button>

      </div>

    </article>

  `;

}


function openVariableRecurringExpenseDraft(
  recurring
) {

  if (
    !recurring
  ) {

    return;

  }


  showScreen(
    "add"
  );


  pendingRecurringLogId =
    recurring.id;


  const titleInput =
    document.getElementById(
      "expenseTitle"
    );


  if (
    titleInput
  ) {

    titleInput.value =
      recurring.name ||
      "";

  }


  if (
    amountInput
  ) {

    amountInput.value =
      "";

    amountInput.placeholder =
      Number(
        recurring.amount ||
        0
      ) >
      0
        ? `Usual: ${formatCurrency(
            recurring.amount,
            recurring.currency
          )}`
        : "Enter this payment";

  }


  if (
    currencySelect
  ) {

    currencySelect.value =
      recurring.currency ||
      "PHP";

  }


  if (
    expenseCategory
  ) {

    expenseCategory.value =
      recurring.category ||
      "Other";

  }


  if (
    expenseOtherCategory
  ) {

    expenseOtherCategory.value =
      recurring.otherCategory ||
      "";

  }


  updateExpenseOtherCategoryVisibility();


  const paymentMethod =
    document.getElementById(
      "paymentMethod"
    );


  if (
    paymentMethod
  ) {

    paymentMethod.value =
      recurring.paymentMethod ||
      "Cash";

  }


  if (
    expenseOtherPaymentMethod
  ) {

    expenseOtherPaymentMethod.value =
      recurring.otherPaymentMethod ||
      "";

  }


  updateExpenseOtherPaymentVisibility();


  if (
    expenseDate
  ) {

    expenseDate.value =
      getTodayString();

  }


  const notesInput =
    document.getElementById(
      "expenseNotes"
    );


  if (
    notesInput
  ) {

    notesInput.value =
      recurring.notes ||
      "";

  }


  updateExpenseConversion();


  showToast(
    "Enter this payment’s actual amount, then save ✨"
  );


  window.setTimeout(
    () =>
      amountInput?.focus(),
    120
  );

}


const RECURRING_RENDER_BATCH = 60;
let recurringRenderLimit = RECURRING_RENDER_BATCH;


function renderRecurringExpenses() {

  const list =
    document.getElementById(
      "recurringList"
    );


  const empty =
    document.getElementById(
      "recurringEmpty"
    );


  if (
    !list ||
    !empty
  ) {

    return;

  }


  const sorted =
    [...recurringExpenses]
      .sort(
        (
          a,
          b
        ) => {

          return (
            String(
              a.nextDueDate ||
              ""
            ).localeCompare(
              String(
                b.nextDueDate ||
                ""
              )
            )
          );

        }
      );


  const active =
    sorted.filter(
      isRecurringActive
    );


  const today =
    getTodayString();


  const dueSoonLimit =
    addDaysToDateString(
      today,
      7
    );


  const dueSoon =
    active.filter(
      (recurring) =>
        recurring.nextDueDate <=
          dueSoonLimit
    );


  const activeCount =
    document.getElementById(
      "recurringActiveCount"
    );


  const dueSoonCount =
    document.getElementById(
      "recurringDueSoonCount"
    );


  const monthlyEstimate =
    document.getElementById(
      "recurringMonthlyEstimate"
    );


  if (
    activeCount
  ) {

    activeCount.textContent =
      String(
        active.length
      );

  }


  if (
    dueSoonCount
  ) {

    dueSoonCount.textContent =
      String(
        dueSoon.length
      );

  }


  if (
    monthlyEstimate
  ) {

    monthlyEstimate.textContent =
      formatPHP(
        getRecurringMonthlyEstimatePHP()
      );

  }


  const subscriptionItems = active.filter(
    (item) => item.kind === "subscription" || item.category === "Subscriptions"
  );

  const subscriptionAnnualPHP = subscriptionItems.reduce(
    (total, item) => total + convertCurrency(
      Number(item.amount || 0) * getRecurringMonthlyFactor(item.frequency) * 12,
      item.currency || "PHP",
      "PHP"
    ),
    0
  );

  const trialSoonLimit = addDaysToDateString(today, 30);
  const trialCount = active.filter(
    (item) => item.trialEndDate && item.trialEndDate >= today && item.trialEndDate <= trialSoonLimit
  ).length;

  const subscriptionCountElement = document.getElementById("subscriptionActiveCount");
  const subscriptionAnnualElement = document.getElementById("subscriptionAnnualEstimate");
  const subscriptionTrialsElement = document.getElementById("subscriptionTrialCount");
  if (subscriptionCountElement) subscriptionCountElement.textContent = String(subscriptionItems.length);
  if (subscriptionAnnualElement) subscriptionAnnualElement.textContent = formatPHP(subscriptionAnnualPHP);
  if (subscriptionTrialsElement) subscriptionTrialsElement.textContent = String(trialCount);


  if (
    sorted.length ===
    0
  ) {

    list.innerHTML =
      "";


    empty.style.display =
      "block";


    return;

  }


  empty.style.display =
    "none";


  const visibleRecurring =
    sorted.slice(
      0,
      recurringRenderLimit
    );


  list.innerHTML =
    visibleRecurring

      .map(
        createRecurringCardHTML
      )

      .join("") +
    (
      visibleRecurring.length <
      sorted.length
        ? `<button class="secondary-button momo-load-more" type="button" data-load-more-recurring>Load more (${sorted.length - visibleRecurring.length} remaining)</button>`
        : ""
    );


  attachRecurringActions();

}


document.addEventListener(
  "click",
  (event) => {

    if (
      !event.target.closest(
        "[data-load-more-recurring]"
      )
    ) {

      return;

    }


    recurringRenderLimit +=
      RECURRING_RENDER_BATCH;


    renderRecurringExpenses();

  }
);


function attachRecurringActions() {

  document
    .querySelectorAll(
      ".edit-recurring"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const recurring =
              recurringExpenses.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .recurringId
              );


            if (
              recurring
            ) {

              openRecurringModal(
                recurring
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-recurring"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            recurringPendingDelete =
              button.dataset
                .recurringId;


            document
              .getElementById(
                "deleteRecurringModal"
              )
              .hidden =
              false;

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".log-recurring-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          async () => {

            const recurring =
              recurringExpenses.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .recurringId
              );


            if (
              !recurring ||
              !isRecurringActive(
                recurring
              )
            ) {

              return;

            }


            if (
              recurring.variableAmount
            ) {

              openVariableRecurringExpenseDraft(
                recurring
              );


              return;

            }


            const expense = {

              id:
                generateId(
                  "expense"
                ),

              title:
                recurring.name,

              amount:
                Number(
                  recurring.amount ||
                  0
                ),

              currency:
                recurring.currency,

              category:
                recurring.category,

              otherCategory:
                recurring.otherCategory ||
                "",

              budgetId:
                "",

              budgetName:
                "",

              paymentMethod:
                recurring.paymentMethod,

              otherPaymentMethod:
                recurring.otherPaymentMethod ||
                "",

              date:
                getTodayString(),

              location:
                "",

              notes:
                recurring.notes ||
                "",

              photo:
                "",

              tripId:
                "",

              sourceRecurringId:
                recurring.id,

              createdAt:
                new Date()
                  .toISOString(),

              updatedAt:
                new Date()
                  .toISOString()

            };


            await putRecord(
              STORES.expenses,
              expense
            );


            const nextDate =
              getNextRecurringDate(
                recurring.nextDueDate,
                recurring.frequency,
                recurring.scheduleDay
              );


            const updatedRecurring = {
              ...recurring,

              nextDueDate:
                nextDate,

              active:
                !(
                  recurring.endDate &&
                  nextDate >
                    recurring.endDate
                ),

              updatedAt:
                new Date()
                  .toISOString()
            };


            await putRecord(
              STORES.recurring,
              updatedRecurring
            );


            await syncPhoneReminder(
              "recurring",
              updatedRecurring
            );


            await loadAppData();


            renderAll();


            showToast(
              "Expense logged and next due date updated ✨"
            );

          }
        );

      }
    );

}


document
  .getElementById(
    "cancelDeleteRecurring"
  )
  ?.addEventListener(
    "click",
    () => {

      recurringPendingDelete =
        null;


      document
        .getElementById(
          "deleteRecurringModal"
        )
        .hidden =
        true;

    }
  );


document
  .getElementById(
    "confirmDeleteRecurring"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !recurringPendingDelete
      ) {

        return;

      }


      const deletedRecurringId =
        recurringPendingDelete;


      await deleteRecord(
        STORES.recurring,
        deletedRecurringId
      );


      await removePhoneReminder(
        "recurring",
        deletedRecurringId
      );


      recurringPendingDelete =
        null;


      document
        .getElementById(
          "deleteRecurringModal"
        )
        .hidden =
        true;


      await loadAppData();


      renderAll();


      showToast(
        "Recurring expense deleted"
      );

    }
  );


document
  .getElementById(
    "deleteRecurringModal"
  )
  ?.addEventListener(
    "click",
    (event) => {

      if (
        event.target.id ===
        "deleteRecurringModal"
      ) {

        recurringPendingDelete =
          null;


        event.currentTarget.hidden =
          true;

      }

    }
  );




// ========================================
// PLANNED EXPENSES
// ========================================

let plannedExpenseFilter =
  "planned";


const plannedExpenseModal =
  document.getElementById(
    "plannedExpenseModal"
  );


const plannedExpenseForm =
  document.getElementById(
    "plannedExpenseForm"
  );


const plannedExpenseId =
  document.getElementById(
    "plannedExpenseId"
  );


const plannedExpenseTitle =
  document.getElementById(
    "plannedExpenseTitle"
  );


const plannedExpenseAmount =
  document.getElementById(
    "plannedExpenseAmount"
  );


const plannedExpenseCurrency =
  document.getElementById(
    "plannedExpenseCurrency"
  );


const plannedExpenseCategory =
  document.getElementById(
    "plannedExpenseCategory"
  );


const plannedOtherCategoryRow =
  document.getElementById(
    "plannedOtherCategoryRow"
  );


const plannedOtherCategory =
  document.getElementById(
    "plannedOtherCategory"
  );


function updatePlannedOtherCategoryVisibility() {

  updateOptionalOtherField(
    plannedExpenseCategory,
    plannedOtherCategoryRow,
    plannedOtherCategory
  );

}


plannedExpenseCategory?.addEventListener(
  "change",
  updatePlannedOtherCategoryVisibility
);


const plannedExpenseTrip =
  document.getElementById(
    "plannedExpenseTrip"
  );


const plannedExpenseTargetDate =
  document.getElementById(
    "plannedExpenseTargetDate"
  );


const plannedPhoneReminder =
  document.getElementById(
    "plannedPhoneReminder"
  );


const plannedPhoneReminderOptions =
  document.getElementById(
    "plannedPhoneReminderOptions"
  );


const plannedReminderDays =
  document.getElementById(
    "plannedReminderDays"
  );


const plannedReminderTime =
  document.getElementById(
    "plannedReminderTime"
  );


function updatePlannedPhoneReminderVisibility() {
  if (plannedPhoneReminderOptions) {
    plannedPhoneReminderOptions.hidden =
      !plannedPhoneReminder?.checked;
  }
}


plannedPhoneReminder?.addEventListener(
  "change",
  updatePlannedPhoneReminderVisibility
);


const plannedExpenseNotes =
  document.getElementById(
    "plannedExpenseNotes"
  );


function populatePlannedTripDropdown() {

  if (
    !plannedExpenseTrip
  ) {

    return;

  }


  const current =
    plannedExpenseTrip.value;


  plannedExpenseTrip.innerHTML = `

    <option value="">
      Personal / No Trip
    </option>

    ${trips

      .map(
        (trip) => `

          <option
            value="${escapeHTML(
              trip.id
            )}"
          >
            ${escapeHTML(
              trip.name
            )}
          </option>

        `
      )

      .join("")}

  `;


  if (
    current &&
    trips.some(
      (trip) =>
        trip.id ===
        current
    )
  ) {

    plannedExpenseTrip.value =
      current;

  }

}


function openPlannedExpenseModal(
  planned =
    null
) {

  if (
    !plannedExpenseModal ||
    !plannedExpenseForm
  ) {

    return;

  }


  populatePlannedTripDropdown();


  plannedExpenseModal.hidden =
    false;


  if (
    planned
  ) {

    document
      .getElementById(
        "plannedExpenseModalTitle"
      )
      .textContent =
      "Edit Planned Expense";


    plannedExpenseId.value =
      planned.id;


    plannedExpenseTitle.value =
      planned.title ||
      "";


    plannedExpenseAmount.value =
      planned.amount ??
      "";


    plannedExpenseCurrency.value =
      planned.currency ||
      "PHP";


    plannedExpenseCategory.value =
      planned.category ||
      "Shopping";


    plannedOtherCategory.value =
      planned.otherCategory ||
      "";


    updatePlannedOtherCategoryVisibility();


    plannedExpenseTrip.value =
      planned.tripId ||
      "";


    plannedExpenseTargetDate.value =
      planned.targetDate ||
      "";


    if (plannedPhoneReminder) {
      plannedPhoneReminder.checked =
        Boolean(planned.phoneReminder);
    }

    if (plannedReminderDays) {
      plannedReminderDays.value =
        String(planned.remindDaysBefore ?? 1);
    }

    if (plannedReminderTime) {
      plannedReminderTime.value =
        planned.remindTime || "09:00";
    }

    updatePlannedPhoneReminderVisibility();


    plannedExpenseNotes.value =
      planned.notes ||
      "";

  } else {

    plannedExpenseForm.reset();


    document
      .getElementById(
        "plannedExpenseModalTitle"
      )
      .textContent =
      "Add Planned Expense";


    plannedExpenseId.value =
      "";


    plannedExpenseCurrency.value =
      "PHP";


    plannedExpenseCategory.value =
      "Shopping";


    plannedOtherCategory.value =
      "";


    updatePlannedOtherCategoryVisibility();


    plannedExpenseTrip.value =
      "";


    if (plannedPhoneReminder) {
      plannedPhoneReminder.checked = false;
    }
    if (plannedReminderDays) {
      plannedReminderDays.value = "1";
    }
    if (plannedReminderTime) {
      plannedReminderTime.value = "09:00";
    }
    updatePlannedPhoneReminderVisibility();

  }

}


function closePlannedExpenseModal() {

  if (
    plannedExpenseModal
  ) {

    plannedExpenseModal.hidden =
      true;

  }

}


document
  .getElementById(
    "addPlannedExpenseButton"
  )
  ?.addEventListener(
    "click",
    () => {

      openPlannedExpenseModal();

    }
  );


document
  .getElementById(
    "closePlannedExpenseModal"
  )
  ?.addEventListener(
    "click",
    closePlannedExpenseModal
  );


plannedExpenseModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      plannedExpenseModal
    ) {

      closePlannedExpenseModal();

    }

  }
);


plannedExpenseForm?.addEventListener(
  "submit",
  async (
    event
  ) => {

    event.preventDefault();


    const plannedTitleValue =
      plannedExpenseTitle?.value
        .trim() ||
      "";


    const plannedAmountValue =
      Number(
        plannedExpenseAmount?.value ||
        0
      );


    if (
      !plannedTitleValue
    ) {

      showToast(
        "Give this planned expense a title."
      );


      plannedExpenseTitle?.focus();


      return;

    }


    if (
      !Number.isFinite(
        plannedAmountValue
      ) ||
      plannedAmountValue <=
        0
    ) {

      showToast(
        "Enter an expected amount greater than 0."
      );


      plannedExpenseAmount?.focus();


      return;

    }


    if (
      plannedPhoneReminder?.checked &&
      !plannedExpenseTargetDate?.value
    ) {
      showToast(
        "Choose a target date for the phone reminder."
      );
      plannedExpenseTargetDate?.focus();
      return;
    }


    const existingId =
      plannedExpenseId.value;


    const previous =
      plannedExpenses.find(
        (item) =>
          item.id ===
          existingId
      );


    const planned = {

      id:
        existingId ||
        generateId(
          "planned"
        ),

      title:
        plannedTitleValue,

      amount:
        plannedAmountValue,

      currency:
        plannedExpenseCurrency.value,

      category:
        plannedExpenseCategory.value,

      otherCategory:
        plannedExpenseCategory.value ===
          "Other"
          ? (
              plannedOtherCategory?.value
                .trim() ||
              ""
            )
          : "",

      tripId:
        plannedExpenseTrip.value,

      targetDate:
        plannedExpenseTargetDate.value,

      phoneReminder:
        await resolvePhoneReminderPreference(
          Boolean(
            plannedPhoneReminder?.checked
          )
        ),

      remindDaysBefore:
        Number(plannedReminderDays?.value || 1),

      remindTime:
        plannedReminderTime?.value || "09:00",

      notes:
        plannedExpenseNotes.value
          .trim(),

      status:
        previous?.status ||
        "planned",

      convertedExpenseId:
        previous?.convertedExpenseId ||
        "",

      purchasedAt:
        previous?.purchasedAt ||
        "",

      createdAt:
        previous?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    await putRecord(
      STORES.planned,
      planned
    );


    await syncPhoneReminder(
      "planned",
      planned
    );


    await loadAppData();


    closePlannedExpenseModal();


    renderAll();


    showToast(
      existingId
        ? "Planned expense updated ✨"
        : "Planned expense added ☆"
    );

  }
);


function getPlannedTripName(
  planned
) {

  if (
    !planned.tripId
  ) {

    return "Personal";

  }


  const trip =
    trips.find(
      (item) =>
        item.id ===
        planned.tripId
    );


  return (
    trip?.name ||
    "Trip"
  );

}


function getPlannedTotalPHP() {

  return plannedExpenses

    .filter(
      (item) =>
        item.status ===
        "planned"
    )

    .reduce(
      (
        total,
        item
      ) => {

        return (
          total +
          convertCurrency(
            item.amount,
            item.currency,
            "PHP"
          )
        );

      },
      0
    );

}


function createPlannedExpenseCardHTML(
  planned
) {

  const isPurchased =
    planned.status ===
    "purchased";


  return `

    <article
      class="planned-expense-card ${
        isPurchased
          ? "is-purchased"
          : ""
      }"
    >

      <div class="planned-expense-top">

        <div class="planned-expense-icon">
          ${getCategoryEmoji(
            planned.category
          )}
        </div>


        <div class="planned-expense-copy">

          <div class="planned-expense-title-row">

            <h3>
              ${escapeHTML(
                planned.title
              )}
            </h3>

            <span
              class="planned-status ${
                isPurchased
                  ? "purchased"
                  : "planned"
              }"
            >
              ${
                isPurchased
                  ? "Purchased"
                  : "Planned"
              }
            </span>

          </div>


          <p>

            ${escapeHTML(
              planned.category ===
                "Other" &&
              planned.otherCategory
                ? `Other · ${planned.otherCategory}`
                : planned.category
            )}

            ·

            ${escapeHTML(
              getPlannedTripName(
                planned
              )
            )}

          </p>

        </div>

      </div>


      <div class="planned-expense-values">

        <div>

          <span>
            Expected
          </span>

          <strong>
            ${formatCurrency(
              planned.amount,
              planned.currency
            )}
          </strong>

        </div>


        <div>

          <span>
            Target date
          </span>

          <strong>
            ${
              planned.targetDate
                ? formatShortDate(
                    planned.targetDate
                  )
                : "Anytime"
            }
          </strong>

        </div>

      </div>


      ${
        planned.notes

          ? `

              <p class="planned-expense-notes">
                ${escapeHTML(
                  planned.notes
                )}
              </p>

            `

          : ""
      }


      ${
        planned.phoneReminder && !isPurchased
          ? `<p class="phone-reminder-chip">🔔 ${escapeHTML(String(planned.remindDaysBefore ?? 1))} day${Number(planned.remindDaysBefore ?? 1) === 1 ? "" : "s"} before · ${escapeHTML(planned.remindTime || "09:00")}</p>`
          : ""
      }


      <div class="planned-expense-actions">

        ${
          !isPurchased

            ? `

                <button
                  class="secondary-btn convert-planned-expense"
                  type="button"
                  data-planned-id="${escapeHTML(
                    planned.id
                  )}"
                >
                  ＋ Move to Expense
                </button>

              `

            : `

                <div class="planned-purchased-note">
                  ✓ Added to expenses
                </div>

              `
        }


        <button
          class="tiny-icon-btn edit-planned-expense"
          type="button"
          data-planned-id="${escapeHTML(
            planned.id
          )}"
          aria-label="Edit planned expense"
        >
          ✎
        </button>


        <button
          class="tiny-icon-btn delete-planned-expense"
          type="button"
          data-planned-id="${escapeHTML(
            planned.id
          )}"
          aria-label="Delete planned expense"
        >
          🗑
        </button>

      </div>

    </article>

  `;

}


const PLANNED_RENDER_BATCH = 60;
let plannedRenderLimit = PLANNED_RENDER_BATCH;


function renderPlannedExpenses() {

  const list =
    document.getElementById(
      "plannedExpenseList"
    );


  const empty =
    document.getElementById(
      "plannedExpenseEmpty"
    );


  if (
    !list ||
    !empty
  ) {

    return;

  }


  populatePlannedTripDropdown();


  const active =
    plannedExpenses.filter(
      (item) =>
        item.status ===
        "planned"
    );


  const purchased =
    plannedExpenses.filter(
      (item) =>
        item.status ===
        "purchased"
    );


  const totalElement =
    document.getElementById(
      "plannedTotalAmount"
    );


  const activeCount =
    document.getElementById(
      "plannedActiveCount"
    );


  const purchasedCount =
    document.getElementById(
      "plannedPurchasedCount"
    );


  if (
    totalElement
  ) {

    totalElement.textContent =
      formatPHP(
        getPlannedTotalPHP()
      );

  }


  if (
    activeCount
  ) {

    activeCount.textContent =
      `${active.length} ${
        active.length ===
        1
          ? "item"
          : "items"
      }`;

  }


  if (
    purchasedCount
  ) {

    purchasedCount.textContent =
      String(
        purchased.length
      );

  }


  let filtered =
    plannedExpenses;


  if (
    plannedExpenseFilter !==
    "all"
  ) {

    filtered =
      plannedExpenses.filter(
        (item) =>
          item.status ===
          plannedExpenseFilter
      );

  }


  if (
    filtered.length ===
    0
  ) {

    list.innerHTML =
      "";


    empty.style.display =
      "block";


    const title =
      empty.querySelector(
        "h3"
      );


    const copy =
      empty.querySelector(
        "p"
      );


    if (
      title
    ) {

      title.textContent =
        plannedExpenses.length
          ? "Nothing in this view"
          : "No planned expenses yet";

    }


    if (
      copy
    ) {

      copy.textContent =
        plannedExpenses.length
          ? "Try another filter."
          : "Add something you may want to buy later.";

    }


    return;

  }


  empty.style.display =
    "none";


  const visiblePlanned =
    filtered.slice(
      0,
      plannedRenderLimit
    );


  list.innerHTML =
    visiblePlanned

      .map(
        createPlannedExpenseCardHTML
      )

      .join("") +
    (
      visiblePlanned.length <
      filtered.length
        ? `<button class="secondary-button momo-load-more" type="button" data-load-more-planned>Load more (${filtered.length - visiblePlanned.length} remaining)</button>`
        : ""
    );


  attachPlannedExpenseActions();

}


document.addEventListener(
  "click",
  (event) => {

    if (
      !event.target.closest(
        "[data-load-more-planned]"
      )
    ) {

      return;

    }


    plannedRenderLimit +=
      PLANNED_RENDER_BATCH;


    renderPlannedExpenses();

  }
);


document
  .querySelectorAll(
    "[data-planned-filter]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          plannedExpenseFilter =
            button.dataset
              .plannedFilter;


          document
            .querySelectorAll(
              "[data-planned-filter]"
            )
            .forEach(
              (item) =>
                item.classList.toggle(
                  "active",
                  item ===
                    button
                )
            );


          plannedRenderLimit =
            PLANNED_RENDER_BATCH;


          renderPlannedExpenses();

        }
      );

    }
  );


function attachPlannedExpenseActions() {

  document
    .querySelectorAll(
      ".edit-planned-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const planned =
              plannedExpenses.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .plannedId
              );


            if (
              planned
            ) {

              openPlannedExpenseModal(
                planned
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-planned-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            plannedPendingDelete =
              button.dataset
                .plannedId;


            document
              .getElementById(
                "deletePlannedExpenseModal"
              )
              .hidden =
              false;

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".convert-planned-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const planned =
              plannedExpenses.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .plannedId
              );


            if (
              !planned
            ) {

              return;

            }


            pendingPlannedConversionId =
              planned.id;


            openingExpenseEditor =
              true;


            showScreen(
              "add"
            );


            resetExpenseForm();


            setExpenseFormMode(
              "add"
            );


            document
              .getElementById(
                "expenseTitle"
              )
              .value =
              planned.title ||
              "";


            amountInput.value =
              planned.amount ??
              "";


            currencySelect.value =
              planned.currency ||
              "PHP";


            expenseCategory.value =
              planned.category ||
              "Shopping";


            if (
              expenseOtherCategory
            ) {

              expenseOtherCategory.value =
                planned.otherCategory ||
                "";

            }


            updateExpenseOtherCategoryVisibility();


            if (
              expenseTrip
            ) {

              expenseTrip.value =
                planned.tripId ||
                "";

            }


            document
              .getElementById(
                "expenseNotes"
              )
              .value =
              planned.notes ||
              "";


            expenseDate.value =
              planned.targetDate ||
              getTodayString();


            updateExpenseConversion();


            showToast(
              "Planned item loaded. Add payment details, then save."
            );

          }
        );

      }
    );

}


document
  .getElementById(
    "cancelDeletePlannedExpense"
  )
  ?.addEventListener(
    "click",
    () => {

      plannedPendingDelete =
        null;


      document
        .getElementById(
          "deletePlannedExpenseModal"
        )
        .hidden =
        true;

    }
  );


document
  .getElementById(
    "confirmDeletePlannedExpense"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !plannedPendingDelete
      ) {

        return;

      }


      const deletedPlannedId =
        plannedPendingDelete;


      await deleteRecord(
        STORES.planned,
        deletedPlannedId
      );


      await removePhoneReminder(
        "planned",
        deletedPlannedId
      );


      plannedPendingDelete =
        null;


      document
        .getElementById(
          "deletePlannedExpenseModal"
        )
        .hidden =
        true;


      await loadAppData();


      renderAll();


      showToast(
        "Planned expense deleted"
      );

    }
  );


document
  .getElementById(
    "deletePlannedExpenseModal"
  )
  ?.addEventListener(
    "click",
    (event) => {

      if (
        event.target.id ===
        "deletePlannedExpenseModal"
      ) {

        plannedPendingDelete =
          null;


        event.currentTarget.hidden =
          true;

      }

    }
  );


// ========================================
// BACKUP & EXPORT
// ========================================

const MOMO_BACKUP_FORMAT =
  "momo-backup";


const MOMO_BACKUP_VERSION =
  2;


const importMomoBackupFile =
  document.getElementById(
    "importMomoBackupFile"
  );


const restoreBackupModal =
  document.getElementById(
    "restoreBackupModal"
  );


function formatBackupFileDate(
  date =
    new Date()
) {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  const hour =
    String(
      date.getHours()
    ).padStart(
      2,
      "0"
    );


  const minute =
    String(
      date.getMinutes()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}_${hour}-${minute}`;

}


function downloadTextFile(
  filename,
  content,
  mimeType
) {

  const blob =
    new Blob(
      [
        content
      ],
      {
        type:
          mimeType
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    filename;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        url
      );

    },
    1000
  );

}



function getBackupFeatureSummaryFromSettings(
  settingsRecords
) {

  const getValue =
    (
      key,
      fallback
    ) =>
      settingsRecords.find(
        (
          item
        ) =>
          item?.key ===
          key
      )?.value ??
      fallback;


  const savings =
    getValue(
      SAVINGS_GOALS_SETTING_KEY,
      []
    );


  const settlements =
    getValue(
      TRAVEL_SETTLEMENT_SETTING_KEY,
      []
    );


  const shopping =
    getValue(
      TRIP_SHOPPING_SETTING_KEY,
      []
    );


  const monthlyIncome =
    getValue(
      MONTHLY_INCOME_SETTING_KEY,
      {}
    );


  return {
    expenses:
      expenses.length,
    photos:
      expenses.filter(
        (
          expense
        ) =>
          Boolean(
            expense.photo
          )
      ).length,
    budgets:
      budgets.length,
    trips:
      trips.length,
    recurring:
      recurringExpenses.length,
    planned:
      plannedExpenses.length,
    templates:
      favoriteExpenses.length,
    savingsGoals:
      Array.isArray(
        savings
      )
        ? savings.length
        : 0,
    settlements:
      Array.isArray(
        settlements
      )
        ? settlements.length
        : 0,
    shoppingItems:
      Array.isArray(
        shopping
      )
        ? shopping.length
        : 0,
    incomeMonths:
      monthlyIncome &&
      typeof monthlyIncome ===
        "object" &&
      !Array.isArray(
        monthlyIncome
      )
        ? Object.keys(
            monthlyIncome
          ).length
        : 0,
    settingsRecords:
      settingsRecords.length
  };

}


async function getAllMomoStoreSnapshots() {

  const snapshots =
    {};


  for (
    const storeName of Object.values(
      STORES
    )
  ) {

    snapshots[
      storeName
    ] =
      await getAllRecords(
        storeName
      );

  }


  return snapshots;

}


function getBackupStoreSnapshots(
  backup
) {

  if (
    Number(
      backup?.backupVersion
    ) >=
      2 &&
    backup?.storeSnapshots &&
    typeof backup.storeSnapshots ===
      "object" &&
    !Array.isArray(
      backup.storeSnapshots
    )
  ) {

    return backup.storeSnapshots;

  }


  const data =
    backup?.data ||
    {};


  return {
    [STORES.expenses]:
      Array.isArray(
        data.expenses
      )
        ? data.expenses
        : [],
    [STORES.budgets]:
      Array.isArray(
        data.budgets
      )
        ? data.budgets
        : [],
    [STORES.trips]:
      Array.isArray(
        data.trips
      )
        ? data.trips
        : [],
    [STORES.cards]:
      Array.isArray(
        data.cards
      )
        ? data.cards
        : [],
    [STORES.recurring]:
      Array.isArray(
        data.recurringExpenses
      )
        ? data.recurringExpenses
        : [],
    [STORES.planned]:
      Array.isArray(
        data.plannedExpenses
      )
        ? data.plannedExpenses
        : [],
    [STORES.settings]:
      Array.isArray(
        data.settings
      )
        ? data.settings
        : []
  };

}


async function buildMomoBackup() {

  const storeSnapshots =
    await getAllMomoStoreSnapshots();


  const settings =
    storeSnapshots[
      STORES.settings
    ] ||
    [];


  return {
    format:
      MOMO_BACKUP_FORMAT,
    backupVersion:
      MOMO_BACKUP_VERSION,
    databaseVersion:
      db?.version ||
      DB_VERSION,
    appName:
      "Momo",
    exportedAt:
      new Date()
        .toISOString(),

    /*
      Exact IndexedDB snapshot. This protects current features
      and future Momo data that lives in existing stores.
    */
    storeSnapshots,

    featureSummary:
      getBackupFeatureSummaryFromSettings(
        settings
      ),

    /*
      Legacy shape retained for compatibility/readability.
    */
    data: {
      expenses:
        storeSnapshots[
          STORES.expenses
        ] ||
        [],
      budgets:
        storeSnapshots[
          STORES.budgets
        ] ||
        [],
      trips:
        storeSnapshots[
          STORES.trips
        ] ||
        [],
      cards:
        storeSnapshots[
          STORES.cards
        ] ||
        [],
      recurringExpenses:
        storeSnapshots[
          STORES.recurring
        ] ||
        [],
      plannedExpenses:
        storeSnapshots[
          STORES.planned
        ] ||
        [],
      favoriteExpenses:
        favoriteExpenses,
      settings:
        settings
    },

    preferences: {
      converterCurrencyA:
        localStorage.getItem(
          LOCAL_KEYS.converterA
        ) ||
        "",
      converterCurrencyB:
        localStorage.getItem(
          LOCAL_KEYS.converterB
        ) ||
        "",
      appearanceTheme:
        localStorage.getItem(
          LOCAL_KEYS.appearanceTheme
        ) ||
        "",
      appearanceWallpaperEnabled:
        localStorage.getItem(
          LOCAL_KEYS.appearanceWallpaperEnabled
        ) ||
        "",
      appearanceOverlay:
        localStorage.getItem(
          LOCAL_KEYS.appearanceOverlay
        ) ||
        ""
    }
  };

}


document
  .getElementById(
    "exportMomoBackup"
  )
  ?.addEventListener(
    "click",
    async () => {

      try {

        const backup =
          await buildMomoBackup();


        const json =
          JSON.stringify(
            backup,
            null,
            2
          );


        downloadTextFile(
          `momo-backup-${formatBackupFileDate()}.json`,
          json,
          "application/json"
        );


        showToast(
          "Momo backup exported ✨"
        );

      } catch (
        error
      ) {

        console.error(
          "Backup export failed:",
          error
        );


        showToast(
          "Could not export backup."
        );

      }

    }
  );


function csvEscape(
  value
) {

  if (
    value ===
    null ||
    value ===
    undefined
  ) {

    return "";

  }


  const text =
    String(
      value
    );


  if (
    /[",\n\r]/.test(
      text
    )
  ) {

    return `"${text.replaceAll(
      '"',
      '""'
    )}"`;

  }


  return text;

}


function createExpenseCSV() {

  const headers = [

    "Date",
    "Title",
    "Amount",
    "Currency",
    "PHP Equivalent",
    "Category",
    "Category Detail",
    "Payment Method",
    "Payment Detail",
    "Tags",
    "Shared Expense",
    "Budget",
    "Trip",
    "Location / Store",
    "Notes",
    "Photo Attached",
    "Created At",
    "Updated At"

  ];


  const rows =
    expenses.map(
      (expense) => {

        const phpEquivalent =
          convertCurrency(
            expense.amount,
            expense.currency,
            "PHP"
          );


        return [

          expense.date ||
            "",

          expense.title ||
            "",

          Number(
            expense.amount ||
            0
          ),

          expense.currency ||
            "PHP",

          Number(
            phpEquivalent.toFixed(
              2
            )
          ),

          expense.category ||
            "",

          expense.otherCategory ||
            "",

          expense.paymentMethod ||
            "",

          expense.otherPaymentMethod ||
            "",

          normalizeExpenseTags(
            expense.tags
          ).join(
            " | "
          ),

          expense.settlementShared
            ? "Yes"
            : "No",

          getExpenseBudgetName(
            expense
          ),

          getExpenseTripName(
            expense
          ),

          expense.location ||
            "",

          expense.notes ||
            "",

          expense.photo
            ? "Yes"
            : "No",

          expense.createdAt ||
            "",

          expense.updatedAt ||
            ""

        ];

      }
    );


  return [

    headers,
    ...rows

  ]

    .map(
      (row) =>
        row
          .map(
            csvEscape
          )
          .join(
            ","
          )
    )

    .join(
      "\r\n"
    );

}


document
  .getElementById(
    "exportExpensesCSV"
  )
  ?.addEventListener(
    "click",
    () => {

      if (
        expenses.length ===
        0
      ) {

        showToast(
          "No expenses to export yet."
        );


        return;

      }


      const csv =
        createExpenseCSV();


      downloadTextFile(
        `momo-expenses-${formatBackupFileDate()}.csv`,
        `\uFEFF${csv}`,
        "text/csv;charset=utf-8"
      );


      showToast(
        "Expense CSV exported ✨"
      );

    }
  );


document
  .getElementById(
    "chooseMomoBackup"
  )
  ?.addEventListener(
    "click",
    () => {

      if (
        importMomoBackupFile
      ) {

        importMomoBackupFile.value =
          "";


        importMomoBackupFile.click();

      }

    }
  );


function isPlainObject(
  value
) {

  return (
    value !==
      null &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );

}


function validateMomoBackup(
  backup
) {

  if (
    !isPlainObject(
      backup
    )
  ) {

    return {
      valid:
        false,

      message:
        "That file is not a valid Momo backup."
    };

  }


  if (
    backup.format !==
    MOMO_BACKUP_FORMAT
  ) {

    return {
      valid:
        false,

      message:
        "This is not a Momo backup file."
    };

  }


  if (
    Number(
      backup.backupVersion
    ) >
    MOMO_BACKUP_VERSION
  ) {

    return {
      valid:
        false,

      message:
        "This backup was created by a newer Momo backup format."
    };

  }


  if (
    Number(
      backup.backupVersion
    ) >=
      2
  ) {

    if (
      !isPlainObject(
        backup.storeSnapshots
      )
    ) {

      return {
        valid:
          false,
        message:
          "The full Momo database snapshot is missing."
      };

    }


    const requiredStores = [
      STORES.expenses,
      STORES.budgets,
      STORES.trips,
      STORES.cards,
      STORES.recurring,
      STORES.planned,
      STORES.settings
    ];


    const missingStore =
      requiredStores.find(
        (
          storeName
        ) =>
          !Array.isArray(
            backup.storeSnapshots[
              storeName
            ]
          )
      );


    if (
      missingStore
    ) {

      return {
        valid:
          false,
        message:
          `The backup is missing ${missingStore} data.`
      };

    }


    return {
      valid:
        true,
      message:
        ""
    };

  }


  if (
    !isPlainObject(
      backup.data
    )
  ) {

    return {
      valid:
        false,

      message:
        "Backup data is missing."
    };

  }


  const requiredArrays = [

    "expenses",
    "budgets",
    "trips",
    "recurringExpenses",
    "plannedExpenses"

  ];


  const invalidArray =
    requiredArrays.find(
      (key) =>
        !Array.isArray(
          backup.data[
            key
          ]
        )
    );


  if (
    invalidArray
  ) {

    return {
      valid:
        false,

      message:
        "The backup is incomplete or damaged."
    };

  }


  return {
    valid:
      true,

    message:
      ""
  };

}


function getBackupRestoreSummaryHTML(
  backup
) {

  const snapshots =
    getBackupStoreSnapshots(
      backup
    );


  const settings =
    snapshots[
      STORES.settings
    ] ||
    [];


  const getSetting =
    (
      key,
      fallback
    ) =>
      settings.find(
        (
          item
        ) =>
          item?.key ===
          key
      )?.value ??
      fallback;


  const expensesSnapshot =
    snapshots[
      STORES.expenses
    ] ||
    [];


  const templateSetting =
    getSetting(
      "favorite_expenses",
      []
    );


  const featureSummary =
    backup.featureSummary ||
    {
      expenses:
        expensesSnapshot.length,
      photos:
        expensesSnapshot.filter(
          (
            expense
          ) =>
            Boolean(
              expense.photo
            )
        ).length,
      budgets:
        (
          snapshots[
            STORES.budgets
          ] ||
          []
        ).length,
      trips:
        (
          snapshots[
            STORES.trips
          ] ||
          []
        ).length,
      templates:
        Array.isArray(
          templateSetting
        )
          ? templateSetting.length
          : (
              Array.isArray(
                backup.data
                  ?.favoriteExpenses
              )
                ? backup.data
                    .favoriteExpenses
                    .length
                : 0
            ),
      savingsGoals:
        Array.isArray(
          getSetting(
            SAVINGS_GOALS_SETTING_KEY,
            []
          )
        )
          ? getSetting(
              SAVINGS_GOALS_SETTING_KEY,
              []
            ).length
          : 0,
      settlements:
        Array.isArray(
          getSetting(
            TRAVEL_SETTLEMENT_SETTING_KEY,
            []
          )
        )
          ? getSetting(
              TRAVEL_SETTLEMENT_SETTING_KEY,
              []
            ).length
          : 0,
      shoppingItems:
        Array.isArray(
          getSetting(
            TRIP_SHOPPING_SETTING_KEY,
            []
          )
        )
          ? getSetting(
              TRIP_SHOPPING_SETTING_KEY,
              []
            ).length
          : 0
    };


  const exportedAt =
    backup.exportedAt
      ? new Date(
          backup.exportedAt
        )
      : null;


  const exportedText =
    exportedAt &&
    !Number.isNaN(
      exportedAt.getTime()
    )
      ? new Intl.DateTimeFormat(
          "en-US",
          {
            dateStyle:
              "medium",
            timeStyle:
              "short"
          }
        ).format(
          exportedAt
        )
      : "Unknown";


  return `

    <div class="restore-summary-date">
      <span>Backup created</span>
      <strong>${escapeHTML(
        exportedText
      )}</strong>
    </div>

    <div class="restore-summary-grid restore-summary-grid-expanded">
      <div><strong>${featureSummary.expenses || 0}</strong><span>Expenses</span></div>
      <div><strong>${featureSummary.photos || 0}</strong><span>Photos</span></div>
      <div><strong>${featureSummary.budgets || 0}</strong><span>Budgets</span></div>
      <div><strong>${featureSummary.trips || 0}</strong><span>Trips</span></div>
      <div><strong>${featureSummary.templates || 0}</strong><span>Templates</span></div>
      <div><strong>${featureSummary.savingsGoals || 0}</strong><span>Savings</span></div>
      <div><strong>${featureSummary.settlements || 0}</strong><span>Settlements</span></div>
      <div><strong>${featureSummary.shoppingItems || 0}</strong><span>Shopping</span></div>
    </div>

    <div class="restore-coverage-note">
      <span>✓</span>
      <p>
        ${
          Number(
            backup.backupVersion
          ) >=
          2
            ? "Full database snapshot detected."
            : "Older Momo backup detected. Compatible data will be restored."
        }
      </p>
    </div>

  `;

}


importMomoBackupFile?.addEventListener(
  "change",
  async () => {

    const file =
      importMomoBackupFile.files?.[
        0
      ];


    if (
      !file
    ) {

      return;

    }


    try {

      const text =
        await file.text();


      const backup =
        JSON.parse(
          text
        );


      const validation =
        validateMomoBackup(
          backup
        );


      if (
        !validation.valid
      ) {

        pendingBackupRestore =
          null;


        showToast(
          validation.message
        );


        return;

      }


      pendingBackupRestore =
        backup;


      const summary =
        document.getElementById(
          "restoreBackupSummary"
        );


      if (
        summary
      ) {

        summary.innerHTML =
          getBackupRestoreSummaryHTML(
            backup
          );

      }


      if (
        restoreBackupModal
      ) {

        restoreBackupModal.hidden =
          false;

      }

    } catch (
      error
    ) {

      console.error(
        "Backup import failed:",
        error
      );


      pendingBackupRestore =
        null;


      showToast(
        "Could not read that backup file."
      );

    }

  }
);


async function restoreRecords(
  storeName,
  records
) {

  await clearStore(
    storeName
  );


  for (
    const record of records
  ) {

    if (
      !isPlainObject(
        record
      )
    ) {

      continue;

    }


    await putRecord(
      storeName,
      record
    );

  }

}


async function restoreMomoBackup(
  backup
) {

  const snapshots =
    getBackupStoreSnapshots(
      backup
    );


  for (
    const storeName of Object.values(
      STORES
    )
  ) {

    await restoreRecords(
      storeName,
      Array.isArray(
        snapshots[
          storeName
        ]
      )
        ? snapshots[
            storeName
          ]
        : []
    );

  }


  if (
    Number(
      backup.backupVersion
    ) <
      2 &&
    Array.isArray(
      backup.data
        ?.favoriteExpenses
    )
  ) {

    favoriteExpenses =
      backup.data
        .favoriteExpenses;


    await saveFavoriteExpenses();

  }


  const preferences =
    isPlainObject(
      backup.preferences
    )
      ? backup.preferences
      : {};


  if (
    preferences.converterCurrencyA
  ) {

    localStorage.setItem(
      LOCAL_KEYS.converterA,
      preferences.converterCurrencyA
    );

  } else {

    localStorage.removeItem(
      LOCAL_KEYS.converterA
    );

  }


  if (
    preferences.converterCurrencyB
  ) {

    localStorage.setItem(
      LOCAL_KEYS.converterB,
      preferences.converterCurrencyB
    );

  } else {

    localStorage.removeItem(
      LOCAL_KEYS.converterB
    );

  }


  if (
    preferences.appearanceTheme
  ) {

    localStorage.setItem(
      LOCAL_KEYS.appearanceTheme,
      preferences.appearanceTheme
    );

  }


  if (
    preferences.appearanceWallpaperEnabled !==
      undefined &&
    preferences.appearanceWallpaperEnabled !==
      ""
  ) {

    localStorage.setItem(
      LOCAL_KEYS.appearanceWallpaperEnabled,
      String(
        preferences.appearanceWallpaperEnabled
      )
    );

  }


  if (
    preferences.appearanceOverlay
  ) {

    localStorage.setItem(
      LOCAL_KEYS.appearanceOverlay,
      preferences.appearanceOverlay
    );

  }


  if (
    preferences.appearanceTheme ||
    preferences.appearanceWallpaperEnabled !==
      undefined ||
    preferences.appearanceOverlay
  ) {

    localStorage.setItem(
      LOCAL_KEYS.appearanceLocalMigrated,
      "yes"
    );

  }


  await loadAppData();


  renderAll();


  initializeConverterCurrencies();

}


document
  .getElementById(
    "cancelRestoreBackup"
  )
  ?.addEventListener(
    "click",
    () => {

      pendingBackupRestore =
        null;


      if (
        restoreBackupModal
      ) {

        restoreBackupModal.hidden =
          true;

      }

    }
  );


document
  .getElementById(
    "confirmRestoreBackup"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !pendingBackupRestore
      ) {

        return;

      }


      const restoreButton =
        document.getElementById(
          "confirmRestoreBackup"
        );


      if (
        restoreButton
      ) {

        restoreButton.disabled =
          true;

      }


      try {

        const backup =
          pendingBackupRestore;


        const safetyBackup =
          await buildMomoBackup();


        downloadTextFile(
          `momo-before-restore-${formatBackupFileDate()}.json`,
          JSON.stringify(
            safetyBackup,
            null,
            2
          ),
          "application/json"
        );


        await restoreMomoBackup(
          backup
        );


        pendingBackupRestore =
          null;


        if (
          restoreBackupModal
        ) {

          restoreBackupModal.hidden =
            true;

        }


        renderBackupStatus();


        showToast(
          "Backup restored ✨ · safety copy downloaded"
        );

      } catch (
        error
      ) {

        console.error(
          "Backup restore failed:",
          error
        );


        showToast(
          "Restore failed. Your backup file was not deleted."
        );

      } finally {

        if (
          restoreButton
        ) {

          restoreButton.disabled =
            false;

        }

      }

    }
  );


restoreBackupModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      restoreBackupModal
    ) {

      pendingBackupRestore =
        null;


      restoreBackupModal.hidden =
        true;

    }

  }
);


function renderBackupStatus() {

  const mappings = [
    [
      "backupExpenseCount",
      expenses.length
    ],
    [
      "backupPhotoCount",
      expenses.filter(
        (
          expense
        ) =>
          Boolean(
            expense.photo
          )
      ).length
    ],
    [
      "backupBudgetCount",
      budgets.length
    ],
    [
      "backupTripCount",
      trips.length
    ],
    [
      "backupPayableCount",
      cards.length
    ],
    [
      "backupRecurringCount",
      recurringExpenses.length
    ],
    [
      "backupPlannedCount",
      plannedExpenses.length
    ],
    [
      "backupFavoriteCount",
      favoriteExpenses.length
    ],
    [
      "backupSavingsCount",
      savingsGoals.length
    ],
    [
      "backupSettlementCount",
      travelSettlements.length
    ],
    [
      "backupShoppingCount",
      tripShoppingItems.length
    ]
  ];


  mappings.forEach(
    (
      [
        id,
        value
      ]
    ) => {

      const element =
        document.getElementById(
          id
        );


      if (
        element
      ) {

        element.textContent =
          String(
            value
          );

      }

    }
  );


  const coverage =
    document.getElementById(
      "backupCoverageText"
    );


  if (
    coverage
  ) {

    coverage.textContent =
      `Full backup includes ${Object.values(
        STORES
      ).length} database stores, including Payables, plus local converter preferences.`;

  }

}



// ========================================
// TRAVEL SETTLEMENT
// ========================================

const settlementTripSelect =
  document.getElementById(
    "settlementTripSelect"
  );


const settlementPersonModal =
  document.getElementById(
    "settlementPersonModal"
  );


const settlementPersonForm =
  document.getElementById(
    "settlementPersonForm"
  );


const sharedExpenseModal =
  document.getElementById(
    "sharedExpenseModal"
  );


const sharedExpenseForm =
  document.getElementById(
    "sharedExpenseForm"
  );


const settlementPaymentModal =
  document.getElementById(
    "settlementPaymentModal"
  );



const settlementCategoryModal =
  document.getElementById(
    "settlementCategoryModal"
  );


const settlementCategoryForm =
  document.getElementById(
    "settlementCategoryForm"
  );


const settlementPaymentForm =
  document.getElementById(
    "settlementPaymentForm"
  );


function createEmptyTravelSettlement(
  tripId
) {

  const linkedTrip =
    trips.find(
      (
        trip
      ) =>
        trip.id ===
        tripId
    );


  const isDailyLife =
    tripId ===
      DAILY_LIFE_SETTLEMENT_ID;


  const isCategory =
    isSettlementCategoryId(
      tripId
    );


  return {
    tripId:
      tripId,
    kind:
      isDailyLife
        ? "daily-life"
        : (
            isCategory
              ? "category"
              : "trip"
          ),
    name:
      isDailyLife
        ? "Daily Life"
        : (
            linkedTrip?.name ||
            ""
          ),
    emoji:
      isDailyLife
        ? "🏠"
        : "",
    currency:
      isDailyLife
        ? "PHP"
        : (
            linkedTrip?.currency ||
            "PHP"
          ),
    people: [
      {
        id:
          generateId(
            "person"
          ),
        name:
          "You",
        isYou:
          true,
        createdAt:
          new Date()
            .toISOString()
      }
    ],
    expenses: [],
    payments: [],
    createdAt:
      new Date()
        .toISOString(),
    updatedAt:
      new Date()
        .toISOString()
  };

}


function getSettlementForTrip(
  tripId,
  createIfMissing =
    false
) {

  let settlement =
    travelSettlements.find(
      (
        item
      ) =>
        item.tripId ===
        tripId
    );


  if (
    !settlement &&
    createIfMissing &&
    tripId
  ) {

    settlement =
      createEmptyTravelSettlement(
        tripId
      );


    travelSettlements.push(
      settlement
    );

  }


  return settlement ||
    null;

}


function getActiveSettlementTrip() {

  if (
    activeSettlementTripId ===
      DAILY_LIFE_SETTLEMENT_ID
  ) {

    const settlement =
      getSettlementForTrip(
        DAILY_LIFE_SETTLEMENT_ID,
        false
      );


    return {
      id:
        DAILY_LIFE_SETTLEMENT_ID,
      name:
        "Daily Life",
      destination:
        "Everyday",
      currency:
        settlement?.currency ||
        "PHP",
      emoji:
        "🏠",
      isDailyLife:
        true
    };

  }


  if (
    isSettlementCategoryId(
      activeSettlementTripId
    )
  ) {

    const settlement =
      getSettlementForTrip(
        activeSettlementTripId,
        false
      );


    if (
      settlement
    ) {

      return {
        id:
          settlement.tripId,
        name:
          settlement.name ||
          "Shared Category",
        destination:
          settlement.name ||
          "Shared Category",
        currency:
          settlement.currency ||
          "PHP",
        emoji:
          settlement.emoji ||
          "🤝",
        isCategory:
          true
      };

    }

  }


  return trips.find(
    (
      trip
    ) =>
      trip.id ===
      activeSettlementTripId
  ) ||
    null;

}


function getActiveTravelSettlement(
  createIfMissing =
    false
) {

  return getSettlementForTrip(
    activeSettlementTripId,
    createIfMissing
  );

}


function getSettlementPerson(
  settlement,
  personId
) {

  return settlement?.people?.find(
    (
      person
    ) =>
      person.id ===
      personId
  ) ||
    null;

}


async function saveTravelSettlements() {

  await putRecord(
    STORES.settings,
    {
      key:
        TRAVEL_SETTLEMENT_SETTING_KEY,
      value:
        travelSettlements,
      updatedAt:
        new Date()
          .toISOString()
    }
  );

}


function formatSettlementAmount(
  amount,
  currency
) {

  return formatCurrency(
    Number(
      amount ||
      0
    ),
    currency ||
      "PHP"
  );

}


function normalizeSharedExpenseShares(
  expense
) {

  const shares =
    Array.isArray(
      expense?.shares
    )
      ? expense.shares
      : [];


  return shares.filter(
    (
      share
    ) =>
      share &&
      share.personId &&
      Number(
        share.amount
      ) >=
      0
  );

}



function getLinkedExpenseSettlementEntries(
  settlement
) {

  if (
    !settlement?.tripId
  ) {

    return [];

  }


  const trip =
    trips.find(
      (
        item
      ) =>
        item.id ===
        settlement.tripId
    );


  if (
    !trip
  ) {

    return [];

  }


  return expenses
    .filter(
      (
        expense
      ) =>
        expense.tripId ===
          settlement.tripId &&
        Boolean(
          expense.settlementShared
        ) &&
        Boolean(
          expense.settlementPayerId
        ) &&
        Array.isArray(
          expense.settlementShares
        ) &&
        expense.settlementShares.length >
          0
    )
    .map(
      (
        expense
      ) => {

        const settlementAmount =
          Number(
            expense.settlementAmount
          ) >
          0
            ? Number(
                expense.settlementAmount
              )
            : convertCurrency(
                expense.amount,
                expense.currency,
                trip.currency ||
                  "PHP"
              );


        return {
          id:
            `linked_${expense.id}`,
          source:
            "expense",
          sourceExpenseId:
            expense.id,
          title:
            expense.title,
          amount:
            settlementAmount,
          currency:
            trip.currency ||
            "PHP",
          originalAmount:
            expense.amount,
          originalCurrency:
            expense.currency,
          date:
            expense.date,
          payerId:
            expense.settlementPayerId,
          splitMode:
            expense.settlementSplitMode ||
            "equal",
          shares:
            expense.settlementShares,
          notes:
            expense.notes ||
            "",
          createdAt:
            expense.createdAt,
          updatedAt:
            expense.updatedAt
        };

      }
    );

}


function getAllSettlementExpenseEntries(
  settlement
) {

  return [
    ...(
      settlement?.expenses ||
      []
    ).map(
      (
        expense
      ) => ({
        ...expense,
        source:
          expense.source ||
          "settlement"
      })
    ),
    ...getLinkedExpenseSettlementEntries(
      settlement
    )
  ];

}


function calculateSettlementBalances(
  settlement
) {

  const balances =
    {};


  (
    settlement?.people ||
    []
  ).forEach(
    (
      person
    ) => {

      balances[
        person.id
      ] =
        0;

    }
  );


  getAllSettlementExpenseEntries(
    settlement
  ).forEach(
    (
      expense
    ) => {

      const amount =
        Number(
          expense.amount ||
          0
        );


      if (
        amount <=
        0 ||
        !balances.hasOwnProperty(
          expense.payerId
        )
      ) {

        return;

      }


      balances[
        expense.payerId
      ] +=
        amount;


      normalizeSharedExpenseShares(
        expense
      ).forEach(
        (
          share
        ) => {

          if (
            balances.hasOwnProperty(
              share.personId
            )
          ) {

            balances[
              share.personId
            ] -=
              Number(
                share.amount ||
                0
              );

          }

        }
      );

    }
  );


  (
    settlement?.payments ||
    []
  ).forEach(
    (
      payment
    ) => {

      const amount =
        Number(
          payment.amount ||
          0
        );


      if (
        amount <=
        0
      ) {

        return;

      }


      if (
        balances.hasOwnProperty(
          payment.fromId
        )
      ) {

        balances[
          payment.fromId
        ] +=
          amount;

      }


      if (
        balances.hasOwnProperty(
          payment.toId
        )
      ) {

        balances[
          payment.toId
        ] -=
          amount;

      }

    }
  );


  return balances;

}


function calculateSettlementTransfers(
  settlement
) {

  const balances =
    calculateSettlementBalances(
      settlement
    );


  const epsilon =
    0.005;


  const creditors =
    Object.entries(
      balances
    )
      .filter(
        (
          [
            ,
            amount
          ]
        ) =>
          amount >
          epsilon
      )
      .map(
        (
          [
            personId,
            amount
          ]
        ) => ({
          personId,
          amount
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.amount -
          a.amount
      );


  const debtors =
    Object.entries(
      balances
    )
      .filter(
        (
          [
            ,
            amount
          ]
        ) =>
          amount <
          -epsilon
      )
      .map(
        (
          [
            personId,
            amount
          ]
        ) => ({
          personId,
          amount:
            Math.abs(
              amount
            )
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.amount -
          a.amount
      );


  const transfers =
    [];


  let debtorIndex =
    0;


  let creditorIndex =
    0;


  while (
    debtorIndex <
      debtors.length &&
    creditorIndex <
      creditors.length
  ) {

    const debtor =
      debtors[
        debtorIndex
      ];


    const creditor =
      creditors[
        creditorIndex
      ];


    const amount =
      Math.min(
        debtor.amount,
        creditor.amount
      );


    if (
      amount >
      epsilon
    ) {

      transfers.push(
        {
          fromId:
            debtor.personId,
          toId:
            creditor.personId,
          amount:
            amount
        }
      );

    }


    debtor.amount -=
      amount;


    creditor.amount -=
      amount;


    if (
      debtor.amount <=
      epsilon
    ) {

      debtorIndex++;

    }


    if (
      creditor.amount <=
      epsilon
    ) {

      creditorIndex++;

    }

  }


  return transfers;

}


function getSettlementTripCurrency() {

  const settlement =
    getActiveTravelSettlement(
      false
    );


  return (
    settlement?.currency ||
    getActiveSettlementTrip()
      ?.currency ||
    "PHP"
  );

}


function renderSettlementTripOptions() {

  if (
    !settlementTripSelect
  ) {

    return;

  }


  const previous =
    activeSettlementTripId ||
    settlementTripSelect.value ||
    DAILY_LIFE_SETTLEMENT_ID;


  const categorySettlements =
    travelSettlements
      .filter(
        (
          settlement
        ) =>
          settlement?.kind ===
            "category" ||
          isSettlementCategoryId(
            settlement?.tripId
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          String(
            a.name ||
            ""
          ).localeCompare(
            String(
              b.name ||
              ""
            )
          )
      );


  settlementTripSelect.innerHTML =
    `
      <option value="${DAILY_LIFE_SETTLEMENT_ID}">
        🏠 Daily Life
      </option>
    ` +
    (
      categorySettlements.length
        ? `
            <optgroup label="My Categories">
              ${categorySettlements
                .map(
                  (
                    settlement
                  ) =>
                    `
                      <option value="${escapeHTML(
                        settlement.tripId
                      )}">
                        ${escapeHTML(
                          settlement.emoji ||
                          "🤝"
                        )} ${escapeHTML(
                          settlement.name ||
                          "Shared Category"
                        )}
                      </option>
                    `
                )
                .join("")}
            </optgroup>
          `
        : ""
    ) +
    (
      trips.length
        ? `
            <optgroup label="Trips">
              ${trips
                .map(
                  (
                    trip
                  ) =>
                    `
                      <option value="${escapeHTML(
                        trip.id
                      )}">
                        ✈ ${escapeHTML(
                          trip.name
                        )}
                      </option>
                    `
                )
                .join("")}
            </optgroup>
          `
        : ""
    );


  const validSelection =
    previous ===
      DAILY_LIFE_SETTLEMENT_ID ||
    categorySettlements.some(
      (
        settlement
      ) =>
        settlement.tripId ===
        previous
    ) ||
    trips.some(
      (
        trip
      ) =>
        trip.id ===
        previous
    );


  activeSettlementTripId =
    validSelection
      ? previous
      : DAILY_LIFE_SETTLEMENT_ID;


  settlementTripSelect.value =
    activeSettlementTripId;


  getActiveTravelSettlement(
    true
  );

}


function renderSettlementPeople(
  settlement
) {

  const container =
    document.getElementById(
      "settlementPeopleList"
    );


  if (
    !container
  ) {

    return;

  }


  container.innerHTML =
    (
      settlement.people ||
      []
    )
      .map(
        (
          person
        ) =>
          `

            <div class="settlement-person-chip">

              <span class="settlement-person-avatar">
                ${escapeHTML(
                  (
                    person.name ||
                    "?"
                  )
                    .slice(
                      0,
                      1
                    )
                    .toUpperCase()
                )}
              </span>

              <span class="settlement-person-name">
                ${escapeHTML(
                  person.name
                )}
                ${
                  person.isYou
                    ? `<small>You</small>`
                    : ""
                }
              </span>

              <button
                type="button"
                data-edit-settlement-person="${escapeHTML(
                  person.id
                )}"
                aria-label="Edit ${escapeHTML(
                  person.name
                )}"
              >
                ✎
              </button>

              ${
                person.isYou
                  ? ""
                  : `
                      <button
                        type="button"
                        class="settlement-person-remove"
                        data-remove-settlement-person="${escapeHTML(
                          person.id
                        )}"
                        aria-label="Remove ${escapeHTML(
                          person.name
                        )}"
                      >
                        ×
                      </button>
                    `
              }

            </div>

          `
      )
      .join("");


  container
    .querySelectorAll(
      "[data-edit-settlement-person]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            const person =
              getSettlementPerson(
                settlement,
                button.dataset
                  .editSettlementPerson
              );


            if (
              person
            ) {

              openSettlementPersonModal(
                person
              );

            }

          }
        );

      }
    );


  container
    .querySelectorAll(
      "[data-remove-settlement-person]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          async () => {

            const personId =
              button.dataset
                .removeSettlementPerson;


            const isUsed =
              getAllSettlementExpenseEntries(
                settlement
              ).some(
                (
                  expense
                ) =>
                  expense.payerId ===
                    personId ||
                  normalizeSharedExpenseShares(
                    expense
                  ).some(
                    (
                      share
                    ) =>
                      share.personId ===
                      personId
                  )
              ) ||
              (
                settlement.payments ||
                []
              ).some(
                (
                  payment
                ) =>
                  payment.fromId ===
                    personId ||
                  payment.toId ===
                    personId
              );


            if (
              isUsed
            ) {

              showToast(
                "This person is already used in settlement history."
              );


              return;

            }


            settlement.people =
              settlement.people.filter(
                (
                  person
                ) =>
                  person.id !==
                  personId
              );


            settlement.updatedAt =
              new Date()
                .toISOString();


            await saveTravelSettlements();


            renderTravelSettlement();

          }
        );

      }
    );

}


function renderSettlementBalances(
  settlement,
  currency
) {

  const container =
    document.getElementById(
      "settlementBalanceList"
    );


  if (
    !container
  ) {

    return;

  }


  const transfers =
    calculateSettlementTransfers(
      settlement
    );


  if (
    transfers.length ===
    0
  ) {

    container.innerHTML =
      `
        <div class="settlement-balanced-card">
          <span>✨</span>
          <div>
            <strong>Everyone is settled up</strong>
            <small>No one owes anyone right now.</small>
          </div>
        </div>
      `;


    return;

  }


  container.innerHTML =
    transfers
      .map(
        (
          transfer
        ) => {

          const from =
            getSettlementPerson(
              settlement,
              transfer.fromId
            );


          const to =
            getSettlementPerson(
              settlement,
              transfer.toId
            );


          return `
            <div class="settlement-balance-card">
              <div>
                <strong>
                  ${escapeHTML(
                    from?.name ||
                    "Someone"
                  )}
                </strong>
                <span>pays</span>
                <strong>
                  ${escapeHTML(
                    to?.name ||
                    "Someone"
                  )}
                </strong>
              </div>

              <b>
                ${formatSettlementAmount(
                  transfer.amount,
                  currency
                )}
              </b>

              <button
                type="button"
                data-quick-settle-from="${escapeHTML(
                  transfer.fromId
                )}"
                data-quick-settle-to="${escapeHTML(
                  transfer.toId
                )}"
                data-quick-settle-amount="${transfer.amount}"
              >
                Settle
              </button>
            </div>
          `;

        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-quick-settle-from]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            openSettlementPaymentModal(
              {
                fromId:
                  button.dataset
                    .quickSettleFrom,
                toId:
                  button.dataset
                    .quickSettleTo,
                amount:
                  Number(
                    button.dataset
                      .quickSettleAmount
                  )
              }
            );

          }
        );

      }
    );

}


function renderSettlementExpenses(
  settlement,
  currency
) {

  const list =
    document.getElementById(
      "settlementExpenseList"
    );


  const empty =
    document.getElementById(
      "settlementExpenseEmpty"
    );


  const count =
    document.getElementById(
      "settlementExpenseCount"
    );


  if (
    !list ||
    !empty
  ) {

    return;

  }


  const expensesList =
    getAllSettlementExpenseEntries(
      settlement
    )
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          String(
            b.date ||
            ""
          ).localeCompare(
            String(
              a.date ||
              ""
            )
          )
      );


  if (
    count
  ) {

    count.textContent =
      String(
        expensesList.length
      );

  }


  empty.hidden =
    expensesList.length >
    0;


  list.innerHTML =
    expensesList
      .map(
        (
          expense
        ) => {

          const payer =
            getSettlementPerson(
              settlement,
              expense.payerId
            );


          const shares =
            normalizeSharedExpenseShares(
              expense
            );


          return `
            <article class="settlement-history-card">

              <div class="settlement-history-main">

                <div class="settlement-history-icon">
                  🍽️
                </div>

                <div>
                  <strong>
                    ${escapeHTML(
                      expense.title
                    )}
                  </strong>

                  <span>
                    ${escapeHTML(
                      formatDate(
                        expense.date
                      )
                    )}
                    ·
                    Paid by
                    ${escapeHTML(
                      payer?.name ||
                      "Unknown"
                    )}
                  </span>

                  <small>
                    Split between
                    ${shares
                      .map(
                        (
                          share
                        ) =>
                          escapeHTML(
                            getSettlementPerson(
                              settlement,
                              share.personId
                            )?.name ||
                            "Unknown"
                          )
                      )
                      .join(", ")}
                  </small>
                </div>

                <b class="settlement-history-amount">
                  ${
                    expense.originalCurrency &&
                    expense.originalCurrency !==
                      currency
                      ? `
                          <span>
                            ${formatCurrency(
                              expense.originalAmount ??
                              expense.amount,
                              expense.originalCurrency
                            )}
                          </span>
                          <small>
                            ≈ ${formatSettlementAmount(
                              expense.amount,
                              currency
                            )}
                          </small>
                        `
                      : formatSettlementAmount(
                          expense.amount,
                          currency
                        )
                  }
                </b>

              </div>

              <div class="settlement-history-actions">

                ${
                  expense.source ===
                  "expense"
                    ? `
                        <button
                          type="button"
                          class="settlement-linked-expense-action"
                          data-open-linked-expense="${escapeHTML(
                            expense.sourceExpenseId
                          )}"
                        >
                          Open Expense
                        </button>

                        <span class="settlement-linked-badge">
                          Linked from Momo
                        </span>
                      `
                    : `
                        <button
                          type="button"
                          data-edit-shared-expense="${escapeHTML(
                            expense.id
                          )}"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          class="danger"
                          data-delete-shared-expense="${escapeHTML(
                            expense.id
                          )}"
                        >
                          Delete
                        </button>
                      `
                }

              </div>

            </article>
          `;

        }
      )
      .join("");


  list
    .querySelectorAll(
      "[data-open-linked-expense]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            const expense =
              expenses.find(
                (
                  item
                ) =>
                  item.id ===
                  button.dataset
                    .openLinkedExpense
              );


            if (
              expense
            ) {

              openExpenseEditor(
                expense
              );

            }

          }
        );

      }
    );


  list
    .querySelectorAll(
      "[data-edit-shared-expense]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            const expense =
              settlement.expenses.find(
                (
                  item
                ) =>
                  item.id ===
                  button.dataset
                    .editSharedExpense
              );


            if (
              expense
            ) {

              openSharedExpenseModal(
                expense
              );

            }

          }
        );

      }
    );


  list
    .querySelectorAll(
      "[data-delete-shared-expense]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          async () => {

            const confirmed =
              window.confirm(
                "Delete this shared expense from the settlement?"
              );


            if (
              !confirmed
            ) {

              return;

            }


            settlement.expenses =
              settlement.expenses.filter(
                (
                  expense
                ) =>
                  expense.id !==
                  button.dataset
                    .deleteSharedExpense
              );


            settlement.updatedAt =
              new Date()
                .toISOString();


            await saveTravelSettlements();


            renderTravelSettlement();


            showToast(
              "Shared expense deleted"
            );

          }
        );

      }
    );

}


function renderSettlementPayments(
  settlement,
  currency
) {

  const list =
    document.getElementById(
      "settlementPaymentList"
    );


  const empty =
    document.getElementById(
      "settlementPaymentEmpty"
    );


  if (
    !list ||
    !empty
  ) {

    return;

  }


  const payments =
    (
      settlement.payments ||
      []
    )
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          String(
            b.date ||
            ""
          ).localeCompare(
            String(
              a.date ||
              ""
            )
          )
      );


  empty.hidden =
    payments.length >
    0;


  list.innerHTML =
    payments
      .map(
        (
          payment
        ) => {

          const from =
            getSettlementPerson(
              settlement,
              payment.fromId
            );


          const to =
            getSettlementPerson(
              settlement,
              payment.toId
            );


          return `
            <div class="settlement-payment-card">

              <div>
                <strong>
                  ${escapeHTML(
                    from?.name ||
                    "Someone"
                  )}
                  → 
                  ${escapeHTML(
                    to?.name ||
                    "Someone"
                  )}
                </strong>

                <span>
                  ${escapeHTML(
                    formatDate(
                      payment.date
                    )
                  )}
                  ${
                    payment.note
                      ? `· ${escapeHTML(
                          payment.note
                        )}`
                      : ""
                  }
                </span>
              </div>

              <b>
                ${formatSettlementAmount(
                  payment.amount,
                  currency
                )}
              </b>

              <button
                type="button"
                data-delete-settlement-payment="${escapeHTML(
                  payment.id
                )}"
                aria-label="Delete payment"
              >
                ×
              </button>

            </div>
          `;

        }
      )
      .join("");


  list
    .querySelectorAll(
      "[data-delete-settlement-payment]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          async () => {

            settlement.payments =
              settlement.payments.filter(
                (
                  payment
                ) =>
                  payment.id !==
                  button.dataset
                    .deleteSettlementPayment
              );


            settlement.updatedAt =
              new Date()
                .toISOString();


            await saveTravelSettlements();


            renderTravelSettlement();


            showToast(
              "Settlement payment removed"
            );

          }
        );

      }
    );

}


function renderTravelSettlement() {

  renderSettlementTripOptions();


  const workspace =
    document.getElementById(
      "settlementWorkspace"
    );


  const noTrips =
    document.getElementById(
      "settlementNoTrips"
    );


  const hint =
    document.getElementById(
      "settlementTripHint"
    );


  if (
    noTrips
  ) {

    noTrips.hidden =
      true;

  }


  if (
    settlementTripSelect
  ) {

    settlementTripSelect.disabled =
      false;

  }


  if (
    !activeSettlementTripId
  ) {

    activeSettlementTripId =
      DAILY_LIFE_SETTLEMENT_ID;

  }


  const context =
    getActiveSettlementTrip();


  if (
    !context
  ) {

    activeSettlementTripId =
      DAILY_LIFE_SETTLEMENT_ID;


    renderTravelSettlement();


    return;

  }


  const settlement =
    getActiveTravelSettlement(
      true
    );


  if (
    !settlement
  ) {

    return;

  }


  if (
    !settlement.currency
  ) {

    settlement.currency =
      context.currency ||
      "PHP";

  }


  const currency =
    settlement.currency ||
    context.currency ||
    "PHP";


  if (
    workspace
  ) {

    workspace.hidden =
      false;

  }


  if (
    hint
  ) {

    hint.textContent =
      context.isDailyLife
        ? `Everyday shared costs · ${currency} settlement · Great for meals, groceries, dates, Grab, and household spending.`
        : (
            context.isCategory
              ? `${context.emoji || "🤝"} ${context.name} · ${currency} settlement · Your own shared-expense category.`
              : `${context.destination || context.name} · ${currency} settlement · Linked trip expenses can appear here automatically.`
          );

  }


  const totalShared =
    getAllSettlementExpenseEntries(
      settlement
    ).reduce(
      (
        total,
        expense
      ) =>
        total +
        Number(
          expense.amount ||
          0
        ),
      0
    );


  const transfers =
    calculateSettlementTransfers(
      settlement
    );


  document.getElementById(
    "settlementSharedTotal"
  ).textContent =
    formatSettlementAmount(
      totalShared,
      currency
    );


  document.getElementById(
    "settlementPeopleCount"
  ).textContent =
    String(
      settlement.people.length
    );


  document.getElementById(
    "settlementUnsettledCount"
  ).textContent =
    String(
      transfers.length
    );


  renderSettlementPeople(
    settlement
  );


  renderSettlementBalances(
    settlement,
    currency
  );


  renderSettlementExpenses(
    settlement,
    currency
  );


  renderSettlementPayments(
    settlement,
    currency
  );


  const categoryActions =
    document.getElementById(
      "settlementCategoryActions"
    );


  if (
    categoryActions
  ) {

    categoryActions.hidden =
      !context.isCategory;

  }

}


function populateSettlementPersonSelects() {

  const settlement =
    getActiveTravelSettlement(
      true
    );


  if (
    !settlement
  ) {

    return;

  }


  const options =
    settlement.people
      .map(
        (
          person
        ) =>
          `
            <option value="${escapeHTML(
              person.id
            )}">
              ${escapeHTML(
                person.name
              )}
            </option>
          `
      )
      .join("");


  [
    "sharedExpensePayer",
    "settlementPaymentFrom",
    "settlementPaymentTo"
  ].forEach(
    (
      id
    ) => {

      const select =
        document.getElementById(
          id
        );


      if (
        select
      ) {

        select.innerHTML =
          options;

      }

    }
  );

}


function openSettlementCategoryModal() {

  if (
    !settlementCategoryModal
  ) {

    return;

  }


  document.getElementById(
    "settlementCategoryName"
  ).value =
    "";


  document.getElementById(
    "settlementCategoryEmoji"
  ).value =
    "🍽️";


  document.getElementById(
    "settlementCategoryCurrency"
  ).value =
    "PHP";


  settlementCategoryModal.hidden =
    false;


  document.body.classList.add(
    "drawer-open"
  );


  requestAnimationFrame(
    () =>
      document.getElementById(
        "settlementCategoryName"
      )?.focus()
  );

}


function closeSettlementCategoryModal() {

  if (
    settlementCategoryModal
  ) {

    settlementCategoryModal.hidden =
      true;

  }


  document.body.classList.remove(
    "drawer-open"
  );

}


function openSettlementPersonModal(
  person =
    null
) {

  if (
    !settlementPersonModal
  ) {

    return;

  }


  document.getElementById(
    "settlementPersonTitle"
  ).textContent =
    person
      ? "Edit Person"
      : "Add Person";


  document.getElementById(
    "settlementPersonId"
  ).value =
    person?.id ||
    "";


  document.getElementById(
    "settlementPersonName"
  ).value =
    person?.name ||
    "";


  settlementPersonModal.hidden =
    false;


  document.body.classList.add(
    "drawer-open"
  );


  requestAnimationFrame(
    () =>
      document.getElementById(
        "settlementPersonName"
      )?.focus()
  );

}


function closeSettlementPersonModal() {

  if (
    settlementPersonModal
  ) {

    settlementPersonModal.hidden =
      true;

  }


  document.body.classList.remove(
    "drawer-open"
  );

}


function renderSharedExpenseParticipants(
  expense =
    null
) {

  const settlement =
    getActiveTravelSettlement(
      true
    );


  const container =
    document.getElementById(
      "sharedExpenseParticipants"
    );


  const splitMode =
    document.getElementById(
      "sharedExpenseSplitMode"
    )?.value ||
    "equal";


  if (
    !settlement ||
    !container
  ) {

    return;

  }


  const existingShares =
    new Map(
      normalizeSharedExpenseShares(
        expense
      ).map(
        (
          share
        ) => [
          share.personId,
          Number(
            share.amount ||
            0
          )
        ]
      )
    );


  container.innerHTML =
    settlement.people
      .map(
        (
          person
        ) => {

          const isSelected =
            expense
              ? existingShares.has(
                  person.id
                )
              : true;


          return `
            <label class="shared-participant-row">

              <input
                type="checkbox"
                data-shared-person="${escapeHTML(
                  person.id
                )}"
                ${
                  isSelected
                    ? "checked"
                    : ""
                }
              >

              <span class="shared-participant-avatar">
                ${escapeHTML(
                  person.name
                    .slice(
                      0,
                      1
                    )
                    .toUpperCase()
                )}
              </span>

              <strong>
                ${escapeHTML(
                  person.name
                )}
              </strong>

              ${
                splitMode ===
                "exact"
                  ? `
                      <input
                        class="shared-exact-amount"
                        type="number"
                        inputmode="decimal"
                        min="0"
                        step="0.01"
                        data-shared-exact="${escapeHTML(
                          person.id
                        )}"
                        value="${
                          existingShares.has(
                            person.id
                          )
                            ? existingShares.get(
                                person.id
                              )
                            : ""
                        }"
                        placeholder="0"
                      >
                    `
                  : `
                      <span class="shared-equal-label">
                        Equal
                      </span>
                    `
              }

            </label>
          `;

        }
      )
      .join("");

}


function updateSharedExpenseValidation() {

  const validation =
    document.getElementById(
      "sharedExpenseValidation"
    );


  const splitMode =
    document.getElementById(
      "sharedExpenseSplitMode"
    )?.value ||
    "equal";


  const amount =
    Number(
      document.getElementById(
        "sharedExpenseAmount"
      )?.value ||
      0
    );


  if (
    !validation
  ) {

    return;

  }


  if (
    splitMode ===
    "equal"
  ) {

    const checked =
      document.querySelectorAll(
        "#sharedExpenseParticipants [data-shared-person]:checked"
      ).length;


    validation.textContent =
      checked
        ? `${checked} ${
            checked ===
            1
              ? "person"
              : "people"
          } sharing this expense equally.`
        : "Choose at least one person.";


    validation.classList.toggle(
      "error",
      checked ===
      0
    );


    return;

  }


  const exactTotal =
    Array.from(
      document.querySelectorAll(
        "#sharedExpenseParticipants [data-shared-exact]"
      )
    ).reduce(
      (
        total,
        input
      ) => {

        const checkbox =
          document.querySelector(
            `[data-shared-person="${CSS.escape(
              input.dataset
                .sharedExact
            )}"]`
          );


        return total +
          (
            checkbox?.checked
              ? Number(
                  input.value ||
                  0
                )
              : 0
          );

      },
      0
    );


  const difference =
    Math.abs(
      amount -
      exactTotal
    );


  validation.textContent =
    amount > 0
      ? `Assigned ${formatSettlementAmount(
          exactTotal,
          getSettlementTripCurrency()
        )} of ${formatSettlementAmount(
          amount,
          getSettlementTripCurrency()
        )}.`
      : "Enter the expense amount first.";


  validation.classList.toggle(
    "error",
    amount >
      0 &&
    difference >
      0.01
  );

}


function openSharedExpenseModal(
  expense =
    null
) {

  const settlement =
    getActiveTravelSettlement(
      true
    );


  const trip =
    getActiveSettlementTrip();


  if (
    !settlement ||
    !trip ||
    settlement.people.length ===
    0 ||
    !sharedExpenseModal
  ) {

    return;

  }


  editingSharedExpenseId =
    expense?.id ||
    "";


  populateSettlementPersonSelects();


  document.getElementById(
    "sharedExpenseModalTitle"
  ).textContent =
    expense
      ? "Edit Shared Expense"
      : "Add Shared Expense";


  document.getElementById(
    "sharedExpenseId"
  ).value =
    expense?.id ||
    "";


  document.getElementById(
    "sharedExpenseTitle"
  ).value =
    expense?.title ||
    "";


  document.getElementById(
    "sharedExpenseAmount"
  ).value =
    expense?.originalAmount ??
    expense?.amount ??
    "";


  document.getElementById(
    "sharedExpenseCurrency"
  ).value =
    expense?.originalCurrency ||
    expense?.currency ||
    trip.currency ||
    "PHP";


  document.getElementById(
    "sharedExpenseCurrency"
  ).disabled =
    false;


  document.getElementById(
    "sharedExpenseDate"
  ).value =
    expense?.date ||
    getTodayString();


  document.getElementById(
    "sharedExpensePayer"
  ).value =
    expense?.payerId ||
    settlement.people[
      0
    ].id;


  document.getElementById(
    "sharedExpenseSplitMode"
  ).value =
    expense?.splitMode ||
    "equal";


  document.getElementById(
    "sharedExpenseNotes"
  ).value =
    expense?.notes ||
    "";


  renderSharedExpenseParticipants(
    expense
  );


  updateSharedExpenseValidation();


  sharedExpenseModal.hidden =
    false;


  document.body.classList.add(
    "drawer-open"
  );

}


function closeSharedExpenseModal() {

  if (
    sharedExpenseModal
  ) {

    sharedExpenseModal.hidden =
      true;

  }


  editingSharedExpenseId =
    "";


  document.body.classList.remove(
    "drawer-open"
  );

}


function openSettlementPaymentModal(
  preset =
    null
) {

  const settlement =
    getActiveTravelSettlement(
      true
    );


  if (
    !settlement ||
    settlement.people.length <
      2 ||
    !settlementPaymentModal
  ) {

    showToast(
      "Add at least two people first."
    );


    return;

  }


  populateSettlementPersonSelects();


  document.getElementById(
    "settlementPaymentFrom"
  ).value =
    preset?.fromId ||
    settlement.people[
      0
    ].id;


  document.getElementById(
    "settlementPaymentTo"
  ).value =
    preset?.toId ||
    settlement.people[
      1
    ].id;


  document.getElementById(
    "settlementPaymentAmount"
  ).value =
    preset?.amount
      ? Number(
          preset.amount
        ).toFixed(
          2
        )
      : "";


  document.getElementById(
    "settlementPaymentDate"
  ).value =
    getTodayString();


  document.getElementById(
    "settlementPaymentNote"
  ).value =
    "";


  settlementPaymentModal.hidden =
    false;


  document.body.classList.add(
    "drawer-open"
  );

}


function closeSettlementPaymentModal() {

  if (
    settlementPaymentModal
  ) {

    settlementPaymentModal.hidden =
      true;

  }


  document.body.classList.remove(
    "drawer-open"
  );

}


settlementTripSelect
  ?.addEventListener(
    "change",
    async () => {

      activeSettlementTripId =
        settlementTripSelect.value;


      if (
        activeSettlementTripId
      ) {

        getActiveTravelSettlement(
          true
        );


        await saveTravelSettlements();

      }


      renderTravelSettlement();

    }
  );


document
  .getElementById(
    "deleteSettlementCategoryButton"
  )
  ?.addEventListener(
    "click",
    async () => {

      const context =
        getActiveSettlementTrip();


      if (
        !context?.isCategory
      ) {

        return;

      }


      const settlement =
        getActiveTravelSettlement(
          false
        );


      const hasHistory =
        Boolean(
          settlement &&
          (
            (
              settlement.expenses ||
              []
            ).length ||
            (
              settlement.payments ||
              []
            ).length
          )
        );


      const confirmed =
        window.confirm(
          hasHistory
            ? `Delete "${context.name}" and all of its shared-expense history?`
            : `Delete "${context.name}"?`
        );


      if (
        !confirmed
      ) {

        return;

      }


      travelSettlements =
        travelSettlements.filter(
          (
            item
          ) =>
            item.tripId !==
            activeSettlementTripId
        );


      activeSettlementTripId =
        DAILY_LIFE_SETTLEMENT_ID;


      await saveTravelSettlements();


      renderTravelSettlement();


      showToast(
        "Settlement category deleted"
      );

    }
  );


document
  .getElementById(
    "addSettlementCategoryButton"
  )
  ?.addEventListener(
    "click",
    openSettlementCategoryModal
  );


document
  .getElementById(
    "closeSettlementCategory"
  )
  ?.addEventListener(
    "click",
    closeSettlementCategoryModal
  );


settlementCategoryForm
  ?.addEventListener(
    "submit",
    async (
      event
    ) => {

      event.preventDefault();


      const name =
        document.getElementById(
          "settlementCategoryName"
        ).value
          .trim();


      const emoji =
        document.getElementById(
          "settlementCategoryEmoji"
        ).value
          .trim() ||
        "🤝";


      const currency =
        document.getElementById(
          "settlementCategoryCurrency"
        ).value ||
        "PHP";


      if (
        !name
      ) {

        showToast(
          "Give this settlement category a name."
        );


        return;

      }


      const duplicate =
        travelSettlements.some(
          (
            settlement
          ) =>
            (
              settlement?.kind ===
                "category" ||
              isSettlementCategoryId(
                settlement?.tripId
              )
            ) &&
            String(
              settlement.name ||
              ""
            )
              .trim()
              .toLowerCase() ===
              name.toLowerCase()
        );


      if (
        duplicate
      ) {

        showToast(
          "You already have a settlement category with that name."
        );


        return;

      }


      const categoryId =
        `${SETTLEMENT_CATEGORY_PREFIX}${generateId(
          "group"
        )}`;


      const settlement =
        createEmptyTravelSettlement(
          categoryId
        );


      settlement.kind =
        "category";


      settlement.name =
        name;


      settlement.emoji =
        emoji;


      settlement.currency =
        currency;


      travelSettlements.push(
        settlement
      );


      activeSettlementTripId =
        categoryId;


      await saveTravelSettlements();


      closeSettlementCategoryModal();


      renderTravelSettlement();


      showToast(
        `${emoji} ${name} created`
      );

    }
  );


document
  .getElementById(
    "addSettlementPersonButton"
  )
  ?.addEventListener(
    "click",
    () =>
      openSettlementPersonModal()
  );


document
  .getElementById(
    "addSharedExpenseButton"
  )
  ?.addEventListener(
    "click",
    () => {

      const settlement =
        getActiveTravelSettlement(
          true
        );


      if (
        !settlement ||
        settlement.people.length <
          1
      ) {

        showToast(
          "Add a traveler first."
        );


        return;

      }


      openSharedExpenseModal();

    }
  );


document
  .getElementById(
    "recordSettlementPaymentButton"
  )
  ?.addEventListener(
    "click",
    () =>
      openSettlementPaymentModal()
  );


document
  .getElementById(
    "closeSettlementPerson"
  )
  ?.addEventListener(
    "click",
    closeSettlementPersonModal
  );


document
  .getElementById(
    "closeSharedExpense"
  )
  ?.addEventListener(
    "click",
    closeSharedExpenseModal
  );


document
  .getElementById(
    "closeSettlementPayment"
  )
  ?.addEventListener(
    "click",
    closeSettlementPaymentModal
  );


[
  settlementPersonModal,
  sharedExpenseModal,
  settlementPaymentModal,
  settlementCategoryModal
].forEach(
  (
    modal
  ) => {

    modal?.addEventListener(
      "click",
      (
        event
      ) => {

        if (
          event.target !==
          modal
        ) {

          return;

        }


        if (
          modal ===
          settlementPersonModal
        ) {

          closeSettlementPersonModal();

        } else if (
          modal ===
          sharedExpenseModal
        ) {

          closeSharedExpenseModal();

        } else if (
          modal ===
          settlementPaymentModal
        ) {

          closeSettlementPaymentModal();

        } else {

          closeSettlementCategoryModal();

        }

      }
    );

  }
);


settlementPersonForm
  ?.addEventListener(
    "submit",
    async (
      event
    ) => {

      event.preventDefault();


      const settlement =
        getActiveTravelSettlement(
          true
        );


      if (
        !settlement
      ) {

        return;

      }


      const id =
        document.getElementById(
          "settlementPersonId"
        ).value;


      const name =
        document.getElementById(
          "settlementPersonName"
        ).value
          .trim();


      if (
        !name
      ) {

        return;

      }


      const duplicate =
        settlement.people.some(
          (
            person
          ) =>
            person.id !==
              id &&
            person.name
              .trim()
              .toLowerCase() ===
            name.toLowerCase()
        );


      if (
        duplicate
      ) {

        showToast(
          "That person is already in this settlement."
        );


        return;

      }


      const existing =
        settlement.people.find(
          (
            person
          ) =>
            person.id ===
            id
        );


      if (
        existing
      ) {

        existing.name =
          name;

      } else {

        settlement.people.push(
          {
            id:
              generateId(
                "person"
              ),
            name:
              name,
            isYou:
              false,
            createdAt:
              new Date()
                .toISOString()
          }
        );

      }


      settlement.updatedAt =
        new Date()
          .toISOString();


      await saveTravelSettlements();


      closeSettlementPersonModal();


      renderTravelSettlement();


      showToast(
        existing
          ? "Person updated"
          : "Person added"
      );

    }
  );


document
  .getElementById(
    "sharedExpenseSplitMode"
  )
  ?.addEventListener(
    "change",
    () => {

      const settlement =
        getActiveTravelSettlement(
          true
        );


      const expense =
        settlement?.expenses?.find(
          (
            item
          ) =>
            item.id ===
            editingSharedExpenseId
        );


      renderSharedExpenseParticipants(
        expense
      );


      updateSharedExpenseValidation();

    }
  );


document
  .getElementById(
    "sharedExpenseAmount"
  )
  ?.addEventListener(
    "input",
    updateSharedExpenseValidation
  );


document
  .getElementById(
    "sharedExpenseCurrency"
  )
  ?.addEventListener(
    "change",
    updateSharedExpenseValidation
  );


document
  .getElementById(
    "sharedExpenseParticipants"
  )
  ?.addEventListener(
    "input",
    updateSharedExpenseValidation
  );


document
  .getElementById(
    "sharedExpenseParticipants"
  )
  ?.addEventListener(
    "change",
    updateSharedExpenseValidation
  );


sharedExpenseForm
  ?.addEventListener(
    "submit",
    async (
      event
    ) => {

      event.preventDefault();


      const settlement =
        getActiveTravelSettlement(
          true
        );


      const trip =
        getActiveSettlementTrip();


      if (
        !settlement ||
        !trip
      ) {

        return;

      }


      const amount =
        Number(
          document.getElementById(
            "sharedExpenseAmount"
          ).value
        );


      const entryCurrency =
        document.getElementById(
          "sharedExpenseCurrency"
        ).value ||
        "PHP";


      const settlementCurrency =
        settlement.currency ||
        trip.currency ||
        "PHP";


      const convertedAmount =
        convertCurrency(
          amount,
          entryCurrency,
          settlementCurrency
        );


      if (
        !Number.isFinite(
          amount
        ) ||
        amount <=
        0 ||
        !Number.isFinite(
          convertedAmount
        ) ||
        convertedAmount <=
        0
      ) {

        showToast(
          "Enter a valid shared expense amount."
        );


        return;

      }


      const splitMode =
        document.getElementById(
          "sharedExpenseSplitMode"
        ).value;


      const checkedIds =
        Array.from(
          document.querySelectorAll(
            "#sharedExpenseParticipants [data-shared-person]:checked"
          )
        ).map(
          (
            input
          ) =>
            input.dataset
              .sharedPerson
        );


      if (
        checkedIds.length ===
        0
      ) {

        showToast(
          "Choose at least one person to split with."
        );


        return;

      }


      let shares =
        [];


      if (
        splitMode ===
        "equal"
      ) {

        const baseShare =
          convertedAmount /
          checkedIds.length;


        let assigned =
          0;


        shares =
          checkedIds.map(
            (
              personId,
              index
            ) => {

              const shareAmount =
                index ===
                  checkedIds.length -
                  1
                  ? convertedAmount -
                    assigned
                  : Math.round(
                      baseShare *
                      100
                    ) /
                    100;


              assigned +=
                shareAmount;


              return {
                personId:
                  personId,
                amount:
                  shareAmount
              };

            }
          );

      } else {

        const enteredShares =
          checkedIds.map(
            (
              personId
            ) => {

              const input =
                document.querySelector(
                  `[data-shared-exact="${CSS.escape(
                    personId
                  )}"]`
                );


              return {
                personId:
                  personId,
                amount:
                  Number(
                    input?.value ||
                    0
                  )
              };

            }
          );


        const exactTotal =
          enteredShares.reduce(
            (
              total,
              share
            ) =>
              total +
              share.amount,
            0
          );


        if (
          Math.abs(
            exactTotal -
            amount
          ) >
          0.01
        ) {

          showToast(
            "Exact shares need to add up to the expense amount."
          );


          updateSharedExpenseValidation();


          return;

        }


        let assignedConverted =
          0;


        shares =
          enteredShares.map(
            (
              share,
              index
            ) => {

              const convertedShare =
                index ===
                  enteredShares.length -
                  1
                  ? convertedAmount -
                    assignedConverted
                  : Math.round(
                      convertCurrency(
                        share.amount,
                        entryCurrency,
                        settlementCurrency
                      ) *
                      100
                    ) /
                    100;


              assignedConverted +=
                convertedShare;


              return {
                personId:
                  share.personId,
                amount:
                  convertedShare
              };

            }
          );

      }


      const id =
        document.getElementById(
          "sharedExpenseId"
        ).value;


      const previous =
        settlement.expenses.find(
          (
            expense
          ) =>
            expense.id ===
            id
        );


      const sharedExpense = {
        id:
          previous?.id ||
          generateId(
            "shared"
          ),
        title:
          document.getElementById(
            "sharedExpenseTitle"
          ).value
            .trim(),
        amount:
          convertedAmount,
        currency:
          settlementCurrency,
        originalAmount:
          amount,
        originalCurrency:
          entryCurrency,
        date:
          document.getElementById(
            "sharedExpenseDate"
          ).value,
        payerId:
          document.getElementById(
            "sharedExpensePayer"
          ).value,
        splitMode:
          splitMode,
        shares:
          shares,
        notes:
          document.getElementById(
            "sharedExpenseNotes"
          ).value
            .trim(),
        createdAt:
          previous?.createdAt ||
          new Date()
            .toISOString(),
        updatedAt:
          new Date()
            .toISOString()
      };


      if (
        previous
      ) {

        settlement.expenses =
          settlement.expenses.map(
            (
              expense
            ) =>
              expense.id ===
                previous.id
                ? sharedExpense
                : expense
          );

      } else {

        settlement.expenses.push(
          sharedExpense
        );

      }


      settlement.updatedAt =
        new Date()
          .toISOString();


      await saveTravelSettlements();


      closeSharedExpenseModal();


      renderTravelSettlement();


      showToast(
        previous
          ? "Shared expense updated"
          : "Shared expense added 🤝"
      );

    }
  );


settlementPaymentForm
  ?.addEventListener(
    "submit",
    async (
      event
    ) => {

      event.preventDefault();


      const settlement =
        getActiveTravelSettlement(
          true
        );


      if (
        !settlement
      ) {

        return;

      }


      const fromId =
        document.getElementById(
          "settlementPaymentFrom"
        ).value;


      const toId =
        document.getElementById(
          "settlementPaymentTo"
        ).value;


      const amount =
        Number(
          document.getElementById(
            "settlementPaymentAmount"
          ).value
        );


      if (
        fromId ===
        toId
      ) {

        showToast(
          "Choose two different people."
        );


        return;

      }


      if (
        !Number.isFinite(
          amount
        ) ||
        amount <=
        0
      ) {

        showToast(
          "Enter a valid payment amount."
        );


        return;

      }


      settlement.payments.push(
        {
          id:
            generateId(
              "settle"
            ),
          fromId:
            fromId,
          toId:
            toId,
          amount:
            amount,
          date:
            document.getElementById(
              "settlementPaymentDate"
            ).value ||
            getTodayString(),
          note:
            document.getElementById(
              "settlementPaymentNote"
            ).value
              .trim(),
          createdAt:
            new Date()
              .toISOString()
        }
      );


      settlement.updatedAt =
        new Date()
          .toISOString();


      await saveTravelSettlements();


      closeSettlementPaymentModal();


      renderTravelSettlement();


      showToast(
        "Payment recorded ✓"
      );

    }
  );


// ========================================
// SAVINGS GOALS
// ========================================

const savingsGoalModal =
  document.getElementById(
    "savingsGoalModal"
  );


const savingsGoalForm =
  document.getElementById(
    "savingsGoalForm"
  );


const savingsGoalDetailModal =
  document.getElementById(
    "savingsGoalDetailModal"
  );


const savingsContributionModal =
  document.getElementById(
    "savingsContributionModal"
  );


const savingsContributionForm =
  document.getElementById(
    "savingsContributionForm"
  );


function getSavingsGoalSaved(
  goal
) {

  return (
    Array.isArray(
      goal?.contributions
    )
      ? goal.contributions
      : []
  ).reduce(
    (
      total,
      contribution
    ) =>
      total +
      Number(
        contribution.amount ||
        0
      ),
    0
  );

}


function getSavingsGoalProgress(
  goal
) {

  const target =
    Number(
      goal?.targetAmount ||
      0
    );


  if (
    target <=
    0
  ) {

    return 0;

  }


  return Math.max(
    0,
    Math.min(
      100,
      (
        getSavingsGoalSaved(
          goal
        ) /
        target
      ) *
      100
    )
  );

}


async function saveSavingsGoals() {

  await putRecord(
    STORES.settings,
    {
      key:
        SAVINGS_GOALS_SETTING_KEY,
      value:
        savingsGoals,
      updatedAt:
        new Date()
          .toISOString()
    }
  );

}


function openSavingsGoalModal(
  goal =
    null
) {

  if (
    !savingsGoalModal
  ) {

    return;

  }


  document.getElementById(
    "savingsGoalModalTitle"
  ).textContent =
    goal
      ? "Edit Goal"
      : "New Goal";


  document.getElementById(
    "savingsGoalId"
  ).value =
    goal?.id ||
    "";


  document.getElementById(
    "savingsGoalEmoji"
  ).value =
    goal?.emoji ||
    "🌱";


  document.getElementById(
    "savingsGoalName"
  ).value =
    goal?.name ||
    "";


  document.getElementById(
    "savingsGoalTarget"
  ).value =
    goal?.targetAmount ||
    "";


  document.getElementById(
    "savingsGoalCurrency"
  ).value =
    goal?.currency ||
    "PHP";


  document.getElementById(
    "savingsGoalTargetDate"
  ).value =
    goal?.targetDate ||
    "";


  const goalMode = document.getElementById("savingsGoalMode");
  if (goalMode) goalMode.value = goal?.jarMode ? "jar" : "goal";

  const monthlyPlan = document.getElementById("savingsGoalMonthlyPlan");
  if (monthlyPlan) monthlyPlan.value = goal?.monthlyPlan ?? "";

  const protectedJar = document.getElementById("savingsGoalProtected");
  if (protectedJar) protectedJar.checked = Boolean(goal?.protectedJar);


  document.getElementById(
    "savingsGoalNotes"
  ).value =
    goal?.notes ||
    "";


  savingsGoalModal.hidden =
    false;


  document.body.classList.add(
    "drawer-open"
  );


  requestAnimationFrame(
    () =>
      document.getElementById(
        "savingsGoalName"
      )?.focus()
  );

}


function closeSavingsGoalModal() {

  if (
    savingsGoalModal
  ) {

    savingsGoalModal.hidden =
      true;

  }


  document.body.classList.remove(
    "drawer-open"
  );

}


function closeSavingsGoalDetail() {

  if (
    savingsGoalDetailModal
  ) {

    savingsGoalDetailModal.hidden =
      true;

  }


  selectedSavingsGoalId =
    "";


  document.body.classList.remove(
    "drawer-open"
  );

}


function closeSavingsContributionModal() {

  if (
    savingsContributionModal
  ) {

    savingsContributionModal.hidden =
      true;

  }

}


function openSavingsContributionModal(
  goal
) {

  if (
    !goal ||
    !savingsContributionModal
  ) {

    return;

  }


  document.getElementById(
    "savingsContributionTitle"
  ).textContent =
    `Add to ${goal.name}`;


  document.getElementById(
    "savingsContributionGoalId"
  ).value =
    goal.id;


  document.getElementById(
    "savingsContributionAmount"
  ).value =
    "";


  document.getElementById(
    "savingsContributionDate"
  ).value =
    getTodayString();


  document.getElementById(
    "savingsContributionNote"
  ).value =
    "";


  savingsContributionModal.hidden =
    false;


  requestAnimationFrame(
    () =>
      document.getElementById(
        "savingsContributionAmount"
      )?.focus()
  );

}


function renderSavingsGoals() {

  const list =
    document.getElementById(
      "savingsGoalList"
    );


  const empty =
    document.getElementById(
      "savingsGoalEmpty"
    );


  const totalSaved =
    document.getElementById(
      "savingsTotalSaved"
    );


  const goalCount =
    document.getElementById(
      "savingsGoalCount"
    );


  if (
    !list ||
    !empty
  ) {

    return;

  }


  const sorted =
    [
      ...savingsGoals
    ].sort(
      (
        a,
        b
      ) => {

        const completeA =
          getSavingsGoalProgress(
            a
          ) >=
          100;


        const completeB =
          getSavingsGoalProgress(
            b
          ) >=
          100;


        if (
          completeA !==
          completeB
        ) {

          return completeA
            ? 1
            : -1;

        }


        return String(
          a.targetDate ||
          "9999-12-31"
        ).localeCompare(
          String(
            b.targetDate ||
            "9999-12-31"
          )
        );

      }
    );


  if (
    goalCount
  ) {

    goalCount.textContent =
      String(
        savingsGoals.length
      );

  }


  if (
    totalSaved
  ) {

    const phpTotal =
      savingsGoals.reduce(
        (
          total,
          goal
        ) =>
          total +
          convertCurrency(
            getSavingsGoalSaved(
              goal
            ),
            goal.currency ||
              "PHP",
            "PHP"
          ),
        0
      );


    totalSaved.textContent =
      formatCurrency(
        phpTotal,
        "PHP"
      );

  }


  const protectedPlanElement =
    document.getElementById("savingsProtectedPlan");

  if (protectedPlanElement) {
    const monthlyProtected = savingsGoals.reduce(
      (total, goal) => total + (goal.protectedJar
        ? convertCurrency(Number(goal.monthlyPlan || 0), goal.currency || "PHP", "PHP")
        : 0),
      0
    );
    protectedPlanElement.textContent = formatPHP(monthlyProtected);
  }


  if (
    sorted.length ===
    0
  ) {

    list.innerHTML =
      "";


    empty.hidden =
      false;


    return;

  }


  empty.hidden =
    true;


  list.innerHTML =
    sorted
      .map(
        (
          goal
        ) => {

          const saved =
            getSavingsGoalSaved(
              goal
            );


          const target =
            Number(
              goal.targetAmount ||
              0
            );


          const remaining =
            Math.max(
              0,
              target -
              saved
            );


          const progress =
            getSavingsGoalProgress(
              goal
            );


          const complete =
            progress >=
            100;


          return `

            <article
              class="savings-goal-card ${
                complete
                  ? "complete"
                  : ""
              }"
              data-savings-goal-id="${escapeHTML(
                goal.id
              )}"
            >

              <button
                class="savings-goal-main"
                type="button"
                data-open-savings-goal="${escapeHTML(
                  goal.id
                )}"
              >

                <div class="savings-goal-top">

                  <span class="savings-goal-emoji">
                    ${escapeHTML(
                      goal.emoji ||
                      "🌱"
                    )}
                  </span>

                  <div class="savings-goal-title">

                    <strong>
                      ${escapeHTML(
                        goal.name
                      )}
                    </strong>

                    ${goal.jarMode ? `<em class="peach-jar-badge">🍑 Peach Jar${goal.protectedJar ? " · protected" : ""}</em>` : ""}

                    <span>
                      ${
                        complete
                          ? "Goal reached ✨"
                          : goal.targetDate
                            ? `Target ${escapeHTML(
                                formatShortDate(
                                  goal.targetDate
                                )
                              )}`
                            : "No target date"
                      }
                    </span>

                  </div>

                  <strong class="savings-goal-percent">
                    ${Math.round(
                      progress
                    )}%
                  </strong>

                </div>


                <div class="savings-progress-track">

                  <div
                    class="savings-progress-fill"
                    style="width:${progress}%"
                  ></div>

                </div>


                ${Number(goal.monthlyPlan || 0) > 0 ? `<p class="peach-jar-plan">Monthly plan · ${formatCurrency(goal.monthlyPlan, goal.currency || "PHP")}${goal.protectedJar ? " · included in Safe to Spend" : ""}</p>` : ""}

                <div class="savings-goal-numbers">

                  <div>
                    <span>Saved</span>
                    <strong>
                      ${formatCurrency(
                        saved,
                        goal.currency ||
                        "PHP"
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Remaining</span>
                    <strong>
                      ${formatCurrency(
                        remaining,
                        goal.currency ||
                        "PHP"
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Target</span>
                    <strong>
                      ${formatCurrency(
                        target,
                        goal.currency ||
                        "PHP"
                      )}
                    </strong>
                  </div>

                </div>

              </button>


              <button
                class="savings-contribute-btn"
                type="button"
                data-add-savings-contribution="${escapeHTML(
                  goal.id
                )}"
              >
                ＋ Add Money
              </button>

            </article>

          `;

        }
      )
      .join("");


  list
    .querySelectorAll(
      "[data-open-savings-goal]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            const goal =
              savingsGoals.find(
                (
                  item
                ) =>
                  item.id ===
                  button.dataset
                    .openSavingsGoal
              );


            if (
              goal
            ) {

              openSavingsGoalDetail(
                goal
              );

            }

          }
        );

      }
    );


  list
    .querySelectorAll(
      "[data-add-savings-contribution]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            const goal =
              savingsGoals.find(
                (
                  item
                ) =>
                  item.id ===
                  button.dataset
                    .addSavingsContribution
              );


            if (
              goal
            ) {

              openSavingsContributionModal(
                goal
              );

            }

          }
        );

      }
    );

}


function openSavingsGoalDetail(
  goal
) {

  if (
    !goal ||
    !savingsGoalDetailModal
  ) {

    return;

  }


  selectedSavingsGoalId =
    goal.id;


  const title =
    document.getElementById(
      "savingsGoalDetailTitle"
    );


  const body =
    document.getElementById(
      "savingsGoalDetailBody"
    );


  if (
    title
  ) {

    title.textContent =
      `${goal.emoji || "🌱"} ${goal.name}`;

  }


  if (
    !body
  ) {

    return;

  }


  const saved =
    getSavingsGoalSaved(
      goal
    );


  const target =
    Number(
      goal.targetAmount ||
      0
    );


  const remaining =
    Math.max(
      0,
      target -
      saved
    );


  const progress =
    getSavingsGoalProgress(
      goal
    );


  const contributions =
    (
      Array.isArray(
        goal.contributions
      )
        ? goal.contributions
        : []
    )
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          String(
            b.date ||
            ""
          ).localeCompare(
            String(
              a.date ||
              ""
            )
          )
      );


  body.innerHTML =
    `

      <section class="savings-detail-hero">

        <div class="savings-detail-progress-copy">

          <strong>
            ${formatCurrency(
              saved,
              goal.currency ||
              "PHP"
            )}
          </strong>

          <span>
            of
            ${formatCurrency(
              target,
              goal.currency ||
              "PHP"
            )}
          </span>

        </div>

        <div class="savings-progress-track large">
          <div
            class="savings-progress-fill"
            style="width:${progress}%"
          ></div>
        </div>

        <div class="savings-detail-stats">
          <span>
            ${Math.round(
              progress
            )}% complete
          </span>
          <span>
            ${formatCurrency(
              remaining,
              goal.currency ||
              "PHP"
            )} left
          </span>
        </div>

        ${
          goal.targetDate
            ? `
                <p class="savings-detail-date">
                  🎯 Target:
                  ${escapeHTML(
                    formatDate(
                      goal.targetDate
                    )
                  )}
                </p>
              `
            : ""
        }

        ${goal.jarMode ? `
              <div class="peach-jar-detail">
                <strong>🍑 Peach Jar</strong>
                <span>${Number(goal.monthlyPlan || 0) > 0 ? `${formatCurrency(goal.monthlyPlan, goal.currency || "PHP")} planned each month` : "No monthly plan"}${goal.protectedJar ? " · protected in Safe to Spend" : ""}</span>
              </div>
            ` : ""}

        ${
          goal.notes
            ? `
                <p class="savings-detail-notes">
                  ${escapeHTML(
                    goal.notes
                  )}
                </p>
              `
            : ""
        }

      </section>


      <div class="savings-detail-actions">

        <button
          type="button"
          class="primary-button"
          data-detail-add-contribution="${escapeHTML(
            goal.id
          )}"
        >
          ＋ Add Money
        </button>

        <button
          type="button"
          class="secondary-btn"
          data-edit-savings-goal="${escapeHTML(
            goal.id
          )}"
        >
          ✎ Edit Goal
        </button>

      </div>


      <section class="savings-history-section">

        <div class="section-title-row">
          <h3>Contribution History</h3>
          <span>
            ${contributions.length}
          </span>
        </div>

        ${
          contributions.length
            ? `
                <div class="savings-history-list">

                  ${contributions
                    .map(
                      (
                        contribution
                      ) =>
                        `
                          <div class="savings-history-item">

                            <div>
                              <strong>
                                +${formatCurrency(
                                  contribution.amount,
                                  goal.currency ||
                                  "PHP"
                                )}
                              </strong>

                              <span>
                                ${escapeHTML(
                                  formatDate(
                                    contribution.date
                                  )
                                )}
                              </span>

                              ${
                                contribution.note
                                  ? `
                                      <small>
                                        ${escapeHTML(
                                          contribution.note
                                        )}
                                      </small>
                                    `
                                  : ""
                              }
                            </div>

                            <button
                              type="button"
                              class="savings-history-delete"
                              data-delete-savings-contribution="${escapeHTML(
                                contribution.id
                              )}"
                              aria-label="Delete contribution"
                            >
                              ×
                            </button>

                          </div>
                        `
                    )
                    .join("")}

                </div>
              `
            : `
                <div class="savings-history-empty">
                  No contributions yet.
                </div>
              `
        }

      </section>


      <button
        type="button"
        class="danger-btn savings-delete-goal-btn"
        data-delete-savings-goal="${escapeHTML(
          goal.id
        )}"
      >
        Delete Goal
      </button>

    `;


  body
    .querySelector(
      "[data-detail-add-contribution]"
    )
    ?.addEventListener(
      "click",
      () =>
        openSavingsContributionModal(
          goal
        )
    );


  body
    .querySelector(
      "[data-edit-savings-goal]"
    )
    ?.addEventListener(
      "click",
      () => {

        closeSavingsGoalDetail();


        openSavingsGoalModal(
          goal
        );

      }
    );


  body
    .querySelectorAll(
      "[data-delete-savings-contribution]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          async () => {

            const contributionId =
              button.dataset
                .deleteSavingsContribution;


            const currentGoal =
              savingsGoals.find(
                (
                  item
                ) =>
                  item.id ===
                  goal.id
              );


            if (
              !currentGoal
            ) {

              return;

            }


            currentGoal.contributions =
              (
                Array.isArray(
                  currentGoal.contributions
                )
                  ? currentGoal.contributions
                  : []
              ).filter(
                (
                  contribution
                ) =>
                  contribution.id !==
                  contributionId
              );


            currentGoal.updatedAt =
              new Date()
                .toISOString();


            try {

              await saveSavingsGoals();


              renderSavingsGoals();


              openSavingsGoalDetail(
                currentGoal
              );


              showToast(
                "Contribution removed"
              );

            } catch (
              error
            ) {

              console.error(
                "Could not remove contribution:",
                error
              );


              showToast(
                "Could not remove contribution."
              );

            }

          }
        );

      }
    );


  body
    .querySelector(
      "[data-delete-savings-goal]"
    )
    ?.addEventListener(
      "click",
      async () => {

        const confirmed =
          window.confirm(
            `Delete "${goal.name}" and its contribution history?`
          );


        if (
          !confirmed
        ) {

          return;

        }


        savingsGoals =
          savingsGoals.filter(
            (
              item
            ) =>
              item.id !==
              goal.id
          );


        try {

          await saveSavingsGoals();


          closeSavingsGoalDetail();


          renderSavingsGoals();


          showToast(
            "Savings goal deleted"
          );

        } catch (
          error
        ) {

          console.error(
            "Could not delete savings goal:",
            error
          );


          showToast(
            "Could not delete goal."
          );

        }

      }
    );


  savingsGoalDetailModal.hidden =
    false;


  document.body.classList.add(
    "drawer-open"
  );

}


document
  .getElementById(
    "addSavingsGoalButton"
  )
  ?.addEventListener(
    "click",
    () =>
      openSavingsGoalModal()
  );


document
  .getElementById(
    "closeSavingsGoalModal"
  )
  ?.addEventListener(
    "click",
    closeSavingsGoalModal
  );


document
  .getElementById(
    "closeSavingsGoalDetail"
  )
  ?.addEventListener(
    "click",
    closeSavingsGoalDetail
  );


document
  .getElementById(
    "closeSavingsContribution"
  )
  ?.addEventListener(
    "click",
    closeSavingsContributionModal
  );


savingsGoalModal
  ?.addEventListener(
    "click",
    (
      event
    ) => {

      if (
        event.target ===
        savingsGoalModal
      ) {

        closeSettlementPersonModal();

    closeSharedExpenseModal();

    closeSettlementPaymentModal();


    closeSavingsGoalModal();

      }

    }
  );


savingsGoalDetailModal
  ?.addEventListener(
    "click",
    (
      event
    ) => {

      if (
        event.target ===
        savingsGoalDetailModal
      ) {

        closeSavingsGoalDetail();

      }

    }
  );


savingsContributionModal
  ?.addEventListener(
    "click",
    (
      event
    ) => {

      if (
        event.target ===
        savingsContributionModal
      ) {

        closeSavingsContributionModal();

      }

    }
  );


savingsGoalForm
  ?.addEventListener(
    "submit",
    async (
      event
    ) => {

      event.preventDefault();


      const id =
        document.getElementById(
          "savingsGoalId"
        ).value;


      const name =
        document.getElementById(
          "savingsGoalName"
        ).value
          .trim();


      const targetAmount =
        Number(
          document.getElementById(
            "savingsGoalTarget"
          ).value
        );


      if (
        !name ||
        !Number.isFinite(
          targetAmount
        ) ||
        targetAmount <=
        0
      ) {

        showToast(
          "Enter a goal name and target amount."
        );


        return;

      }


      const existing =
        savingsGoals.find(
          (
            goal
          ) =>
            goal.id ===
            id
        );


      const now =
        new Date()
          .toISOString();


      const goal = {
        id:
          existing?.id ||
          generateId(
            "saving"
          ),
        emoji:
          document.getElementById(
            "savingsGoalEmoji"
          ).value
            .trim() ||
          "🌱",
        name:
          name,
        targetAmount:
          targetAmount,
        currency:
          document.getElementById(
            "savingsGoalCurrency"
          ).value ||
          "PHP",
        targetDate:
          document.getElementById(
            "savingsGoalTargetDate"
          ).value ||
          "",
        jarMode:
          document.getElementById("savingsGoalMode")?.value === "jar",
        monthlyPlan:
          Math.max(0, Number(document.getElementById("savingsGoalMonthlyPlan")?.value || 0)),
        protectedJar:
          Boolean(document.getElementById("savingsGoalProtected")?.checked),
        notes:
          document.getElementById(
            "savingsGoalNotes"
          ).value
            .trim(),
        contributions:
          Array.isArray(
            existing?.contributions
          )
            ? existing.contributions
            : [],
        createdAt:
          existing?.createdAt ||
          now,
        updatedAt:
          now
      };


      if (
        existing
      ) {

        savingsGoals =
          savingsGoals.map(
            (
              item
            ) =>
              item.id ===
                existing.id
                ? goal
                : item
          );

      } else {

        savingsGoals.push(
          goal
        );

      }


      try {

        await saveSavingsGoals();


        closeSavingsGoalModal();


        renderSavingsGoals();


        showToast(
          existing
            ? "Savings goal updated"
            : "Savings goal created 🌱"
        );

      } catch (
        error
      ) {

        console.error(
          "Could not save savings goal:",
          error
        );


        showToast(
          "Could not save goal."
        );

      }

    }
  );


savingsContributionForm
  ?.addEventListener(
    "submit",
    async (
      event
    ) => {

      event.preventDefault();


      const goalId =
        document.getElementById(
          "savingsContributionGoalId"
        ).value;


      const goal =
        savingsGoals.find(
          (
            item
          ) =>
            item.id ===
            goalId
        );


      if (
        !goal
      ) {

        return;

      }


      const amount =
        Number(
          document.getElementById(
            "savingsContributionAmount"
          ).value
        );


      const date =
        document.getElementById(
          "savingsContributionDate"
        ).value;


      if (
        !Number.isFinite(
          amount
        ) ||
        amount <=
          0 ||
        !date
      ) {

        showToast(
          !date
            ? "Choose a contribution date."
            : "Enter a contribution amount greater than 0."
        );


        return;

      }


      if (
        !Array.isArray(
          goal.contributions
        )
      ) {

        goal.contributions =
          [];

      }


      goal.contributions.push(
        {
          id:
            generateId(
              "contribution"
            ),
          amount:
            amount,
          date:
            date,
          note:
            document.getElementById(
              "savingsContributionNote"
            ).value
              .trim(),
          createdAt:
            new Date()
              .toISOString()
        }
      );


      goal.updatedAt =
        new Date()
          .toISOString();


      try {

        await saveSavingsGoals();


        closeSavingsContributionModal();


        renderSavingsGoals();


        if (
          !savingsGoalDetailModal
            ?.hidden &&
          selectedSavingsGoalId ===
            goal.id
        ) {

          openSavingsGoalDetail(
            goal
          );

        }


        showToast(
          "Contribution added ✨"
        );

      } catch (
        error
      ) {

        console.error(
          "Could not add contribution:",
          error
        );


        showToast(
          "Could not add contribution."
        );

      }

    }
  );


// ========================================
// RECEIPT GALLERY
// ========================================

const receiptSearch =
  document.getElementById(
    "receiptSearch"
  );


const receiptCategoryFilter =
  document.getElementById(
    "receiptCategoryFilter"
  );


const receiptTripFilter =
  document.getElementById(
    "receiptTripFilter"
  );


const receiptDateFrom =
  document.getElementById(
    "receiptDateFrom"
  );


const receiptDateTo =
  document.getElementById(
    "receiptDateTo"
  );


function getReceiptExpenses() {

  return expenses.filter(
    (expense) =>
      Boolean(
        expense.photo
      )
  );

}


function populateReceiptFilters() {

  if (
    receiptCategoryFilter
  ) {

    const current =
      receiptCategoryFilter.value;


    const categories =
      Array.from(
        new Set(
          getReceiptExpenses()
            .map(
              (expense) =>
                expense.category ||
                "Other"
            )
        )
      )
        .sort(
          (a, b) =>
            a.localeCompare(
              b
            )
        );


    receiptCategoryFilter.innerHTML =
      `
        <option value="">
          All categories
        </option>
      ` +
      categories
        .map(
          (category) =>
            `
              <option value="${escapeHTML(
                category
              )}">
                ${escapeHTML(
                  category
                )}
              </option>
            `
        )
        .join("");


    if (
      categories.includes(
        current
      )
    ) {

      receiptCategoryFilter.value =
        current;

    }

  }


  if (
    receiptTripFilter
  ) {

    const current =
      receiptTripFilter.value;


    const tripIds =
      new Set(
        getReceiptExpenses()
          .map(
            (expense) =>
              expense.tripId
          )
          .filter(
            Boolean
          )
      );


    const receiptTrips =
      trips.filter(
        (trip) =>
          tripIds.has(
            trip.id
          )
      );


    receiptTripFilter.innerHTML =
      `
        <option value="">
          All trips
        </option>
        <option value="__personal__">
          Personal / No Trip
        </option>
      ` +
      receiptTrips
        .map(
          (trip) =>
            `
              <option value="${escapeHTML(
                trip.id
              )}">
                ${escapeHTML(
                  trip.name
                )}
              </option>
            `
        )
        .join("");


    if (
      current ===
        "__personal__" ||
      receiptTrips.some(
        (trip) =>
          trip.id ===
          current
      )
    ) {

      receiptTripFilter.value =
        current;

    }

  }

}


function getFilteredReceiptExpenses() {

  const search =
    String(
      receiptSearch?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const tripNameLookup =
    search
      ? new Map(
          trips.map(
            (item) => [
              item.id,
              item.name ||
                "Trip unavailable"
            ]
          )
        )
      : null;


  const category =
    receiptCategoryFilter?.value ||
    "";


  const trip =
    receiptTripFilter?.value ||
    "";


  const rawFrom =
    receiptDateFrom?.value ||
    "";


  const rawTo =
    receiptDateTo?.value ||
    "";


  const from =
    rawFrom &&
    rawTo &&
    rawFrom >
      rawTo
      ? rawTo
      : rawFrom;


  const to =
    rawFrom &&
    rawTo &&
    rawFrom >
      rawTo
      ? rawFrom
      : rawTo;


  return getReceiptExpenses()
    .filter(
      (expense) => {

        if (
          category &&
          (
            expense.category ||
            "Other"
          ) !==
            category
        ) {

          return false;

        }


        if (
          trip ===
            "__personal__" &&
          expense.tripId
        ) {

          return false;

        }


        if (
          trip &&
          trip !==
            "__personal__" &&
          expense.tripId !==
            trip
        ) {

          return false;

        }


        if (
          from &&
          String(
            expense.date ||
            ""
          ) <
            from
        ) {

          return false;

        }


        if (
          to &&
          String(
            expense.date ||
            ""
          ) >
            to
        ) {

          return false;

        }


        if (
          search
        ) {

          const haystack =
            [
              expense.title,
              expense.category,
              expense.otherCategory,
              expense.location,
              expense.notes,
              expense.paymentMethod,
              expense.tripId
                ? (
                    tripNameLookup?.get(
                      expense.tripId
                    ) ||
                    "Trip unavailable"
                  )
                : "Personal / No Trip",
              ...normalizeExpenseTags(
                expense.tags
              )
            ]
              .filter(
                Boolean
              )
              .join(" ")
              .toLowerCase();


          if (
            !haystack.includes(
              search
            )
          ) {

            return false;

          }

        }


        return true;

      }
    )
    .sort(
      (a, b) =>
        String(
          b.date ||
          ""
        ).localeCompare(
          String(
            a.date ||
            ""
          )
        ) ||
        String(
          b.createdAt ||
          ""
        ).localeCompare(
          String(
            a.createdAt ||
            ""
          )
        )
    );

}


const RECEIPT_RENDER_BATCH = 48;
let receiptRenderLimit = RECEIPT_RENDER_BATCH;
let receiptRenderTimer = null;


function resetReceiptRenderWindow() {

  receiptRenderLimit =
    RECEIPT_RENDER_BATCH;


  renderReceiptGallery(
    {
      refreshFilters:
        false
    }
  );

}


function scheduleReceiptRender() {

  receiptRenderLimit =
    RECEIPT_RENDER_BATCH;


  window.clearTimeout(
    receiptRenderTimer
  );


  receiptRenderTimer =
    window.setTimeout(
      () =>
        renderReceiptGallery(
          {
            refreshFilters:
              false
          }
        ),
      FILTER_INPUT_DEBOUNCE_MS
    );

}


function renderReceiptGallery(
  {
    refreshFilters = true
  } = {}
) {

  const grid =
    document.getElementById(
      "receiptGalleryGrid"
    );


  const empty =
    document.getElementById(
      "receiptGalleryEmpty"
    );


  const count =
    document.getElementById(
      "receiptGalleryCount"
    );


  const resultCount =
    document.getElementById(
      "receiptResultCount"
    );


  if (
    !grid ||
    !empty
  ) {

    return;

  }


  if (
    refreshFilters
  ) {

    populateReceiptFilters();

  }


  const allReceipts =
    getReceiptExpenses();


  const filtered =
    getFilteredReceiptExpenses();


  if (
    count
  ) {

    count.textContent =
      `${allReceipts.length} ${
        allReceipts.length ===
        1
          ? "photo"
          : "photos"
      }`;

  }


  if (
    resultCount
  ) {

    resultCount.textContent =
      `${filtered.length} ${
        filtered.length ===
        1
          ? "receipt"
          : "receipts"
      }`;

  }


  if (
    filtered.length ===
    0
  ) {

    grid.innerHTML =
      "";


    empty.hidden =
      false;


    const title =
      empty.querySelector(
        "h3"
      );


    const copy =
      empty.querySelector(
        "p"
      );


    if (
      title
    ) {

      title.textContent =
        allReceipts.length
          ? "No matching receipts"
          : "No receipts yet";

    }


    if (
      copy
    ) {

      copy.textContent =
        allReceipts.length
          ? "Try changing or clearing your receipt filters."
          : "Add a photo to an expense and it will appear here automatically.";

    }


    return;

  }


  empty.hidden =
    true;


  const visibleReceipts =
    filtered.slice(0, receiptRenderLimit);


  grid.innerHTML =
    visibleReceipts
      .map(
        (expense) => {

          const tags =
            normalizeExpenseTags(
              expense.tags
            );


          return `

            <button
              class="receipt-gallery-card"
              type="button"
              data-receipt-expense-id="${escapeHTML(
                expense.id
              )}"
              aria-label="Open ${escapeHTML(
                expense.title ||
                "receipt"
              )}"
            >

              <div class="receipt-gallery-photo">

                <img
                  src="${expense.photo}"
                  alt="${escapeHTML(
                    expense.title ||
                    "Expense receipt"
                  )}"
                  loading="lazy"
                  decoding="async"
                >

                <span class="receipt-gallery-amount">
                  ${formatCurrency(
                    expense.amount,
                    expense.currency
                  )}
                </span>

              </div>


              <div class="receipt-gallery-copy">

                <strong>
                  ${escapeHTML(
                    expense.title ||
                    "Expense"
                  )}
                </strong>

                <span>
                  ${escapeHTML(
                    formatShortDate(
                      expense.date
                    )
                  )}
                  ·
                  ${escapeHTML(
                    expense.category ===
                      "Other" &&
                    expense.otherCategory
                      ? `Other · ${expense.otherCategory}`
                      : (
                          expense.category ||
                          "Other"
                        )
                  )}
                </span>

                ${
                  expense.tripId
                    ? `
                        <small>
                          ✈ ${escapeHTML(
                            getExpenseTripName(
                              expense
                            )
                          )}
                        </small>
                      `
                    : ""
                }

                ${
                  tags.length
                    ? `
                        <div class="receipt-gallery-tags">
                          ${tags
                            .slice(
                              0,
                              2
                            )
                            .map(
                              (tag) =>
                                `<span>#${escapeHTML(
                                  tag
                                )}</span>`
                            )
                            .join("")}
                        </div>
                      `
                    : ""
                }

              </div>

            </button>

          `;

        }
      )
      .join("") +
    (visibleReceipts.length < filtered.length
      ? `<button class="secondary-button momo-load-more" type="button" data-load-more-receipts>Load more (${filtered.length - visibleReceipts.length} remaining)</button>`
      : "");


}


document.getElementById("receiptGalleryGrid")?.addEventListener("click", (event) => {

  const loadMore =
    event.target.closest(
      "[data-load-more-receipts]"
    );


  if (
    loadMore
  ) {

    receiptRenderLimit +=
      RECEIPT_RENDER_BATCH;


    renderReceiptGallery(
      {
        refreshFilters:
          false
      }
    );


    return;

  }


  const card =
    event.target.closest(
      "[data-receipt-expense-id]"
    );


  if (
    !card
  ) {

    return;

  }


  const expense =
    expenses.find(
      (item) =>
        item.id ===
        card.dataset
          .receiptExpenseId
    );


  if (
    expense
  ) {

    openExpenseDetail(
      expense
    );

  }

});


[
  receiptSearch,
  receiptCategoryFilter,
  receiptTripFilter,
  receiptDateFrom,
  receiptDateTo
]
  .filter(
    Boolean
  )
  .forEach(
    (control) => {

      const eventName =
        control ===
          receiptSearch
          ? "input"
          : "change";


      control.addEventListener(
        eventName,
        eventName ===
          "input"
          ? scheduleReceiptRender
          : resetReceiptRenderWindow
      );

    }
  );


document
  .getElementById(
    "clearReceiptFilters"
  )
  ?.addEventListener(
    "click",
    () => {

      [
        receiptSearch,
        receiptCategoryFilter,
        receiptTripFilter,
        receiptDateFrom,
        receiptDateTo
      ]
        .filter(
          Boolean
        )
        .forEach(
          (control) => {

            control.value =
              "";

          }
        );


      resetReceiptRenderWindow();

    }
  );



// ========================================
// PAYABLES
// ========================================

const PAYABLE_TYPE_META = {
  "credit-card": { label: "Credit Card" },
  installment: { label: "Shop Installment" },
  loan: { label: "Loan" },
  borrowed: { label: "Borrowed Money" },
  custom: { label: "Custom" },
  // Kept only so older saved "Other" records still display safely.
  other: { label: "Other" }
};

let selectedPayableId = "";

const PAYABLE_RENDER_BATCH = 60;
let payableRenderLimit = PAYABLE_RENDER_BATCH;


function getPayableMeta(payable) {
  const fallback = PAYABLE_TYPE_META[payable?.type] || PAYABLE_TYPE_META.other;

  if (payable?.type === "custom" && payable.customType) {
    return { label: payable.customType };
  }

  return fallback;
}

function getPayablePayments(payable) {
  return Array.isArray(payable?.payments) ? payable.payments : [];
}

function getPayableBalance(payable) {
  return Math.max(0, Number(payable?.balance || 0));
}

function payablePHPValue(payable, amount) {
  return convertCurrency(Number(amount || 0), payable?.currency || "PHP", "PHP");
}

function nextPayableDueDate(currentDate, frequency) {
  const base = createLocalDate(currentDate) || new Date();
  const next = new Date(base);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "biweekly") next.setDate(next.getDate() + 14);
  else if (frequency === "quarterly") next.setMonth(next.getMonth() + 3);
  else if (frequency === "one-time" || frequency === "custom") return "";
  else next.setMonth(next.getMonth() + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function payableDueTone(dateString) {
  if (!dateString) return "";
  const due = createLocalDate(dateString);
  const today = createLocalDate(getTodayString());
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return "overdue";
  if (days <= 7) return "soon";
  return "";
}

function getPayableTotalPaid(payable) {
  return getPayablePayments(payable).reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );
}

function estimatePayablePayoff(payable) {
  const balance = getPayableBalance(payable);
  const payment = Number(payable.regularPayment || payable.minimumDue || 0);
  const apr = Math.max(0, Number(payable.interestAPR || 0));

  if (balance <= 0) return { months: 0, interest: 0, finishDate: "" };
  if (payment <= 0) return { months: null, interest: null, finishDate: "" };

  const monthlyRate = apr > 0 ? apr / 100 / 12 : 0;
  let remaining = balance;
  let months = 0;
  let interest = 0;

  while (remaining > 0.005 && months < 600) {
    const monthInterest = remaining * monthlyRate;
    if (monthlyRate > 0 && payment <= monthInterest) {
      return { months: null, interest: null, finishDate: "" };
    }
    interest += monthInterest;
    remaining = Math.max(0, remaining + monthInterest - payment);
    months += 1;
  }

  if (months >= 600) return { months: null, interest: null, finishDate: "" };

  const finish = new Date();
  finish.setMonth(finish.getMonth() + months);
  return {
    months,
    interest,
    finishDate: `${finish.getFullYear()}-${String(finish.getMonth()+1).padStart(2,"0")}-${String(finish.getDate()).padStart(2,"0")}`
  };
}


function renderPayables() {
  const list = document.getElementById("payablesList");
  const empty = document.getElementById("payablesEmpty");
  if (!list || !empty) return;

  const active = cards.filter((item) => getPayableBalance(item) > 0);
  const total = active.reduce((sum, item) => sum + payablePHPValue(item, getPayableBalance(item)), 0);
  const today = createLocalDate(getTodayString());
  const soonLimit = new Date(today);
  soonLimit.setDate(soonLimit.getDate() + 30);

  const dueSoon = active.reduce((sum, item) => {
    const due = createLocalDate(item.dueDate);
    if (!due || due < today || due > soonLimit) return sum;
    const amount = Number(item.regularPayment || item.minimumDue || item.balance || 0);
    return sum + payablePHPValue(item, Math.min(amount, getPayableBalance(item)));
  }, 0);

  const now = new Date();
  const paidMonth = cards.reduce((sum, item) => {
    return sum + getPayablePayments(item).reduce((paymentSum, payment) => {
      const date = createLocalDate(payment.date);
      if (!date || date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return paymentSum;
      return paymentSum + payablePHPValue(item, payment.amount);
    }, 0);
  }, 0);

  const totalEl = document.getElementById("payablesTotal");
  const countEl = document.getElementById("payablesCount");
  const dueEl = document.getElementById("payablesDueSoon");
  const paidEl = document.getElementById("payablesPaidMonth");
  const activeCountEl = document.getElementById("payablesActiveCount");

  if (totalEl) totalEl.textContent = formatPHP(total);
  if (dueEl) dueEl.textContent = formatPHP(dueSoon);
  if (paidEl) paidEl.textContent = formatPHP(paidMonth);
  if (activeCountEl) activeCountEl.textContent = `${active.length} active`;
  if (countEl) countEl.textContent = active.length ? `${active.length} ${active.length === 1 ? "thing" : "things"} waiting on you` : "Nothing waiting on you 🌸";

  const sorted = [...cards].sort((a, b) => {
    const doneA = getPayableBalance(a) <= 0;
    const doneB = getPayableBalance(b) <= 0;
    if (doneA !== doneB) return doneA ? 1 : -1;
    return String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"));
  });

  empty.hidden = sorted.length > 0;


  const visiblePayables =
    sorted.slice(
      0,
      payableRenderLimit
    );


  list.innerHTML = visiblePayables.map((item) => {
    const meta = getPayableMeta(item);
    const balance = getPayableBalance(item);
    const original = Number(item.originalAmount || 0);
    const paidPercent = original > 0 ? Math.min(100, Math.max(0, ((original - balance) / original) * 100)) : 0;
    const done = balance <= 0;
    const tone = payableDueTone(item.dueDate);
    const dueCopy = done ? "All paid! 🌸" : item.dueDate ? `Next payment · ${formatShortDate(item.dueDate)}` : "No due date set";
    return `
      <button class="payable-item ${done ? "is-paid" : ""}" type="button" data-payable-open="${escapeHTML(item.id)}">
        <span class="payable-item-main">
          <span class="payable-item-topline">
            <span>
              <strong>${escapeHTML(item.name || meta.label)}</strong>
              <small>${escapeHTML(item.provider || meta.label)}</small>
            </span>
            <b>${formatCurrency(balance, item.currency || "PHP")}</b>
          </span>
          <span class="payable-progress"><i style="width:${paidPercent}%"></i></span>
          <span class="payable-item-foot">
            <small class="${tone}">${dueCopy}</small>
            <em>${done ? "finished" : "still to pay"}</em>
          </span>
        </span>
      </button>`;
  }).join("") +
    (
      visiblePayables.length <
      sorted.length
        ? `<button class="secondary-button momo-load-more" type="button" data-load-more-payables>Load more (${sorted.length - visiblePayables.length} remaining)</button>`
        : ""
    );
}


document.addEventListener(
  "click",
  (event) => {

    if (
      !event.target.closest(
        "[data-load-more-payables]"
      )
    ) {

      return;

    }


    payableRenderLimit +=
      PAYABLE_RENDER_BATCH;


    renderPayables();

  }
);


function updatePayableSpecialFields() {
  const type = document.getElementById("payableType")?.value;
  const credit = document.getElementById("payableCreditFields");
  const installment = document.getElementById("payableInstallmentFields");
  const custom = document.getElementById("payableCustomTypeField");
  if (credit) credit.hidden = type !== "credit-card";
  if (installment) installment.hidden = type !== "installment";
  if (custom) custom.hidden = type !== "custom";
}

function openPayableEditor(id = "") {
  const modal = document.getElementById("payableModal");
  const form = document.getElementById("payableForm");
  if (!modal || !form) return;
  form.reset();
  const item = cards.find((entry) => String(entry.id) === String(id));
  document.getElementById("payableId").value = item?.id || "";
  document.getElementById("payableModalTitle").textContent = item ? "Edit Payable" : "Add something to pay";
  const editorType = item?.type === "other" ? "custom" : (item?.type || "credit-card");
  document.getElementById("payableType").value = editorType;
  document.getElementById("payableCustomType").value = item?.customType || (item?.type === "other" ? "Other" : "");
  document.getElementById("payableName").value = item?.name || "";
  document.getElementById("payableProvider").value = item?.provider || "";
  document.getElementById("payableOriginalAmount").value = item?.originalAmount ?? "";
  document.getElementById("payableBalance").value = item?.balance ?? "";
  document.getElementById("payableCurrency").value = item?.currency || "PHP";
  document.getElementById("payableDueDate").value = item?.dueDate || "";
  document.getElementById("payableRegularPayment").value = item?.regularPayment ?? "";
  document.getElementById("payableFrequency").value = item?.frequency || "monthly";
  document.getElementById("payableCreditLimit").value = item?.creditLimit ?? "";
  document.getElementById("payableStatementBalance").value = item?.statementBalance ?? "";
  document.getElementById("payableMinimumDue").value = item?.minimumDue ?? "";
  const payableInterestAPR = document.getElementById("payableInterestAPR");
  if (payableInterestAPR) payableInterestAPR.value = item?.interestAPR ?? "";
  document.getElementById("payableStatementDay").value = item?.statementDay ?? "";
  document.getElementById("payableInstallmentCount").value = item?.installmentCount ?? "";
  document.getElementById("payableInstallmentsPaid").value = item?.installmentsPaid ?? "";
  document.getElementById("payableNotes").value = item?.notes || "";
  updatePayableSpecialFields();
  modal.hidden = false;
}

function closePayableEditor() {
  const modal = document.getElementById("payableModal");
  if (modal) modal.hidden = true;
}

async function savePayable(event) {
  event.preventDefault();
  const id = document.getElementById("payableId").value || generateId("payable");
  const existing = cards.find((item) => String(item.id) === String(id));
  const type = document.getElementById("payableType").value;
  const customType = type === "custom"
    ? document.getElementById("payableCustomType").value.trim()
    : "";

  const originalRaw = document.getElementById("payableOriginalAmount").value.trim();
  const balanceRaw = document.getElementById("payableBalance").value.trim();
  const statementRaw = type === "credit-card"
    ? document.getElementById("payableStatementBalance").value.trim()
    : "";

  const originalAmount = originalRaw === "" ? 0 : Number(originalRaw);
  const enteredBalance = balanceRaw === "" ? null : Number(balanceRaw);
  const statementBalance = statementRaw === "" ? 0 : Number(statementRaw);

  if (!Number.isFinite(originalAmount) || originalAmount < 0) {
    showToast("Enter a valid original amount.");
    document.getElementById("payableOriginalAmount")?.focus();
    return;
  }

  if (enteredBalance !== null && (!Number.isFinite(enteredBalance) || enteredBalance < 0)) {
    showToast("Enter a valid remaining balance.");
    document.getElementById("payableBalance")?.focus();
    return;
  }

  if (!Number.isFinite(statementBalance) || statementBalance < 0) {
    showToast("Enter a valid statement balance.");
    document.getElementById("payableStatementBalance")?.focus();
    return;
  }

  let resolvedBalance = enteredBalance;
  if (resolvedBalance === null && type === "credit-card" && statementRaw !== "") {
    resolvedBalance = statementBalance;
  }
  if (resolvedBalance === null && originalRaw !== "") {
    resolvedBalance = originalAmount;
  }

  if (resolvedBalance === null) {
    showToast("Add Original Amount, Still to Pay, or Statement Balance so Momo knows what remains.");
    document.getElementById(type === "credit-card" ? "payableStatementBalance" : "payableOriginalAmount")?.focus();
    return;
  }

  const record = {
    ...(existing || {}),
    id,
    type,
    customType,
    name: document.getElementById("payableName").value.trim(),
    provider: document.getElementById("payableProvider").value.trim(),
    originalAmount,
    balance: resolvedBalance,
    currency: document.getElementById("payableCurrency").value || "PHP",
    dueDate: document.getElementById("payableDueDate").value || "",
    regularPayment: Number(document.getElementById("payableRegularPayment").value || 0),
    frequency: document.getElementById("payableFrequency").value || "monthly",
    creditLimit: type === "credit-card" ? Number(document.getElementById("payableCreditLimit").value || 0) : 0,
    statementBalance,
    minimumDue: type === "credit-card" ? Number(document.getElementById("payableMinimumDue").value || 0) : 0,
    interestAPR: type === "credit-card" ? Math.max(0, Number(document.getElementById("payableInterestAPR")?.value || 0)) : Math.max(0, Number(existing?.interestAPR || 0)),
    statementDay: type === "credit-card" ? Number(document.getElementById("payableStatementDay").value || 0) : 0,
    installmentCount: type === "installment" ? Number(document.getElementById("payableInstallmentCount").value || 0) : 0,
    installmentsPaid: type === "installment" ? Number(document.getElementById("payableInstallmentsPaid").value || 0) : 0,
    notes: document.getElementById("payableNotes").value.trim(),
    payments: getPayablePayments(existing),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!record.name) {
    showToast("Give this payable a name.");
    document.getElementById("payableName")?.focus();
    return;
  }

  if (record.type === "custom" && !record.customType) {
    showToast("Give your custom payable type a name.");
    document.getElementById("payableCustomType")?.focus();
    return;
  }


  if (!Number.isFinite(record.regularPayment) || record.regularPayment < 0) {
    showToast("Enter a valid regular payment amount.");
    document.getElementById("payableRegularPayment")?.focus();
    return;
  }

  if (record.type === "installment") {
    record.installmentCount = Math.max(0, Math.floor(record.installmentCount || 0));
    record.installmentsPaid = Math.max(
      0,
      Math.min(
        record.installmentCount || Number.MAX_SAFE_INTEGER,
        Math.floor(record.installmentsPaid || 0)
      )
    );
  }

  if (record.type === "credit-card") {
    record.statementDay = record.statementDay
      ? Math.max(1, Math.min(31, Math.floor(record.statementDay)))
      : 0;
  }

  await putRecord(STORES.cards, record);
  const index = cards.findIndex((item) => String(item.id) === String(id));
  if (index >= 0) cards[index] = record;
  else cards.push(record);
  closePayableEditor();
  renderPayables();
  showToast(existing ? "Payable updated 🌸" : "Payable added ✿");
}

function renderPayableDetail(id) {
  const item = cards.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  selectedPayableId = item.id;
  const modal = document.getElementById("payableDetailModal");
  const body = document.getElementById("payableDetailBody");
  if (!modal || !body) return;
  const meta = getPayableMeta(item);
  const balance = getPayableBalance(item);
  const payments = [...getPayablePayments(item)].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const available = item.type === "credit-card" && Number(item.creditLimit || 0) > 0 ? Math.max(0, Number(item.creditLimit) - balance) : null;
  const totalPaid = getPayableTotalPaid(item);
  const payoff = estimatePayablePayoff(item);
  document.getElementById("payableDetailKicker").textContent = meta.label;
  document.getElementById("payableDetailTitle").textContent = item.name || meta.label;
  body.innerHTML = `
    <section class="payable-detail-hero ${balance <= 0 ? "is-paid" : ""}">
      <small>${balance <= 0 ? "All paid! 🌸" : "Still to pay"}</small>
      <strong>${formatCurrency(balance, item.currency || "PHP")}</strong>
      <p>${escapeHTML(item.provider || "")}</p>
    </section>
    <div class="payable-detail-grid">
      ${item.dueDate ? `<div><small>Next payment</small><strong>${formatDate(item.dueDate)}</strong></div>` : ""}
      ${Number(item.regularPayment || 0) ? `<div><small>Regular payment</small><strong>${formatCurrency(item.regularPayment, item.currency || "PHP")}</strong></div>` : ""}
      ${available !== null ? `<div><small>Available credit</small><strong>${formatCurrency(available, item.currency || "PHP")}</strong></div>` : ""}
      ${Number(item.creditLimit || 0) ? `<div><small>Credit limit</small><strong>${formatCurrency(item.creditLimit, item.currency || "PHP")}</strong></div>` : ""}
      ${Number(item.minimumDue || 0) ? `<div><small>Minimum due</small><strong>${formatCurrency(item.minimumDue, item.currency || "PHP")}</strong></div>` : ""}
      ${Number(item.installmentCount || 0) ? `<div><small>Installments</small><strong>${Number(item.installmentsPaid || 0)} / ${Number(item.installmentCount)}</strong></div>` : ""}
      <div><small>Total paid</small><strong>${formatCurrency(totalPaid, item.currency || "PHP")}</strong></div>
      ${payoff.months !== null && payoff.months > 0 ? `<div><small>Est. payoff</small><strong>${payoff.months} mo · ${formatShortDate(payoff.finishDate)}</strong></div>` : ""}
      ${Number(item.interestAPR || 0) > 0 ? `<div><small>APR</small><strong>${Number(item.interestAPR).toFixed(2)}%</strong></div>` : ""}
      ${payoff.interest !== null && payoff.interest > 0 ? `<div><small>Est. interest</small><strong>${formatCurrency(payoff.interest, item.currency || "PHP")}</strong></div>` : ""}
    </div>
    ${Number(item.interestAPR || 0) > 0 ? `<p class="payable-estimate-note">Payoff and interest are planning estimates based on the regular payment you entered. Momo does not include issuer-specific fees or future purchases.</p>` : ""}
    ${item.notes ? `<p class="payable-detail-note">🌷 ${escapeHTML(item.notes)}</p>` : ""}
    <div class="payable-detail-actions">
      ${balance > 0 ? `<button class="primary-button" type="button" data-payable-pay="${escapeHTML(item.id)}">Record Payment</button>` : ""}
      <button class="secondary-button" type="button" data-payable-edit="${escapeHTML(item.id)}">Edit</button>
    </div>
    <div class="payable-history">
      <div class="payables-section-heading"><div><p class="section-kicker">Little wins</p><h3>Payment History</h3></div></div>
      ${payments.length ? payments.map((payment) => `
        <div class="payable-history-row">
          <span>✓</span>
          <div><strong>${formatCurrency(payment.amount, item.currency || "PHP")}</strong><small>${formatDate(payment.date)}${payment.note ? ` · ${escapeHTML(payment.note)}` : ""}</small></div>
        </div>`).join("") : `<p class="payable-no-history">No payments recorded yet.</p>`}
    </div>
    <button class="text-btn payable-delete-btn" type="button" data-payable-delete="${escapeHTML(item.id)}">Remove this payable</button>`;
  modal.hidden = false;
}

function closePayableDetail() {
  const modal = document.getElementById("payableDetailModal");
  if (modal) modal.hidden = true;
}

function openPayablePayment(id) {
  const item = cards.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  const modal = document.getElementById("payablePaymentModal");
  if (!modal) return;
  document.getElementById("payablePaymentId").value = item.id;
  document.getElementById("payablePaymentTitle").textContent = `Pay ${item.name}`;
  document.getElementById("payablePaymentAmount").value = item.regularPayment || item.minimumDue || "";
  document.getElementById("payablePaymentAmount").max = getPayableBalance(item);
  document.getElementById("payablePaymentDate").value = getTodayString();
  document.getElementById("payablePaymentNote").value = "";
  modal.hidden = false;
}

function closePayablePayment() {
  const modal = document.getElementById("payablePaymentModal");
  if (modal) modal.hidden = true;
}

async function recordPayablePayment(event) {
  event.preventDefault();
  const id = document.getElementById("payablePaymentId").value;
  const item = cards.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  const amount = Number(document.getElementById("payablePaymentAmount").value || 0);
  const paymentDate = document.getElementById("payablePaymentDate").value;

  if (!Number.isFinite(amount) || !(amount > 0)) {
    showToast("Enter a payment amount greater than 0.");
    document.getElementById("payablePaymentAmount")?.focus();
    return;
  }

  if (!paymentDate) {
    showToast("Choose the payment date.");
    document.getElementById("payablePaymentDate")?.focus();
    return;
  }

  const currentBalance = getPayableBalance(item);

  if (currentBalance <= 0) {
    showToast("This payable is already fully paid 🌸");
    closePayablePayment();
    return;
  }

  const actualAmount = Math.min(amount, currentBalance);
  const payment = {
    id: generateId("payment"),
    amount: actualAmount,
    date: paymentDate,
    note: document.getElementById("payablePaymentNote").value.trim()
  };
  const nextBalance = Math.max(0, getPayableBalance(item) - actualAmount);
  const next = {
    ...item,
    balance: nextBalance,
    payments: [...getPayablePayments(item), payment],
    installmentsPaid: item.type === "installment" && Number(item.installmentCount || 0) ? Math.min(Number(item.installmentCount), Number(item.installmentsPaid || 0) + 1) : Number(item.installmentsPaid || 0),
    dueDate: nextBalance > 0 ? nextPayableDueDate(item.dueDate || payment.date, item.frequency || "monthly") : "",
    updatedAt: new Date().toISOString()
  };
  await putRecord(STORES.cards, next);
  cards[cards.findIndex((entry) => String(entry.id) === String(id))] = next;
  closePayablePayment();
  renderPayables();
  renderPayableDetail(id);
  showToast(nextBalance <= 0 ? "All paid! 🌸" : "Payment recorded ✨");
}

async function deletePayable(id) {
  const item = cards.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  if (!window.confirm(`Remove "${item.name}" from Payables? Its payment history will also be removed.`)) return;
  await deleteRecord(STORES.cards, item.id);
  cards = cards.filter((entry) => String(entry.id) !== String(id));
  closePayableDetail();
  renderPayables();
  showToast("Payable removed.");
}

document.addEventListener("click", (event) => {
  const add = event.target.closest("#addPayableButton, [data-payable-add]");
  if (add) openPayableEditor();

  const open = event.target.closest("[data-payable-open]");
  if (open) renderPayableDetail(open.dataset.payableOpen);

  const edit = event.target.closest("[data-payable-edit]");
  if (edit) {
    closePayableDetail();
    openPayableEditor(edit.dataset.payableEdit);
  }

  const pay = event.target.closest("[data-payable-pay]");
  if (pay) openPayablePayment(pay.dataset.payablePay);

  const remove = event.target.closest("[data-payable-delete]");
  if (remove) deletePayable(remove.dataset.payableDelete);
});

document.getElementById("payableType")?.addEventListener("change", updatePayableSpecialFields);
document.getElementById("payableForm")?.addEventListener("submit", savePayable);
document.getElementById("payablePaymentForm")?.addEventListener("submit", recordPayablePayment);
document.getElementById("closePayableModal")?.addEventListener("click", closePayableEditor);
document.getElementById("closePayableDetail")?.addEventListener("click", closePayableDetail);
document.getElementById("closePayablePayment")?.addEventListener("click", closePayablePayment);



// ========================================
// PAYDAY PLANNER
// ========================================

async function savePaydayPlan() {
  await putRecord(STORES.settings, {
    key: PAYDAY_PLAN_SETTING_KEY,
    value: paydayPlan,
    updatedAt: new Date().toISOString()
  });
}

function getPaydayPlanTotals() {
  const amount = Math.max(0, Number(paydayPlan.expectedAmount || 0));
  const bills = Math.max(0, Number(paydayPlan.bills || 0));
  const savings = Math.max(0, Number(paydayPlan.savings || 0));
  const payables = Math.max(0, Number(paydayPlan.payables || 0));
  const wants = Math.max(0, Number(paydayPlan.wants || 0));
  const assigned = bills + savings + payables + wants;
  return { amount, bills, savings, payables, wants, assigned, buffer: amount - assigned };
}

function renderPaydayPlanner() {
  const form = document.getElementById("paydayPlannerForm");
  if (!form) return;

  const setValue = (id, value) => {
    const input = document.getElementById(id);
    if (input && document.activeElement !== input) input.value = value ?? "";
  };

  setValue("paydayNextDate", paydayPlan.nextPayday || "");
  setValue("paydayExpectedAmount", paydayPlan.expectedAmount || "");
  setValue("paydayBills", paydayPlan.bills || "");
  setValue("paydaySavings", paydayPlan.savings || "");
  setValue("paydayPayables", paydayPlan.payables || "");
  setValue("paydayWants", paydayPlan.wants || "");
  setValue("paydayNotes", paydayPlan.notes || "");

  const totals = getPaydayPlanTotals();
  const assigned = document.getElementById("paydayAssignedTotal");
  const buffer = document.getElementById("paydayBufferTotal");
  const status = document.getElementById("paydayPlanStatus");

  if (assigned) assigned.textContent = formatPHP(totals.assigned);
  if (buffer) {
    buffer.textContent = totals.amount > 0
      ? `${totals.buffer < 0 ? "−" : ""}${formatPHP(Math.abs(totals.buffer))}`
      : "—";
    buffer.classList.toggle("danger", totals.buffer < 0);
  }

  if (status) {
    if (!paydayPlan.nextPayday && totals.amount <= 0) {
      status.textContent = "Add a payday and expected amount to start planning.";
    } else if (totals.buffer < 0) {
      status.textContent = `Your plan is ${formatPHP(Math.abs(totals.buffer))} over the expected pay. Adjust a bucket before payday.`;
    } else {
      status.textContent = `${formatPHP(Math.max(0, totals.buffer))} is still unassigned as a flexible buffer.`;
    }
  }
}

function readPaydayPlannerForm() {
  const numberValue = (id) => Math.max(0, Number(document.getElementById(id)?.value || 0));
  return {
    nextPayday: document.getElementById("paydayNextDate")?.value || "",
    expectedAmount: numberValue("paydayExpectedAmount"),
    bills: numberValue("paydayBills"),
    savings: numberValue("paydaySavings"),
    payables: numberValue("paydayPayables"),
    wants: numberValue("paydayWants"),
    notes: document.getElementById("paydayNotes")?.value.trim() || ""
  };
}

document.getElementById("paydayPlannerForm")?.addEventListener("input", () => {
  paydayPlan = readPaydayPlannerForm();
  renderPaydayPlanner();
});

document.getElementById("paydayPlannerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  paydayPlan = readPaydayPlannerForm();
  try {
    await savePaydayPlan();
    renderPaydayPlanner();
    showToast("Payday plan saved 🍑");
  } catch (error) {
    console.error("Could not save payday plan:", error);
    showToast("Could not save the payday plan.");
  }
});

document.getElementById("paydayUseAsIncome")?.addEventListener("click", async () => {
  paydayPlan = readPaydayPlannerForm();
  const amount = Number(paydayPlan.expectedAmount || 0);
  if (!(amount > 0)) {
    showToast("Add the expected payday amount first.");
    return;
  }

  const targetDate = createLocalDate(paydayPlan.nextPayday) || new Date();
  const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
  monthlyIncomeByMonth[monthKey] = amount;

  try {
    await saveMonthlyIncome();
    await savePaydayPlan();
    renderHomeSummary();
    showToast(`Saved ${formatPHP(amount)} as ${monthKey}'s income.`);
  } catch (error) {
    console.error("Could not use payday plan as income:", error);
    showToast("Could not update monthly income.");
  }
});


// ========================================
// SMART REMINDERS
// ========================================

let activeReminderFilter = "all";

const REMINDER_WINDOWS = {
  recurring: 7,
  planned: 14,
  trip: 30,
  savings: 14,
  budgetEnd: 3
};

function reminderDaysFromToday(dateString) {
  const target = createLocalDate(dateString);
  const today = createLocalDate(getTodayString());

  if (!target || !today) {
    return null;
  }

  return Math.round((target - today) / 86400000);
}

function getReminderBucket(days, forceAttention = false) {
  if (forceAttention || (days !== null && days < 0)) {
    return "attention";
  }

  if (days !== null && days <= 7) {
    return "soon";
  }

  return "later";
}

function getReminderTimingLabel(days, dateString) {
  if (days === null) {
    return dateString ? formatShortDate(dateString) : "";
  }

  if (days < -1) {
    return `${Math.abs(days)} days overdue`;
  }

  if (days === -1) {
    return "Yesterday";
  }

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "Tomorrow";
  }

  if (days <= 7) {
    return `In ${days} days`;
  }

  return dateString ? formatShortDate(dateString) : `In ${days} days`;
}

async function refreshPhonePushStatus() {
  const status = document.getElementById(
    "phonePushStatus"
  );
  const button = document.getElementById(
    "enablePhonePush"
  );

  if (!status || !button) return;

  const push = getMomoPush();
  if (!push) {
    status.textContent =
      "Phone notification setup is still loading.";
    button.textContent = "Enable on this phone";
    return;
  }

  const state = await push.getStatus();
  status.textContent = state.message;
  button.textContent = state.enabled
    ? "Turn off on this phone"
    : "Enable on this phone";
  button.dataset.enabled = state.enabled ? "true" : "false";
}


document
  .getElementById(
    "enablePhonePush"
  )
  ?.addEventListener(
    "click",
    async () => {
      const push = getMomoPush();
      if (!push) {
        showToast("Phone notification setup is still loading.");
        return;
      }

      try {
        const button = document.getElementById(
          "enablePhonePush"
        );
        if (button?.dataset.enabled === "true") {
          await push.disable();
          showToast("Phone notifications turned off on this device.");
        } else {
          await push.enable();

          await resyncAllPhoneReminders();

          showToast("Phone notifications enabled 🔔");
        }
      } catch (error) {
        showToast(error?.message || "Could not change phone notifications.");
      }

      await refreshPhonePushStatus();
    }
  );


async function resyncAllPhoneReminders() {
  const push = getMomoPush();
  if (!push) return;

  let status;
  try {
    status = await push.getStatus();
  } catch (error) {
    console.warn(
      "Could not check Momo phone notification status:",
      error
    );
    return;
  }

  if (!status.enabled) return;

  const tasks = [
    ...recurringExpenses
      .filter(
        (item) =>
          item.phoneReminder &&
          isRecurringActive(item) &&
          item.nextDueDate
      )
      .map(
        (item) =>
          push.syncReminder(
            "recurring",
            item
          )
      ),
    ...plannedExpenses
      .filter(
        (item) =>
          item.phoneReminder &&
          item.status === "planned" &&
          item.targetDate
      )
      .map(
        (item) =>
          push.syncReminder(
            "planned",
            item
          )
      ),
    ...customReminders
      .filter(
        (item) =>
          item.phoneReminder &&
          !item.completed &&
          item.date
      )
      .map(
        (item) =>
          push.syncReminder(
            "custom",
            item
          )
      )
  ];

  const activeGentle = new Map(
    buildSmartReminders()
      .filter(
        (reminder) =>
          ![
            "recurring",
            "planned",
            "custom"
          ].includes(reminder.type)
      )
      .map(
        (reminder) => [
          reminder.id,
          reminder
        ]
      )
  );

  let gentlePreferencesChanged =
    false;

  Object.entries(
    gentlePushPreferences || {}
  ).forEach(
    ([reminderId, preference]) => {
      if (!preference?.enabled) return;

      const reminder =
        activeGentle.get(reminderId);

      if (!reminder) {
        tasks.push(
          push.deleteReminder(
            "gentle",
            reminderId
          )
        );

        gentlePushPreferences = {
          ...gentlePushPreferences,
          [reminderId]: {
            ...preference,
            enabled: false,
            resolvedAt:
              new Date().toISOString()
          }
        };

        gentlePreferencesChanged =
          true;
        return;
      }

      tasks.push(
        push.syncReminder(
          "gentle",
          {
            id: reminder.id,
            title: reminder.title,
            note: reminder.detail,
            date:
              reminder.date ||
              preference.scheduledDate ||
              getTodayString(),
            phoneReminder: true,
            remindDaysBefore: 0,
            remindTime: "09:00"
          }
        )
      );
    }
  );

  await Promise.allSettled(
    tasks
  );

  if (gentlePreferencesChanged) {
    await persistGentlePushPreferences();
  }
}

window.addEventListener(
  "momo-push-ready",
  () => {
    refreshPhonePushStatus();
    resyncAllPhoneReminders();
  }
);

window.addEventListener(
  "online",
  resyncAllPhoneReminders
);


async function persistGentlePushPreferences() {
  return putRecord(
    STORES.settings,
    {
      key: GENTLE_PUSH_SETTING_KEY,
      value: gentlePushPreferences,
      updatedAt: new Date().toISOString()
    }
  );
}

function gentleReminderPushEnabled(reminder) {
  if (!reminder) return false;
  if (reminder.type === "recurring") {
    return Boolean(
      recurringExpenses.find((item) => `recurring:${item.id}` === reminder.id)?.phoneReminder
    );
  }
  if (reminder.type === "planned") {
    return Boolean(
      plannedExpenses.find((item) => `planned:${item.id}` === reminder.id)?.phoneReminder
    );
  }
  if (reminder.type === "custom") {
    return Boolean(
      customReminders.find((item) => `custom:${item.id}` === reminder.id)?.phoneReminder
    );
  }
  return Boolean(gentlePushPreferences?.[reminder.id]?.enabled);
}

async function setGentleReminderPush(reminderId, enabled) {
  const reminder = buildSmartReminders().find((item) => item.id === reminderId);
  if (!reminder) return;

  const push = getMomoPush();

  if (enabled) {
    if (!push) {
      throw new Error(
        "Phone notification setup is still loading. Try again in a moment."
      );
    }

    const status =
      await push.getStatus();

    if (!status.enabled) {
      throw new Error(
        "Enable phone notifications on this device first."
      );
    }
  }

  if (reminder.type === "recurring") {
    const item = recurringExpenses.find((entry) => `recurring:${entry.id}` === reminder.id);
    if (!item) return;
    item.phoneReminder = enabled;
    item.remindDaysBefore = Number(item.remindDaysBefore ?? 0);
    item.remindTime = item.remindTime || "09:00";
    item.updatedAt = new Date().toISOString();
    await putRecord(STORES.recurring, item);
    enabled ? await syncPhoneReminder("recurring", item) : await removePhoneReminder("recurring", item.id);
  } else if (reminder.type === "planned") {
    const item = plannedExpenses.find((entry) => `planned:${entry.id}` === reminder.id);
    if (!item) return;
    item.phoneReminder = enabled;
    item.remindDaysBefore = Number(item.remindDaysBefore ?? 0);
    item.remindTime = item.remindTime || "09:00";
    item.updatedAt = new Date().toISOString();
    await putRecord(STORES.planned, item);
    enabled ? await syncPhoneReminder("planned", item) : await removePhoneReminder("planned", item.id);
  } else if (reminder.type === "custom") {
    const item = customReminders.find((entry) => `custom:${entry.id}` === reminder.id);
    if (!item) return;
    item.phoneReminder = enabled;
    item.remindDaysBefore = Number(item.remindDaysBefore ?? 0);
    item.remindTime = item.remindTime || item.time || "09:00";
    item.updatedAt = new Date().toISOString();
    await persistCustomReminders();
    enabled ? await syncPhoneReminder("custom", item) : await removePhoneReminder("custom", item.id);
  } else {
    const scheduledDate =
      enabled
        ? (
            reminder.date ||
            getTodayString()
          )
        : (
            gentlePushPreferences?.[reminder.id]
              ?.scheduledDate ||
            ""
          );

    gentlePushPreferences = {
      ...gentlePushPreferences,
      [reminder.id]: {
        enabled,
        scheduledDate,
        updatedAt: new Date().toISOString()
      }
    };
    await persistGentlePushPreferences();

    const generic = {
      id: reminder.id,
      title: reminder.title,
      note: reminder.detail,
      date: scheduledDate || reminder.date || getTodayString(),
      phoneReminder: enabled,
      remindDaysBefore: 0,
      remindTime: "09:00"
    };
    enabled
      ? await push?.syncReminder("gentle", generic)
      : await push?.deleteReminder("gentle", generic.id);
  }

  renderSmartReminders();
}

function buildSmartReminders() {
  const reminders = [];

  recurringExpenses.forEach((item) => {
    if (!isRecurringActive(item) || !item.nextDueDate) {
      return;
    }

    const days = reminderDaysFromToday(item.nextDueDate);

    if (days !== null && days <= REMINDER_WINDOWS.recurring) {
      reminders.push({
        id: `recurring:${item.id}`,
        type: "recurring",
        icon: "↻",
        title: item.name || "Recurring expense",
        detail: `${formatCurrency(item.amount || 0, item.currency || "PHP")} · ${getReminderTimingLabel(days, item.nextDueDate)}`,
        date: item.nextDueDate,
        days,
        bucket: getReminderBucket(days),
        nav: "recurring",
        priority: days < 0 ? 0 : days === 0 ? 1 : 3
      });
    }
  });

  plannedExpenses.forEach((item) => {
    if (item.status !== "planned" || !item.targetDate) {
      return;
    }

    const days = reminderDaysFromToday(item.targetDate);

    if (days !== null && days <= REMINDER_WINDOWS.planned) {
      reminders.push({
        id: `planned:${item.id}`,
        type: "planned",
        icon: "☆",
        title: item.title || "Planned purchase",
        detail: `${formatCurrency(item.amount || 0, item.currency || "PHP")} · ${getReminderTimingLabel(days, item.targetDate)}`,
        date: item.targetDate,
        days,
        bucket: getReminderBucket(days),
        nav: "planned",
        priority: days < 0 ? 0 : days === 0 ? 1 : 4
      });
    }
  });

  customReminders.forEach((item) => {
    if (item.completed || !item.date) {
      return;
    }

    const days = reminderDaysFromToday(item.date);

    if (days !== null) {
      reminders.push({
        id: `custom:${item.id}`,
        type: "custom",
        icon: item.icon || "🔔",
        title: item.title || "Reminder",
        detail: `${item.time ? item.time + " · " : ""}${item.note || "Custom reminder"}${item.repeat && item.repeat !== "none" ? ` · Repeats ${item.repeat}` : ""}`,
        date: item.date,
        days,
        bucket: getReminderBucket(days),
        nav: "reminders",
        priority: days < 0 ? 0 : days === 0 ? 1 : days <= 7 ? 3 : 7,
        customId: item.id
      });
    }
  });

  trips.forEach((trip) => {
    if (!trip.startDate) {
      return;
    }

    const days = reminderDaysFromToday(trip.startDate);

    if (days !== null && days >= 0 && days <= REMINDER_WINDOWS.trip) {
      reminders.push({
        id: `trip:${trip.id}`,
        type: "trip",
        icon: "✈️",
        title: trip.name || trip.destination || "Upcoming trip",
        detail: days === 0 ? "Your trip starts today ✨" : `${getReminderTimingLabel(days, trip.startDate)} · ${trip.destination || "Adventure"}`,
        date: trip.startDate,
        days,
        bucket: days <= 7 ? "soon" : "later",
        nav: "trips",
        priority: days === 0 ? 1 : days <= 7 ? 2 : 6
      });
    }
  });

  savingsGoals.forEach((goal) => {
    if (!goal.targetDate || getSavingsGoalProgress(goal) >= 100) {
      return;
    }

    const days = reminderDaysFromToday(goal.targetDate);

    if (days !== null && days <= REMINDER_WINDOWS.savings) {
      const remaining = Math.max(0, Number(goal.targetAmount || 0) - getSavingsGoalSaved(goal));

      reminders.push({
        id: `savings:${goal.id}`,
        type: "savings",
        icon: goal.emoji || "🌱",
        title: goal.name || "Savings goal",
        detail: `${formatCurrency(remaining, goal.currency || "PHP")} left · ${getReminderTimingLabel(days, goal.targetDate)}`,
        date: goal.targetDate,
        days,
        bucket: getReminderBucket(days),
        nav: "savings",
        priority: days < 0 ? 0 : days <= 3 ? 2 : 5
      });
    }
  });

  budgets.forEach((budget) => {
    const percent = getBudgetUsagePercent(budget);

    if (percent >= 80) {
      reminders.push({
        id: `budget-usage:${budget.id}`,
        type: "budget",
        icon: "♡",
        title: percent >= 100 ? `${budget.name} needs a look` : `${budget.name} is getting full`,
        detail: `${Math.round(percent)}% of your ${getPeriodLabel(budget).toLowerCase()} budget used`,
        date: "",
        days: null,
        bucket: percent >= 100 ? "attention" : "soon",
        nav: "budgets",
        priority: percent >= 100 ? 0 : 2
      });
    }

    if (budget.period === "custom" && budget.endDate) {
      const days = reminderDaysFromToday(budget.endDate);

      if (days !== null && days >= 0 && days <= REMINDER_WINDOWS.budgetEnd) {
        reminders.push({
          id: `budget-end:${budget.id}`,
          type: "budget",
          icon: "♡",
          title: `${budget.name} is wrapping up`,
          detail: `Budget period ends ${getReminderTimingLabel(days, budget.endDate).toLowerCase()}`,
          date: budget.endDate,
          days,
          bucket: days <= 1 ? "soon" : "later",
          nav: "budgets",
          priority: 3
        });
      }
    }
  });

  return reminders.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    const aDays = a.days === null ? 9999 : a.days;
    const bDays = b.days === null ? 9999 : b.days;

    return aDays - bDays;
  });
}

function reminderTypeLabel(type) {
  const labels = {
    recurring: "Recurring",
    planned: "Planned",
    trip: "Trip",
    savings: "Savings",
    budget: "Budget",
    custom: "Custom"
  };

  return labels[type] || "Reminder";
}

function createReminderCardHTML(reminder, compact = false) {
  const customActions =
    reminder.type === "custom" && !compact
      ? `
          <span class="custom-reminder-actions">
            <button class="tiny-icon-btn edit-custom-reminder" type="button" data-custom-reminder-id="${escapeHTML(reminder.customId || "")}" aria-label="Edit custom reminder">✎</button>
            <button class="tiny-icon-btn complete-custom-reminder" type="button" data-custom-reminder-id="${escapeHTML(reminder.customId || "")}" aria-label="Mark custom reminder done">✓</button>
            <button class="tiny-icon-btn delete-custom-reminder" type="button" data-custom-reminder-id="${escapeHTML(reminder.customId || "")}" aria-label="Delete custom reminder">🗑</button>
          </span>
        `
      : `<span class="smart-reminder-arrow">›</span>`;

  const pushEnabled = gentleReminderPushEnabled(reminder);
  const pushControl = !compact
    ? `
        <button
          class="gentle-push-toggle ${pushEnabled ? "is-on" : ""}"
          type="button"
          data-gentle-push-id="${escapeHTML(reminder.id)}"
          aria-pressed="${pushEnabled ? "true" : "false"}"
          aria-label="${pushEnabled ? "Turn off" : "Turn on"} phone notification for ${escapeHTML(reminder.title)}"
        >
          <span aria-hidden="true">🔔</span>
          <span>Phone ${pushEnabled ? "On" : "Off"}</span>
        </button>
      `
    : "";

  return `
    <div
      class="smart-reminder-card ${reminder.bucket} ${compact ? "compact" : ""}"
      ${reminder.type === "custom" ? "" : `data-reminder-nav="${escapeHTML(reminder.nav)}"`}
    >
      <span class="smart-reminder-icon">${reminder.icon}</span>
      <span class="smart-reminder-copy">
        <span class="smart-reminder-meta">
          <small>${escapeHTML(reminderTypeLabel(reminder.type))}</small>
          <em>${escapeHTML(
            reminder.days !== null
              ? getReminderTimingLabel(reminder.days, reminder.date)
              : reminder.bucket === "attention"
                ? "Needs attention"
                : "Worth a look"
          )}</em>
        </span>
        <strong>${escapeHTML(reminder.title)}</strong>
        <p>${escapeHTML(reminder.detail)}</p>
        ${pushControl}
      </span>
      ${customActions}
    </div>
  `;
}

function renderSmartReminders() {
  const reminders = buildSmartReminders();
  const list = document.getElementById("reminderList");
  const empty = document.getElementById("reminderEmpty");
  const attentionCount = document.getElementById("reminderAttentionCount");
  const summaryCopy = document.getElementById("reminderSummaryCopy");
  const drawerBadge = document.getElementById("drawerReminderBadge");

  const attention = reminders.filter((item) => item.bucket === "attention").length;
  const soon = reminders.filter((item) => item.bucket === "soon").length;

  if (attentionCount) {
    attentionCount.textContent = String(attention + soon);
  }

  if (summaryCopy) {
    summaryCopy.textContent =
      reminders.length === 0
        ? "All quiet for now 🌸"
        : attention > 0
          ? `${attention} ${attention === 1 ? "thing needs" : "things need"} a little attention`
          : soon > 0
            ? `${soon} ${soon === 1 ? "thing is" : "things are"} coming up soon`
            : "A few things are on the horizon";
  }

  if (drawerBadge) {
    const badgeCount = attention + soon;
    drawerBadge.hidden = badgeCount === 0;
    drawerBadge.textContent = String(Math.min(99, badgeCount));
  }

  if (list && empty) {
    const visible =
      activeReminderFilter === "all"
        ? reminders
        : reminders.filter((item) => item.bucket === activeReminderFilter);

    list.innerHTML = visible.map((item) => createReminderCardHTML(item)).join("");
    empty.hidden = visible.length > 0;

    if (visible.length === 0) {
      const title = empty.querySelector("h3");
      const copy = empty.querySelector("p");

      if (title) {
        title.textContent = activeReminderFilter === "all" ? "All quiet" : "Nothing here";
      }

      if (copy) {
        copy.textContent =
          activeReminderFilter === "all"
            ? "Momo will bring things here automatically when something gets closer."
            : "Try another reminder filter.";
      }
    }
  }

  renderHomeSmartReminders(reminders);
}

function renderHomeSmartReminders(reminders = buildSmartReminders()) {
  const section = document.getElementById("homeRemindersSection");
  const list = document.getElementById("homeReminderList");

  if (!section || !list) {
    return;
  }

  const visible = reminders.slice(0, 3);

  if (visible.length === 0) {
    list.innerHTML = `
      <div class="home-reminder-all-clear">
        <span>🌸</span>
        <div>
          <strong>All quiet for now</strong>
          <p>Momo will nudge you here when something gets closer.</p>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = visible.map((item) => createReminderCardHTML(item, true)).join("");
}

document.querySelectorAll("[data-reminder-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeReminderFilter = button.dataset.reminderFilter || "all";

    document.querySelectorAll("[data-reminder-filter]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderSmartReminders();
  });
});

document.addEventListener("click", async (event) => {
  const toggle = event.target.closest("[data-gentle-push-id]");
  if (!toggle) return;

  event.preventDefault();
  event.stopPropagation();

  const reminderId = toggle.dataset.gentlePushId;
  const nextEnabled = toggle.getAttribute("aria-pressed") !== "true";
  toggle.disabled = true;

  try {
    await setGentleReminderPush(reminderId, nextEnabled);
    showToast(nextEnabled ? "Phone notification added 🔔" : "Phone notification removed");
  } catch (error) {
    showToast(error?.message || "Could not update phone notification.");
  } finally {
    toggle.disabled = false;
  }
});


document.addEventListener("click", (event) => {
  if (event.target.closest("[data-gentle-push-id]")) return;
  const reminder = event.target.closest("[data-reminder-nav]");

  if (!reminder) {
    return;
  }

  const destination = reminder.dataset.reminderNav;

  if (destination) {
    showScreen(destination);
  }
});




// ========================================
// CUSTOM REMINDERS
// ========================================

function persistCustomReminders() {
  return putRecord(
    STORES.settings,
    {
      key: CUSTOM_REMINDERS_SETTING_KEY,
      value: customReminders,
      updatedAt: new Date().toISOString()
    }
  );
}

function toggleCustomReminderPhoneOptions() {
  const toggle = document.getElementById("customReminderPhone");
  const options = document.getElementById("customReminderPhoneOptions");
  if (options) options.hidden = !toggle?.checked;
}

function openCustomReminderModal(id = "") {
  const modal = document.getElementById("customReminderModal");
  const form = document.getElementById("customReminderForm");
  if (!modal || !form) return;

  const existing = customReminders.find((item) => item.id === id);
  editingCustomReminderId = existing?.id || "";
  form.reset();

  document.getElementById("customReminderModalTitle").textContent = existing ? "Edit Reminder" : "Add Reminder";
  document.getElementById("customReminderTitle").value = existing?.title || "";
  document.getElementById("customReminderNote").value = existing?.note || "";
  document.getElementById("customReminderDate").value = existing?.date || getTodayString();
  document.getElementById("customReminderTime").value = existing?.time || "09:00";
  document.getElementById("customReminderRepeat").value = existing?.repeat || "none";
  document.getElementById("customReminderPhone").checked = Boolean(existing?.phoneReminder);
  document.getElementById("customReminderDaysBefore").value = String(existing?.remindDaysBefore ?? 0);
  document.getElementById("customReminderPhoneTime").value = existing?.remindTime || existing?.time || "09:00";
  toggleCustomReminderPhoneOptions();
  modal.hidden = false;
  setTimeout(() => document.getElementById("customReminderTitle")?.focus(), 50);
}

function closeCustomReminderModal() {
  const modal = document.getElementById("customReminderModal");
  if (modal) modal.hidden = true;
  editingCustomReminderId = "";
}

async function saveCustomReminder(event) {
  event.preventDefault();
  const title = document.getElementById("customReminderTitle")?.value.trim() || "";
  const date = document.getElementById("customReminderDate")?.value || "";
  const time = document.getElementById("customReminderTime")?.value || "09:00";
  if (!title || !date) {
    showToast("Add a title and date for this reminder.");
    return;
  }

  const previous = customReminders.find((item) => item.id === editingCustomReminderId);
  const reminder = {
    id: previous?.id || generateId("reminder"),
    title,
    note: document.getElementById("customReminderNote")?.value.trim() || "",
    date,
    time,
    repeat: document.getElementById("customReminderRepeat")?.value || "none",
    repeatAnchorDay:
      previous?.date === date &&
      Number(previous?.repeatAnchorDay)
        ? Number(previous.repeatAnchorDay)
        : Number(
            date.split("-")[2] ||
            1
          ),
    phoneReminder: await resolvePhoneReminderPreference(
      Boolean(
        document.getElementById(
          "customReminderPhone"
        )?.checked
      )
    ),
    remindDaysBefore: Number(document.getElementById("customReminderDaysBefore")?.value || 0),
    remindTime: document.getElementById("customReminderPhoneTime")?.value || time,
    completed: false,
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  customReminders = previous
    ? customReminders.map((item) => item.id === reminder.id ? reminder : item)
    : [...customReminders, reminder];

  await persistCustomReminders();
  await syncPhoneReminder("custom", reminder);
  closeCustomReminderModal();
  renderSmartReminders();
  showToast(previous ? "Reminder updated ✨" : "Reminder added 🔔");
}

async function deleteCustomReminder(id) {
  if (!id) return;
  customReminders = customReminders.filter((item) => item.id !== id);
  await persistCustomReminders();
  await removePhoneReminder("custom", id);
  renderSmartReminders();
  showToast("Reminder deleted");
}

async function completeCustomReminder(id) {
  const item = customReminders.find((entry) => entry.id === id);
  if (!item) return;

  if (item.repeat && item.repeat !== "none") {
    const anchorDay =
      Number(item.repeatAnchorDay) ||
      Number(String(item.date || "").split("-")[2]) ||
      1;

    let nextDate = item.date;

    if (item.repeat === "daily") {
      nextDate = addDaysToDateString(
        item.date,
        1
      );
    }

    if (item.repeat === "weekly") {
      nextDate = addDaysToDateString(
        item.date,
        7
      );
    }

    if (item.repeat === "monthly") {
      nextDate = addMonthsClamped(
        item.date,
        1,
        anchorDay
      );
    }

    if (item.repeat === "yearly") {
      nextDate = addMonthsClamped(
        item.date,
        12,
        anchorDay
      );
    }

    if (!nextDate) {
      showToast(
        "Could not move this reminder to its next date."
      );
      return;
    }

    item.repeatAnchorDay =
      anchorDay;
    item.date = nextDate;
    item.completed = false;
    item.updatedAt = new Date().toISOString();
    await persistCustomReminders();
    await syncPhoneReminder("custom", item);
    showToast(`Done — next reminder set for ${formatShortDate(nextDate)} 🌸`);
  } else {
    item.completed = true;
    item.updatedAt = new Date().toISOString();
    await persistCustomReminders();
    await removePhoneReminder("custom", id);
    showToast("Reminder marked done ✓");
  }
  renderSmartReminders();
}

document.getElementById("addCustomReminderButton")?.addEventListener("click", () => openCustomReminderModal());
document.getElementById("closeCustomReminderModal")?.addEventListener("click", closeCustomReminderModal);
document.getElementById("cancelCustomReminder")?.addEventListener("click", closeCustomReminderModal);
document.getElementById("customReminderPhone")?.addEventListener("change", toggleCustomReminderPhoneOptions);
document.getElementById("customReminderForm")?.addEventListener("submit", saveCustomReminder);
document.getElementById("customReminderModal")?.addEventListener("click", (event) => {
  if (event.target.id === "customReminderModal") closeCustomReminderModal();
});

document.addEventListener("click", async (event) => {
  const edit = event.target.closest(".edit-custom-reminder");
  if (edit) {
    event.stopPropagation();
    openCustomReminderModal(edit.dataset.customReminderId || "");
    return;
  }
  const done = event.target.closest(".complete-custom-reminder");
  if (done) {
    event.stopPropagation();
    await completeCustomReminder(done.dataset.customReminderId || "");
    return;
  }
  const remove = event.target.closest(".delete-custom-reminder");
  if (remove) {
    event.stopPropagation();
    const id = remove.dataset.customReminderId || "";
    if (id && window.confirm("Delete this reminder?")) await deleteCustomReminder(id);
  }
});


// ========================================
// MOMO 1.0 — APP LIFECYCLE + CONNECTIVITY
// ========================================

let momoWasOffline =
  !navigator.onLine;


function updateMomoConnectivityState(
  announce =
    false
) {

  const offline =
    !navigator.onLine;


  document.documentElement
    .classList.toggle(
      "momo-offline",
      offline
    );


  if (
    announce
  ) {

    if (
      offline
    ) {

      showToast(
        "You’re offline — Momo is using the data saved on this device."
      );

    } else if (
      momoWasOffline
    ) {

      showToast(
        "Back online ✨"
      );

    }

  }


  momoWasOffline =
    offline;

}


window.addEventListener(
  "offline",
  () =>
    updateMomoConnectivityState(
      true
    )
);


window.addEventListener(
  "online",
  () =>
    updateMomoConnectivityState(
      true
    )
);


updateMomoConnectivityState();


let momoLastResumeDate =
  getTodayString();


document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState !==
        "visible"
    ) {

      return;

    }


    const today =
      getTodayString();


    /*
      Re-render when Momo is resumed on a different day.
      This keeps Today, reminders, recurring dates, budgets,
      calendar markers, and trip countdowns from looking stale.
    */
    if (
      today !==
      momoLastResumeDate
    ) {

      momoLastResumeDate =
        today;


      try {

        renderAll();

      } catch (
        error
      ) {

        console.error(
          "Momo could not refresh after resume:",
          error
        );

      }

    }

  }
);


window.addEventListener(
  "pageshow",
  (
    event
  ) => {

    /*
      iOS Safari can restore a page from the back-forward cache.
      Refresh lightweight date-sensitive UI when that happens.
    */
    if (
      event.persisted
    ) {

      try {

        renderAll();

      } catch (
        error
      ) {

        console.error(
          "Momo could not refresh after page restore:",
          error
        );

      }

    }

  }
);


// ========================================
// RENDER EVERYTHING
// ========================================

function safelyRenderSection(
  label,
  renderer
) {

  try {

    renderer();

    return true;

  } catch (
    error
  ) {

    console.error(
      `Momo could not render ${label}:`,
      error
    );

    return false;

  }

}


function renderAll() {

  const renderSteps = [

    [
      "Home summary",
      renderHomeSummary
    ],

    [
      "Smart reminders",
      renderSmartReminders
    ],

    [
      "Transactions",
      renderTransactions
    ]

  ];


  const activeScreenRenderers = {
    budgets: ["Budgets", renderBudgets],
    trips: ["Trips", renderTrips],
    calendar: ["Calendar", renderCalendar],
    recurring: ["Recurring expenses", renderRecurringExpenses],
    planned: ["Planned expenses", renderPlannedExpenses],
    add: ["Favorite Quick Add", renderFavoriteQuickAdd],
    payables: ["Payables", renderPayables],
    payday: ["Payday Planner", renderPaydayPlanner],
    savings: ["Savings goals", renderSavingsGoals],
    settlement: ["Shared Settlement", renderTravelSettlement],
    receipts: ["Receipt Gallery", renderReceiptGallery],
    backup: ["Backup status", renderBackupStatus],
    reports: ["Reports", renderReportSummary]
  };


  const activeStep = activeScreenRenderers[currentScreenName];
  if (activeStep) {
    renderSteps.push(activeStep);
  }


  let failedSections =
    0;


  renderSteps.forEach(
    (
      [
        label,
        renderer
      ]
    ) => {

      if (
        !safelyRenderSection(
          label,
          renderer
        )
      ) {

        failedSections++;

      }

    }
  );


  if (
    failedSections >
    0
  ) {

    console.warn(
      `Momo finished loading with ${failedSections} section(s) that could not render.`
    );

  }

}


// ========================================
// ESCAPE KEY
// ========================================

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key !==
      "Escape"
    ) {

      return;

    }


    closeDrawer();


    if (
      budgetModal
    ) {

      budgetModal.hidden =
        true;

    }


    if (
      tripModal
    ) {

      tripModal.hidden =
        true;

    }


    const deleteBudgetModal =
      document.getElementById(
        "deleteModal"
      );


    if (
      deleteBudgetModal
    ) {

      deleteBudgetModal.hidden =
        true;

    }


    const deleteTripModal =
      document.getElementById(
        "deleteTripModal"
      );


    if (
      deleteTripModal
    ) {

      deleteTripModal.hidden =
        true;

    }


    closeExpenseDetail();

    closeMonthlyIncomeModal();

    closeTripShoppingModal();

    closeTripDashboard();


    const deleteExpenseModal =
      document.getElementById(
        "deleteExpenseModal"
      );


    if (
      deleteExpenseModal
    ) {

      deleteExpenseModal.hidden =
        true;

    }


    if (
      recurringModal
    ) {

      recurringModal.hidden =
        true;

    }


    const deleteRecurringModal =
      document.getElementById(
        "deleteRecurringModal"
      );


    if (
      deleteRecurringModal
    ) {

      deleteRecurringModal.hidden =
        true;

    }


    closeSavingsGoalModal();

    closeSavingsGoalDetail();

    closeSavingsContributionModal();


    if (
      restoreBackupModal
    ) {

      restoreBackupModal.hidden =
        true;

    }


    if (
      plannedExpenseModal
    ) {

      plannedExpenseModal.hidden =
        true;

    }


    const deletePlannedExpenseModal =
      document.getElementById(
        "deletePlannedExpenseModal"
      );


    if (
      deletePlannedExpenseModal
    ) {

      deletePlannedExpenseModal.hidden =
        true;

    }


    expensePendingDelete =
      null;


    recurringPendingDelete =
      null;


    pendingBackupRestore =
      null;


    plannedPendingDelete =
      null;

  }
);



// ========================================
// MOMO GUIDE + ONBOARDING
// ========================================

const MOMO_TUTORIAL_KEYS = {
  welcomeComplete:
    "momo_welcome_tour_complete_v1",

  firstUsePrefix:
    "momo_first_use_tip_v1_"
};


const MOMO_HELP_TOPICS = {
  "first-expense": {
    emoji: "💸",
    title: "Add your first expense",
    intro: "An expense is the basic building block of Momo. Add as much detail as is useful to you — most extra fields are optional.",
    steps: [
      "Tap Add in the bottom navigation.",
      "Enter the amount and choose the currency.",
      "Add a title, category, payment method, date, and any optional details you want.",
      "Attach a receipt photo if you want a visual record.",
      "Tap the check mark or Save to store the expense on this device."
    ],
    tip: "For something you buy often, save it as a Quick Add template so the next entry takes fewer taps."
  },

  income: {
    emoji: "💰",
    title: "Add monthly income",
    intro: "Monthly income gives the Home snapshot extra context. It is stored locally and does not connect to a bank account.",
    steps: [
      "Go to Home.",
      "Tap the Income card or Add income.",
      "Enter the income amount for the selected month.",
      "Save it and return to the snapshot."
    ],
    tip: "Income is month-specific, so you can keep historical months separate."
  },

  budgets: {
    emoji: "♡",
    title: "Use Budgets",
    short: "Budgets let you set a spending limit and compare it with the expenses assigned to that budget.",
    intro: "Use budgets to give spending a limit without changing how your expenses are stored.",
    steps: [
      "Open Budgets from the bottom navigation or menu.",
      "Tap + to create a budget.",
      "Choose the amount, period, category, and other available budget details.",
      "When adding an expense, assign it to the matching budget when appropriate.",
      "Return to Budgets to see budgeted, spent, and remaining amounts."
    ],
    tip: "Editing or deleting an assigned expense updates the budget totals automatically."
  },

  receipts: {
    emoji: "📷",
    title: "Receipt photos",
    intro: "Receipt photos stay with the expense so you can keep a visual record of a purchase.",
    steps: [
      "While adding or editing an expense, tap Add Photo.",
      "Choose a photo from your device.",
      "Save the expense.",
      "Open the expense later to see the photo, or use Receipt Gallery from the menu to browse all receipt photos."
    ],
    tip: "Receipt photos are local data, so include them in your regular Momo backups."
  },

  "quick-add": {
    emoji: "⚡",
    title: "Quick Add templates",
    short: "Quick Add remembers repeat expense details and prefills the form — but deliberately leaves the amount blank.",
    intro: "Quick Add is for purchases you make repeatedly, such as Grab, coffee, or a regular shop.",
    steps: [
      "Create or edit an expense with the details you commonly reuse.",
      "Save it as a Quick Add template using the available template action.",
      "Next time, open Add Expense and tap that template near the top.",
      "Momo prefills remembered details such as category, payment method, merchant, tags, trip, or notes.",
      "Enter the new amount and save the expense normally."
    ],
    tip: "The amount is intentionally not saved in a template, so an old price cannot sneak into a new expense."
  },

  search: {
    emoji: "⌕",
    title: "Search & filter expenses",
    intro: "Use Activity when your expense history gets long. Search and filters can narrow the list without changing any data.",
    steps: [
      "Open Activity from the menu.",
      "Type a merchant, trip, category, payment method, tag, or other useful term in search.",
      "Add filters such as date, category, payment method, trip, amount range, tags, or receipt status when needed.",
      "Tap an expense result to open its full details.",
      "Clear the search or filters to return to the full history."
    ],
    tip: "Try a simple real-world term first — for example Grab, Japan, cash, or food."
  },

  savings: {
    emoji: "🌱",
    title: "Savings Goals",
    short: "Savings Goals track money you are setting aside without counting it as an expense.",
    intro: "Use a goal for something you want to save toward while keeping savings separate from spending totals.",
    steps: [
      "Open Savings Goals from the menu.",
      "Tap + and create a goal with a target amount.",
      "Add contributions as you set money aside.",
      "Open the goal later to review its progress.",
      "Edit the goal if the target changes."
    ],
    tip: "Savings Goals are tracking tools inside Momo; they do not move money between real accounts."
  },

  trips: {
    emoji: "✈️",
    title: "Create & use a trip",
    short: "Trips keep travel dates, spending, budgets, shopping, planning, and related tools grouped around one adventure.",
    intro: "Create a trip before or during travel, then assign relevant expenses to it as you spend.",
    steps: [
      "Open Trips and tap +.",
      "Give the trip a name and choose its start and end dates.",
      "Add the available trip budget or currency details you want to track.",
      "When logging travel purchases, assign those expenses to the trip.",
      "Open the Trip Dashboard to review spending and use its related travel tools."
    ],
    tip: "Keeping expenses attached to the correct trip makes the travel totals and trip-specific tools much more useful."
  },

  converter: {
    emoji: "💱",
    title: "Currency Converter",
    intro: "The converter works as both a currency tool and a tiny travel calculator.",
    steps: [
      "Open Currency Converter from the menu or the converter inside Trips.",
      "Choose the two currencies.",
      "Enter one amount, or type a calculation such as 500 + 890 + 1200.",
      "Momo totals the original expression and shows the converted result.",
      "Swap or change currencies whenever you need another comparison."
    ],
    tip: "The smaller original-currency total is useful when adding several prices while shopping."
  },

  shopping: {
    emoji: "🛍️",
    title: "Things I Want to Buy",
    intro: "Each trip can keep its own shopping list, separate from your actual expense history.",
    steps: [
      "Open the Trip Dashboard for the trip you are planning.",
      "Find Things I Want to Buy and add an item.",
      "Add a target price, store or location, photo, or other available details.",
      "Mark the item bought when you purchase it and update the actual price if needed.",
      "Use the shopping summary to compare target and actual purchased totals."
    ],
    tip: "Shopping lists belong to individual trips, so a Japan list stays separate from another adventure."
  },

  settlement: {
    emoji: "🤝",
    title: "Shared Settlement",
    short: "Shared Settlement records everyday, custom-category, and trip costs locally and works out who owes whom.",
    intro: "Use Daily Life for regular splitting, create categories such as Eating Out, Household, Dates, or Friends, or choose a particular trip.",
    steps: [
      "Open Shared Settlement from the menu.",
      "Choose Daily Life, a custom category, or a trip settlement.",
      "Add the people involved.",
      "Record who paid, then split equally or enter exact shares.",
      "The entered currency may differ from the base currency; Momo preserves the original amount and converts it for settlement calculations.",
      "Review balances and Momo's suggested settlement transfers.",
      "Record payments as people settle up."
    ],
    tip: "Settlement data is local to your Momo and is included in the full backup system."
  },

  recurring: {
    emoji: "↻",
    title: "Recurring Expenses",
    short: "Recurring Expenses keep repeat payments visible, whether the amount stays fixed or changes each time.",
    intro: "Use this area as a local tracker for subscriptions, bills, memberships, and other costs that repeat on a schedule.",
    steps: [
      "Open Recurring Expenses from the menu and tap +.",
      "Enter the name, currency, category, payment method, frequency, and next due date.",
      "For a fixed payment, enter its normal amount.",
      "If the amount changes from one payment to the next, turn on Amount varies each time. You can leave the usual amount blank or save a typical amount as a reference.",
      "When you tap Log Expense on a variable recurring item, Momo opens Add Expense with the recurring details prefilled so you can enter that payment's actual amount.",
      "The next due date advances after the expense is saved.",
      "Edit or remove the recurring item when the schedule changes or ends."
    ],
    tip: "Recurring Expenses are only a local tracker — Momo never connects to or charges your bank or card."
  },

  payables: {
    emoji: "🌸",
    title: "Payables",
    short: "Payables keep cards, loans, installments, and borrowed money in one gentle place.",
    intro: "Use Payables for money you still need to pay without mixing it into ordinary expense history before the payment actually happens.",
    steps: [
      "Open Payables from the menu and tap +.",
      "Choose what kind of payable it is: credit card, installment, loan, borrowed money, or Other.",
      "Add the name, remaining balance, currency, due date, and any payment schedule you want to remember.",
      "Credit cards can also keep details such as credit limit, statement balance, minimum due, and statement day.",
      "Open a payable and use Record Payment when you actually pay part or all of it.",
      "Momo updates the remaining balance and keeps the payment history for that payable."
    ],
    tip: "Payables are tracking records only. Recording a payable or payment in Momo does not move real money."
  },

  planned: {
    emoji: "☆",
    title: "Planned Expenses",
    short: "Planned Expenses let you save something you expect to buy without counting it as money already spent.",
    intro: "This is useful for future purchases, travel plans, or anything you want visible before it becomes a real expense.",
    steps: [
      "Open Planned Expenses from the menu.",
      "Tap + and enter the item, target amount, date, category, trip, or notes you need.",
      "Keep it in Planned while it is only an intention.",
      "When you actually buy it, use the purchase/convert action to turn it into an expense.",
      "Review Purchased when you want to see plans that became real spending."
    ],
    tip: "Keeping planned items separate prevents future purchases from inflating today's spending totals."
  },

  calendar: {
    emoji: "▦",
    title: "Calendar",
    intro: "Calendar gives dated money activity another way to be viewed, especially when timing matters.",
    steps: [
      "Open Calendar from the bottom navigation.",
      "Move to the month or date you want to review.",
      "Use the dated entries shown there to understand when activity happened.",
      "Open the relevant item when you need its full details."
    ],
    tip: "Calendar is a view of your Momo data — changing screens does not duplicate the underlying records."
  },

  reports: {
    emoji: "◔",
    title: "Reports",
    short: "Reports summarize the expenses already in Momo so you can see patterns by period and scope.",
    intro: "Use Reports when you want a wider view of where your money went rather than one individual transaction.",
    steps: [
      "Open Reports from the menu.",
      "Choose a period such as this month, last month, this year, or a custom range.",
      "Adjust the available scope or filters when you want a narrower view.",
      "Review totals, category breakdowns, and trend information.",
      "Change the period to compare a different slice of your spending."
    ],
    tip: "Reports are calculated from your existing local expense data, so edits to expenses flow through to the summaries."
  },

  appearance: {
    emoji: "✿",
    title: "Themes & wallpaper",
    intro: "Appearance lets you change Momo's color personality or place your own photo behind the interface.",
    steps: [
      "Tap the flower icon in the top-right corner.",
      "Choose Peach Pink, Sakura Pink, Lavender Purple, Sky Blue, Mint Green, or Soft Yellow.",
      "Optionally choose a wallpaper from your device.",
      "Position and zoom the wallpaper in the crop screen, then apply it.",
      "Adjust the overlay strength if you want more or less separation between the photo and Momo's cards."
    ],
    tip: "Appearance preferences are device-local. Your manual full local backup can protect them, while cloud backup intentionally leaves device appearance local."
  },

  "account-cloud": {
    emoji: "☁️",
    title: "Account & Cloud",
    short: "Momo works without an account. Sign in only if you want access to optional cloud backup.",
    intro: "Your normal Momo data stays local on this device. Logging in does not automatically sync, upload, restore, merge, or replace your local records.",
    steps: [
      "Use Momo normally without signing in if you only want local storage.",
      "Open Account & Cloud from the menu when you want to sign in or create an account.",
      "After signing in, your existing local data stays exactly where it is.",
      "Use Upload This Device to Cloud only when you intentionally want to replace your current cloud copy with this device's local data.",
      "Use Restore Cloud Copy to This Device only when you intentionally want to replace local records with the saved cloud copy.",
      "Sign out whenever you want. Momo remains usable and your local data stays on the device."
    ],
    tip: "Login and Restore are separate actions. Signing in by itself never replaces your local Momo."
  },

  backup: {
    emoji: "⇩",
    title: "Backup & Restore",
    intro: "A full Momo backup protects the local data that lives on this device, including photos and app settings.",
    steps: [
      "Open Backup & Export from the menu.",
      "Tap Export Momo Backup and keep the downloaded JSON somewhere safe.",
      "To restore later, choose a Momo backup file from the Restore section.",
      "Review Momo's validation and restore summary before confirming.",
      "Momo creates a safety backup of the device's current data before destructive restoration begins."
    ],
    tip: "Make a fresh backup periodically, especially before major device changes or if you keep many receipt photos."
  },

  offline: {
    emoji: "☁",
    title: "Using Momo offline",
    intro: "Momo is designed as an installable PWA whose personal data is stored locally on your device.",
    steps: [
      "Open Momo online at least once so the app shell is available to the installed PWA.",
      "Install Momo to your Home Screen if you want the app-like experience.",
      "Use your existing local expenses, trips, budgets, and other stored information even without a connection.",
      "When internet returns, normal app-file updates can be fetched again."
    ],
    tip: "Offline storage is convenient, but it makes your own backup file especially important."
  }
};


const MOMO_FIRST_USE_SCREENS = {
  budgets: "budgets",
  trips: "trips",
  recurring: "recurring",
  planned: "planned",
  savings: "savings",
  settlement: "settlement",
  reports: "reports"
};


const welcomeTour =
  document.getElementById(
    "welcomeTour"
  );

const welcomeTourSlides =
  Array.from(
    document.querySelectorAll(
      "[data-tutorial-slide]"
    )
  );

const welcomeTourDots =
  Array.from(
    document.querySelectorAll(
      "[data-tour-dot]"
    )
  );

const welcomeTourBack =
  document.getElementById(
    "welcomeTourBack"
  );

const welcomeTourNext =
  document.getElementById(
    "welcomeTourNext"
  );

const skipWelcomeTour =
  document.getElementById(
    "skipWelcomeTour"
  );

const replayWelcomeTour =
  document.getElementById(
    "replayWelcomeTour"
  );

const contextTipModal =
  document.getElementById(
    "contextTipModal"
  );

const contextTipEmoji =
  document.getElementById(
    "contextTipEmoji"
  );

const contextTipTitle =
  document.getElementById(
    "contextTipTitle"
  );

const contextTipCopy =
  document.getElementById(
    "contextTipCopy"
  );

const contextTipGotIt =
  document.getElementById(
    "contextTipGotIt"
  );

const contextTipShowHow =
  document.getElementById(
    "contextTipShowHow"
  );

const helpTopicModal =
  document.getElementById(
    "helpTopicModal"
  );

const helpTopicTitle =
  document.getElementById(
    "helpTopicTitle"
  );

const helpTopicEmoji =
  document.getElementById(
    "helpTopicEmoji"
  );

const helpTopicIntro =
  document.getElementById(
    "helpTopicIntro"
  );

const helpTopicSteps =
  document.getElementById(
    "helpTopicSteps"
  );

const helpTopicTip =
  document.getElementById(
    "helpTopicTip"
  );

const closeHelpTopicButton =
  document.getElementById(
    "closeHelpTopic"
  );

const doneHelpTopicButton =
  document.getElementById(
    "doneHelpTopic"
  );


let welcomeTourIndex =
  0;

let welcomeTourTouchStartX =
  null;

let activeContextTopic =
  "";


function setTutorialBodyLock(
  locked
) {

  document.body.classList.toggle(
    "tutorial-open",
    Boolean(
      locked
    )
  );

}


function renderWelcomeTour() {

  const maxIndex =
    Math.max(
      0,
      welcomeTourSlides.length - 1
    );


  welcomeTourIndex =
    Math.min(
      Math.max(
        0,
        welcomeTourIndex
      ),
      maxIndex
    );


  welcomeTourSlides.forEach(
    (slide, index) => {

      slide.classList.toggle(
        "active",
        index ===
          welcomeTourIndex
      );

    }
  );


  welcomeTourDots.forEach(
    (dot, index) => {

      const active =
        index ===
        welcomeTourIndex;


      dot.classList.toggle(
        "active",
        active
      );


      dot.setAttribute(
        "aria-current",
        active
          ? "step"
          : "false"
      );

    }
  );


  if (
    welcomeTourBack
  ) {

    welcomeTourBack.hidden =
      welcomeTourIndex ===
      0;

  }


  if (
    welcomeTourNext
  ) {

    welcomeTourNext.textContent =
      welcomeTourIndex ===
        maxIndex
        ? "Start using Momo ✿"
        : "Next";

  }

}


function openWelcomeTour() {

  if (
    !welcomeTour
  ) {

    return;

  }


  closeDrawer();


  welcomeTourIndex =
    0;


  renderWelcomeTour();


  welcomeTour.hidden =
    false;


  setTutorialBodyLock(
    true
  );

}


function closeWelcomeTour(
  markComplete =
    true
) {

  if (
    welcomeTour
  ) {

    welcomeTour.hidden =
      true;

  }


  if (
    markComplete
  ) {

    localStorage.setItem(
      MOMO_TUTORIAL_KEYS
        .welcomeComplete,
      "yes"
    );

  }


  setTutorialBodyLock(
    false
  );

}


function maybeOpenWelcomeTour() {

  const completed =
    localStorage.getItem(
      MOMO_TUTORIAL_KEYS
        .welcomeComplete
    ) ===
    "yes";


  if (
    !completed
  ) {

    setTimeout(
      openWelcomeTour,
      180
    );

  }

}


welcomeTourBack
  ?.addEventListener(
    "click",
    () => {

      welcomeTourIndex -=
        1;


      renderWelcomeTour();

    }
  );


welcomeTourNext
  ?.addEventListener(
    "click",
    () => {

      if (
        welcomeTourIndex >=
        welcomeTourSlides.length - 1
      ) {

        closeWelcomeTour(
          true
        );

        return;

      }


      welcomeTourIndex +=
        1;


      renderWelcomeTour();

    }
  );


skipWelcomeTour
  ?.addEventListener(
    "click",
    () => {

      closeWelcomeTour(
        true
      );

    }
  );


replayWelcomeTour
  ?.addEventListener(
    "click",
    openWelcomeTour
  );


welcomeTourDots.forEach(
  (dot) => {

    dot.addEventListener(
      "click",
      () => {

        const nextIndex =
          Number(
            dot.dataset
              .tourDot
          );


        if (
          Number.isFinite(
            nextIndex
          )
        ) {

          welcomeTourIndex =
            nextIndex;


          renderWelcomeTour();

        }

      }
    );

  }
);


welcomeTour
  ?.addEventListener(
    "touchstart",
    (event) => {

      welcomeTourTouchStartX =
        event.touches?.[0]
          ?.clientX ??
        null;

    },
    {
      passive: true
    }
  );


welcomeTour
  ?.addEventListener(
    "touchend",
    (event) => {

      if (
        welcomeTourTouchStartX ===
        null
      ) {

        return;

      }


      const endX =
        event.changedTouches?.[0]
          ?.clientX ??
        welcomeTourTouchStartX;


      const delta =
        endX -
        welcomeTourTouchStartX;


      welcomeTourTouchStartX =
        null;


      if (
        Math.abs(
          delta
        ) <
        52
      ) {

        return;

      }


      if (
        delta <
        0 &&
        welcomeTourIndex <
          welcomeTourSlides.length - 1
      ) {

        welcomeTourIndex +=
          1;

      } else if (
        delta >
        0 &&
        welcomeTourIndex >
          0
      ) {

        welcomeTourIndex -=
          1;

      }


      renderWelcomeTour();

    },
    {
      passive: true
    }
  );


function closeHelpTopic() {

  if (
    helpTopicModal
  ) {

    helpTopicModal.hidden =
      true;

  }


  if (
    contextTipModal?.hidden !==
    false &&
    welcomeTour?.hidden !==
    false
  ) {

    setTutorialBodyLock(
      false
    );

  }

}


function openHelpTopic(
  topicKey
) {

  const topic =
    MOMO_HELP_TOPICS[
      topicKey
    ];


  if (
    !topic ||
    !helpTopicModal
  ) {

    return;

  }


  if (
    helpTopicTitle
  ) {

    helpTopicTitle.textContent =
      topic.title;

  }


  if (
    helpTopicEmoji
  ) {

    if (topic.emoji) {

      helpTopicEmoji.textContent =
        topic.emoji;

    } else {

      helpTopicEmoji.innerHTML =
        getMomoPeachIconHTML();

    }

  }


  if (
    helpTopicIntro
  ) {

    helpTopicIntro.textContent =
      topic.intro ||
      "";

  }


  if (
    helpTopicSteps
  ) {

    helpTopicSteps.innerHTML =
      "";


    (
      topic.steps ||
      []
    ).forEach(
      (step) => {

        const item =
          document.createElement(
            "li"
          );


        item.textContent =
          step;


        helpTopicSteps.appendChild(
          item
        );

      }
    );

  }


  if (
    helpTopicTip
  ) {

    const tipCopy =
      helpTopicTip.querySelector(
        "p"
      );


    helpTopicTip.hidden =
      !topic.tip;


    if (
      tipCopy
    ) {

      tipCopy.textContent =
        topic.tip ||
        "";

    }

  }


  helpTopicModal.hidden =
    false;


  setTutorialBodyLock(
    true
  );

}


closeHelpTopicButton
  ?.addEventListener(
    "click",
    closeHelpTopic
  );


doneHelpTopicButton
  ?.addEventListener(
    "click",
    closeHelpTopic
  );


helpTopicModal
  ?.addEventListener(
    "click",
    (event) => {

      if (
        event.target ===
        helpTopicModal
      ) {

        closeHelpTopic();

      }

    }
  );


document.addEventListener(
  "click",
  (event) => {

    const helpButton =
      event.target.closest(
        "[data-help-topic], [data-guide-topic]"
      );


    if (
      !helpButton
    ) {

      return;

    }


    const topic =
      helpButton.dataset
        .helpTopic ||
      helpButton.dataset
        .guideTopic;


    openHelpTopic(
      topic
    );

  }
);


function closeContextTip(
  markSeen =
    true
) {

  if (
    markSeen &&
    activeContextTopic
  ) {

    localStorage.setItem(
      MOMO_TUTORIAL_KEYS
        .firstUsePrefix +
        activeContextTopic,
      "yes"
    );

  }


  activeContextTopic =
    "";


  if (
    contextTipModal
  ) {

    contextTipModal.hidden =
      true;

  }


  if (
    helpTopicModal?.hidden !==
    false &&
    welcomeTour?.hidden !==
    false
  ) {

    setTutorialBodyLock(
      false
    );

  }

}


function maybeShowFirstUseTip(
  screenName
) {

  const topicKey =
    MOMO_FIRST_USE_SCREENS[
      screenName
    ];


  if (
    !topicKey ||
    !contextTipModal
  ) {

    return;

  }


  if (
    localStorage.getItem(
      MOMO_TUTORIAL_KEYS
        .welcomeComplete
    ) !==
    "yes"
  ) {

    return;

  }


  const seenKey =
    MOMO_TUTORIAL_KEYS
      .firstUsePrefix +
    topicKey;


  if (
    localStorage.getItem(
      seenKey
    ) ===
    "yes"
  ) {

    return;

  }


  const topic =
    MOMO_HELP_TOPICS[
      topicKey
    ];


  if (
    !topic
  ) {

    return;

  }


  activeContextTopic =
    topicKey;


  if (
    contextTipEmoji
  ) {

    if (topic.emoji) {

      contextTipEmoji.textContent =
        topic.emoji;

    } else {

      contextTipEmoji.innerHTML =
        getMomoPeachIconHTML();

    }

  }


  if (
    contextTipTitle
  ) {

    contextTipTitle.textContent =
      topic.title;

  }


  if (
    contextTipCopy
  ) {

    contextTipCopy.textContent =
      topic.short ||
      topic.intro ||
      "";

  }


  setTimeout(
    () => {

      if (
        activeContextTopic ===
        topicKey
      ) {

        contextTipModal.hidden =
          false;


        setTutorialBodyLock(
          true
        );

      }

    },
    320
  );

}


contextTipGotIt
  ?.addEventListener(
    "click",
    () => {

      closeContextTip(
        true
      );

    }
  );


contextTipShowHow
  ?.addEventListener(
    "click",
    () => {

      const topic =
        activeContextTopic;


      closeContextTip(
        true
      );


      openHelpTopic(
        topic
      );

    }
  );


contextTipModal
  ?.addEventListener(
    "click",
    (event) => {

      if (
        event.target ===
        contextTipModal
      ) {

        closeContextTip(
          true
        );

      }

    }
  );


window.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key !==
      "Escape"
    ) {

      return;

    }


    if (
      helpTopicModal?.hidden ===
      false
    ) {

      closeHelpTopic();

      return;

    }


    if (
      contextTipModal?.hidden ===
      false
    ) {

      closeContextTip(
        true
      );

    }

  }
);


// MOMO 1.8 — INSIGHTS, FORECASTING, MONTH CLOSE + BUDGET ROLLOVER
const MOMO_MONTH_CLOSE_KEY = "momo_month_close_snapshots_v1";
const MOMO_BUDGET_ROLLOVER_KEY = "momo_budget_rollover_v1";
let momoMonthCloses = [];
let momoBudgetRolloverPrefs = {};

function loadMomo18Settings(records) {
  const closeSetting = records.find((item) => item?.key === MOMO_MONTH_CLOSE_KEY);
  const rolloverSetting = records.find((item) => item?.key === MOMO_BUDGET_ROLLOVER_KEY);
  momoMonthCloses = Array.isArray(closeSetting?.value) ? closeSetting.value : [];
  momoBudgetRolloverPrefs = rolloverSetting?.value && typeof rolloverSetting.value === "object" ? rolloverSetting.value : {};
}

async function saveMomoSetting(key, value) {
  await putRecord(STORES.settings, { key, value, updatedAt: new Date().toISOString() });
}

function momoMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function momoOffsetMonthKey(monthKey, offset) {
  const [year, month] = String(monthKey).split("-").map(Number);
  return momoMonthKey(new Date(year, month - 1 + offset, 1));
}

function momoMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function momoBudgetSpentForMonth(budget, monthKey) {
  return expenses.reduce((total, expense) => {
    if (!String(expense.date || "").startsWith(monthKey)) return total;
    const linked = expense.budgetId === budget.id;
    const categoryMatch = !expense.budgetId && (expense.category || "Other") === (budget.category || "Other");
    if (!linked && !categoryMatch) return total;
    return total + convertCurrency(expense.amount, expense.currency, budget.currency || "PHP");
  }, 0);
}

function getEffectiveBudgetLimit(budget) {
  const base = Math.max(0, Number(budget?.amount || 0));
  if (budget?.period !== "monthly" || base <= 0) return base;
  const pref = momoBudgetRolloverPrefs[budget.id] || { mode: "reset", manual: 0 };
  const currentMonth = getCurrentMonthKey();
  const previousMonth = momoOffsetMonthKey(currentMonth, -1);
  const previousSpent = momoBudgetSpentForMonth(budget, previousMonth);
  const difference = base - previousSpent;
  if (pref.mode === "roll-unused") return base + Math.max(0, difference);
  if (pref.mode === "carry-overspending") return Math.max(0, base - Math.max(0, -difference));
  if (pref.mode === "manual") return Math.max(0, base + Number(pref.manual || 0));
  return base;
}

const momo18CoreBudgetUsage = getBudgetUsagePercent;
getBudgetUsagePercent = function(budget) {
  const limit = getEffectiveBudgetLimit(budget);
  return limit > 0 ? getBudgetSpent(budget) / limit * 100 : 0;
};

const momo18CoreBudgetAlert = getBudgetAlertState;
getBudgetAlertState = function(budget) {
  const spent = getBudgetSpent(budget);
  const limit = getEffectiveBudgetLimit(budget);
  if (limit <= 0) return null;
  const percent = spent / limit * 100;
  const left = Math.max(0, limit - spent);
  const over = Math.max(0, spent - limit);
  if (percent >= 100) return { level: "over", threshold: 100, percent, icon: "!", title: over ? `${budget.name} is over budget` : `${budget.name} reached its limit`, message: over ? `${formatCurrency(over, budget.currency)} over the ${formatCurrency(limit, budget.currency)} effective limit` : `You've used the full ${formatCurrency(limit, budget.currency)} effective budget` };
  if (percent >= 90) return { level: "critical", threshold: 90, percent, icon: "!", title: `${budget.name} is almost full`, message: `${percent.toFixed(0)}% used · ${formatCurrency(left, budget.currency)} left` };
  if (percent >= 75) return { level: "warning", threshold: 75, percent, icon: "◔", title: `${budget.name} is getting close`, message: `${percent.toFixed(0)}% used · ${formatCurrency(left, budget.currency)} left` };
  if (percent >= 50) return { level: "notice", threshold: 50, percent, icon: "♡", title: `${budget.name} passed halfway`, message: `${percent.toFixed(0)}% of this budget has been used` };
  return null;
};

function momoExpensesForMonth(monthKey) {
  return expenses.filter((expense) => String(expense.date || "").startsWith(monthKey));
}

function momoSavingsForMonth(monthKey) {
  return savingsGoals.reduce((total, goal) => total + convertCurrency(
    (Array.isArray(goal.contributions) ? goal.contributions : []).filter((item) => String(item.date || "").startsWith(monthKey)).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    goal.currency || "PHP", "PHP"
  ), 0);
}

function momoPaidPayablesForMonth(monthKey) {
  return cards.reduce((total, payable) => total + getPayablePayments(payable).filter((item) => String(item.date || "").startsWith(monthKey)).reduce((sum, item) => sum + payablePHPValue(payable, item.amount), 0), 0);
}

function momoCategoryTotals(monthKey) {
  const totals = new Map();
  for (const expense of momoExpensesForMonth(monthKey)) {
    const label = expense.category === "Other" && expense.otherCategory ? expense.otherCategory : (expense.category || "Other");
    totals.set(label, (totals.get(label) || 0) + convertCurrency(expense.amount, expense.currency, "PHP"));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function momoForecastCurrentMonth() {
  const today = new Date();
  const monthKey = getCurrentMonthKey();
  const days = getDaysInMonth(today.getFullYear(), today.getMonth());
  const elapsed = Math.max(1, today.getDate());
  const spent = totalExpensesPHP(momoExpensesForMonth(monthKey));
  const average = spent / elapsed;
  const monthEnd = `${monthKey}-${String(days).padStart(2, "0")}`;
  const tomorrow = addDaysToDateString(getTodayString(), 1);
  const scheduled = tomorrow <= monthEnd ? buildScheduledCashFlow(tomorrow, monthEnd).totalPHP : 0;
  const projectedSpending = spent + average * Math.max(0, days - elapsed) + scheduled;
  const base = clampMoney(monthlyIncomeByMonth[monthKey]) || clampMoney(getCurrentMonthlyBudgetTotal());
  const protectedSavings = getProtectedSavingsRemainingPHP(monthKey);
  const projectedLeft = base > 0 ? base - projectedSpending - protectedSavings : null;
  return { monthKey, days, elapsed, spent, average, scheduled, projectedSpending, protectedSavings, base, projectedLeft };
}

function momoBudgetPaceRows() {
  const now = new Date();
  const monthProgress = now.getDate() / getDaysInMonth(now.getFullYear(), now.getMonth()) * 100;
  return budgets.filter((budget) => budget.period === "monthly" && Number(budget.amount || 0) > 0).map((budget) => {
    const budgetProgress = getBudgetUsagePercent(budget);
    const delta = budgetProgress - monthProgress;
    return { budget, budgetProgress, monthProgress, delta, tone: delta > 12 ? "ahead" : delta < -12 ? "under" : "even" };
  }).sort((a, b) => b.delta - a.delta);
}

function momoBuildNotices() {
  const notices = [];
  const comparison = getMonthToDateComparison();
  if (comparison.previousSpent > 0) {
    const change = (comparison.currentSpent - comparison.previousSpent) / comparison.previousSpent * 100;
    if (Math.abs(change) >= 10) notices.push({ icon: change > 0 ? "◔" : "♡", title: `Spending is ${Math.abs(change).toFixed(0)}% ${change > 0 ? "higher" : "lower"} than the same point last month`, copy: `${formatPHP(comparison.currentSpent)} now vs ${formatPHP(comparison.previousSpent)} through the same day.` });
  }
  const due = buildScheduledCashFlow(getTodayString(), addDaysToDateString(getTodayString(), 7));
  if (due.totalPHP > 0) notices.push({ icon: "🔔", title: `${formatPHP(due.totalPHP)} is known to be due in the next 7 days`, copy: "This combines dated recurring items, planned expenses, and payable payments you entered in Momo." });
  const subscriptionAnnual = recurringExpenses.filter((item) => isRecurringActive(item) && (item.kind === "subscription" || item.category === "Subscriptions")).reduce((sum, item) => sum + convertCurrency(Number(item.amount || 0) * getRecurringMonthlyFactor(item.frequency) * 12, item.currency || "PHP", "PHP"), 0);
  if (subscriptionAnnual > 0) notices.push({ icon: "↻", title: `Subscriptions are about ${formatPHP(subscriptionAnnual)} a year`, copy: "An estimate from the active subscription amounts and frequencies currently saved." });
  const ahead = momoBudgetPaceRows().filter((row) => row.tone === "ahead").slice(0, 2);
  for (const row of ahead) notices.push({ icon: "!", title: `${row.budget.name} is moving faster than the month`, copy: `${row.budgetProgress.toFixed(0)}% of the budget is used while ${row.monthProgress.toFixed(0)}% of the month has passed.` });
  if (!notices.length) notices.push({ icon: "🍑", title: "Nothing urgent is standing out", copy: "Momo will surface useful patterns here as you add more real data." });
  return notices.slice(0, 6);
}

function momoBuildMonthSnapshot(monthKey) {
  const list = momoExpensesForMonth(monthKey);
  const category = momoCategoryTotals(monthKey)[0] || null;
  const spent = totalExpensesPHP(list);
  const income = clampMoney(monthlyIncomeByMonth[monthKey]);
  const saved = momoSavingsForMonth(monthKey);
  const paid = momoPaidPayablesForMonth(monthKey);
  const tripCount = new Set(list.map((item) => item.tripId).filter(Boolean)).size;
  return { monthKey, savedAt: new Date().toISOString(), spent, income, saved, paid, tripCount, expenseCount: list.length, biggestCategory: category?.[0] || "", biggestCategoryAmount: category?.[1] || 0, balance: income > 0 ? income - spent - saved : null };
}

async function momoSaveMonthClose(monthKey) {
  const snapshot = momoBuildMonthSnapshot(monthKey);
  momoMonthCloses = [snapshot, ...momoMonthCloses.filter((item) => item.monthKey !== monthKey)].slice(0, 36);
  await saveMomoSetting(MOMO_MONTH_CLOSE_KEY, momoMonthCloses);
  renderMomoInsights();
  showToast(`${momoMonthLabel(monthKey)} snapshot saved ✓`);
}

function renderMomoInsights() {
  const forecastSpend = document.getElementById("momoForecastSpend");
  if (!forecastSpend) return;
  const forecast = momoForecastCurrentMonth();
  forecastSpend.textContent = formatPHP(forecast.projectedSpending);
  document.getElementById("momoForecastLeft").textContent = forecast.projectedLeft === null ? "Add income or budget" : formatPHP(Math.max(0, forecast.projectedLeft));
  document.getElementById("momoForecastCommitments").textContent = formatPHP(forecast.scheduled);
  document.getElementById("momoForecastProtected").textContent = formatPHP(forecast.protectedSavings);
  document.getElementById("momoForecastAssumptions").textContent = `Projection = ${formatPHP(forecast.spent)} already spent + your ${formatPHP(forecast.average)} daily pace for the rest of the month + ${formatPHP(forecast.scheduled)} of known dated commitments. It is an estimate, not financial advice.`;

  const notices = document.getElementById("momoNoticesList");
  notices.innerHTML = momoBuildNotices().map((item) => `<article class="momo-notice"><span>${item.icon}</span><div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.copy)}</p></div></article>`).join("");

  const paceRows = momoBudgetPaceRows();
  document.getElementById("momoMonthPacePill").textContent = `${forecast.elapsed}/${forecast.days} days`;
  document.getElementById("momoSpendingPaceList").innerHTML = paceRows.length ? paceRows.map((row) => `<article class="momo-pace-row ${row.tone}"><div><strong>${escapeHTML(row.budget.name)}</strong><small>${row.budgetProgress.toFixed(0)}% used · ${row.monthProgress.toFixed(0)}% of month passed</small></div><span>${row.tone === "ahead" ? "Ahead of pace" : row.tone === "under" ? "Under pace" : "On pace"}</span></article>`).join("") : `<div class="momo-tool-empty">Create a monthly budget to see spending pace.</div>`;

  const rollover = document.getElementById("momoBudgetRolloverList");
  const monthly = budgets.filter((item) => item.period === "monthly");
  rollover.innerHTML = monthly.length ? monthly.map((budget) => {
    const pref = momoBudgetRolloverPrefs[budget.id] || { mode: "reset", manual: 0 };
    const effective = getEffectiveBudgetLimit(budget);
    return `<article class="momo-rollover-row"><div><strong>${escapeHTML(budget.name)}</strong><small>Base ${formatCurrency(budget.amount, budget.currency)} · effective ${formatCurrency(effective, budget.currency)}</small></div><select data-momo-rollover-mode="${escapeHTML(budget.id)}"><option value="reset" ${pref.mode === "reset" ? "selected" : ""}>Reset monthly</option><option value="roll-unused" ${pref.mode === "roll-unused" ? "selected" : ""}>Roll unused forward</option><option value="carry-overspending" ${pref.mode === "carry-overspending" ? "selected" : ""}>Carry overspending forward</option><option value="manual" ${pref.mode === "manual" ? "selected" : ""}>Manual adjustment</option></select>${pref.mode === "manual" ? `<input data-momo-rollover-manual="${escapeHTML(budget.id)}" type="number" step="0.01" value="${Number(pref.manual || 0)}" aria-label="Manual rollover adjustment">` : ""}</article>`;
  }).join("") : `<div class="momo-tool-empty">Monthly budgets will appear here.</div>`;

  const select = document.getElementById("momoMonthCloseSelect");
  const monthKeys = new Set([getCurrentMonthKey(), ...expenses.map((item) => String(item.date || "").slice(0, 7)).filter((item) => /^\d{4}-\d{2}$/.test(item))]);
  const sortedKeys = [...monthKeys].sort().reverse().slice(0, 36);
  const previous = select.value;
  select.innerHTML = sortedKeys.map((key) => `<option value="${key}">${escapeHTML(momoMonthLabel(key))}</option>`).join("");
  if (sortedKeys.includes(previous)) select.value = previous;
  document.getElementById("momoMonthCloseList").innerHTML = momoMonthCloses.length ? momoMonthCloses.slice(0, 12).map((item) => `<article class="momo-month-close-row"><div><strong>${escapeHTML(momoMonthLabel(item.monthKey))}</strong><small>${item.expenseCount} expenses · ${item.biggestCategory ? `top: ${escapeHTML(item.biggestCategory)}` : "no category yet"}</small></div><div><b>${formatPHP(item.spent)}</b><small>${item.income > 0 ? `${formatPHP(Math.max(0, item.balance ?? 0))} left` : `${formatPHP(item.saved)} saved`}</small></div></article>`).join("") : `<div class="momo-tool-empty">No month snapshots saved yet.</div>`;
}

const momo18CoreRenderAll = renderAll;
renderAll = function() {
  momo18CoreRenderAll();
  renderMomoInsights();
};

const momo18CoreShowScreen = showScreen;
showScreen = function(name) {
  momo18CoreShowScreen(name);
  if (name === "insights") renderMomoInsights();
};

document.addEventListener("change", async (event) => {
  const mode = event.target.closest("[data-momo-rollover-mode]");
  if (mode) {
    const id = mode.dataset.momoRolloverMode;
    momoBudgetRolloverPrefs[id] = { ...(momoBudgetRolloverPrefs[id] || {}), mode: mode.value };
    await saveMomoSetting(MOMO_BUDGET_ROLLOVER_KEY, momoBudgetRolloverPrefs);
    renderAll();
    return;
  }
  const manual = event.target.closest("[data-momo-rollover-manual]");
  if (manual) {
    const id = manual.dataset.momoRolloverManual;
    momoBudgetRolloverPrefs[id] = { ...(momoBudgetRolloverPrefs[id] || {}), mode: "manual", manual: Number(manual.value || 0) };
    await saveMomoSetting(MOMO_BUDGET_ROLLOVER_KEY, momoBudgetRolloverPrefs);
    renderAll();
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-momo-close-month]")) return;
  const select = document.getElementById("momoMonthCloseSelect");
  if (select?.value) momoSaveMonthClose(select.value).catch((error) => { console.error(error); showToast("Could not save that month snapshot."); });
});


// MOMO 1.9 — CUSTOM HOME + GLOBAL MONEY SEARCH
const MOMO_HOME_LAYOUT_KEY = "momo_home_layout_v1";
const MOMO_HOME_DEFAULT_ORDER = ["snapshot", "today", "reminders", "adventure", "lately"];
const MOMO_HOME_LABELS = { snapshot: ["Money Snapshot", "Your month at a glance"], today: ["Momo Today", "Safe to Spend and what is due"], reminders: ["Gentle Nudges", "Upcoming reminders"], adventure: ["Next Adventure", "Trip snapshot"], lately: ["Recent Spending", "Your latest entries"] };
let momoHomeLayout = { order: [...MOMO_HOME_DEFAULT_ORDER], hidden: [], density: "cozy" };
let momoSearchTimer = null;
let momoSearchRunId = 0;

function loadMomo19Settings(records) {
  const setting = records.find((item) => item?.key === MOMO_HOME_LAYOUT_KEY)?.value;
  if (setting && typeof setting === "object") {
    const order = Array.isArray(setting.order) ? setting.order.filter((id) => MOMO_HOME_DEFAULT_ORDER.includes(id)) : [];
    momoHomeLayout = { order: [...order, ...MOMO_HOME_DEFAULT_ORDER.filter((id) => !order.includes(id))], hidden: Array.isArray(setting.hidden) ? setting.hidden.filter((id) => MOMO_HOME_DEFAULT_ORDER.includes(id)) : [], density: setting.density === "compact" ? "compact" : "cozy" };
  }
}

async function saveMomoHomeLayout() {
  await saveMomoSetting(MOMO_HOME_LAYOUT_KEY, momoHomeLayout);
}

function applyMomoHomeLayout() {
  const home = document.querySelector('[data-screen="home"]');
  if (!home) return;
  for (const id of momoHomeLayout.order) {
    const element = home.querySelector(`[data-home-module="${id}"]`);
    if (element) home.appendChild(element);
  }
  home.querySelectorAll("[data-home-module]").forEach((element) => { element.hidden = momoHomeLayout.hidden.includes(element.dataset.homeModule); });
  document.body.classList.toggle("momo-home-compact", momoHomeLayout.density === "compact");
}

function renderMomoHomeCustomizer() {
  const list = document.getElementById("momoHomeModuleList");
  if (!list) return;
  list.innerHTML = momoHomeLayout.order.map((id, index) => {
    const label = MOMO_HOME_LABELS[id] || [id, ""];
    const hidden = momoHomeLayout.hidden.includes(id);
    return `<article class="momo-home-module-row"><label><input type="checkbox" data-momo-home-visible="${id}" ${hidden ? "" : "checked"}><span><strong>${escapeHTML(label[0])}</strong><small>${escapeHTML(label[1])}</small></span></label><div><button type="button" data-momo-home-move="${id}" data-direction="up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-momo-home-move="${id}" data-direction="down" ${index === momoHomeLayout.order.length - 1 ? "disabled" : ""}>↓</button></div></article>`;
  }).join("");
  document.querySelectorAll("[data-momo-density]").forEach((button) => button.classList.toggle("active", button.dataset.momoDensity === momoHomeLayout.density));
}

function momoSearchNormalize(value) { return normalizeActivitySearchText(value || ""); }
function momoSearchTokens() { return momoSearchNormalize(document.getElementById("momoGlobalSearchInput")?.value).split(" ").filter(Boolean); }
function momoSearchYield() { return new Promise((resolve) => requestAnimationFrame(resolve)); }
function momoSearchMatchesTokens(text, tokens) { const normalized = momoSearchNormalize(text); return tokens.every((token) => normalized.includes(token)); }
function momoSearchDateOkay(date, from, to) { return (!from || !date || date >= from) && (!to || !date || date <= to); }
function momoSearchAmountOkay(amount, min, max) { return (min === null || amount >= min) && (max === null || amount <= max); }

function populateMomoSearchFilters() {
  const category = document.getElementById("momoGlobalSearchCategory");
  const payment = document.getElementById("momoGlobalSearchPayment");
  const trip = document.getElementById("momoGlobalSearchTrip");
  if (!category || !payment || !trip) return;
  const current = [category.value, payment.value, trip.value];
  const categories = [...new Set(expenses.map((item) => item.category === "Other" && item.otherCategory ? item.otherCategory : item.category).filter(Boolean))].sort();
  const payments = [...new Set(expenses.map((item) => item.paymentMethod === "Other" && item.otherPaymentMethod ? item.otherPaymentMethod : item.paymentMethod).filter(Boolean))].sort();
  category.innerHTML = `<option value="">All categories</option>${categories.map((item) => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join("")}`;
  payment.innerHTML = `<option value="">All payment methods</option>${payments.map((item) => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join("")}`;
  trip.innerHTML = `<option value="">All trips</option><option value="__personal__">Personal / no trip</option>${trips.map((item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`).join("")}`;
  [category, payment, trip].forEach((control, index) => { if ([...control.options].some((option) => option.value === current[index])) control.value = current[index]; });
}

async function runMomoGlobalSearch() {
  const resultsElement = document.getElementById("momoGlobalSearchResults");
  const statusElement = document.getElementById("momoGlobalSearchStatus");
  if (!resultsElement || !statusElement) return;
  const runId = ++momoSearchRunId;
  const type = document.getElementById("momoGlobalSearchType")?.value || "all";
  const tokens = momoSearchTokens();
  const category = document.getElementById("momoGlobalSearchCategory")?.value || "";
  const payment = document.getElementById("momoGlobalSearchPayment")?.value || "";
  const tripId = document.getElementById("momoGlobalSearchTrip")?.value || "";
  const receipt = document.getElementById("momoGlobalSearchReceipt")?.value || "";
  const from = document.getElementById("momoGlobalSearchFrom")?.value || "";
  const to = document.getElementById("momoGlobalSearchTo")?.value || "";
  const minRaw = document.getElementById("momoGlobalSearchMin")?.value;
  const maxRaw = document.getElementById("momoGlobalSearchMax")?.value;
  const min = minRaw === "" || minRaw == null ? null : Number(minRaw);
  const max = maxRaw === "" || maxRaw == null ? null : Number(maxRaw);
  const hasFilter = tokens.length || type !== "all" || category || payment || tripId || receipt || from || to || min !== null || max !== null;
  if (!hasFilter) { resultsElement.innerHTML = `<div class="momo-tool-empty">Search by a word, type, date, amount, category, payment method, trip, or receipt.</div>`; statusElement.textContent = "Type something or choose a filter."; return; }
  statusElement.textContent = "Searching…";
  const output = [];
  const push = (item) => { if (output.length < 120) output.push(item); };
  const tripLookup = new Map(trips.map((item) => [item.id, item]));

  if (type === "all" || type === "expense") {
    for (let i = 0; i < expenses.length && output.length < 120; i += 1) {
      if (runId !== momoSearchRunId) return;
      const item = expenses[i]; const amountPHP = convertCurrency(item.amount, item.currency, "PHP");
      const categoryText = item.category === "Other" && item.otherCategory ? item.otherCategory : (item.category || "Other");
      const paymentText = item.paymentMethod === "Other" && item.otherPaymentMethod ? item.otherPaymentMethod : (item.paymentMethod || "");
      if (category && categoryText !== category) continue; if (payment && paymentText !== payment) continue;
      if (tripId === "__personal__" && item.tripId) continue; if (tripId && tripId !== "__personal__" && item.tripId !== tripId) continue;
      if (receipt === "with" && !item.photo) continue; if (receipt === "without" && item.photo) continue;
      if (!momoSearchDateOkay(item.date, from, to) || !momoSearchAmountOkay(amountPHP, min, max)) continue;
      const trip = tripLookup.get(item.tripId); const text = [item.title, item.location, item.notes, categoryText, paymentText, item.date, trip?.name, ...(normalizeExpenseTags(item.tags) || [])].join(" ");
      if (tokens.length && !momoSearchMatchesTokens(text, tokens)) continue;
      push({ kind: "expense", id: item.id, icon: getCategoryEmoji(item.category), title: item.title || "Expense", meta: `${categoryText} · ${formatShortDate(item.date)}`, amount: formatCurrency(item.amount, item.currency), destination: "activity" });
      if (i && i % 1200 === 0) await momoSearchYield();
    }
  }

  const scan = async (kind, list, mapper) => {
    if (type !== "all" && type !== kind) return;
    for (let i = 0; i < list.length && output.length < 120; i += 1) {
      if (runId !== momoSearchRunId) return;
      const mapped = mapper(list[i]); if (!mapped) continue;
      if (!momoSearchDateOkay(mapped.date, from, to) || !momoSearchAmountOkay(mapped.amountPHP || 0, min, max)) continue;
      if (tokens.length && !momoSearchMatchesTokens(mapped.searchText, tokens)) continue;
      push({ kind, ...mapped });
      if (i && i % 800 === 0) await momoSearchYield();
    }
  };
  await scan("planned", plannedExpenses, (item) => ({ id: item.id, icon: "☆", title: item.title || "Planned expense", meta: `${item.status || "planned"} · ${item.targetDate ? formatShortDate(item.targetDate) : "no date"}`, amount: Number(item.amount || 0) ? formatCurrency(item.amount, item.currency || "PHP") : "Amount not set", amountPHP: convertCurrency(item.amount, item.currency || "PHP", "PHP"), date: item.targetDate, destination: "planned", searchText: [item.title, item.notes, item.category, item.targetDate].join(" ") }));
  await scan("recurring", recurringExpenses, (item) => ({ id: item.id, icon: "↻", title: item.name || "Recurring", meta: `${item.kind || "bill"} · ${item.nextDueDate ? formatShortDate(item.nextDueDate) : "no due date"}`, amount: Number(item.amount || 0) ? formatCurrency(item.amount, item.currency || "PHP") : "Varies", amountPHP: convertCurrency(item.amount, item.currency || "PHP", "PHP"), date: item.nextDueDate, destination: "recurring", searchText: [item.name, item.notes, item.kind, item.category, item.paymentMethod].join(" ") }));
  await scan("payable", cards, (item) => ({ id: item.id, icon: "♡", title: item.name || "Payable", meta: `${getPayableMeta(item).label} · ${item.dueDate ? formatShortDate(item.dueDate) : "no due date"}`, amount: formatCurrency(getPayableBalance(item), item.currency || "PHP"), amountPHP: payablePHPValue(item, getPayableBalance(item)), date: item.dueDate, destination: "payables", searchText: [item.name, item.provider, item.notes, getPayableMeta(item).label].join(" ") }));
  await scan("savings", savingsGoals, (item) => ({ id: item.id, icon: item.emoji || "🌱", title: item.name || "Savings", meta: `${item.jarMode ? "Peach Jar" : "Savings goal"} · ${Math.round(getSavingsGoalProgress(item))}%`, amount: formatCurrency(getSavingsGoalSaved(item), item.currency || "PHP"), amountPHP: convertCurrency(getSavingsGoalSaved(item), item.currency || "PHP", "PHP"), date: item.targetDate, destination: "savings", searchText: [item.name, item.notes, item.jarMode ? "peach jar" : "savings goal"].join(" ") }));
  await scan("trip", trips, (item) => ({ id: item.id, icon: "✈", title: item.name || "Trip", meta: item.destination || "Trip", amount: Number(item.budget || 0) ? formatCurrency(item.budget, item.currency || "PHP") : "No budget", amountPHP: convertCurrency(item.budget, item.currency || "PHP", "PHP"), date: item.startDate, destination: "trips", searchText: [item.name, item.destination, item.notes, item.startDate, item.endDate].join(" ") }));
  if (runId !== momoSearchRunId) return;
  statusElement.textContent = `${output.length}${output.length === 120 ? "+" : ""} result${output.length === 1 ? "" : "s"}`;
  resultsElement.innerHTML = output.length ? output.map((item) => `<button class="momo-global-result" type="button" data-momo-search-kind="${item.kind}" data-momo-search-id="${escapeHTML(item.id)}" data-momo-search-destination="${item.destination}"><span>${item.icon}</span><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.meta || "")}</small></div><b>${escapeHTML(item.amount || "")}</b></button>`).join("") : `<div class="momo-tool-empty">No matching Momo records.</div>`;
}

function scheduleMomoGlobalSearch() { clearTimeout(momoSearchTimer); momoSearchTimer = setTimeout(() => runMomoGlobalSearch().catch(console.error), 220); }
function renderMomoGlobalSearch() { populateMomoSearchFilters(); scheduleMomoGlobalSearch(); }

const momo19CoreRenderAll = renderAll;
renderAll = function() { momo19CoreRenderAll(); applyMomoHomeLayout(); if (currentScreenName === "dashboard") renderMomoHomeCustomizer(); };
const momo19CoreShowScreen = showScreen;
showScreen = function(name) { momo19CoreShowScreen(name); if (name === "search") renderMomoGlobalSearch(); if (name === "dashboard") renderMomoHomeCustomizer(); applyMomoHomeLayout(); };

document.addEventListener("input", (event) => { if (event.target.matches("#momoGlobalSearchInput,#momoGlobalSearchFrom,#momoGlobalSearchTo,#momoGlobalSearchMin,#momoGlobalSearchMax")) scheduleMomoGlobalSearch(); });
document.addEventListener("change", (event) => { if (event.target.matches("#momoGlobalSearchType,#momoGlobalSearchCategory,#momoGlobalSearchPayment,#momoGlobalSearchTrip,#momoGlobalSearchReceipt")) scheduleMomoGlobalSearch(); });
document.addEventListener("click", async (event) => {
  if (event.target.closest("#momoGlobalSearchClear")) {
    ["momoGlobalSearchInput","momoGlobalSearchFrom","momoGlobalSearchTo","momoGlobalSearchMin","momoGlobalSearchMax"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
    ["momoGlobalSearchCategory","momoGlobalSearchPayment","momoGlobalSearchTrip","momoGlobalSearchReceipt"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
    const type = document.getElementById("momoGlobalSearchType"); if (type) type.value = "all"; scheduleMomoGlobalSearch(); return;
  }
  const result = event.target.closest("[data-momo-search-destination]");
  if (result) {
    if (result.dataset.momoSearchKind === "expense") { const item = expenses.find((entry) => entry.id === result.dataset.momoSearchId); if (item) openExpenseDetail(item); }
    else showScreen(result.dataset.momoSearchDestination);
    return;
  }
  const visible = event.target.closest("[data-momo-home-visible]");
  if (visible) {
    const id = visible.dataset.momoHomeVisible; const nextHidden = new Set(momoHomeLayout.hidden);
    if (visible.checked) nextHidden.delete(id); else nextHidden.add(id);
    if (nextHidden.size >= MOMO_HOME_DEFAULT_ORDER.length) { visible.checked = true; showToast("Keep at least one Home card visible."); return; }
    momoHomeLayout.hidden = [...nextHidden]; await saveMomoHomeLayout(); applyMomoHomeLayout(); renderMomoHomeCustomizer(); return;
  }
  const move = event.target.closest("[data-momo-home-move]");
  if (move) {
    const id = move.dataset.momoHomeMove; const index = momoHomeLayout.order.indexOf(id); const target = index + (move.dataset.direction === "up" ? -1 : 1);
    if (index >= 0 && target >= 0 && target < momoHomeLayout.order.length) { const next = [...momoHomeLayout.order]; [next[index], next[target]] = [next[target], next[index]]; momoHomeLayout.order = next; await saveMomoHomeLayout(); applyMomoHomeLayout(); renderMomoHomeCustomizer(); }
    return;
  }
  const density = event.target.closest("[data-momo-density]");
  if (density) { momoHomeLayout.density = density.dataset.momoDensity === "compact" ? "compact" : "cozy"; await saveMomoHomeLayout(); applyMomoHomeLayout(); renderMomoHomeCustomizer(); }
});


// MOMO 1.10 — DEEPER TOOLS + MOMO-ONLY FEATURES
const MOMO_JAR_PAUSE_KEY = "momo_paused_peach_jars_v1";
let momoPausedJars = new Set();

function loadMomo10Settings(records) {
  const value = records.find((item) => item?.key === MOMO_JAR_PAUSE_KEY)?.value;
  momoPausedJars = new Set(Array.isArray(value) ? value : []);
}

const momo10CoreProtectedSavings = getProtectedSavingsRemainingPHP;
getProtectedSavingsRemainingPHP = function(monthKey = getCurrentMonthKey()) {
  return savingsGoals.reduce((total, goal) => {
    if (!goal?.protectedJar || momoPausedJars.has(goal.id) || Number(goal.monthlyPlan || 0) <= 0) return total;
    const plannedPHP = convertCurrency(Number(goal.monthlyPlan || 0), goal.currency || "PHP", "PHP");
    return total + Math.max(0, plannedPHP - getSavingsGoalMonthContributedPHP(goal, monthKey));
  }, 0);
};

function momoFlexibleExpense(expense) {
  return !new Set(["Bills", "Subscriptions", "Groceries"]).has(expense.category || "Other");
}

function momoDaysOfSafeSpend(amountPHP) {
  const safe = getMomoTodaySnapshot().safePerDay;
  return safe && safe > 0 ? amountPHP / safe : null;
}

function renderMomoFutureBuys() {
  const list = document.getElementById("momoFutureList"); if (!list) return;
  const planned = plannedExpenses.filter((item) => item.status === "planned").slice().sort((a,b) => String(a.targetDate || "9999-12-31").localeCompare(String(b.targetDate || "9999-12-31")));
  const total = planned.reduce((sum,item) => sum + convertCurrency(item.amount, item.currency || "PHP", "PHP"), 0);
  document.getElementById("momoFutureTotal").textContent = formatPHP(total); document.getElementById("momoFutureCount").textContent = String(planned.length);
  list.innerHTML = planned.length ? planned.map((item) => { const php = convertCurrency(item.amount, item.currency || "PHP", "PHP"); const days = momoDaysOfSafeSpend(php); return `<button class="momo-future-item" type="button" data-nav="planned"><span>☆</span><div><strong>${escapeHTML(item.title || "Future purchase")}</strong><small>${item.targetDate ? `Target ${formatShortDate(item.targetDate)}` : "No target date"}${days ? ` · about ${days.toFixed(days < 10 ? 1 : 0)} Safe-to-Spend day${days >= 1.5 ? "s" : ""}` : ""}</small></div><b>${Number(item.amount || 0) ? formatCurrency(item.amount, item.currency || "PHP") : "No amount"}</b></button>`; }).join("") : `<div class="momo-tool-empty">Nothing planned yet. Add a Future Buy whenever you want time to think before spending.</div>`;
}

function momoNoSpendSummary(year = new Date().getFullYear(), month = new Date().getMonth()) {
  const monthKey = `${year}-${String(month + 1).padStart(2,"0")}`; const days = getDaysInMonth(year, month); const todayKey = getTodayString();
  const spentDays = new Set(expenses.filter((item) => String(item.date || "").startsWith(monthKey) && momoFlexibleExpense(item)).map((item) => item.date));
  const cells = []; let count = 0;
  for (let day=1; day<=days; day += 1) { const key = `${monthKey}-${String(day).padStart(2,"0")}`; const future = key > todayKey; const quiet = !future && !spentDays.has(key); if (quiet) count += 1; cells.push({day,key,quiet,future}); }
  return { count, cells };
}

function momoLittleWins(year = new Date().getFullYear()) {
  const wins = [];
  for (const goal of savingsGoals) if (getSavingsGoalProgress(goal) >= 100) wins.push(`Reached ${goal.name || "a savings goal"}`);
  const paidThisYear = cards.reduce((sum, item) => sum + getPayablePayments(item).filter((p) => String(p.date || "").startsWith(String(year))).reduce((s,p) => s + payablePHPValue(item,p.amount),0),0);
  if (paidThisYear > 0) wins.push(`Recorded ${formatPHP(paidThisYear)} toward payables this year`);
  const currentUnder = momoBudgetPaceRows().filter((row) => row.tone === "under").length; if (currentUnder) wins.push(`${currentUnder} monthly budget${currentUnder === 1 ? " is" : "s are"} currently under spending pace`);
  const quiet = momoNoSpendSummary().count; if (quiet) wins.push(`${quiet} quiet discretionary-spend day${quiet === 1 ? "" : "s"} this month`);
  return wins.slice(0, 8);
}

function renderMomo10InsightsExtras() {
  const worth = document.getElementById("momoWorthItList"); if (!worth) return;
  const recent = expenses.filter(momoFlexibleExpense).slice(0, 8);
  worth.innerHTML = recent.length ? recent.map((item) => `<article class="momo-worth-row"><div><strong>${escapeHTML(item.title || "Expense")}</strong><small>${formatCurrency(item.amount,item.currency || "PHP")} · ${formatShortDate(item.date)}</small></div><div class="momo-worth-actions"><button type="button" data-momo-worth="loved" data-expense-id="${escapeHTML(item.id)}" class="${item.worthIt === "loved" ? "active" : ""}">Loved it</button><button type="button" data-momo-worth="fine" data-expense-id="${escapeHTML(item.id)}" class="${item.worthIt === "fine" ? "active" : ""}">Fine</button><button type="button" data-momo-worth="not-really" data-expense-id="${escapeHTML(item.id)}" class="${item.worthIt === "not-really" ? "active" : ""}">Not really</button></div></article>`).join("") : `<div class="momo-tool-empty">Flexible purchases will appear here when you have some.</div>`;
  const quiet = momoNoSpendSummary(); document.getElementById("momoNoSpendCount").textContent = `${quiet.count} day${quiet.count === 1 ? "" : "s"}`; document.getElementById("momoNoSpendCalendar").innerHTML = quiet.cells.map((cell) => `<span class="${cell.future ? "future" : cell.quiet ? "quiet" : "spent"}" title="${cell.key}">${cell.day}</span>`).join("");
  const wins = momoLittleWins(); document.getElementById("momoLittleWins").innerHTML = wins.length ? wins.map((item) => `<div><span>✓</span><p>${escapeHTML(item)}</p></div>`).join("") : `<div class="momo-tool-empty">Little wins will collect here naturally.</div>`;
  renderMomoPayoffLab();
}

function momoPayoffProjection(payable, extra = 0) {
  const balance = getPayableBalance(payable); const basePayment = Number(payable.regularPayment || payable.minimumDue || 0); const payment = basePayment + Math.max(0, Number(extra || 0)); const apr = Math.max(0, Number(payable.interestAPR || 0));
  if (balance <= 0) return { months:0, interest:0 }; if (payment <= 0) return { months:null, interest:null };
  const rate = apr / 100 / 12; let remaining = balance, months = 0, interest = 0;
  while (remaining > .005 && months < 600) { const monthInterest = remaining * rate; if (rate > 0 && payment <= monthInterest) return {months:null,interest:null}; interest += monthInterest; remaining = Math.max(0, remaining + monthInterest - payment); months += 1; }
  return months >= 600 ? {months:null,interest:null} : {months,interest};
}

function renderMomoPayoffLab() {
  const health = document.getElementById("momoCardHealth"); const select = document.getElementById("momoPayoffSelect"); const result = document.getElementById("momoPayoffResult"); if (!health || !select || !result) return;
  const creditCards = cards.filter((item) => item.type === "credit-card");
  health.innerHTML = creditCards.length ? creditCards.map((item) => { const limit = Number(item.creditLimit || 0); const balance = getPayableBalance(item); const util = limit > 0 ? balance / limit * 100 : null; const available = limit > 0 ? Math.max(0,limit-balance) : null; return `<article><div><strong>${escapeHTML(item.name || "Credit card")}</strong><small>${item.statementDay ? `Statement day ${item.statementDay}` : "Statement day not set"}${item.dueDate ? ` · due ${formatShortDate(item.dueDate)}` : ""}</small></div><div><b>${util === null ? "—" : `${util.toFixed(0)}% utilization`}</b><small>${available === null ? "Add a credit limit" : `${formatCurrency(available,item.currency || "PHP")} available`}</small></div></article>`; }).join("") : `<div class="momo-tool-empty">Credit-card health appears here when you add a credit card payable.</div>`;
  const active = cards.filter((item) => getPayableBalance(item) > 0); const previous = select.value; select.innerHTML = active.length ? active.map((item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name || getPayableMeta(item).label)}</option>`).join("") : `<option value="">No active payables</option>`; if (active.some((item) => item.id === previous)) select.value = previous;
  const payable = active.find((item) => item.id === select.value) || active[0]; if (!payable) { result.innerHTML = `<p>Add an active payable to try a payoff scenario.</p>`; return; }
  const extra = Number(document.getElementById("momoPayoffExtra")?.value || 0); const base = momoPayoffProjection(payable,0); const boosted = momoPayoffProjection(payable,extra);
  result.innerHTML = boosted.months === null ? `<p>The saved payment is not enough to produce a payoff estimate. Increase the payment amount.</p>` : `<div><strong>${boosted.months} month${boosted.months === 1 ? "" : "s"}</strong><small>estimated with ${formatCurrency(extra,payable.currency || "PHP")} extra / month</small></div><div><strong>${formatCurrency(boosted.interest || 0,payable.currency || "PHP")}</strong><small>estimated interest${base.months && extra > 0 ? ` · about ${Math.max(0,base.months-boosted.months)} month${Math.max(0,base.months-boosted.months)===1?"":"s"} sooner` : ""}</small></div>`;
}

function renderMomoSubscriptionManager() {
  const list = document.getElementById("momoSubscriptionManager"); if (!list) return;
  const subscriptions = recurringExpenses.filter((item) => item.kind === "subscription" || item.kind === "membership" || item.category === "Subscriptions");
  list.innerHTML = subscriptions.length ? subscriptions.map((item) => { const monthly = Number(item.amount || 0) * getRecurringMonthlyFactor(item.frequency); const annual = monthly * 12; const state = item.subscriptionState || (item.active === false ? "paused" : "active"); const history = Array.isArray(item.priceHistory) ? item.priceHistory : []; const trialDays = item.trialEndDate ? Math.ceil((createLocalDate(item.trialEndDate)-createLocalDate(getTodayString()))/86400000) : null; return `<article class="momo-sub-manager-row"><div><strong>${escapeHTML(item.name || "Subscription")}</strong><small>${state} · ${formatCurrency(monthly,item.currency || "PHP")}/mo equivalent · ${formatCurrency(annual,item.currency || "PHP")}/yr${trialDays !== null && trialDays >= 0 ? ` · trial ${trialDays}d left` : ""}${history.length ? ` · ${history.length} price change${history.length===1?"":"s"}` : ""}</small></div><div><button type="button" data-sub-price="${escapeHTML(item.id)}">Price</button>${state === "active" ? `<button type="button" data-sub-state="paused" data-sub-id="${escapeHTML(item.id)}">Pause</button><button type="button" data-sub-state="cancelled" data-sub-id="${escapeHTML(item.id)}">Cancel</button>` : `<button type="button" data-sub-state="active" data-sub-id="${escapeHTML(item.id)}">Resume</button>`}</div></article>`; }).join("") : `<div class="momo-tool-empty">Subscriptions and memberships will appear here.</div>`;
}

function renderMomoJarPlanner() {
  const list = document.getElementById("momoJarPlanner"); if (!list) return;
  const jars = savingsGoals.filter((item) => item.jarMode);
  list.innerHTML = jars.length ? jars.map((goal) => { const saved = getSavingsGoalSaved(goal); const remaining = Math.max(0, Number(goal.targetAmount || 0) - saved); let recommended = null; if (goal.targetDate && goal.targetDate >= getTodayString()) { const target = createLocalDate(goal.targetDate); const now = createLocalDate(getTodayString()); const months = Math.max(1, (target.getFullYear()-now.getFullYear())*12 + target.getMonth()-now.getMonth() + (target.getDate()>=now.getDate()?1:0)); recommended = remaining / months; } const paused = momoPausedJars.has(goal.id); return `<article class="momo-jar-planner-row ${paused ? "paused" : ""}"><div><strong>${escapeHTML(goal.emoji || "🍑")} ${escapeHTML(goal.name)}</strong><small>${recommended !== null ? `${formatCurrency(recommended,goal.currency || "PHP")}/month could reach the current target date` : "Add a target date for a suggested monthly contribution"}</small></div><button type="button" data-momo-jar-pause="${escapeHTML(goal.id)}">${paused ? "Resume Jar" : "Pause Jar"}</button></article>`; }).join("") : `<div class="momo-tool-empty">Turn a Savings Goal into a Peach Jar to use this planner.</div>`;
}

function renderMomoYearReview() {
  const yearSelect = document.getElementById("momoReviewYear"); if (!yearSelect) return;
  const years = new Set([new Date().getFullYear(), ...expenses.map((item) => Number(String(item.date || "").slice(0,4))).filter(Number.isFinite)]); const sorted = [...years].sort((a,b)=>b-a); const old = Number(yearSelect.value); yearSelect.innerHTML = sorted.map((year)=>`<option value="${year}">${year}</option>`).join(""); if (sorted.includes(old)) yearSelect.value=String(old); const year = Number(yearSelect.value || sorted[0]);
  let spent=0,count=0; const category=new Map(); const tripIds=new Set(); const worth={loved:0,fine:0,"not-really":0};
  for (const item of expenses) { if (!String(item.date || "").startsWith(String(year))) continue; const php=convertCurrency(item.amount,item.currency,"PHP"); spent+=php; count+=1; const label=item.category === "Other"&&item.otherCategory?item.otherCategory:(item.category||"Other"); category.set(label,(category.get(label)||0)+php); if(item.tripId)tripIds.add(item.tripId); if(worth[item.worthIt]!==undefined)worth[item.worthIt]+=1; }
  const saved=savingsGoals.reduce((total,goal)=>total+convertCurrency((goal.contributions||[]).filter((c)=>String(c.date||"").startsWith(String(year))).reduce((s,c)=>s+Number(c.amount||0),0),goal.currency||"PHP","PHP"),0);
  document.getElementById("momoReviewSpent").textContent=formatPHP(spent); document.getElementById("momoReviewSaved").textContent=formatPHP(saved); document.getElementById("momoReviewExpenseCount").textContent=String(count); document.getElementById("momoReviewTrips").textContent=String(tripIds.size); document.getElementById("momoReviewHeadline").textContent=count?`${year} had ${count} little money moments in Momo.`:`${year} is still a blank page in Momo.`;
  const top=[...category.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6); const max=top[0]?.[1]||1; document.getElementById("momoReviewCategories").innerHTML=top.length?top.map(([name,value])=>`<div><span><strong>${escapeHTML(name)}</strong><small>${formatPHP(value)}</small></span><i><b style="width:${Math.max(4,value/max*100)}%"></b></i></div>`).join(""):`<div class="momo-tool-empty">No spending categories for this year.</div>`;
  document.getElementById("momoReviewWorth").innerHTML=`<div><strong>${worth.loved}</strong><small>Loved it</small></div><div><strong>${worth.fine}</strong><small>Fine</small></div><div><strong>${worth["not-really"]}</strong><small>Not really</small></div>`;
  const wins=momoLittleWins(year); document.getElementById("momoReviewWins").innerHTML=wins.length?wins.map((item)=>`<div><span>✓</span><p>${escapeHTML(item)}</p></div>`).join(""):`<div class="momo-tool-empty">No tracked wins yet — that is okay.</div>`;
}

const momo10CoreRenderAll = renderAll;
renderAll = function() { momo10CoreRenderAll(); if (currentScreenName === "insights") renderMomo10InsightsExtras(); if (currentScreenName === "recurring") renderMomoSubscriptionManager(); if (currentScreenName === "savings") renderMomoJarPlanner(); if (currentScreenName === "future") renderMomoFutureBuys(); if (currentScreenName === "review") renderMomoYearReview(); };
const momo10CoreShowScreen = showScreen;
showScreen = function(name) { momo10CoreShowScreen(name); if (name === "insights") renderMomo10InsightsExtras(); if (name === "recurring") renderMomoSubscriptionManager(); if (name === "savings") renderMomoJarPlanner(); if (name === "future") renderMomoFutureBuys(); if (name === "review") renderMomoYearReview(); };

document.addEventListener("input", (event) => { if (event.target.id === "momoPayoffExtra") renderMomoPayoffLab(); });
document.addEventListener("change", (event) => { if (event.target.id === "momoPayoffSelect") renderMomoPayoffLab(); if (event.target.id === "momoReviewYear") renderMomoYearReview(); });
document.addEventListener("click", async (event) => {
  if (event.target.closest("#momoFutureAdd")) { document.getElementById("addPlannedExpenseButton")?.click(); return; }
  const worth = event.target.closest("[data-momo-worth]"); if (worth) { const expense = expenses.find((item)=>item.id===worth.dataset.expenseId); if (!expense) return; const updated={...expense,worthIt:worth.dataset.momoWorth,updatedAt:new Date().toISOString()}; await putRecord(STORES.expenses,updated); const index=expenses.findIndex((item)=>item.id===expense.id); if(index>=0)expenses[index]=updated; renderMomo10InsightsExtras(); showToast("Saved to Worth It? ♡"); return; }
  const jar = event.target.closest("[data-momo-jar-pause]"); if (jar) { const id=jar.dataset.momoJarPause; if(momoPausedJars.has(id))momoPausedJars.delete(id);else momoPausedJars.add(id); await saveMomoSetting(MOMO_JAR_PAUSE_KEY,[...momoPausedJars]); renderSavingsGoals(); renderMomoJarPlanner(); renderMomoToday(); showToast(momoPausedJars.has(id)?"Peach Jar paused":"Peach Jar resumed"); return; }
  const subState = event.target.closest("[data-sub-state]"); if (subState) { const item=recurringExpenses.find((entry)=>entry.id===subState.dataset.subId); if(!item)return; const state=subState.dataset.subState; const updated={...item,subscriptionState:state,active:state==="active",updatedAt:new Date().toISOString()}; await putRecord(STORES.recurring,updated); await loadAppData(); renderRecurringExpenses(); renderMomoSubscriptionManager(); renderMomoToday(); showToast(state==="active"?"Subscription resumed":state==="paused"?"Subscription paused":"Subscription cancelled"); return; }
  const price = event.target.closest("[data-sub-price]"); if (price) { const item=recurringExpenses.find((entry)=>entry.id===price.dataset.subPrice); if(!item)return; const answer=window.prompt(`New price for ${item.name}?`,String(item.amount||"")); if(answer===null)return; const amount=Number(answer); if(!Number.isFinite(amount)||amount<=0){showToast("Enter an amount greater than 0.");return;} const history=Array.isArray(item.priceHistory)?[...item.priceHistory]:[]; history.unshift({fromAmount:Number(item.amount||0),toAmount:amount,currency:item.currency||"PHP",date:getTodayString()}); const updated={...item,amount,priceHistory:history.slice(0,24),updatedAt:new Date().toISOString()}; await putRecord(STORES.recurring,updated); await loadAppData(); renderRecurringExpenses(); renderMomoSubscriptionManager(); renderMomoToday(); showToast("Subscription price updated"); }
});


// ========================================
// INITIALIZE
// ========================================

function waitForDatabaseRetry(
  delay
) {

  return new Promise(
    (resolve) => {

      setTimeout(
        resolve,
        delay
      );

    }
  );

}


async function openDatabaseWithRetry(
  attempts =
    3
) {

  let lastError =
    null;


  for (
    let attempt = 1;
    attempt <= attempts;
    attempt++
  ) {

    try {

      if (
        db
      ) {

        try {

          db.close();

        } catch (
          closeError
        ) {

          console.warn(
            "Could not close the previous Momo database connection:",
            closeError
          );

        }


        db =
          null;

      }


      return await openDatabase();

    } catch (
      error
    ) {

      lastError =
        error;


      console.warn(
        `Momo database open attempt ${attempt} of ${attempts} failed:`,
        error
      );


      if (
        attempt <
        attempts
      ) {

        await waitForDatabaseRetry(
          attempt *
            350
        );

      }

    }

  }


  throw (
    lastError ||
    new Error(
      "Momo could not open IndexedDB."
    )
  );

}


function safelyInitializeInterfaceStep(
  label,
  initializer
) {

  try {

    initializer();

    return true;

  } catch (
    error
  ) {

    console.error(
      `Momo interface step failed (${label}):`,
      error
    );

    return false;

  }

}


async function initializeApp() {

  try {

    await openDatabaseWithRetry();

  } catch (
    error
  ) {

    console.error(
      "Momo could not open its local database:",
      error
    );


    showToast(
      "Momo could not open its local database. Please close and reopen the app."
    );


    return;

  }


  try {

    await performCleanStartIfNeeded();


    await loadAppData();

  } catch (
    error
  ) {

    console.error(
      "Momo could not load its saved data:",
      error
    );


    showToast(
      "Momo opened, but its saved data could not finish loading."
    );


    return;

  }


  // Ask the browser to treat Momo's local-first database as persistent
  // storage when the platform supports it. This is best-effort and never
  // blocks startup or changes the user's saved data.
  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(
      (error) => {
        console.debug(
          "Persistent storage request skipped:",
          error
        );
      }
    );
  }


  safelyInitializeInterfaceStep(
    "Appearance",
    applyAppearance
  );


  safelyInitializeInterfaceStep(
    "Expense date",
    () => {

      if (
        expenseDate
      ) {

        expenseDate.value =
          getTodayString();

      }

    }
  );


  safelyInitializeInterfaceStep(
    "Currency converter",
    initializeConverter
  );


  safelyInitializeInterfaceStep(
    "Expense conversion preview",
    updateExpenseConversion
  );


  safelyInitializeInterfaceStep(
    "Main screen rendering",
    renderAll
  );


  // Firebase auth/push can become ready before IndexedDB finishes loading.
  // Run a second, non-blocking reconciliation now that local reminder data
  // is definitely available, so offline edits are not missed on startup.
  Promise.resolve(
    resyncAllPhoneReminders()
  ).catch(
    (error) => {
      console.warn(
        "Momo phone reminder startup sync skipped:",
        error
      );
    }
  );


  safelyInitializeInterfaceStep(
    "Welcome tutorial",
    maybeOpenWelcomeTour
  );


  console.log(
    "Momo ready."
  );

}


initializeApp();


// ========================================
// TRIP QUICK ADD EXPENSE
// Uses the normal Add Expense form and only presets the trip.
// ========================================

document.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest?.(
        ".trip-quick-expense-btn"
      );

    if (!button) {
      return;
    }

    const tripId =
      String(
        button.dataset.tripExpenseId ||
        ""
      );

    if (!tripId) {
      return;
    }

    pendingTripExpenseId =
      tripId;

    editingExpenseId =
      "";

    openingExpenseEditor =
      false;

    showScreen(
      "add"
    );

  }
);



// ========================================
// COMPACT TRAVEL CONVERTER
// Trips defaults to a quick two-way converter; full calculator stays one tap away.
// ========================================

const travelInlineConverter =
  document.getElementById(
    "inlineConverter"
  );

const toggleTravelConverter =
  document.getElementById(
    "toggleTravelConverter"
  );

function setTravelConverterExpanded(
  expanded
) {

  if (!travelInlineConverter) {
    return;
  }

  const next =
    Boolean(
      expanded
    );

  travelInlineConverter.classList.toggle(
    "is-expanded",
    next
  );

  if (toggleTravelConverter) {
    toggleTravelConverter.setAttribute(
      "aria-expanded",
      String(next)
    );

    toggleTravelConverter.textContent =
      next
        ? "Compact"
        : "Full";
  }
}

toggleTravelConverter?.addEventListener(
  "click",
  () => {
    setTravelConverterExpanded(
      !travelInlineConverter?.classList.contains(
        "is-expanded"
      )
    );
  }
);

// The dedicated Converter shortcut should still open the full calculator.
document
  .querySelectorAll(
    "[data-focus-converter]"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          setTimeout(
            () =>
              setTravelConverterExpanded(
                true
              ),
            0
          );
        }
      );
    }
  );
