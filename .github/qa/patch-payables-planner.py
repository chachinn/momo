from pathlib import Path
import re


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing {label} in {path}")
    p.write_text(text.replace(old, new, 1))


def sub_once(path, pattern, repl, label, flags=0):
    p = Path(path)
    text = p.read_text()
    new, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"Expected one replacement for {label}, got {count}")
    p.write_text(new)


# ---------- index.html ----------
replace_once(
    "index.html",
    '''        <div class="payables-view-switch" role="tablist" aria-label="Payables view">
          <button class="active" type="button" role="tab" data-payables-view="due" aria-selected="true">Due</button>
          <button type="button" role="tab" data-payables-view="all" aria-selected="false">All Payables</button>
        </div>

        <div class="payables-section-heading">''',
    '''        <div class="payables-view-switch" role="tablist" aria-label="Payables view">
          <button class="active" type="button" role="tab" data-payables-view="due" aria-selected="true">Due</button>
          <button type="button" role="tab" data-payables-view="all" aria-selected="false">All Payables</button>
        </div>

        <section id="payablesPaydaySummary" class="payables-payday-summary" aria-label="Payday totals">
          <article><small>1st payday</small><strong id="payablesPaydayOne">₱0.00</strong><em id="payablesPaydayOneHint">this view</em></article>
          <article><small>2nd payday</small><strong id="payablesPaydayTwo">₱0.00</strong><em id="payablesPaydayTwoHint">this view</em></article>
        </section>
        <div id="payablesGroupSummary" class="payables-group-summary"></div>

        <div class="payables-section-heading">''',
    "payday/group summary insertion",
)

replace_once(
    "index.html",
    '''          <label>
            <span>Notes <small>(optional)</small></span>
            <textarea id="payableNotes" rows="3" maxlength="300" placeholder="Anything Momo should remember?"></textarea>
          </label>''',
    '''          <div class="modal-field-row payable-planning-fields">
            <label>
              <span>Pay from</span>
              <select id="payablePaydaySlot">
                <option value="">Not assigned</option>
                <option value="first">1st payday</option>
                <option value="second">2nd payday</option>
              </select>
            </label>
            <label>
              <span>Paid together under <small>(optional)</small></span>
              <input id="payablePaymentGroup" type="text" maxlength="60" list="payablePaymentGroupOptions" placeholder="BPI Credit Card">
              <datalist id="payablePaymentGroupOptions"></datalist>
            </label>
          </div>
          <p class="payable-amount-helper payable-group-helper">Use the same payment account name for installments or loans you pay together in one card statement.</p>

          <label>
            <span>Notes <small>(optional)</small></span>
            <textarea id="payableNotes" rows="3" maxlength="300" placeholder="Anything Momo should remember?"></textarea>
          </label>''',
    "payable planning fields",
)

replace_once(
    "index.html",
    '''        <form id="payablePaymentForm">
          <input id="payablePaymentId" type="hidden">
          <label><span>Amount Paid</span><input id="payablePaymentAmount" type="number" inputmode="decimal" min="0.01" step="0.01" required></label>
          <label><span>Date</span><input id="payablePaymentDate" type="date" required></label>
          <label><span>Note <small>(optional)</small></span><input id="payablePaymentNote" type="text" maxlength="100" placeholder="Paid via bank transfer"></label>
          <p class="payable-payment-note">🌸 This reduces the payable balance. It does not create a new spending expense.</p>
          <button class="primary-button" type="submit">Record Payment</button>
        </form>
      </section>
    </div>''',
    '''        <form id="payablePaymentForm">
          <input id="payablePaymentId" type="hidden">
          <label><span>Amount Paid</span><input id="payablePaymentAmount" type="number" inputmode="decimal" min="0.01" step="0.01" required></label>
          <label><span>Date</span><input id="payablePaymentDate" type="date" required></label>
          <label><span>Note <small>(optional)</small></span><input id="payablePaymentNote" type="text" maxlength="100" placeholder="Paid via bank transfer"></label>
          <p id="payablePaymentCycleNote" class="payable-payment-note">🌸 Partial payments stay on this due cycle until the full monthly amount is covered.</p>
          <button class="primary-button" type="submit">Record Payment</button>
        </form>
      </section>
    </div>

    <div id="payableGroupPaymentModal" class="modal-backdrop" hidden>
      <section class="modal-card payable-payment-card" role="dialog" aria-modal="true" aria-labelledby="payableGroupPaymentTitle">
        <div class="modal-header">
          <div>
            <p class="eyebrow">One payment, separate tracking</p>
            <h2 id="payableGroupPaymentTitle">Pay together</h2>
          </div>
          <button id="closePayableGroupPayment" class="icon-btn soft" type="button" aria-label="Close group payment">×</button>
        </div>
        <form id="payableGroupPaymentForm">
          <input id="payableGroupPaymentName" type="hidden">
          <input id="payableGroupPaymentScope" type="hidden">
          <label><span>Total Paid</span><input id="payableGroupPaymentAmount" type="number" inputmode="decimal" min="0.01" step="0.01" required></label>
          <label><span>Date</span><input id="payableGroupPaymentDate" type="date" required></label>
          <p class="payable-payment-note">Momo splits partial card payments proportionally across the linked items. You can adjust each allocation before saving.</p>
          <div id="payableGroupAllocationList" class="payable-group-allocation-list"></div>
          <label><span>Note <small>(optional)</small></span><input id="payableGroupPaymentNote" type="text" maxlength="100" placeholder="BPI statement payment"></label>
          <button class="primary-button" type="submit">Record Combined Payment</button>
        </form>
      </section>
    </div>''',
    "group payment modal",
)

# ---------- app.js helpers ----------
replace_once(
    "app.js",
    '''function payablePHPValue(payable, amount) {
  return convertCurrency(Number(amount || 0), payable?.currency || "PHP", "PHP");
}''',
    '''function payablePHPValue(payable, amount) {
  return convertCurrency(Number(amount || 0), payable?.currency || "PHP", "PHP");
}

function getPayableOverallProgressPercent(payable) {
  if (!payable) return 0;
  const totalProgress = Math.max(0, Math.floor(Number(payable.paymentsTotal || payable.installmentCount || 0)));
  const completedProgress = Math.max(0, Math.floor(Number(payable.paymentsCompleted ?? payable.installmentsPaid ?? 0)));
  if (payable.balanceMode === "progress" && totalProgress > 0) {
    return Math.min(100, completedProgress / totalProgress * 100);
  }
  if (payable.type === "installment" && Number(payable.installmentCount || 0) > 0) {
    return Math.min(100, Math.max(0, Number(payable.installmentsPaid || 0) / Number(payable.installmentCount) * 100));
  }
  const startingMonths = Math.max(0, Number(payable.startingRemainingMonths || 0));
  const remainingMonths = Math.max(0, Number(payable.remainingMonths || 0));
  if (payable.balanceMode === "months" && startingMonths > 0) {
    return Math.min(100, Math.max(0, (startingMonths - remainingMonths) / startingMonths * 100));
  }
  const original = Math.max(0, Number(payable.originalAmount || 0));
  const balance = getPayableBalance(payable);
  return original > 0 ? Math.min(100, Math.max(0, (original - balance) / original * 100)) : 0;
}

function getPayableCyclePayments(payable, monthKey) {
  return getPayablePayments(payable).filter((payment) => payment?.paidMonth === monthKey);
}

function getPayableCyclePaidAmount(payable, monthKey) {
  return getPayableCyclePayments(payable, monthKey).reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0);
}

function getPayableCycleTargetAmount(payable, monthKey) {
  const payments = getPayableCyclePayments(payable, monthKey);
  const storedTarget = payments.reduce((max, payment) => Math.max(max, Number(payment.cycleTargetAmount || 0)), 0);
  if (storedTarget > 0) return storedTarget;
  const paid = getPayableCyclePaidAmount(payable, monthKey);
  if (isVariableMonthlyPayable(payable)) {
    return Math.max(0, Number(payable.regularPayment || 0), paid);
  }
  const balanceAvailable = getPayableBalance(payable) + paid;
  const scheduled = Math.max(0, Number(payable.regularPayment || payable.minimumDue || 0));
  return scheduled > 0 ? Math.min(balanceAvailable, scheduled) : balanceAvailable;
}

function getPayableCycleRemainingAmount(payable, monthKey) {
  return Math.max(0, Math.round((getPayableCycleTargetAmount(payable, monthKey) - getPayableCyclePaidAmount(payable, monthKey) + Number.EPSILON) * 100) / 100);
}

function getPayablePaymentCycleMonth(payable, paymentDate = getTodayString()) {
  return getPayableMonthKey(payable?.dueDate || paymentDate) || getPayableMonthKey(paymentDate);
}

function getPayableMonthlyPlanAmount(payable, monthKey = getCurrentMonthKey()) {
  if (!isPayableActive(payable)) return 0;
  if (payable.frequency === "monthly") {
    if (isVariableMonthlyPayable(payable)) {
      const target = getPayableCycleTargetAmount(payable, monthKey);
      return target > 0 ? target : Math.max(0, Number(payable.regularPayment || 0));
    }
    return getPayableNextPaymentAmount(payable);
  }
  return getPayableMonthKey(payable.dueDate) === monthKey ? getPayableNextPaymentAmount(payable) : 0;
}

function getPayablePaydayLabel(payable) {
  if (payable?.paydaySlot === "first") return "1st payday";
  if (payable?.paydaySlot === "second") return "2nd payday";
  return "";
}

function getPayableGroupName(payable) {
  return String(payable?.paymentGroup || "").trim();
}

function getPayableGroupMembers(groupName) {
  const target = String(groupName || "").trim().toLowerCase();
  return cards.filter((item) => isPayableActive(item) && getPayableGroupName(item).toLowerCase() === target);
}

function getPayableGroupCycleRemaining(item) {
  const cycleMonth = getPayablePaymentCycleMonth(item);
  return getPayableCycleRemainingAmount(item, cycleMonth);
}''',
    "payable planning helpers",
)

# Replace totals and rendering calculations.
replace_once(
    "app.js",
    '''  const nextPaymentsTotal = waiting.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableNextPaymentAmount(item)),
    0
  );
  const paidCycleTotal = paidCycleEntries.reduce(
    (sum, { item, payment }) => sum + payablePHPValue(item, payment.amount),
    0
  );
  const fullMonthPayablesTotal = nextPaymentsTotal + paidCycleTotal;''',
    '''  const nextPaymentsTotal = waiting.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableCycleRemainingAmount(item, currentMonthKey)),
    0
  );
  const fullMonthPayablesTotal = cards.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableMonthlyPlanAmount(item, currentMonthKey)),
    0
  );''',
    "monthly payable totals",
)

replace_once(
    "app.js",
    '''    return sum + payablePHPValue(item, getPayableNextPaymentAmount(item));''',
    '''    return sum + payablePHPValue(item, getPayableCycleRemainingAmount(item, currentMonthKey));''',
    "due soon remaining",
)

replace_once(
    "app.js",
    '''  if (countEl) {
    countEl.textContent = isDueView
      ? (waiting.length
          ? `${waiting.length} ${waiting.length === 1 ? "payment" : "payments"} left this month`
          : "Nothing waiting this month 🌸")
      : `${waiting.length + paidCycleEntries.length} scheduled this month · ${paidCycleEntries.length} paid`;
  }''',
    '''  if (countEl) {
    const activeMonthly = cards.filter((item) => isPayableActive(item) && getPayableMonthlyPlanAmount(item, currentMonthKey) > 0).length;
    countEl.textContent = isDueView
      ? (waiting.length
          ? `${waiting.length} ${waiting.length === 1 ? "payment" : "payments"} left this month`
          : "Nothing waiting this month 🌸")
      : `${activeMonthly} active monthly ${activeMonthly === 1 ? "payment" : "payments"}`;
  }

  const paydayAmount = (slot, dueOnly) => cards.reduce((sum, item) => {
    if (item.paydaySlot !== slot || !isPayableActive(item)) return sum;
    const amount = dueOnly
      ? (isPayableWaitingThisMonth(item) ? getPayableCycleRemainingAmount(item, currentMonthKey) : 0)
      : getPayableMonthlyPlanAmount(item, currentMonthKey);
    return sum + payablePHPValue(item, amount);
  }, 0);
  const paydayOne = document.getElementById("payablesPaydayOne");
  const paydayTwo = document.getElementById("payablesPaydayTwo");
  if (paydayOne) paydayOne.textContent = formatPHP(paydayAmount("first", isDueView));
  if (paydayTwo) paydayTwo.textContent = formatPHP(paydayAmount("second", isDueView));
  const oneHint = document.getElementById("payablesPaydayOneHint");
  const twoHint = document.getElementById("payablesPaydayTwoHint");
  if (oneHint) oneHint.textContent = isDueView ? "still due" : "monthly plan";
  if (twoHint) twoHint.textContent = isDueView ? "still due" : "monthly plan";

  const groupSummary = document.getElementById("payablesGroupSummary");
  if (groupSummary) {
    const groups = new Map();
    cards.filter((item) => isPayableActive(item) && getPayableGroupName(item)).forEach((item) => {
      const name = getPayableGroupName(item);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(item);
    });
    groupSummary.innerHTML = [...groups.entries()].map(([name, items]) => {
      const amount = items.reduce((sum, item) => {
        const value = isDueView
          ? (isPayableWaitingThisMonth(item) ? getPayableCycleRemainingAmount(item, currentMonthKey) : 0)
          : getPayableMonthlyPlanAmount(item, currentMonthKey);
        return sum + payablePHPValue(item, value);
      }, 0);
      const payableNow = items.reduce((sum, item) => sum + payablePHPValue(item, getPayableGroupCycleRemaining(item)), 0);
      return `<article class="payable-group-card"><div><small>Paid together</small><strong>${escapeHTML(name)}</strong><em>${items.length} linked ${items.length === 1 ? "item" : "items"}</em></div><div><b>${formatPHP(amount)}</b>${payableNow > 0 ? `<button type="button" data-payable-group-pay="${escapeHTML(name)}" data-group-scope="${isDueView ? "due" : "all"}">Pay together</button>` : ""}</div></article>`;
    }).join("");
    groupSummary.hidden = groups.size === 0;
  }''',
    "payday and group summaries",
)

# All-list and Due-list progress/labels.
replace_once(
    "app.js",
    '''      const original = Number(item.originalAmount || 0);
      const paidPercent = original > 0 ? Math.min(100, Math.max(0, ((original - balance) / original) * 100)) : 0;''',
    '''      const paidPercent = getPayableOverallProgressPercent(item);''',
    "all progress",
)
replace_once(
    "app.js",
    '''              <b>${done ? "Paid off" : (isVariableMonthlyPayable(item) && !(nextPayment > 0) ? "Set amount" : formatCurrency(nextPayment, item.currency || "PHP"))}</b>''',
    '''              <b>${done ? "Paid off" : (isVariableMonthlyPayable(item) && !(getPayableMonthlyPlanAmount(item, currentMonthKey) > 0) ? "Set amount" : formatCurrency(getPayableMonthlyPlanAmount(item, currentMonthKey), item.currency || "PHP"))}</b>''',
    "all monthly amount",
)
replace_once(
    "app.js",
    '''              <em>${done ? "finished" : escapeHTML(getPayablePaymentLabel(item))}</em>''',
    '''              <em>${done ? "finished" : escapeHTML([getPayablePaymentLabel(item), getPayablePaydayLabel(item), getPayableGroupName(item)].filter(Boolean).join(" · "))}</em>''',
    "all payable meta",
)
replace_once(
    "app.js",
    '''        const original = Number(item.originalAmount || 0);
        const paidPercent = original > 0 ? Math.min(100, Math.max(0, ((original - balance) / original) * 100)) : 0;
        const tone = payableDueTone(item.dueDate);''',
    '''        const paidPercent = getPayableOverallProgressPercent(item);
        const cycleTarget = getPayableCycleTargetAmount(item, currentMonthKey);
        const cyclePaid = getPayableCyclePaidAmount(item, currentMonthKey);
        const cycleRemaining = getPayableCycleRemainingAmount(item, currentMonthKey);
        const tone = payableDueTone(item.dueDate);''',
    "due progress and partials",
)
replace_once(
    "app.js",
    '''                  <b>${isVariableMonthlyPayable(item) && !(nextPayment > 0) ? "Set amount" : formatCurrency(nextPayment, item.currency || "PHP")}</b>''',
    '''                  <b>${isVariableMonthlyPayable(item) && !(cycleTarget > 0) ? "Set amount" : formatCurrency(cycleRemaining, item.currency || "PHP")}</b>''',
    "due remaining amount",
)
replace_once(
    "app.js",
    '''                  <em>${escapeHTML(getPayablePaymentLabel(item))}</em>''',
    '''                  <em>${escapeHTML([cyclePaid > 0 ? `${formatCurrency(cyclePaid, item.currency || "PHP")} paid of ${formatCurrency(cycleTarget, item.currency || "PHP")}` : getPayablePaymentLabel(item), getPayablePaydayLabel(item), getPayableGroupName(item)].filter(Boolean).join(" · "))}</em>''',
    "due partial meta",
)

# Editor fields.
replace_once(
    "app.js",
    '''  document.getElementById("payableNotes").value = item?.notes || "";
  updatePayableSpecialFields();''',
    '''  document.getElementById("payablePaydaySlot").value = item?.paydaySlot || "";
  document.getElementById("payablePaymentGroup").value = item?.paymentGroup || "";
  const groupOptions = document.getElementById("payablePaymentGroupOptions");
  if (groupOptions) {
    groupOptions.innerHTML = [...new Set(cards.map((entry) => getPayableGroupName(entry)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `<option value="${escapeHTML(name)}"></option>`).join("");
  }
  document.getElementById("payableNotes").value = item?.notes || "";
  updatePayableSpecialFields();''',
    "open planning fields",
)
replace_once(
    "app.js",
    '''    statementDay: paymentMode === "variable" ? Number(document.getElementById("payableStatementDay").value || 0) : 0,
    installmentCount:''',
    '''    statementDay: paymentMode === "variable" ? Number(document.getElementById("payableStatementDay").value || 0) : 0,
    paydaySlot: ["first", "second"].includes(document.getElementById("payablePaydaySlot")?.value) ? document.getElementById("payablePaydaySlot").value : "",
    paymentGroup: document.getElementById("payablePaymentGroup")?.value.trim() || "",
    startingRemainingMonths: balanceMode === "months" ? Math.max(Number(existing?.startingRemainingMonths || 0), remainingMonths) : Number(existing?.startingRemainingMonths || 0),
    installmentCount:''',
    "save planning fields",
)

# Detail planning info.
replace_once(
    "app.js",
    '''      ${variableMonthly && Number(item.statementDay || 0) ? `<div><small>Statement day</small><strong>Day ${Number(item.statementDay)}</strong></div>` : ""}
      ${item.dueDate ?''',
    '''      ${variableMonthly && Number(item.statementDay || 0) ? `<div><small>Statement day</small><strong>Day ${Number(item.statementDay)}</strong></div>` : ""}
      ${getPayablePaydayLabel(item) ? `<div><small>Payday plan</small><strong>${escapeHTML(getPayablePaydayLabel(item))}</strong></div>` : ""}
      ${getPayableGroupName(item) ? `<div><small>Paid together under</small><strong>${escapeHTML(getPayableGroupName(item))}</strong></div>` : ""}
      ${item.dueDate ?''',
    "detail planning metadata",
)

# Replace payment functions with cycle-aware partial engine.
sub_once(
    "app.js",
    r'''async function recordPayablePayment\(event\) \{.*?\n\}\n\nasync function markPayablePaidForCurrentMonth\(id\) \{.*?\n\}\n\nasync function undoPayablePaidForCurrentMonth''',
    r'''async function applyPayablePayment(item, requestedAmount, paymentDate, note = "", options = {}) {
  if (!item || !isPayableActive(item)) return null;
  const variableMonthly = isVariableMonthlyPayable(item);
  const cycleMonth = options.paidMonth || getPayablePaymentCycleMonth(item, paymentDate);
  const alreadyPaid = getPayableCyclePaidAmount(item, cycleMonth);
  const target = getPayableCycleTargetAmount(item, cycleMonth);
  if (!(target > 0)) return null;
  const remainingForCycle = Math.max(0, Math.round((target - alreadyPaid + Number.EPSILON) * 100) / 100);
  if (!(remainingForCycle > 0)) return null;

  const currentBalance = getPayableBalance(item);
  const requested = Math.max(0, Number(requestedAmount || 0));
  const actualAmount = Math.min(requested, remainingForCycle, variableMonthly ? remainingForCycle : currentBalance);
  if (!(actualAmount > 0)) return null;

  const cyclePaidAfter = Math.round((alreadyPaid + actualAmount + Number.EPSILON) * 100) / 100;
  const completedCycle = cyclePaidAfter + 0.005 >= target;
  const nextBalance = variableMonthly
    ? 0
    : Math.max(0, Math.round((currentBalance - actualAmount + Number.EPSILON) * 100) / 100);
  const previousDueDate = item.dueDate || "";
  const dueAnchor = previousDueDate || paymentDate;
  const remainsActive = variableMonthly || nextBalance > 0;
  const nextDueDate = completedCycle && remainsActive
    ? nextPayableDueDate(dueAnchor, item.frequency || "monthly", item.dueDayOfMonth || getPayableDueDay(dueAnchor))
    : (completedCycle ? "" : previousDueDate);

  const payment = {
    id: generateId("payment"),
    amount: actualAmount,
    date: paymentDate,
    note,
    source: options.source || "manual",
    paidMonth: cycleMonth,
    cycleTargetAmount: target,
    groupPaymentId: options.groupPaymentId || "",
    groupName: options.groupName || "",
    previousDueDate,
    nextDueDate,
    previousRegularPayment: variableMonthly ? Number(item.regularPayment || 0) : undefined,
    previousRemainingMonths: Number(item.remainingMonths || 0),
    previousPaymentsCompleted: Number(item.paymentsCompleted || 0)
  };

  const next = {
    ...item,
    balance: nextBalance,
    regularPayment: variableMonthly && completedCycle ? 0 : item.regularPayment,
    payments: [...getPayablePayments(item), payment],
    remainingMonths:
      completedCycle && item.balanceMode === "months"
        ? Math.max(0, Number(item.remainingMonths || 0) - 1)
        : Number(item.remainingMonths || 0),
    paymentsCompleted:
      completedCycle && item.balanceMode === "progress"
        ? Math.min(Number(item.paymentsTotal || 0), Number(item.paymentsCompleted || 0) + 1)
        : Number(item.paymentsCompleted || 0),
    installmentsPaid:
      item.type === "installment" && completedCycle && Number(item.installmentCount || 0)
        ? Math.min(Number(item.installmentCount), Number(item.installmentsPaid || 0) + 1)
        : Number(item.installmentsPaid || 0),
    dueDate: completedCycle ? nextDueDate : previousDueDate,
    updatedAt: new Date().toISOString()
  };

  await putRecord(STORES.cards, next);
  const index = cards.findIndex((entry) => String(entry.id) === String(item.id));
  if (index >= 0) cards[index] = next;
  return { next, payment, actualAmount, completedCycle, cycleMonth, target, remainingAfter: Math.max(0, target - cyclePaidAfter) };
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
    return;
  }
  if (!paymentDate) {
    showToast("Choose the payment date.");
    return;
  }
  const result = await applyPayablePayment(
    item,
    amount,
    paymentDate,
    document.getElementById("payablePaymentNote").value.trim()
  );
  if (!result) {
    showToast(isVariableMonthlyPayable(item) ? "Set this month’s statement amount first." : "There is nothing left to apply to this payment cycle.");
    return;
  }
  closePayablePayment();
  renderPayables();
  renderMomoToday();
  renderSmartReminders();
  resyncAllPhoneReminders();
  document.dispatchEvent(new CustomEvent("momo-data-changed"));
  renderPayableDetail(id);
  showToast(result.completedCycle ? "Monthly payment covered ✓" : `${formatCurrency(result.remainingAfter, item.currency || "PHP")} still due for this cycle`);
}

async function markPayablePaidForCurrentMonth(id) {
  const item = cards.find((entry) => String(entry.id) === String(id));
  if (!item || !isPayableActive(item)) return;
  const monthKey = getCurrentMonthKey();
  if (getPayableCycleCheckPayment(item, monthKey)) return;
  if (!isPayableWaitingThisMonth(item)) {
    showToast("That payable is not due this month yet.");
    return;
  }
  const remaining = getPayableCycleRemainingAmount(item, monthKey);
  if (!(remaining > 0)) return;
  const result = await applyPayablePayment(
    item,
    remaining,
    getTodayString(),
    `Paid for ${getPayableMonthLabel(monthKey)}`,
    { source: "month-check", paidMonth: monthKey }
  );
  if (!result) return;
  renderPayables();
  renderMomoToday();
  renderSmartReminders();
  resyncAllPhoneReminders();
  document.dispatchEvent(new CustomEvent("momo-data-changed"));
  showToast(`${item.name || "Payable"} is paid for ${getPayableMonthLabel(monthKey)} ✓`);
}

async function undoPayablePaidForCurrentMonth''',
    "cycle-aware payment engine",
    flags=re.S,
)

# Payment modal should show remaining for the actual due cycle and allow early payments.
replace_once(
    "app.js",
    '''  document.getElementById("payablePaymentAmount").value = item.regularPayment || item.minimumDue || "";
  document.getElementById("payablePaymentAmount").max = isVariableMonthlyPayable(item) ? getPayableNextPaymentAmount(item) : getPayableBalance(item);
  document.getElementById("payablePaymentDate").value = getTodayString();''',
    '''  const cycleMonth = getPayablePaymentCycleMonth(item);
  const remaining = getPayableCycleRemainingAmount(item, cycleMonth);
  document.getElementById("payablePaymentAmount").value = remaining > 0 ? remaining : "";
  document.getElementById("payablePaymentAmount").max = remaining > 0 ? remaining : getPayableBalance(item);
  document.getElementById("payablePaymentDate").value = getTodayString();
  const cycleNote = document.getElementById("payablePaymentCycleNote");
  if (cycleNote) cycleNote.textContent = `${getPayableMonthLabel(cycleMonth)} cycle · partial payments are okay, including payments before the due date.`;''',
    "payment modal cycle remainder",
)

# Add group-payment functions before deletePayable.
replace_once(
    "app.js",
    '''async function deletePayable(id) {''',
    '''function closePayableGroupPayment() {
  const modal = document.getElementById("payableGroupPaymentModal");
  if (modal) modal.hidden = true;
}

function getGroupPaymentCandidates(groupName, scope = "all") {
  return getPayableGroupMembers(groupName)
    .filter((item) => scope !== "due" || isPayableWaitingThisMonth(item))
    .map((item) => ({ item, remaining: getPayableGroupCycleRemaining(item) }))
    .filter((entry) => entry.remaining > 0)
    .sort((a, b) => String(a.item.dueDate || "9999-12-31").localeCompare(String(b.item.dueDate || "9999-12-31")));
}

function rebalancePayableGroupAllocations() {
  const totalInput = document.getElementById("payableGroupPaymentAmount");
  const list = document.getElementById("payableGroupAllocationList");
  if (!totalInput || !list) return;
  const total = Math.max(0, Number(totalInput.value || 0));
  const inputs = [...list.querySelectorAll("[data-group-allocation]")];
  const capacity = inputs.reduce((sum, input) => sum + Math.max(0, Number(input.dataset.maxAmount || 0)), 0);
  if (!(capacity > 0)) return;
  let assigned = 0;
  inputs.forEach((input, index) => {
    const max = Math.max(0, Number(input.dataset.maxAmount || 0));
    const value = index === inputs.length - 1
      ? Math.max(0, Math.min(max, Math.round((Math.min(total, capacity) - assigned + Number.EPSILON) * 100) / 100))
      : Math.min(max, Math.round((Math.min(total, capacity) * (max / capacity) + Number.EPSILON) * 100) / 100);
    input.value = value > 0 ? value.toFixed(2) : "";
    assigned += value;
  });
}

function openPayableGroupPayment(groupName, scope = "all") {
  const modal = document.getElementById("payableGroupPaymentModal");
  const list = document.getElementById("payableGroupAllocationList");
  if (!modal || !list) return;
  const candidates = getGroupPaymentCandidates(groupName, scope);
  if (!candidates.length) {
    showToast("Nothing is waiting under this payment account right now.");
    return;
  }
  document.getElementById("payableGroupPaymentName").value = groupName;
  document.getElementById("payableGroupPaymentScope").value = scope;
  document.getElementById("payableGroupPaymentTitle").textContent = `Pay ${groupName}`;
  document.getElementById("payableGroupPaymentDate").value = getTodayString();
  document.getElementById("payableGroupPaymentNote").value = "";
  const total = candidates.reduce((sum, entry) => sum + payablePHPValue(entry.item, entry.remaining), 0);
  document.getElementById("payableGroupPaymentAmount").value = total.toFixed(2);
  list.innerHTML = candidates.map(({ item, remaining }) => `
    <label class="payable-group-allocation-row">
      <span><strong>${escapeHTML(item.name || getPayableMeta(item).label)}</strong><small>${item.dueDate ? `Due ${formatShortDate(item.dueDate)}` : "No due date"} · ${formatCurrency(remaining, item.currency || "PHP")} left</small></span>
      <input type="number" inputmode="decimal" min="0" step="0.01" data-group-allocation="${escapeHTML(item.id)}" data-max-amount="${remaining}" value="${remaining.toFixed(2)}">
    </label>`).join("");
  modal.hidden = false;
}

async function recordPayableGroupPayment(event) {
  event.preventDefault();
  const groupName = document.getElementById("payableGroupPaymentName").value.trim();
  const paymentDate = document.getElementById("payableGroupPaymentDate").value;
  const note = document.getElementById("payableGroupPaymentNote").value.trim();
  if (!groupName || !paymentDate) return;
  const groupPaymentId = generateId("group-payment");
  const allocations = [...document.querySelectorAll("[data-group-allocation]")]
    .map((input) => ({ id: input.dataset.groupAllocation, amount: Math.max(0, Number(input.value || 0)) }))
    .filter((entry) => entry.amount > 0);
  if (!allocations.length) {
    showToast("Add at least one allocation.");
    return;
  }
  let recorded = 0;
  for (const allocation of allocations) {
    const item = cards.find((entry) => String(entry.id) === String(allocation.id));
    if (!item) continue;
    const result = await applyPayablePayment(item, allocation.amount, paymentDate, note || `Paid together via ${groupName}`, {
      source: "group-payment",
      groupPaymentId,
      groupName
    });
    if (result) recorded += payablePHPValue(item, result.actualAmount);
  }
  closePayableGroupPayment();
  renderPayables();
  renderMomoToday();
  renderSmartReminders();
  resyncAllPhoneReminders();
  document.dispatchEvent(new CustomEvent("momo-data-changed"));
  showToast(`${formatPHP(recorded)} recorded across ${groupName} ✓`);
}

async function deletePayable(id) {''',
    "group payment functions",
)

# Event hooks.
replace_once(
    "app.js",
    '''  const remove = event.target.closest("[data-payable-delete]");
  if (remove) deletePayable(remove.dataset.payableDelete);''',
    '''  const groupPay = event.target.closest("[data-payable-group-pay]");
  if (groupPay) openPayableGroupPayment(groupPay.dataset.payableGroupPay, groupPay.dataset.groupScope || "all");

  const remove = event.target.closest("[data-payable-delete]");
  if (remove) deletePayable(remove.dataset.payableDelete);''',
    "group pay click",
)
replace_once(
    "app.js",
    '''document.getElementById("payablePaymentForm")?.addEventListener("submit", recordPayablePayment);
document.getElementById("closePayableModal")?.addEventListener("click", closePayableEditor);''',
    '''document.getElementById("payablePaymentForm")?.addEventListener("submit", recordPayablePayment);
document.getElementById("payableGroupPaymentForm")?.addEventListener("submit", recordPayableGroupPayment);
document.getElementById("payableGroupPaymentAmount")?.addEventListener("input", rebalancePayableGroupAllocations);
document.getElementById("closePayableGroupPayment")?.addEventListener("click", closePayableGroupPayment);
document.getElementById("closePayableModal")?.addEventListener("click", closePayableEditor);''',
    "group payment event hooks",
)

# ---------- styles.css ----------
with Path("styles.css").open("a") as f:
    f.write(r'''

/* Payables planner: payday totals, linked payment accounts, partial allocations */
.payables-payday-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 14px 0 12px;
}
.payables-payday-summary article {
  border: 1px solid var(--line, #f2d7df);
  border-radius: 22px;
  padding: 14px 16px;
  background: rgba(255,255,255,.72);
  min-width: 0;
}
.payables-payday-summary small,
.payables-payday-summary em { display:block; color: var(--muted, #9a7e87); font-style:normal; }
.payables-payday-summary strong { display:block; margin:4px 0; font-size:1.18rem; color:var(--ink,#513f45); }
.payables-group-summary { display:grid; gap:10px; margin: 0 0 18px; }
.payable-group-card {
  display:flex; align-items:center; justify-content:space-between; gap:14px;
  padding:14px 16px; border:1px solid var(--line,#f2d7df); border-radius:22px; background:rgba(255,255,255,.64);
}
.payable-group-card > div:first-child { min-width:0; }
.payable-group-card small,.payable-group-card em { display:block; color:var(--muted,#9a7e87); font-style:normal; }
.payable-group-card strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.payable-group-card > div:last-child { text-align:right; flex:0 0 auto; }
.payable-group-card b { display:block; margin-bottom:6px; }
.payable-group-card button { border:0; border-radius:999px; padding:7px 11px; background:#fbe3ec; color:#b96087; font-weight:700; }
.payable-group-helper { margin-top:-4px; }
.payable-group-allocation-list { display:grid; gap:10px; margin:12px 0; }
.payable-group-allocation-row {
  display:grid !important; grid-template-columns:minmax(0,1fr) 108px; align-items:center; gap:12px;
  padding:12px; border:1px solid var(--line,#f2d7df); border-radius:18px; background:rgba(255,255,255,.66);
}
.payable-group-allocation-row span { min-width:0; }
.payable-group-allocation-row strong,.payable-group-allocation-row small { display:block; }
.payable-group-allocation-row small { color:var(--muted,#9a7e87); margin-top:3px; }
.payable-group-allocation-row input { width:100%; min-width:0; }
@media (max-width: 390px) {
  .payables-payday-summary { gap:9px; }
  .payables-payday-summary article { padding:12px; }
  .payable-group-card { align-items:flex-start; }
  .payable-group-allocation-row { grid-template-columns:minmax(0,1fr) 96px; }
}
''')

# ---------- service-worker.js ----------
replace_once(
    "service-worker.js",
    '`momo-runtime-shell-v${APP_VERSION}-payables-monthly-r2`',
    '`momo-runtime-shell-v${APP_VERSION}-payables-planner-r1`',
    "service worker cache bump",
)
