from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing expected snippet in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "app.js",
    '''function getPayablePaymentLabel(payable) {
  switch (payable?.frequency) {
    case "monthly": return "Monthly payment";
    case "quarterly": return "Quarterly payment";
    case "weekly": return "Weekly payment";
    case "biweekly": return "Every 2 weeks";
    case "one-time": return "One-time payment";
    default: return "Next payment";
  }
}

function payablePHPValue(payable, amount) {''',
    '''function getPayablePaymentLabel(payable) {
  switch (payable?.frequency) {
    case "monthly": return "Monthly payment";
    case "quarterly": return "Quarterly payment";
    case "weekly": return "Weekly payment";
    case "biweekly": return "Every 2 weeks";
    case "one-time": return "One-time payment";
    default: return "Next payment";
  }
}

function getPayableMonthKey(dateString = getTodayString()) {
  const date = createLocalDate(dateString);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getPayableMonthLabel(monthKey = getCurrentMonthKey()) {
  const match = /^(\\d{4})-(\\d{2})$/.exec(String(monthKey || ""));
  if (!match) return "this month";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long" });
}

function isPayableWaitingInMonth(payable, referenceDateString = getTodayString()) {
  if (getPayableBalance(payable) <= 0) return false;
  if (!payable?.dueDate) return true;

  const due = createLocalDate(payable.dueDate);
  const reference = createLocalDate(referenceDateString);
  if (!due || !reference) return true;

  const monthEnd = new Date(
    reference.getFullYear(),
    reference.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  return due <= monthEnd;
}

function isPayableWaitingThisMonth(payable) {
  return isPayableWaitingInMonth(payable, getTodayString());
}

function getPayableCycleCheckPayment(payable, monthKey = getCurrentMonthKey()) {
  return [...getPayablePayments(payable)]
    .reverse()
    .find(
      (payment) =>
        payment?.source === "month-check" &&
        payment?.paidMonth === monthKey
    ) || null;
}

function payablePHPValue(payable, amount) {'''
)

replace_once(
    "app.js",
    '''function getActivePayablesForHome(limit = 3) {
  return cards
    .filter((item) => getPayableBalance(item) > 0)
    .sort((a, b) => {
      const aDate = a.dueDate || "9999-12-31";
      const bDate = b.dueDate || "9999-12-31";
      return aDate.localeCompare(bDate);
    })
    .slice(0, limit);
}''',
    '''function getActivePayablesForHome(limit = 3) {
  return cards
    .filter((item) => isPayableWaitingThisMonth(item))
    .sort((a, b) => {
      const aDate = a.dueDate || "9999-12-31";
      const bDate = b.dueDate || "9999-12-31";
      return aDate.localeCompare(bDate);
    })
    .slice(0, limit);
}'''
)

old_render = '''function renderPayables() {
  const list = document.getElementById("payablesList");
  const empty = document.getElementById("payablesEmpty");
  if (!list || !empty) return;

  const active = cards.filter((item) => getPayableBalance(item) > 0);
  const nextPaymentsTotal = active.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableNextPaymentAmount(item)),
    0
  );
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

  if (totalEl) totalEl.textContent = formatPHP(nextPaymentsTotal);
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
    const nextPayment = getPayableNextPaymentAmount(item);
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
            <b>${formatCurrency(nextPayment, item.currency || "PHP")}</b>
          </span>
          <span class="payable-progress"><i style="width:${paidPercent}%"></i></span>
          <span class="payable-item-foot">
            <small class="${tone}">${dueCopy}</small>
            <em>${done ? "finished" : escapeHTML(getPayablePaymentLabel(item))}</em>
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
}'''

new_render = '''function renderPayables() {
  const list = document.getElementById("payablesList");
  const empty = document.getElementById("payablesEmpty");
  if (!list || !empty) return;

  const waiting = cards
    .filter((item) => isPayableWaitingThisMonth(item))
    .sort((a, b) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")));

  const currentMonthKey = getCurrentMonthKey();
  const paidCycleEntries = cards
    .map((item) => ({ item, payment: getPayableCycleCheckPayment(item, currentMonthKey) }))
    .filter((entry) => entry.payment)
    .sort((a, b) => String(b.payment.date || "").localeCompare(String(a.payment.date || "")));

  const nextPaymentsTotal = waiting.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableNextPaymentAmount(item)),
    0
  );
  const today = createLocalDate(getTodayString());
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  const dueSoon = waiting.reduce((sum, item) => {
    const due = createLocalDate(item.dueDate);
    if (!due || due < today || due > monthEnd) return sum;
    const amount = getPayableNextPaymentAmount(item);
    return sum + payablePHPValue(item, amount);
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

  if (totalEl) totalEl.textContent = formatPHP(nextPaymentsTotal);
  if (dueEl) dueEl.textContent = formatPHP(dueSoon);
  if (paidEl) paidEl.textContent = formatPHP(paidMonth);
  if (activeCountEl) activeCountEl.textContent = `${waiting.length} left`;
  if (countEl) countEl.textContent = waiting.length
    ? `${waiting.length} ${waiting.length === 1 ? "payment" : "payments"} left this month`
    : "Nothing waiting this month 🌸";

  empty.hidden = cards.length > 0;

  const visiblePayables = waiting.slice(0, payableRenderLimit);
  const monthLabel = getPayableMonthLabel(currentMonthKey);

  const waitingMarkup = visiblePayables.length
    ? visiblePayables.map((item) => {
        const meta = getPayableMeta(item);
        const balance = getPayableBalance(item);
        const nextPayment = getPayableNextPaymentAmount(item);
        const original = Number(item.originalAmount || 0);
        const paidPercent = original > 0 ? Math.min(100, Math.max(0, ((original - balance) / original) * 100)) : 0;
        const tone = payableDueTone(item.dueDate);
        const dueCopy = item.dueDate ? `Due · ${formatShortDate(item.dueDate)}` : "No due date set";
        return `
          <div class="payable-cycle-row">
            <button class="payable-item" type="button" data-payable-open="${escapeHTML(item.id)}">
              <span class="payable-item-main">
                <span class="payable-item-topline">
                  <span>
                    <strong>${escapeHTML(item.name || meta.label)}</strong>
                    <small>${escapeHTML(item.provider || meta.label)}</small>
                  </span>
                  <b>${formatCurrency(nextPayment, item.currency || "PHP")}</b>
                </span>
                <span class="payable-progress"><i style="width:${paidPercent}%"></i></span>
                <span class="payable-item-foot">
                  <small class="${tone}">${dueCopy}</small>
                  <em>${escapeHTML(getPayablePaymentLabel(item))}</em>
                </span>
              </span>
            </button>
            <label class="payable-month-check" aria-label="Mark ${escapeHTML(item.name || meta.label)} paid for ${escapeHTML(monthLabel)}">
              <input type="checkbox" data-payable-month-toggle="${escapeHTML(item.id)}">
              <span aria-hidden="true">✓</span>
              <em>Paid</em>
            </label>
          </div>`;
      }).join("")
    : (cards.length ? `<div class="payables-month-clear"><span>🌸</span><strong>You’re clear for ${escapeHTML(monthLabel)}</strong><small>Anything due next month will come back automatically.</small></div>` : "");

  const loadMoreMarkup = visiblePayables.length < waiting.length
    ? `<button class="secondary-button momo-load-more" type="button" data-load-more-payables>Load more (${waiting.length - visiblePayables.length} remaining)</button>`
    : "";

  const paidMarkup = paidCycleEntries.length
    ? `
      <section class="payables-cycle-done">
        <div class="payables-cycle-done-heading">
          <div><p class="section-kicker">Paid this month</p><h3>Done for ${escapeHTML(monthLabel)}</h3></div>
          <span>${paidCycleEntries.length} ✓</span>
        </div>
        <div class="payables-cycle-done-list">
          ${paidCycleEntries.map(({ item, payment }) => {
            const nextDue = getPayableBalance(item) <= 0
              ? "Fully paid"
              : item.dueDate
                ? `Back ${formatShortDate(item.dueDate)}`
                : "No next due date";
            return `
              <div class="payable-cycle-row is-cycle-paid">
                <button class="payable-paid-cycle-card" type="button" data-payable-open="${escapeHTML(item.id)}">
                  <span><strong>${escapeHTML(item.name || getPayableMeta(item).label)}</strong><small>${nextDue}</small></span>
                  <b>${formatCurrency(payment.amount, item.currency || "PHP")}</b>
                </button>
                <label class="payable-month-check is-checked" aria-label="Undo paid status for ${escapeHTML(item.name || getPayableMeta(item).label)}">
                  <input type="checkbox" data-payable-month-toggle="${escapeHTML(item.id)}" checked>
                  <span aria-hidden="true">✓</span>
                  <em>Paid</em>
                </label>
              </div>`;
          }).join("")}
        </div>
      </section>`
    : "";

  list.innerHTML = waitingMarkup + loadMoreMarkup + paidMarkup;
}'''

replace_once("app.js", old_render, new_render)

replace_once(
    "app.js",
    '''  closePayablePayment();
  renderPayables();
  renderPayableDetail(id);
  showToast(nextBalance <= 0 ? "All paid! 🌸" : "Payment recorded ✨");
}

async function deletePayable(id) {''',
    '''  closePayablePayment();
  renderPayables();
  renderMomoToday();
  document.dispatchEvent(new CustomEvent("momo-data-changed"));
  renderPayableDetail(id);
  showToast(nextBalance <= 0 ? "All paid! 🌸" : "Payment recorded ✨");
}

async function markPayablePaidForCurrentMonth(id) {
  const item = cards.find((entry) => String(entry.id) === String(id));
  if (!item || getPayableBalance(item) <= 0) return;

  const monthKey = getCurrentMonthKey();
  if (getPayableCycleCheckPayment(item, monthKey)) return;
  if (!isPayableWaitingThisMonth(item)) {
    showToast("That payable is not due this month yet.");
    return;
  }

  const amount = getPayableNextPaymentAmount(item);
  if (!(amount > 0)) {
    showToast("Add a monthly payment amount first.");
    return;
  }

  const paymentDate = getTodayString();
  const previousDueDate = item.dueDate || "";
  const dueAnchor = previousDueDate || paymentDate;
  const nextBalance = Math.max(
    0,
    Math.round((getPayableBalance(item) - amount + Number.EPSILON) * 100) / 100
  );
  const nextDueDate = nextBalance > 0
    ? nextPayableDueDate(
        dueAnchor,
        item.frequency || "monthly",
        item.dueDayOfMonth || getPayableDueDay(dueAnchor)
      )
    : "";

  const payment = {
    id: generateId("payment"),
    amount,
    date: paymentDate,
    note: `Paid for ${getPayableMonthLabel(monthKey)}`,
    source: "month-check",
    paidMonth: monthKey,
    previousDueDate,
    nextDueDate
  };

  const next = {
    ...item,
    balance: nextBalance,
    payments: [...getPayablePayments(item), payment],
    installmentsPaid:
      item.type === "installment" && Number(item.installmentCount || 0)
        ? Math.min(Number(item.installmentCount), Number(item.installmentsPaid || 0) + 1)
        : Number(item.installmentsPaid || 0),
    dueDate: nextDueDate,
    updatedAt: new Date().toISOString()
  };

  await putRecord(STORES.cards, next);
  cards[cards.findIndex((entry) => String(entry.id) === String(id))] = next;
  renderPayables();
  renderMomoToday();
  document.dispatchEvent(new CustomEvent("momo-data-changed"));
  showToast(`${item.name || "Payable"} is paid for ${getPayableMonthLabel(monthKey)} ✓`);
}

async function undoPayablePaidForCurrentMonth(id) {
  const item = cards.find((entry) => String(entry.id) === String(id));
  if (!item) return;

  const monthKey = getCurrentMonthKey();
  const payment = getPayableCycleCheckPayment(item, monthKey);
  if (!payment) return;

  const restoredBalance = Math.max(
    0,
    Math.round((getPayableBalance(item) + Number(payment.amount || 0) + Number.EPSILON) * 100) / 100
  );
  const restoredDueDate = String(item.dueDate || "") === String(payment.nextDueDate || "")
    ? String(payment.previousDueDate || "")
    : item.dueDate;

  const next = {
    ...item,
    balance: restoredBalance,
    payments: getPayablePayments(item).filter((entry) => String(entry.id) !== String(payment.id)),
    installmentsPaid:
      item.type === "installment"
        ? Math.max(0, Number(item.installmentsPaid || 0) - 1)
        : Number(item.installmentsPaid || 0),
    dueDate: restoredDueDate,
    updatedAt: new Date().toISOString()
  };

  await putRecord(STORES.cards, next);
  cards[cards.findIndex((entry) => String(entry.id) === String(id))] = next;
  renderPayables();
  renderMomoToday();
  document.dispatchEvent(new CustomEvent("momo-data-changed"));
  showToast(`${item.name || "Payable"} is back on this month’s list.`);
}

async function deletePayable(id) {'''
)

replace_once(
    "app.js",
    '''document.addEventListener("click", (event) => {
  const add = event.target.closest("#addPayableButton, [data-payable-add]");''',
    '''document.addEventListener("change", async (event) => {
  const toggle = event.target.closest("[data-payable-month-toggle]");
  if (!toggle) return;

  const id = toggle.dataset.payableMonthToggle;
  toggle.disabled = true;
  try {
    if (toggle.checked) await markPayablePaidForCurrentMonth(id);
    else await undoPayablePaidForCurrentMonth(id);
  } catch (error) {
    console.error("Could not update monthly payable status:", error);
    toggle.checked = !toggle.checked;
    showToast("Could not update this payable. Try again.");
  } finally {
    toggle.disabled = false;
  }
});

document.addEventListener("click", (event) => {
  const add = event.target.closest("#addPayableButton, [data-payable-add]");'''
)

replace_once(
    "app.js",
    '''let momoHomeLayout = { order: [...MOMO_HOME_DEFAULT_ORDER], hidden: [], density: "cozy", showPayablesOnHome: false };''',
    '''let momoHomeLayout = { order: [...MOMO_HOME_DEFAULT_ORDER], hidden: [], density: "cozy", showPayablesOnHome: true };'''
)

replace_once(
    "app.js",
    '''momoHomeLayout = { order: [...order, ...MOMO_HOME_DEFAULT_ORDER.filter((id) => !order.includes(id))], hidden: Array.isArray(setting.hidden) ? setting.hidden.filter((id) => MOMO_HOME_DEFAULT_ORDER.includes(id)) : [], density: setting.density === "compact" ? "compact" : "cozy", showPayablesOnHome: setting.showPayablesOnHome === true };''',
    '''momoHomeLayout = { order: [...order, ...MOMO_HOME_DEFAULT_ORDER.filter((id) => !order.includes(id))], hidden: Array.isArray(setting.hidden) ? setting.hidden.filter((id) => MOMO_HOME_DEFAULT_ORDER.includes(id)) : [], density: setting.density === "compact" ? "compact" : "cozy", showPayablesOnHome: setting.showPayablesOnHome !== false };'''
)

replace_once(
    "smart-money.js",
    '''  function payablesVisibleOnHome(snapshot) {
    const layout = snapshot.settingMap.get("momo_home_layout_v1");
    return Boolean(layout && layout.showPayablesOnHome === true);
  }''',
    '''  function payablesVisibleOnHome(snapshot) {
    const layout = snapshot.settingMap.get("momo_home_layout_v1");
    return layout?.showPayablesOnHome !== false;
  }'''
)

replace_once(
    "index.html",
    '''<span><strong>Show Payables on Home</strong><small>Include payable amounts, payoff insights, and active payable cards on Home.</small></span>''',
    '''<span><strong>Show Payables on Home</strong><small>Show payable amounts, payoff insights, and active payable cards on Home. On by default; turn this off for privacy.</small></span>'''
)

replace_once(
    "index.html",
    '''            <p>Next payments</p>''',
    '''            <p>Still to pay this month</p>'''
)

replace_once(
    "index.html",
    '''            <em>next 30 days</em>''',
    '''            <em>this month</em>'''
)

replace_once(
    "index.html",
    '''          <span id="payablesActiveCount" class="momo-soft-pill">0 active</span>''',
    '''          <span id="payablesActiveCount" class="momo-soft-pill">0 left</span>'''
)

styles = Path("styles.css")
styles.write_text(styles.read_text() + '''\n\n/* MOMO — MONTHLY PAYABLE CHECKOFF */\n.payable-cycle-row {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) 58px;\n  gap: 8px;\n  align-items: stretch;\n}\n\n.payable-cycle-row + .payable-cycle-row {\n  margin-top: 8px;\n}\n\n.payable-cycle-row .payable-item,\n.payable-paid-cycle-card {\n  width: 100%;\n  min-width: 0;\n}\n\n.payable-month-check {\n  min-height: 64px;\n  padding: 7px 4px;\n  border: 1px solid var(--border);\n  border-radius: 18px;\n  display: grid;\n  place-items: center;\n  align-content: center;\n  gap: 4px;\n  background: color-mix(in srgb, var(--surface) 90%, var(--blush));\n  color: var(--text-soft);\n  cursor: pointer;\n}\n\n.payable-month-check input {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  opacity: 0;\n  pointer-events: none;\n}\n\n.payable-month-check > span {\n  width: 27px;\n  height: 27px;\n  border: 1px solid color-mix(in srgb, var(--rose) 28%, var(--border));\n  border-radius: 50%;\n  display: grid;\n  place-items: center;\n  background: var(--surface);\n  color: transparent;\n  font-size: 13px;\n  font-weight: 900;\n}\n\n.payable-month-check > em {\n  font-size: 7px;\n  font-style: normal;\n  font-weight: 900;\n}\n\n.payable-month-check:has(input:checked),\n.payable-month-check.is-checked {\n  border-color: color-mix(in srgb, var(--pink) 70%, var(--border));\n  background: color-mix(in srgb, var(--blush) 76%, var(--surface));\n  color: var(--rose);\n}\n\n.payable-month-check:has(input:checked) > span,\n.payable-month-check.is-checked > span {\n  background: var(--pink);\n  color: white;\n  border-color: var(--pink);\n}\n\n.payables-month-clear {\n  padding: 20px 16px;\n  border: 1px dashed color-mix(in srgb, var(--pink) 58%, var(--border));\n  border-radius: 22px;\n  display: grid;\n  justify-items: center;\n  gap: 5px;\n  text-align: center;\n  background: color-mix(in srgb, var(--surface) 86%, var(--blush));\n}\n\n.payables-month-clear > span { font-size: 24px; }\n.payables-month-clear > strong { font-size: 11px; }\n.payables-month-clear > small { color: var(--text-soft); font-size: 8px; line-height: 1.4; }\n\n.payables-cycle-done {\n  margin-top: 18px;\n  padding-top: 14px;\n  border-top: 1px solid var(--border);\n}\n\n.payables-cycle-done-heading {\n  margin-bottom: 9px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n}\n\n.payables-cycle-done-heading h3 {\n  margin: 2px 0 0;\n  font-family: Georgia, serif;\n  font-size: 15px;\n}\n\n.payables-cycle-done-heading > span {\n  padding: 5px 8px;\n  border-radius: 999px;\n  background: var(--blush);\n  color: var(--rose);\n  font-size: 8px;\n  font-weight: 900;\n}\n\n.payable-paid-cycle-card {\n  min-height: 64px;\n  padding: 11px 13px;\n  border: 1px solid var(--border);\n  border-radius: 18px;\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 10px;\n  text-align: left;\n  background: color-mix(in srgb, var(--surface) 88%, var(--blush));\n  color: var(--text);\n}\n\n.payable-paid-cycle-card strong,\n.payable-paid-cycle-card small { display: block; }\n.payable-paid-cycle-card strong { font-size: 10px; }\n.payable-paid-cycle-card small { margin-top: 3px; color: var(--text-soft); font-size: 8px; }\n.payable-paid-cycle-card b { color: var(--rose); font-size: 10px; white-space: nowrap; }\n\n@media (max-width: 350px) {\n  .payable-cycle-row { grid-template-columns: minmax(0, 1fr) 52px; gap: 6px; }\n  .payable-month-check { min-height: 60px; }\n  .payable-month-check > span { width: 24px; height: 24px; }\n}\n''')

replace_once(
    "service-worker.js",
    '''`momo-runtime-shell-v${APP_VERSION}-shared-trip-r5`''',
    '''`momo-runtime-shell-v${APP_VERSION}-shared-trip-r6`'''
)
