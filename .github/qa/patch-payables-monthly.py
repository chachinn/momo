from pathlib import Path
import re


def sub_once(path, pattern, repl, flags=0, label=None):
    p = Path(path)
    text = p.read_text()
    new, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"Expected one replacement for {label or pattern[:80]!r} in {path}, got {count}")
    p.write_text(new)


def replace_once(path, old, new, label=None):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing {label or old[:100]!r} in {path}")
    p.write_text(text.replace(old, new, 1))

# -----------------------------
# index.html
# -----------------------------
replace_once(
    "index.html",
    '<p>Still to pay this month</p>',
    '<p id="payablesHeroLabel">Still to pay this month</p>',
    "payables hero label",
)

# Clarify the direct-balance field and helper.
replace_once(
    "index.html",
    '<span>Still to Pay <small>(optional)</small></span>',
    '<span>Remaining Balance <small>(optional)</small></span>',
    "remaining balance label",
)
replace_once(
    "index.html",
    'If Still to Pay is blank, Momo will use the Statement Balance for a credit card or the Original Amount for other payables.',
    'For fixed monthly payables, you can enter the remaining balance, remaining months, or payment progress such as 1 of 24. Momo will calculate the balance when you choose one of the calculated options.',
    "payable amount helper",
)

# Give the regular-payment label an id so JS can change it for variable monthly plans.
replace_once(
    "index.html",
    '<span>Regular Payment <small>(optional)</small></span>',
    '<span id="payableRegularPaymentLabel">Regular Payment <small>(optional)</small></span>',
    "regular payment label",
)

# Add combined monthly setup immediately after the frequency select row.
sub_once(
    "index.html",
    r'(<select id="payableFrequency">.*?</select>\s*</label>\s*</div>)',
    r'''\1

          <section id="payableMonthlySetup" class="payable-monthly-setup">
            <p class="section-kicker">Monthly setup</p>
            <div class="modal-field-row">
              <label>
                <span>Monthly Amount</span>
                <select id="payablePaymentMode">
                  <option value="fixed">Fixed amount each month</option>
                  <option value="variable">Amount changes each month</option>
                </select>
              </label>
              <label id="payableBalanceModeField">
                <span>How do you know what’s left?</span>
                <select id="payableBalanceMode">
                  <option value="balance">I know the remaining balance</option>
                  <option value="months">I know the remaining months</option>
                  <option value="progress">I know the payment progress (1 of 24)</option>
                </select>
              </label>
            </div>

            <div id="payableRemainingMonthsFields" class="modal-field-row" hidden>
              <label>
                <span>Remaining Months</span>
                <input id="payableRemainingMonths" type="number" inputmode="numeric" min="1" step="1" placeholder="11">
              </label>
              <div class="payable-calc-card">
                <small>Calculated remaining balance</small>
                <strong id="payableCalculatedBalance">—</strong>
              </div>
            </div>

            <div id="payableProgressFields" class="modal-field-row" hidden>
              <label>
                <span>Payments Completed</span>
                <input id="payablePaymentsCompleted" type="number" inputmode="numeric" min="0" step="1" placeholder="1">
              </label>
              <label>
                <span>Total Payments</span>
                <input id="payablePaymentsTotal" type="number" inputmode="numeric" min="1" step="1" placeholder="24">
              </label>
              <div class="payable-calc-card">
                <small>Calculated remaining balance</small>
                <strong id="payableProgressBalance">—</strong>
              </div>
            </div>

            <div id="payableVariableFields" class="payable-variable-fields" hidden>
              <p class="payable-amount-helper">Enter this month’s amount in the payment field above. After you mark it Paid, Momo clears the amount so you can enter the next statement when it arrives.</p>
              <div class="modal-field-row">
                <label>
                  <span>Statement Day</span>
                  <input id="payableStatementDay" type="number" inputmode="numeric" min="1" max="31" placeholder="15">
                </label>
                <label class="payable-reminder-check">
                  <span>Statement Reminder</span>
                  <span class="payable-reminder-checkline"><input id="payableStatementReminder" type="checkbox" checked> Remind me to set this month’s amount</span>
                </label>
              </div>
            </div>
          </section>''',
    flags=re.S,
    label="monthly setup insertion",
)

# Remove the old credit-card-only Statement Day field now that it is generic for variable monthly plans.
sub_once(
    "index.html",
    r'\s*<label><span>Statement Day</span><input id="payableStatementDay"[^>]*></label>',
    '',
    label="old statement day",
)

# -----------------------------
# app.js helpers + rendering
# -----------------------------
sub_once(
    "app.js",
    r'''function getPayableBalance\(payable\) \{.*?\n\}\n\nfunction getPayableNextPaymentAmount\(payable\) \{.*?\n\}''',
    r'''function isVariableMonthlyPayable(payable) {
  return payable?.frequency === "monthly" && payable?.paymentMode === "variable";
}

function getPayableBalance(payable) {
  return Math.max(0, Number(payable?.balance || 0));
}

function isPayableActive(payable) {
  if (isVariableMonthlyPayable(payable)) {
    return payable?.closed !== true;
  }
  return getPayableBalance(payable) > 0;
}

function getPayableNextPaymentAmount(payable) {
  if (!isPayableActive(payable)) return 0;

  if (isVariableMonthlyPayable(payable)) {
    return Math.max(0, Number(payable?.regularPayment || 0));
  }

  const balance = getPayableBalance(payable);
  const scheduled =
    Number(payable?.regularPayment || 0) ||
    Number(payable?.minimumDue || 0);

  return Math.min(
    balance,
    scheduled > 0 ? scheduled : balance
  );
}

function getPayableRemainingPayments(payable) {
  if (isVariableMonthlyPayable(payable)) return null;

  if (payable?.balanceMode === "months") {
    const months = Math.max(0, Math.floor(Number(payable?.remainingMonths || 0)));
    return months || null;
  }

  if (payable?.balanceMode === "progress") {
    const total = Math.max(0, Math.floor(Number(payable?.paymentsTotal || payable?.installmentCount || 0)));
    const completed = Math.max(0, Math.floor(Number(payable?.paymentsCompleted ?? payable?.installmentsPaid ?? 0)));
    return total > 0 ? Math.max(0, total - completed) : null;
  }

  const payment = Math.max(0, Number(payable?.regularPayment || 0));
  const balance = getPayableBalance(payable);
  return payment > 0 && balance > 0 ? Math.ceil(balance / payment) : null;
}

function getPayableStatementDate(payable, referenceDateString = getTodayString()) {
  const day = Math.max(1, Math.min(31, Math.floor(Number(payable?.statementDay || 0))));
  const reference = createLocalDate(referenceDateString);
  if (!day || !reference) return "";

  const makeDate = (year, monthIndex) => {
    const last = new Date(year, monthIndex + 1, 0).getDate();
    const date = new Date(year, monthIndex, Math.min(day, last));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  let candidate = makeDate(reference.getFullYear(), reference.getMonth());
  if (candidate < referenceDateString) {
    const next = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
    candidate = makeDate(next.getFullYear(), next.getMonth());
  }
  return candidate;
}''',
    flags=re.S,
    label="payable balance helpers",
)

replace_once(
    "app.js",
    'function getPayablePaymentLabel(payable) {\n  switch (payable?.frequency) {',
    'function getPayablePaymentLabel(payable) {\n  if (isVariableMonthlyPayable(payable)) return "Monthly · amount varies";\n  switch (payable?.frequency) {',
    "variable payment label",
)
replace_once(
    "app.js",
    '  if (getPayableBalance(payable) <= 0) return false;',
    '  if (!isPayableActive(payable)) return false;',
    "waiting active check",
)

# All Payables active sorting/count should include variable monthly templates even when this month's amount is 0.
replace_once(
    "app.js",
    '    const doneA = getPayableBalance(a) <= 0;\n    const doneB = getPayableBalance(b) <= 0;',
    '    const doneA = !isPayableActive(a);\n    const doneB = !isPayableActive(b);',
    "all payables sorting",
)
replace_once(
    "app.js",
    '  const activeCount = cards.filter((item) => getPayableBalance(item) > 0).length;',
    '  const activeCount = cards.filter((item) => isPayableActive(item)).length;',
    "active payable count",
)
replace_once(
    "app.js",
    '      const done = balance <= 0;',
    '      const done = !isPayableActive(item);',
    "all payable done state",
)

# Add current-month total (waiting + already paid this month) and switch the hero when viewing All Payables.
replace_once(
    "app.js",
    '''  const nextPaymentsTotal = waiting.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableNextPaymentAmount(item)),
    0
  );''',
    '''  const nextPaymentsTotal = waiting.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableNextPaymentAmount(item)),
    0
  );
  const paidCycleTotal = paidCycleEntries.reduce(
    (sum, { item, payment }) => sum + payablePHPValue(item, payment.amount),
    0
  );
  const fullMonthPayablesTotal = nextPaymentsTotal + paidCycleTotal;''',
    "full month payable total",
)

sub_once(
    "app.js",
    r'''  if \(totalEl\) totalEl\.textContent = formatPHP\(nextPaymentsTotal\);\n  if \(dueEl\) dueEl\.textContent = formatPHP\(dueSoon\);\n  if \(paidEl\) paidEl\.textContent = formatPHP\(paidMonth\);\n  if \(countEl\) countEl\.textContent = waiting\.length\n    \? `\$\{waiting\.length\} \$\{waiting\.length === 1 \? "payment" : "payments"\} left this month`\n    : "Nothing waiting this month 🌸";\n\n  const isDueView = activePayablesView !== "all";''',
    r'''  if (dueEl) dueEl.textContent = formatPHP(dueSoon);
  if (paidEl) paidEl.textContent = formatPHP(paidMonth);

  const isDueView = activePayablesView !== "all";
  const heroLabel = document.getElementById("payablesHeroLabel");
  if (totalEl) totalEl.textContent = formatPHP(isDueView ? nextPaymentsTotal : fullMonthPayablesTotal);
  if (heroLabel) heroLabel.textContent = isDueView ? "Still to pay this month" : "Total for this month";
  if (countEl) {
    countEl.textContent = isDueView
      ? (waiting.length
          ? `${waiting.length} ${waiting.length === 1 ? "payment" : "payments"} left this month`
          : "Nothing waiting this month 🌸")
      : `${waiting.length + paidCycleEntries.length} scheduled this month · ${paidCycleEntries.length} paid`;
  }''',
    label="payables hero totals",
)

# Variable items with no statement amount should say Set amount rather than showing zero.
replace_once(
    "app.js",
    '<b>${done ? "Paid off" : formatCurrency(nextPayment, item.currency || "PHP")}</b>',
    '<b>${done ? "Paid off" : (isVariableMonthlyPayable(item) && !(nextPayment > 0) ? "Set amount" : formatCurrency(nextPayment, item.currency || "PHP"))}</b>',
    "all payable variable amount",
)
replace_once(
    "app.js",
    '<b>${formatCurrency(nextPayment, item.currency || "PHP")}</b>',
    '<b>${isVariableMonthlyPayable(item) && !(nextPayment > 0) ? "Set amount" : formatCurrency(nextPayment, item.currency || "PHP")}</b>',
    "due variable amount",
)

# -----------------------------
# editor behavior
# -----------------------------
sub_once(
    "app.js",
    r'''function updatePayableSpecialFields\(\) \{.*?\n\}''',
    r'''function updatePayableSpecialFields() {
  const type = document.getElementById("payableType")?.value;
  const frequency = document.getElementById("payableFrequency")?.value || "monthly";
  const paymentMode = document.getElementById("payablePaymentMode")?.value || "fixed";
  const balanceMode = document.getElementById("payableBalanceMode")?.value || "balance";
  const credit = document.getElementById("payableCreditFields");
  const installment = document.getElementById("payableInstallmentFields");
  const custom = document.getElementById("payableCustomTypeField");
  const monthly = document.getElementById("payableMonthlySetup");
  const balanceModeField = document.getElementById("payableBalanceModeField");
  const months = document.getElementById("payableRemainingMonthsFields");
  const progress = document.getElementById("payableProgressFields");
  const variable = document.getElementById("payableVariableFields");
  const regularLabel = document.getElementById("payableRegularPaymentLabel");
  const balanceField = document.getElementById("payableBalance")?.closest("label");

  if (credit) credit.hidden = type !== "credit-card";
  if (installment) installment.hidden = type !== "installment";
  if (custom) custom.hidden = type !== "custom";
  if (monthly) monthly.hidden = frequency !== "monthly";

  const variableMonthly = frequency === "monthly" && paymentMode === "variable";
  if (balanceModeField) balanceModeField.hidden = variableMonthly;
  if (months) months.hidden = frequency !== "monthly" || variableMonthly || balanceMode !== "months";
  if (progress) progress.hidden = frequency !== "monthly" || variableMonthly || balanceMode !== "progress";
  if (variable) variable.hidden = !variableMonthly;
  if (balanceField) balanceField.hidden = variableMonthly || (frequency === "monthly" && balanceMode !== "balance");
  if (regularLabel) regularLabel.innerHTML = variableMonthly
    ? 'This Month\'s Amount <small>(set after statement)</small>'
    : 'Regular Payment <small>(optional)</small>';

  updatePayableCalculatedBalance();
}

function updatePayableCalculatedBalance() {
  const payment = Math.max(0, Number(document.getElementById("payableRegularPayment")?.value || 0));
  const months = Math.max(0, Math.floor(Number(document.getElementById("payableRemainingMonths")?.value || 0)));
  const completed = Math.max(0, Math.floor(Number(document.getElementById("payablePaymentsCompleted")?.value || 0)));
  const total = Math.max(0, Math.floor(Number(document.getElementById("payablePaymentsTotal")?.value || 0)));
  const currency = document.getElementById("payableCurrency")?.value || "PHP";
  const monthsPreview = document.getElementById("payableCalculatedBalance");
  const progressPreview = document.getElementById("payableProgressBalance");
  if (monthsPreview) monthsPreview.textContent = payment > 0 && months > 0 ? formatCurrency(payment * months, currency) : "—";
  if (progressPreview) {
    const remaining = total > 0 && completed <= total ? total - completed : 0;
    progressPreview.textContent = payment > 0 && total > 0 && completed <= total ? formatCurrency(payment * remaining, currency) : "—";
  }
}''',
    flags=re.S,
    label="payable editor field behavior",
)

# Populate new fields when editing.
replace_once(
    "app.js",
    '  document.getElementById("payableFrequency").value = item?.frequency || "monthly";',
    '''  document.getElementById("payableFrequency").value = item?.frequency || "monthly";
  document.getElementById("payablePaymentMode").value = item?.paymentMode || "fixed";
  document.getElementById("payableBalanceMode").value = item?.balanceMode || "balance";
  document.getElementById("payableRemainingMonths").value = Number(item?.remainingMonths || 0) > 0 ? Math.floor(Number(item.remainingMonths)) : "";
  document.getElementById("payablePaymentsCompleted").value = Number.isFinite(Number(item?.paymentsCompleted ?? item?.installmentsPaid)) ? Math.max(0, Math.floor(Number(item?.paymentsCompleted ?? item?.installmentsPaid))) : "";
  document.getElementById("payablePaymentsTotal").value = Number(item?.paymentsTotal || item?.installmentCount || 0) > 0 ? Math.floor(Number(item?.paymentsTotal || item?.installmentCount)) : "";''',
    "populate monthly setup",
)
replace_once(
    "app.js",
    '  document.getElementById("payableStatementDay").value = Number(item?.statementDay || 0) >= 1 ? Math.min(31, Math.floor(Number(item.statementDay))) : "";',
    '''  document.getElementById("payableStatementDay").value = Number(item?.statementDay || 0) >= 1 ? Math.min(31, Math.floor(Number(item.statementDay))) : "";
  document.getElementById("payableStatementReminder").checked = item ? Boolean(item.statementReminder) : true;''',
    "populate statement reminder",
)

# Rewrite the save calculation prelude through resolvedBalance validation.
sub_once(
    "app.js",
    r'''  const originalRaw = document\.getElementById\("payableOriginalAmount"\)\.value\.trim\(\);.*?  if \(resolvedBalance === null\) \{\n    showToast\("Add Original Amount, Still to Pay, or Statement Balance so Momo knows what remains\."\);\n    document\.getElementById\(type === "credit-card" \? "payableStatementBalance" : "payableOriginalAmount"\)\?\.focus\(\);\n    return;\n  \}''',
    r'''  const originalRaw = document.getElementById("payableOriginalAmount").value.trim();
  const balanceRaw = document.getElementById("payableBalance").value.trim();
  const statementRaw = type === "credit-card"
    ? document.getElementById("payableStatementBalance").value.trim()
    : "";
  const frequency = document.getElementById("payableFrequency").value || "monthly";
  const paymentMode = frequency === "monthly"
    ? (document.getElementById("payablePaymentMode").value || "fixed")
    : "fixed";
  const balanceMode = frequency === "monthly" && paymentMode === "fixed"
    ? (document.getElementById("payableBalanceMode").value || "balance")
    : "balance";
  const regularPayment = Number(document.getElementById("payableRegularPayment").value || 0);
  const remainingMonths = Math.max(0, Math.floor(Number(document.getElementById("payableRemainingMonths")?.value || 0)));
  const paymentsCompleted = Math.max(0, Math.floor(Number(document.getElementById("payablePaymentsCompleted")?.value || 0)));
  const paymentsTotal = Math.max(0, Math.floor(Number(document.getElementById("payablePaymentsTotal")?.value || 0)));

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

  if (!Number.isFinite(regularPayment) || regularPayment < 0) {
    showToast(paymentMode === "variable" ? "Enter a valid amount for this month." : "Enter a valid regular payment amount.");
    document.getElementById("payableRegularPayment")?.focus();
    return;
  }

  let resolvedBalance = enteredBalance;

  if (paymentMode === "variable") {
    resolvedBalance = 0;
  } else if (frequency === "monthly" && balanceMode === "months") {
    if (!(regularPayment > 0) || !(remainingMonths > 0)) {
      showToast("Add the monthly payment and remaining months.");
      document.getElementById(!(regularPayment > 0) ? "payableRegularPayment" : "payableRemainingMonths")?.focus();
      return;
    }
    resolvedBalance = Math.round((regularPayment * remainingMonths + Number.EPSILON) * 100) / 100;
  } else if (frequency === "monthly" && balanceMode === "progress") {
    if (!(regularPayment > 0) || !(paymentsTotal > 0) || paymentsCompleted > paymentsTotal) {
      showToast("Add a monthly payment and valid progress, such as 1 of 24.");
      document.getElementById(!(regularPayment > 0) ? "payableRegularPayment" : "payablePaymentsCompleted")?.focus();
      return;
    }
    resolvedBalance = Math.round((regularPayment * Math.max(0, paymentsTotal - paymentsCompleted) + Number.EPSILON) * 100) / 100;
  } else {
    if (resolvedBalance === null && type === "credit-card" && statementRaw !== "") {
      resolvedBalance = statementBalance;
    }
    if (resolvedBalance === null && originalRaw !== "") {
      resolvedBalance = originalAmount;
    }
  }

  if (resolvedBalance === null) {
    showToast("Add a remaining balance, remaining months, payment progress, Original Amount, or Statement Balance.");
    document.getElementById("payableBalance")?.focus();
    return;
  }''',
    flags=re.S,
    label="save calculation prelude",
)

# Save new fields and use the already-parsed regularPayment/frequency.
replace_once(
    "app.js",
    '    regularPayment: Number(document.getElementById("payableRegularPayment").value || 0),\n    frequency: document.getElementById("payableFrequency").value || "monthly",',
    '''    regularPayment,
    frequency,
    paymentMode,
    balanceMode,
    remainingMonths: balanceMode === "months" ? remainingMonths : 0,
    paymentsCompleted: balanceMode === "progress" ? paymentsCompleted : 0,
    paymentsTotal: balanceMode === "progress" ? paymentsTotal : 0,
    statementReminder: paymentMode === "variable" && Boolean(document.getElementById("payableStatementReminder")?.checked),''',
    "save monthly fields",
)
replace_once(
    "app.js",
    '    statementDay: type === "credit-card" ? Number(document.getElementById("payableStatementDay").value || 0) : 0,',
    '    statementDay: paymentMode === "variable" ? Number(document.getElementById("payableStatementDay").value || 0) : 0,',
    "save generic statement day",
)

# Remove duplicate regularPayment validation now handled in the prelude.
sub_once(
    "app.js",
    r'''\n\n  if \(!Number\.isFinite\(record\.regularPayment\) \|\| record\.regularPayment < 0\) \{\n    showToast\("Enter a valid regular payment amount\."\);\n    document\.getElementById\("payableRegularPayment"\)\?\.focus\(\);\n    return;\n  \}\n''',
    '\n',
    label="duplicate regular payment validation",
)

# Statement-day validation now applies to variable monthly templates, not only credit cards.
replace_once(
    "app.js",
    '  if (record.type === "credit-card") {\n    record.statementDay = record.statementDay',
    '  if (isVariableMonthlyPayable(record)) {\n    record.statementDay = record.statementDay',
    "statement day validation",
)

# Refresh reminder UI after save.
replace_once(
    "app.js",
    '    renderPayables();\n    showToast(',
    '    renderPayables();\n    renderSmartReminders();\n    resyncAllPhoneReminders();\n    showToast(',
    "save reminder refresh",
)

# -----------------------------
# detail / payment behavior
# -----------------------------
replace_once(
    "app.js",
    '  const balance = getPayableBalance(item);\n  const nextPayment = getPayableNextPaymentAmount(item);',
    '  const balance = getPayableBalance(item);\n  const active = isPayableActive(item);\n  const variableMonthly = isVariableMonthlyPayable(item);\n  const nextPayment = getPayableNextPaymentAmount(item);\n  const remainingPayments = getPayableRemainingPayments(item);',
    "detail active state",
)
replace_once(
    "app.js",
    '<section class="payable-detail-hero ${balance <= 0 ? "is-paid" : ""}">\n      <small>${balance <= 0 ? "All paid! 🌸" : escapeHTML(getPayablePaymentLabel(item))}</small>\n      <strong>${formatCurrency(nextPayment, item.currency || "PHP")}</strong>',
    '<section class="payable-detail-hero ${!active ? "is-paid" : ""}">\n      <small>${!active ? "All paid! 🌸" : escapeHTML(getPayablePaymentLabel(item))}</small>\n      <strong>${variableMonthly && !(nextPayment > 0) ? "Set this month’s amount" : formatCurrency(nextPayment, item.currency || "PHP")}</strong>',
    "detail hero",
)
replace_once(
    "app.js",
    '      ${balance > 0 ? `<div><small>Remaining balance</small><strong>${formatCurrency(balance, item.currency || "PHP")}</strong></div>` : ""}',
    '      ${active && !variableMonthly && balance > 0 ? `<div><small>Remaining balance</small><strong>${formatCurrency(balance, item.currency || "PHP")}</strong></div>` : ""}\n      ${remainingPayments !== null ? `<div><small>Payments remaining</small><strong>${remainingPayments}</strong></div>` : ""}\n      ${variableMonthly && Number(item.statementDay || 0) ? `<div><small>Statement day</small><strong>Day ${Number(item.statementDay)}</strong></div>` : ""}',
    "detail remaining fields",
)
replace_once(
    "app.js",
    '      ${balance > 0 ? `<button class="primary-button" type="button" data-payable-pay="${escapeHTML(item.id)}">Record Payment</button>` : ""}',
    '      ${active && nextPayment > 0 ? `<button class="primary-button" type="button" data-payable-pay="${escapeHTML(item.id)}">Record Payment</button>` : ""}',
    "detail payment action",
)

# Payment modal max/default should use this month's amount for variable payables.
replace_once(
    "app.js",
    '  document.getElementById("payablePaymentAmount").value = item.regularPayment || item.minimumDue || "";\n  document.getElementById("payablePaymentAmount").max = getPayableBalance(item);',
    '  document.getElementById("payablePaymentAmount").value = item.regularPayment || item.minimumDue || "";\n  document.getElementById("payablePaymentAmount").max = isVariableMonthlyPayable(item) ? getPayableNextPaymentAmount(item) : getPayableBalance(item);',
    "payment modal variable max",
)

# Rewrite recordPayablePayment for fixed and variable plans.
sub_once(
    "app.js",
    r'''async function recordPayablePayment\(event\) \{.*?\n\}\n\nasync function markPayablePaidForCurrentMonth''',
    r'''async function recordPayablePayment(event) {
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
  if (!isPayableActive(item)) {
    showToast("This payable is already fully paid 🌸");
    closePayablePayment();
    return;
  }

  const variableMonthly = isVariableMonthlyPayable(item);
  const scheduled = getPayableNextPaymentAmount(item);
  if (variableMonthly && !(scheduled > 0)) {
    showToast("Set this month’s statement amount first.");
    return;
  }

  const currentBalance = getPayableBalance(item);
  const actualAmount = variableMonthly
    ? Math.min(amount, scheduled)
    : Math.min(amount, currentBalance);
  const currentMonthRemainder = variableMonthly
    ? Math.max(0, Math.round((scheduled - actualAmount + Number.EPSILON) * 100) / 100)
    : 0;
  const nextBalance = variableMonthly
    ? 0
    : Math.max(0, Math.round((currentBalance - actualAmount + Number.EPSILON) * 100) / 100);
  const completedCycle = variableMonthly ? currentMonthRemainder <= 0 : (scheduled > 0 && actualAmount + 0.005 >= scheduled);
  const dueAnchor = item.dueDate || paymentDate;
  const nextDueDate = completedCycle && isPayableActive({ ...item, balance: nextBalance })
    ? nextPayableDueDate(dueAnchor, item.frequency || "monthly", item.dueDayOfMonth || getPayableDueDay(dueAnchor))
    : (variableMonthly && completedCycle
        ? nextPayableDueDate(dueAnchor, "monthly", item.dueDayOfMonth || getPayableDueDay(dueAnchor))
        : item.dueDate);

  const payment = {
    id: generateId("payment"),
    amount: actualAmount,
    date: paymentDate,
    note: document.getElementById("payablePaymentNote").value.trim(),
    previousRegularPayment: variableMonthly ? scheduled : undefined,
    previousRemainingMonths: Number(item.remainingMonths || 0),
    previousPaymentsCompleted: Number(item.paymentsCompleted || 0)
  };

  const next = {
    ...item,
    balance: nextBalance,
    regularPayment: variableMonthly ? currentMonthRemainder : item.regularPayment,
    payments: [...getPayablePayments(item), payment],
    remainingMonths:
      completedCycle && item.balanceMode === "months"
        ? Math.max(0, Number(item.remainingMonths || 0) - 1)
        : Number(item.remainingMonths || 0),
    paymentsCompleted:
      completedCycle && item.balanceMode === "progress"
        ? Math.min(Number(item.paymentsTotal || 0), Number(item.paymentsCompleted || 0) + 1)
        : Number(item.paymentsCompleted || 0),
    installmentsPaid: item.type === "installment" && completedCycle && Number(item.installmentCount || 0)
      ? Math.min(Number(item.installmentCount), Number(item.installmentsPaid || 0) + 1)
      : Number(item.installmentsPaid || 0),
    dueDate: variableMonthly ? nextDueDate : (nextBalance > 0 ? nextDueDate : ""),
    updatedAt: new Date().toISOString()
  };

  await putRecord(STORES.cards, next);
  cards[cards.findIndex((entry) => String(entry.id) === String(id))] = next;
  closePayablePayment();
  renderPayables();
  renderMomoToday();
  renderSmartReminders();
  resyncAllPhoneReminders();
  document.dispatchEvent(new CustomEvent("momo-data-changed"));
  renderPayableDetail(id);
  showToast(!variableMonthly && nextBalance <= 0 ? "All paid! 🌸" : "Payment recorded ✨");
}

async function markPayablePaidForCurrentMonth''',
    flags=re.S,
    label="record payable payment",
)

# Rewrite month-check payment so variable templates reset to zero and calculated plans decrement their counters.
sub_once(
    "app.js",
    r'''async function markPayablePaidForCurrentMonth\(id\) \{.*?\n\}\n\nasync function undoPayablePaidForCurrentMonth''',
    r'''async function markPayablePaidForCurrentMonth(id) {
  const item = cards.find((entry) => String(entry.id) === String(id));
  if (!item || !isPayableActive(item)) return;

  const monthKey = getCurrentMonthKey();
  if (getPayableCycleCheckPayment(item, monthKey)) return;
  if (!isPayableWaitingThisMonth(item)) {
    showToast("That payable is not due this month yet.");
    return;
  }

  const amount = getPayableNextPaymentAmount(item);
  if (!(amount > 0)) {
    showToast(isVariableMonthlyPayable(item) ? "Set this month’s statement amount first." : "Add a monthly payment amount first.");
    return;
  }

  const variableMonthly = isVariableMonthlyPayable(item);
  const paymentDate = getTodayString();
  const previousDueDate = item.dueDate || "";
  const dueAnchor = previousDueDate || paymentDate;
  const nextBalance = variableMonthly
    ? 0
    : Math.max(0, Math.round((getPayableBalance(item) - amount + Number.EPSILON) * 100) / 100);
  const remainsActive = variableMonthly || nextBalance > 0;
  const nextDueDate = remainsActive
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
    nextDueDate,
    previousRegularPayment: variableMonthly ? Number(item.regularPayment || 0) : undefined,
    previousRemainingMonths: Number(item.remainingMonths || 0),
    previousPaymentsCompleted: Number(item.paymentsCompleted || 0)
  };

  const next = {
    ...item,
    balance: nextBalance,
    regularPayment: variableMonthly ? 0 : item.regularPayment,
    payments: [...getPayablePayments(item), payment],
    remainingMonths:
      item.balanceMode === "months"
        ? Math.max(0, Number(item.remainingMonths || 0) - 1)
        : Number(item.remainingMonths || 0),
    paymentsCompleted:
      item.balanceMode === "progress"
        ? Math.min(Number(item.paymentsTotal || 0), Number(item.paymentsCompleted || 0) + 1)
        : Number(item.paymentsCompleted || 0),
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
  renderSmartReminders();
  resyncAllPhoneReminders();
  document.dispatchEvent(new CustomEvent("momo-data-changed"));
  showToast(`${item.name || "Payable"} is paid for ${getPayableMonthLabel(monthKey)} ✓`);
}

async function undoPayablePaidForCurrentMonth''',
    flags=re.S,
    label="month check payment",
)

# Restore calculated counters / variable amount on undo.
replace_once(
    "app.js",
    '    balance: restoredBalance,\n    payments: getPayablePayments(item).filter((entry) => String(entry.id) !== String(payment.id)),',
    '''    balance: isVariableMonthlyPayable(item) ? 0 : restoredBalance,
    regularPayment: isVariableMonthlyPayable(item) ? Number(payment.previousRegularPayment || payment.amount || 0) : item.regularPayment,
    payments: getPayablePayments(item).filter((entry) => String(entry.id) !== String(payment.id)),
    remainingMonths: item.balanceMode === "months" ? Number(payment.previousRemainingMonths ?? item.remainingMonths ?? 0) : Number(item.remainingMonths || 0),
    paymentsCompleted: item.balanceMode === "progress" ? Number(payment.previousPaymentsCompleted ?? Math.max(0, Number(item.paymentsCompleted || 0) - 1)) : Number(item.paymentsCompleted || 0),''',
    "undo monthly setup",
)
replace_once(
    "app.js",
    '  renderPayables();\n  renderMomoToday();\n  document.dispatchEvent(new CustomEvent("momo-data-changed"));\n  showToast(`${item.name || "Payable"} is back on this month’s list.`);',
    '  renderPayables();\n  renderMomoToday();\n  renderSmartReminders();\n  resyncAllPhoneReminders();\n  document.dispatchEvent(new CustomEvent("momo-data-changed"));\n  showToast(`${item.name || "Payable"} is back on this month’s list.`);',
    "undo reminder refresh",
)

# -----------------------------
# Smart reminder for statement date
# -----------------------------
replace_once(
    "app.js",
    '''  plannedExpenses.forEach((item) => {''',
    '''  cards.forEach((item) => {
    if (
      !isVariableMonthlyPayable(item) ||
      !isPayableActive(item) ||
      !item.statementReminder ||
      !(Number(item.statementDay || 0) > 0) ||
      Number(item.regularPayment || 0) > 0
    ) {
      return;
    }

    const statementDate = getPayableStatementDate(item);
    const days = reminderDaysFromToday(statementDate);
    if (days !== null && days >= 0 && days <= 7) {
      reminders.push({
        id: `payable-statement:${item.id}`,
        type: "payable-statement",
        icon: "🌸",
        title: item.name || "Monthly payable",
        detail: `Statement is ${getReminderTimingLabel(days, statementDate)} · set this month’s amount`,
        date: statementDate,
        days,
        bucket: getReminderBucket(days),
        nav: "payables",
        priority: days === 0 ? 1 : 3
      });
    }
  });

  plannedExpenses.forEach((item) => {''',
    "statement smart reminder",
)

# -----------------------------
# Event listeners
# -----------------------------
replace_once(
    "app.js",
    'document.getElementById("payableType")?.addEventListener("change", updatePayableSpecialFields);',
    '''document.getElementById("payableType")?.addEventListener("change", updatePayableSpecialFields);
document.getElementById("payableFrequency")?.addEventListener("change", updatePayableSpecialFields);
document.getElementById("payablePaymentMode")?.addEventListener("change", updatePayableSpecialFields);
document.getElementById("payableBalanceMode")?.addEventListener("change", updatePayableSpecialFields);
["payableRegularPayment", "payableRemainingMonths", "payablePaymentsCompleted", "payablePaymentsTotal", "payableCurrency"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", updatePayableCalculatedBalance);
  document.getElementById(id)?.addEventListener("change", updatePayableCalculatedBalance);
});''',
    "monthly setup listeners",
)

# -----------------------------
# Help copy
# -----------------------------
replace_once(
    "app.js",
    '      "Add the name, remaining balance, currency, due date, and any payment schedule you want to remember.",',
    '      "Add the name, currency, due date, and monthly setup. For a fixed amount, you can enter the remaining balance, remaining months, or payment progress such as 1 of 24.",',
    "payables help fixed copy",
)
replace_once(
    "app.js",
    '      "Credit cards can also keep details such as credit limit, statement balance, minimum due, and statement day.",',
    '      "If the amount changes every month, choose Amount changes each month, enter the statement day, and let Momo remind you to set the new monthly amount when the statement arrives.",',
    "payables help variable copy",
)

# -----------------------------
# styles.css
# -----------------------------
Path("styles.css").write_text(Path("styles.css").read_text() + r'''

/* MOMO — PAYABLES MONTHLY SETUP */
.payable-monthly-setup {
  margin: 14px 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface) 92%, var(--blush));
}

.payable-monthly-setup[hidden],
.payable-variable-fields[hidden],
#payableRemainingMonthsFields[hidden],
#payableProgressFields[hidden],
#payableBalanceModeField[hidden] {
  display: none !important;
}

.payable-calc-card {
  min-width: 0;
  min-height: 58px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.payable-calc-card small {
  color: var(--text-soft);
  font-size: 10px;
  font-weight: 800;
}

.payable-calc-card strong {
  font-size: 15px;
  overflow-wrap: anywhere;
}

.payable-variable-fields {
  margin-top: 10px;
}

.payable-reminder-check {
  justify-content: center;
}

.payable-reminder-checkline {
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
}

.payable-reminder-checkline input {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}

@media (max-width: 390px) {
  .payable-monthly-setup {
    padding: 12px;
  }
}
''')

# PWA cache revision.
replace_once(
    "service-worker.js",
    '`momo-runtime-shell-v${APP_VERSION}-shared-trip-r7`',
    '`momo-runtime-shell-v${APP_VERSION}-payables-monthly-r1`',
    "PWA cache revision",
)
