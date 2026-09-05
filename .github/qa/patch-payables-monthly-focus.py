from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing expected snippet in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "app.js",
    '''function getPayableBalance(payable) {
  return Math.max(0, Number(payable?.balance || 0));
}

function payablePHPValue(payable, amount) {''',
    '''function getPayableBalance(payable) {
  return Math.max(0, Number(payable?.balance || 0));
}

function getPayableNextPaymentAmount(payable) {
  const balance = getPayableBalance(payable);
  if (balance <= 0) return 0;

  const scheduled =
    Number(payable?.regularPayment || 0) ||
    Number(payable?.minimumDue || 0);

  return Math.min(
    balance,
    scheduled > 0 ? scheduled : balance
  );
}

function getPayablePaymentLabel(payable) {
  switch (payable?.frequency) {
    case "monthly": return "Monthly payment";
    case "quarterly": return "Quarterly payment";
    case "weekly": return "Weekly payment";
    case "biweekly": return "Every 2 weeks";
    case "one-time": return "One-time payment";
    default: return "Next payment";
  }
}

function payablePHPValue(payable, amount) {'''
)

replace_once(
    "app.js",
    '''function getPayableScheduledAmountPHP(payable) {
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
}''',
    '''function getPayableScheduledAmountPHP(payable) {
  return payablePHPValue(
    payable,
    getPayableNextPaymentAmount(payable)
  );
}'''
)

replace_once(
    "app.js",
    '''function buildScheduledCashFlow(
  startDate,
  endDate
) {''',
    '''function buildScheduledCashFlow(
  startDate,
  endDate,
  { includePayables = true } = {}
) {'''
)

replace_once(
    "app.js",
    '''  for (const payable of cards) {
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
''',
    '''  if (includePayables) {
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
        originalAmount: getPayableNextPaymentAmount(payable),
        currency: payable.currency || "PHP"
      });
    }
  }
'''
)

replace_once(
    "app.js",
    "function getMomoTodaySnapshot() {",
    "function getMomoTodaySnapshot({ includePayables = true } = {}) {"
)

replace_once(
    "app.js",
    '''  const monthSchedule = buildScheduledCashFlow(today, monthEnd);
  const sevenDaySchedule = buildScheduledCashFlow(today, sevenDayEnd);''',
    '''  const monthSchedule = buildScheduledCashFlow(today, monthEnd, { includePayables });
  const sevenDaySchedule = buildScheduledCashFlow(today, sevenDayEnd, { includePayables });'''
)

replace_once(
    "app.js",
    "  const snapshot = getMomoTodaySnapshot();",
    '''  const showPayablesOnHome = momoHomeLayout.showPayablesOnHome === true;
  const snapshot = getMomoTodaySnapshot({ includePayables: showPayablesOnHome });'''
)

replace_once(
    "app.js",
    '''            <b>${formatCurrency(getPayableBalance(item), item.currency || "PHP")}</b>''',
    '''            <b>${formatCurrency(getPayableNextPaymentAmount(item), item.currency || "PHP")}</b>'''
)

replace_once(
    "app.js",
    '''  const total = active.reduce((sum, item) => sum + payablePHPValue(item, getPayableBalance(item)), 0);''',
    '''  const nextPaymentsTotal = active.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableNextPaymentAmount(item)),
    0
  );'''
)

replace_once(
    "app.js",
    "  if (totalEl) totalEl.textContent = formatPHP(total);",
    "  if (totalEl) totalEl.textContent = formatPHP(nextPaymentsTotal);"
)

replace_once(
    "app.js",
    '''    const balance = getPayableBalance(item);
    const original = Number(item.originalAmount || 0);''',
    '''    const balance = getPayableBalance(item);
    const nextPayment = getPayableNextPaymentAmount(item);
    const original = Number(item.originalAmount || 0);'''
)

replace_once(
    "app.js",
    '''            <b>${formatCurrency(balance, item.currency || "PHP")}</b>''',
    '''            <b>${formatCurrency(nextPayment, item.currency || "PHP")}</b>'''
)

replace_once(
    "app.js",
    '''            <em>${done ? "finished" : "still to pay"}</em>''',
    '''            <em>${done ? "finished" : escapeHTML(getPayablePaymentLabel(item))}</em>'''
)

replace_once(
    "app.js",
    '''  const balance = getPayableBalance(item);
  const payments = [...getPayablePayments(item)].sort((a, b) => String(b.date).localeCompare(String(a.date)));''',
    '''  const balance = getPayableBalance(item);
  const nextPayment = getPayableNextPaymentAmount(item);
  const payments = [...getPayablePayments(item)].sort((a, b) => String(b.date).localeCompare(String(a.date)));'''
)

replace_once(
    "app.js",
    '''    <section class="payable-detail-hero ${balance <= 0 ? "is-paid" : ""}">
      <small>${balance <= 0 ? "All paid! 🌸" : "Still to pay"}</small>
      <strong>${formatCurrency(balance, item.currency || "PHP")}</strong>
      <p>${escapeHTML(item.provider || "")}</p>
    </section>
    <div class="payable-detail-grid">
      ${item.dueDate ? `<div><small>Next payment</small><strong>${formatDate(item.dueDate)}</strong></div>` : ""}''',
    '''    <section class="payable-detail-hero ${balance <= 0 ? "is-paid" : ""}">
      <small>${balance <= 0 ? "All paid! 🌸" : escapeHTML(getPayablePaymentLabel(item))}</small>
      <strong>${formatCurrency(nextPayment, item.currency || "PHP")}</strong>
      <p>${escapeHTML(item.provider || "")}</p>
    </section>
    <div class="payable-detail-grid">
      ${balance > 0 ? `<div><small>Remaining balance</small><strong>${formatCurrency(balance, item.currency || "PHP")}</strong></div>` : ""}
      ${item.dueDate ? `<div><small>Next payment</small><strong>${formatDate(item.dueDate)}</strong></div>` : ""}'''
)

replace_once(
    "smart-money.js",
    '''  function paydayPlan(snapshot) {
    const value = snapshot.settingMap.get("payday_plan_v1");
    return value && typeof value === "object" ? value : {};
  }
''',
    '''  function paydayPlan(snapshot) {
    const value = snapshot.settingMap.get("payday_plan_v1");
    return value && typeof value === "object" ? value : {};
  }

  function payablesVisibleOnHome(snapshot) {
    const layout = snapshot.settingMap.get("momo_home_layout_v1");
    return Boolean(layout && layout.showPayablesOnHome === true);
  }
'''
)

replace_once(
    "smart-money.js",
    '''    snapshot.cards.forEach((item) => {
      const due = parseDate(item?.dueDate || item?.nextDueDate || item?.paymentDueDate);
      if (!due || due < startOfDay(now) || due > end) return;
      const amount = toPHP(item?.regularPayment || item?.minimumDue || item?.minimumPayment || item?.dueAmount || item?.paymentAmount || 0, item?.currency || "PHP");
      if (amount <= 0) return;
      items.push({ type: "Payable", name: text(item?.name || item?.title || "Payable"), amount, date: due });
    });''',
    '''    if (payablesVisibleOnHome(snapshot)) {
      snapshot.cards.forEach((item) => {
        const due = parseDate(item?.dueDate || item?.nextDueDate || item?.paymentDueDate);
        if (!due || due < startOfDay(now) || due > end) return;
        const amount = toPHP(item?.regularPayment || item?.minimumDue || item?.minimumPayment || item?.dueAmount || item?.paymentAmount || 0, item?.currency || "PHP");
        if (amount <= 0) return;
        items.push({ type: "Payable", name: text(item?.name || item?.title || "Payable"), amount, date: due });
      });
    }'''
)

replace_once(
    "styles.css",
    '''.momo-today-payables-heading strong { display: block; margin-top: 2px; }
.momo-today-payables { display: grid; gap: 8px; margin-top: 10px; }
''',
    '''.momo-today-payables-heading strong { display: block; margin-top: 2px; }
.momo-today-payables { display: grid; gap: 8px; margin-top: 10px; }
.momo-today-payables-heading[hidden],
.momo-today-payables[hidden] { display: none !important; }
'''
)

replace_once(
    "index.html",
    '''            <p>Still to pay</p>
            <strong id="payablesTotal">₱0.00</strong>''',
    '''            <p>Next payments</p>
            <strong id="payablesTotal">₱0.00</strong>'''
)

replace_once(
    "index.html",
    '''<span><strong>Show Payables on Home</strong><small>Show payable balances, payoff insights, and active payable cards on Home.</small></span>''',
    '''<span><strong>Show Payables on Home</strong><small>Include payable amounts, payoff insights, and active payable cards on Home.</small></span>'''
)

replace_once(
    "service-worker.js",
    '''`momo-runtime-shell-v${APP_VERSION}-shared-trip-r4`''',
    '''`momo-runtime-shell-v${APP_VERSION}-shared-trip-r5`'''
)
