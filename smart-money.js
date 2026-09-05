// ========================================
// MOMO SMART MONEY
// Momo 1.11.0 — local-first intelligence layer
// ========================================

(() => {
  "use strict";

  const DB_NAME = "momo_database";
  const SMART_VERSION = "1.11.0";
  const REFRESH_DEBOUNCE_MS = 450;
  const BASELINE_MONTHS = 3;


  let refreshTimer = 0;
  let lastSnapshotSignature = "";
  const money = (value) => new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));

  const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const text = (value) => String(value ?? "").trim();

  const normalize = (value) => text(value).toLowerCase().replace(/\s+/g, " ");

  const toPHP = (amount, currency = "PHP") => {
    const code = text(currency).toUpperCase() || "PHP";
    if (typeof window.convertCurrency !== "function") {
      throw new Error("Momo currency converter is unavailable.");
    }
    return num(window.convertCurrency(num(amount), code, "PHP"));
  };

  const parseDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const dateKey = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const daysBetween = (a, b) => Math.max(0, Math.round((startOfDay(b) - startOfDay(a)) / 86400000));

  function readAll(db, storeName) {
    return new Promise((resolve) => {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve([]);
        return;
      }
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open Momo database."));
    });
  }

  async function loadSnapshot() {
    const db = await openDb();
    try {
      const [expenses, budgets, recurring, planned, cards, settings, trips] = await Promise.all([
        readAll(db, "expenses"),
        readAll(db, "budgets"),
        readAll(db, "recurring"),
        readAll(db, "planned"),
        readAll(db, "cards"),
        readAll(db, "settings"),
        readAll(db, "trips")
      ]);

      const settingMap = new Map(settings.map((item) => [item?.key, item?.value]));
      return { expenses, budgets, recurring, planned, cards, settings, trips, settingMap };
    } finally {
      db.close();
    }
  }

  function expenseAmountPHP(expense) {
    return toPHP(expense?.amount, expense?.currency || "PHP");
  }

  function expenseDate(expense) {
    return parseDate(expense?.date || expense?.createdAt || expense?.timestamp);
  }

  function expenseName(expense) {
    return text(expense?.merchant || expense?.name || expense?.title || expense?.description || expense?.notes || "Expense");
  }

  function expenseCategory(expense) {
    return text(expense?.category || expense?.customCategory || "Other");
  }

  function monthlyIncome(snapshot, now) {
    const value = snapshot.settingMap.get("monthly_income");
    if (typeof value === "number") return num(value);
    if (value && typeof value === "object") {
      const current = value[monthKey(now)] ?? value.current ?? value.amount;
      return num(current);
    }
    return 0;
  }

  function savingsGoals(snapshot) {
    const value = snapshot.settingMap.get("savings_goals");
    return Array.isArray(value) ? value : [];
  }

  function paydayPlan(snapshot) {
    const value = snapshot.settingMap.get("payday_plan_v1");
    return value && typeof value === "object" ? value : {};
  }

  function monthlyExpenses(snapshot, now) {
    return snapshot.expenses.filter((expense) => {
      const date = expenseDate(expense);
      return date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
  }

  function monthSpend(expenses) {
    return expenses.reduce((sum, expense) => sum + expenseAmountPHP(expense), 0);
  }

  function priorMonthTotals(snapshot, now, count = BASELINE_MONTHS) {
    const totals = [];
    for (let offset = 1; offset <= count; offset += 1) {
      const cursor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const total = snapshot.expenses.reduce((sum, expense) => {
        const date = expenseDate(expense);
        if (!date || date.getFullYear() !== cursor.getFullYear() || date.getMonth() !== cursor.getMonth()) return sum;
        return sum + expenseAmountPHP(expense);
      }, 0);
      if (total > 0) totals.push(total);
    }
    return totals;
  }

  function recurringCommitments(snapshot, now) {
    return snapshot.recurring.reduce((sum, item) => {
      if (item?.active === false || item?.status === "cancelled") return sum;
      const due = parseDate(item?.nextDueDate || item?.date || item?.renewalDate);
      if (due && (due.getFullYear() !== now.getFullYear() || due.getMonth() !== now.getMonth())) return sum;
      return sum + toPHP(item?.amount, item?.currency || "PHP");
    }, 0);
  }

  function upcomingCommitments(snapshot, now, horizonDays = 14) {
    const end = new Date(now);
    end.setDate(end.getDate() + horizonDays);
    const items = [];

    snapshot.recurring.forEach((item) => {
      const due = parseDate(item?.nextDueDate || item?.date || item?.renewalDate);
      if (!due || due < startOfDay(now) || due > end || item?.active === false || item?.status === "cancelled") return;
      items.push({
        type: "Recurring",
        name: text(item?.name || item?.title || item?.merchant || "Recurring payment"),
        amount: toPHP(item?.amount, item?.currency || "PHP"),
        date: due
      });
    });

    snapshot.cards.forEach((item) => {
      const due = parseDate(item?.dueDate || item?.nextDueDate || item?.paymentDueDate);
      if (!due || due < startOfDay(now) || due > end) return;
      const amount = toPHP(item?.regularPayment || item?.minimumDue || item?.minimumPayment || item?.dueAmount || item?.paymentAmount || 0, item?.currency || "PHP");
      if (amount <= 0) return;
      items.push({ type: "Payable", name: text(item?.name || item?.title || "Payable"), amount, date: due });
    });

    snapshot.planned.forEach((item) => {
      const due = parseDate(item?.targetDate || item?.date);
      if (!due || due < startOfDay(now) || due > end || ["bought", "done", "completed"].includes(normalize(item?.status))) return;
      const amount = toPHP(item?.amount, item?.currency || "PHP");
      if (amount <= 0) return;
      items.push({ type: "Planned", name: text(item?.name || item?.title || item?.description || "Planned purchase"), amount, date: due });
    });

    return items.sort((a, b) => a.date - b.date);
  }

  function budgetRemaining(snapshot, now, currentSpend) {
    let monthlyBudget = 0;
    snapshot.budgets.forEach((budget) => {
      const period = normalize(budget?.period || "monthly");
      if (period !== "monthly") return;
      monthlyBudget += toPHP(budget?.amount, budget?.currency || "PHP");
    });
    return monthlyBudget > 0 ? Math.max(0, monthlyBudget - currentSpend) : 0;
  }

  function protectedJarRemaining(snapshot, now) {
  const key = monthKey(now);
  return savingsGoals(snapshot).reduce((sum, goal) => {
    if (!goal?.protectedJar || num(goal?.monthlyPlan) <= 0) return sum;
    const contributed = (Array.isArray(goal?.contributions) ? goal.contributions : [])
      .filter((item) => text(item?.date).startsWith(key))
      .reduce((amount, item) => amount + num(item?.amount), 0);
    return sum + toPHP(Math.max(0, num(goal.monthlyPlan) - contributed), goal?.currency || "PHP");
  }, 0);
}

function computeSafeToSpend(snapshot, now, spend, upcoming) {
    const income = monthlyIncome(snapshot, now);
    const budgetLeft = budgetRemaining(snapshot, now, spend);
    const remainingDays = Math.max(1, daysInMonth(now) - now.getDate() + 1);
    const plan = paydayPlan(snapshot);
    const protectedSavings = Math.max(num(plan?.savings), protectedJarRemaining(snapshot, now));
    const upcomingTotal = upcoming.reduce((sum, item) => sum + item.amount, 0);
    const recurringThisMonth = recurringCommitments(snapshot, now);
    const base = income > 0 ? Math.max(0, income - spend) : budgetLeft;
    const protectedAmount = Math.max(upcomingTotal, recurringThisMonth) + protectedSavings;
    const flexible = Math.max(0, base - protectedAmount);
    return {
      today: flexible / remainingDays,
      flexible,
      base,
      protectedAmount,
      remainingDays,
      income,
      budgetLeft
    };
  }

  function forecast(snapshot, now, currentMonthExpenses, safe) {
    const spent = monthSpend(currentMonthExpenses);
    const elapsed = Math.max(1, now.getDate());
    const totalDays = daysInMonth(now);
    const paceForecast = (spent / elapsed) * totalDays;
    const priorTotals = priorMonthTotals(snapshot, now);
    const historicalAverage = priorTotals.length ? priorTotals.reduce((a, b) => a + b, 0) / priorTotals.length : 0;
    const blended = historicalAverage > 0 ? (paceForecast * 0.7) + (historicalAverage * 0.3) : paceForecast;
    const expectedCommitments = Math.max(recurringCommitments(snapshot, now), safe.protectedAmount);
    const projectedSpend = Math.max(spent, blended, spent + expectedCommitments);
    const projectedBuffer = safe.income > 0 ? safe.income - projectedSpend : safe.budgetLeft - Math.max(0, projectedSpend - spent);
    return { spent, projectedSpend, projectedBuffer, historicalAverage, paceForecast };
  }

  function categoryBaseline(snapshot, now) {
    const current = new Map();
    const history = new Map();
    const currentMonth = monthKey(now);

    snapshot.expenses.forEach((expense) => {
      const date = expenseDate(expense);
      if (!date) return;
      const category = expenseCategory(expense);
      const amount = expenseAmountPHP(expense);
      const key = monthKey(date);
      if (key === currentMonth) {
        current.set(category, (current.get(category) || 0) + amount);
        return;
      }
      const monthDiff = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
      if (monthDiff >= 1 && monthDiff <= BASELINE_MONTHS) {
        if (!history.has(category)) history.set(category, new Map());
        const byMonth = history.get(category);
        byMonth.set(key, (byMonth.get(key) || 0) + amount);
      }
    });

    const anomalies = [];
    current.forEach((amount, category) => {
      const monthly = [...(history.get(category)?.values() || [])];
      if (monthly.length < 2) return;
      const average = monthly.reduce((a, b) => a + b, 0) / monthly.length;
      const expectedToDate = average * (now.getDate() / daysInMonth(now));
      if (expectedToDate > 0 && amount >= expectedToDate * 1.35 && amount - expectedToDate >= 300) {
        anomalies.push({ category, amount, expectedToDate, deltaPct: ((amount / expectedToDate) - 1) * 100 });
      }
    });

    return anomalies.sort((a, b) => b.deltaPct - a.deltaPct);
  }

  function duplicateCandidates(snapshot) {
    const recent = snapshot.expenses
      .map((expense) => ({ expense, date: expenseDate(expense) }))
      .filter((item) => item.date)
      .sort((a, b) => b.date - a.date)
      .slice(0, 120);

    for (let i = 0; i < recent.length; i += 1) {
      for (let j = i + 1; j < Math.min(recent.length, i + 12); j += 1) {
        const a = recent[i];
        const b = recent[j];
        const sameAmount = Math.abs(expenseAmountPHP(a.expense) - expenseAmountPHP(b.expense)) < 0.01;
        const sameName = normalize(expenseName(a.expense)) && normalize(expenseName(a.expense)) === normalize(expenseName(b.expense));
        const nearDate = Math.abs(a.date - b.date) <= 36 * 60 * 60 * 1000;
        if (sameAmount && sameName && nearDate) return [a.expense, b.expense];
      }
    }
    return null;
  }

  function recurringDiscovery(snapshot) {
    const existingNames = new Set(snapshot.recurring.map((item) => normalize(item?.name || item?.merchant || item?.title)));
    const groups = new Map();

    snapshot.expenses.forEach((expense) => {
      const name = normalize(expenseName(expense));
      const date = expenseDate(expense);
      if (!name || name.length < 2 || !date || existingNames.has(name)) return;
      const amount = Math.round(expenseAmountPHP(expense));
      const key = `${name}::${amount}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(date);
    });

    for (const [key, dates] of groups.entries()) {
      if (dates.length < 3) continue;
      dates.sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < dates.length; i += 1) gaps.push(daysBetween(dates[i - 1], dates[i]));
      const monthlyLike = gaps.filter((gap) => gap >= 24 && gap <= 38).length >= 2;
      if (monthlyLike) {
        const [name, amount] = key.split("::");
        return { name, amount: num(amount), occurrences: dates.length };
      }
    }
    return null;
  }

  function merchantLearning(snapshot) {
    const merchants = new Map();
    snapshot.expenses.forEach((expense) => {
      const name = normalize(expenseName(expense));
      if (!name) return;
      if (!merchants.has(name)) merchants.set(name, { categories: new Map(), payments: new Map(), count: 0 });
      const entry = merchants.get(name);
      entry.count += 1;
      const category = expenseCategory(expense);
      if (category) entry.categories.set(category, (entry.categories.get(category) || 0) + 1);
      const payment = text(expense?.paymentMethod || expense?.payment || expense?.method);
      if (payment) entry.payments.set(payment, (entry.payments.get(payment) || 0) + 1);
    });

    const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const learned = new Map();
    merchants.forEach((entry, name) => {
      if (entry.count >= 2) learned.set(name, { category: top(entry.categories), payment: top(entry.payments), count: entry.count });
    });
    return learned;
  }

  function futureBuyImpact(snapshot, forecastData) {
    const planned = snapshot.planned
      .filter((item) => !["bought", "done", "completed"].includes(normalize(item?.status)))
      .map((item) => ({
        item,
        amount: toPHP(item?.amount, item?.currency || "PHP"),
        date: parseDate(item?.targetDate || item?.date)
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => (a.date || Infinity) - (b.date || Infinity));

    if (!planned.length) return null;
    const next = planned[0];
    return {
      name: text(next.item?.name || next.item?.title || next.item?.description || "Future buy"),
      amount: next.amount,
      afterBuffer: forecastData.projectedBuffer - next.amount,
      date: next.date
    };
  }

  function jarPacing(snapshot, now) {
    const goals = savingsGoals(snapshot);
    const goal = goals.find((item) => {
      const target = parseDate(item?.targetDate || item?.date);
      return target && target >= now && num(item?.targetAmount || item?.target || item?.amount) > 0;
    });
    if (!goal) return null;

    const target = num(goal?.targetAmount || goal?.target || goal?.amount);
    const contributed = (Array.isArray(goal?.contributions) ? goal.contributions : []).reduce((sum, item) => sum + num(item?.amount), 0);
    const current = num(goal?.currentAmount ?? goal?.saved ?? goal?.balance ?? goal?.progressAmount ?? contributed);
    const targetDate = parseDate(goal?.targetDate || goal?.date);
    const monthsLeft = Math.max(1, Math.ceil(daysBetween(now, targetDate) / 30.44));
    const neededMonthly = Math.max(0, target - current) / monthsLeft;
    return {
      name: text(goal?.name || goal?.title || "Peach Jar"),
      target,
      current,
      targetDate,
      neededMonthly,
      monthsLeft
    };
  }

  function debtSuggestion(snapshot) {
    const debts = snapshot.cards.map((item) => {
      const balance = toPHP(item?.remainingBalance || item?.balance || item?.amountOwed || item?.amount || 0, item?.currency || "PHP");
      const apr = num(item?.interestAPR || item?.apr || item?.interestRate || item?.rate);
      return { item, balance, apr };
    }).filter((item) => item.balance > 0);

    if (!debts.length) return null;
    const highestApr = [...debts].sort((a, b) => b.apr - a.apr)[0];
    const smallest = [...debts].sort((a, b) => a.balance - b.balance)[0];
    return {
      count: debts.length,
      highestApr,
      smallest,
      total: debts.reduce((sum, debt) => sum + debt.balance, 0)
    };
  }

  function buildInsights(snapshot, now) {
    const current = monthlyExpenses(snapshot, now);
    const spend = monthSpend(current);
    const upcoming = upcomingCommitments(snapshot, now);
    const safe = computeSafeToSpend(snapshot, now, spend, upcoming);
    const forecastData = forecast(snapshot, now, current, safe);
    const anomalies = categoryBaseline(snapshot, now);
    const duplicate = duplicateCandidates(snapshot);
    const recurring = recurringDiscovery(snapshot);
    const future = futureBuyImpact(snapshot, forecastData);
    const jar = jarPacing(snapshot, now);
    const debt = debtSuggestion(snapshot);

    const insights = [];

    if (safe.base > 0) {
      insights.push({
        icon: "🍑",
        tone: "good",
        title: `About ${money(safe.today)} is flexible today`,
        body: `${money(safe.flexible)} remains after Momo protects upcoming commitments${safe.protectedAmount > 0 ? ` (${money(safe.protectedAmount)})` : ""}.`
      });
    }

    if (forecastData.spent > 0) {
      const bufferCopy = safe.income > 0
        ? (forecastData.projectedBuffer >= 0
          ? `You are on track to finish with about ${money(forecastData.projectedBuffer)} left.`
          : `At this pace, spending may exceed income by about ${money(Math.abs(forecastData.projectedBuffer))}.`)
        : `Projected month-end spending is about ${money(forecastData.projectedSpend)}.`;
      insights.push({ icon: "◔", tone: forecastData.projectedBuffer < 0 ? "watch" : "neutral", title: "Month-end forecast", body: bufferCopy });
    }

    if (upcoming.length) {
      const firstWeek = upcoming.filter((item) => daysBetween(now, item.date) <= 7);
      const pressure = firstWeek.reduce((sum, item) => sum + item.amount, 0);
      if (pressure > 0) {
        insights.push({
          icon: "📅",
          tone: pressure > safe.flexible && safe.flexible > 0 ? "watch" : "neutral",
          title: `${money(pressure)} is coming up soon`,
          body: `${firstWeek.length} planned commitment${firstWeek.length === 1 ? "" : "s"} land in the next 7 days.`
        });
      }
    }

    if (anomalies[0]) {
      const item = anomalies[0];
      insights.push({ icon: "↗", tone: "watch", title: `${item.category} is running higher than usual`, body: `About ${Math.round(item.deltaPct)}% above your recent pace for this point in the month.` });
    }

    if (duplicate) {
      insights.push({ icon: "≋", tone: "watch", title: "Possible duplicate expense", body: `${expenseName(duplicate[0])} appears twice with the same amount close together. Check Activity before deleting anything.` });
    }

    if (recurring) {
      insights.push({ icon: "↻", tone: "neutral", title: "Momo spotted a repeating payment", body: `${recurring.name} has appeared on a monthly-like pattern ${recurring.occurrences} times. Consider adding it to Recurring.` });
    }

    if (future) {
      insights.push({
        icon: "☆",
        tone: future.afterBuffer < 0 ? "watch" : "neutral",
        title: `${future.name} would leave about ${money(Math.max(0, future.afterBuffer))}`,
        body: `${money(future.amount)} is currently planned${future.date ? ` for ${future.date.toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}. Momo compares it with your projected month-end buffer.`
      });
    }

    if (jar) {
      insights.push({ icon: "🌱", tone: "good", title: `${jar.name}: about ${money(jar.neededMonthly)}/month`, body: `That pace would reach the target in roughly ${jar.monthsLeft} month${jar.monthsLeft === 1 ? "" : "s"}, based on the saved balance Momo can see.` });
    }

    const homeLayout = snapshot.settingMap.get("momo_home_layout_v1");
    const showPayablesOnHome = Boolean(homeLayout && homeLayout.showPayablesOnHome === true);

    if (showPayablesOnHome && debt && debt.count > 0) {
      const target = debt.highestApr?.apr > 0 ? debt.highestApr : debt.smallest;
      const strategy = debt.highestApr?.apr > 0 ? "highest-interest" : "smallest-balance";
      insights.push({ icon: "🌸", tone: "neutral", title: `${money(debt.total)} remains across payables`, body: `For an optional faster-payoff view, Momo would prioritize the ${strategy} balance first: ${text(target?.item?.name || target?.item?.title || "a payable")}.` });
    }

    return { insights, safe, forecastData, upcoming, learnedMerchants: merchantLearning(snapshot) };
  }

  function ensureStyles() {
    if (document.getElementById("momoSmartMoneyStyles")) return;
    const style = document.createElement("style");
    style.id = "momoSmartMoneyStyles";
    style.textContent = `
      .momo-knows-card{border:1px solid rgba(228,153,164,.22);border-radius:24px;padding:16px;background:linear-gradient(145deg,rgba(255,250,248,.96),rgba(255,241,238,.92));box-shadow:0 10px 30px rgba(143,88,96,.07)}
      .momo-knows-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:12px}.momo-knows-head h2{margin:2px 0 0;font-size:1.15rem}.momo-knows-head p{margin:3px 0 0;color:var(--muted,#7f7272);font-size:.84rem}.momo-knows-badge{white-space:nowrap;padding:7px 10px;border-radius:999px;background:rgba(237,160,170,.14);font-size:.74rem;font-weight:700;color:#9d5964}
      .momo-knows-list{display:grid;gap:10px}.momo-knows-item{display:grid;grid-template-columns:36px 1fr;gap:10px;align-items:start;padding:12px;border-radius:18px;background:rgba(255,255,255,.72)}.momo-knows-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:13px;background:rgba(240,172,181,.14);font-size:1rem}.momo-knows-item strong{display:block;font-size:.94rem;line-height:1.25}.momo-knows-item p{margin:4px 0 0;color:var(--muted,#7f7272);font-size:.81rem;line-height:1.4}.momo-knows-item[data-tone="watch"]{background:rgba(255,247,230,.78)}.momo-knows-item[data-tone="good"]{background:rgba(244,252,245,.78)}
      .momo-smart-empty{padding:14px;border-radius:18px;background:rgba(255,255,255,.65);color:var(--muted,#7f7272);font-size:.86rem;line-height:1.45}.momo-smart-suggest{margin-top:8px;padding:8px 10px;border-radius:12px;background:rgba(240,172,181,.12);font-size:.76rem;color:#8d6068}
      @media(max-width:420px){.momo-knows-card{padding:14px;border-radius:21px}.momo-knows-head{gap:8px}.momo-knows-badge{font-size:.68rem;padding:6px 8px}.momo-knows-item{padding:11px}}
    `;
    document.head.appendChild(style);
  }

  function ensureSection() {
    let section = document.getElementById("momoKnowsSection");
    if (section) return section;

    const host = document.querySelector('[data-screen="home"]');
    if (!host) return null;

    section = document.createElement("section");
    section.id = "momoKnowsSection";
    section.className = "momo-home-section momo-knows-section";
    section.dataset.homeModule = "momo-knows";
    section.innerHTML = `
      <div class="momo-home-section-heading">
        <div><p class="momo-section-kicker">✦ MOMO KNOWS</p><h2>Quietly watching the patterns</h2></div>
      </div>
      <article class="momo-knows-card" aria-live="polite">
        <div class="momo-knows-head"><div><h2>Your smart money check-in</h2><p>Private, local, and based only on the Momo data on this device.</p></div><span class="momo-knows-badge">Local smart</span></div>
        <div id="momoKnowsList" class="momo-knows-list"><div class="momo-smart-empty">Momo is checking your recent patterns…</div></div>
      </article>`;

    const today = document.getElementById("momoTodaySection");
    if (today?.parentNode) today.insertAdjacentElement("afterend", section);
    else host.appendChild(section);
    return section;
  }

  function updateExistingSafeToSpend(safe) {
    const amount = document.getElementById("momoSafeToday");
    const explanation = document.getElementById("momoSafeExplanation");
    if (!amount || !explanation || safe.base <= 0) return;
    amount.textContent = money(safe.today);
    explanation.textContent = `${money(safe.flexible)} flexible after protecting ${money(safe.protectedAmount)} in upcoming commitments and savings.`;
  }

  function renderInsights(result) {
    ensureStyles();
    if (!ensureSection()) return;
    updateExistingSafeToSpend(result.safe);

    const list = document.getElementById("momoKnowsList");
    if (!list) return;

    const chosen = result.insights.slice(0, 3);
    if (!chosen.length) {
      list.innerHTML = `<div class="momo-smart-empty">Nothing urgent stands out yet. Keep using Momo normally and this space will become more personal as your history grows.</div>`;
      return;
    }

    list.innerHTML = chosen.map((item) => `
      <div class="momo-knows-item" data-tone="${item.tone || "neutral"}">
        <div class="momo-knows-icon" aria-hidden="true">${item.icon}</div>
        <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></div>
      </div>`).join("");
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function applyMerchantSuggestions(learned) {
    if (!learned?.size) return;
    const candidates = [
      document.getElementById("expenseMerchant"),
      document.getElementById("expenseName"),
      document.getElementById("expenseTitle"),
      document.querySelector('#expenseForm input[name="merchant"]'),
      document.querySelector('#expenseForm input[name="name"]')
    ].filter(Boolean);

    const merchantInput = candidates[0];
    if (!merchantInput || merchantInput.dataset.momoSmartBound === "yes") return;
    merchantInput.dataset.momoSmartBound = "yes";

    const show = () => {
      const learnedValue = learned.get(normalize(merchantInput.value));
      document.getElementById("momoMerchantSuggestion")?.remove();
      if (!learnedValue || !merchantInput.parentElement) return;
      const note = document.createElement("div");
      note.id = "momoMerchantSuggestion";
      note.className = "momo-smart-suggest";
      note.textContent = `Momo remembers this merchant${learnedValue.category ? ` · usually ${learnedValue.category}` : ""}${learnedValue.payment ? ` · ${learnedValue.payment}` : ""}.`;
      merchantInput.parentElement.appendChild(note);

      const category = document.getElementById("expenseCategory") || document.querySelector('#expenseForm select[name="category"]');
      if (category && learnedValue.category && !category.value) category.value = learnedValue.category;
      const payment = document.getElementById("expensePaymentMethod") || document.querySelector('#expenseForm select[name="paymentMethod"]');
      if (payment && learnedValue.payment && !payment.value) payment.value = learnedValue.payment;
    };

    merchantInput.addEventListener("change", show);
    merchantInput.addEventListener("blur", show);
  }

  async function refresh() {
    try {
      const snapshot = await loadSnapshot();
      const signature = [snapshot.expenses.length, snapshot.budgets.length, snapshot.recurring.length, snapshot.planned.length, snapshot.cards.length, snapshot.settings.length].join(":");
      const result = buildInsights(snapshot, new Date());
      renderInsights(result);
      applyMerchantSuggestions(result.learnedMerchants);
      lastSnapshotSignature = signature;
      window.MomoSmartMoney = { version: SMART_VERSION, refresh, buildInsights: () => buildInsights(snapshot, new Date()) };
    } catch (error) {
      console.warn("Momo Smart Money skipped:", error);
    }
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, REFRESH_DEBOUNCE_MS);
  }

  function watchForChanges() {
  window.addEventListener("focus", scheduleRefresh, { passive: true });
  window.addEventListener("online", scheduleRefresh, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleRefresh();
  });

  // Refresh after real user data actions instead of observing every DOM
  // mutation. This prevents Momo Knows from creating a render/observer
  // feedback loop on long-running sessions with large histories.
  document.addEventListener("submit", () => {
    window.setTimeout(scheduleRefresh, 650);
  }, true);

  document.addEventListener("momo-data-changed", scheduleRefresh);
}

function boot() {
    ensureStyles();
    ensureSection();
    watchForChanges();
    refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
