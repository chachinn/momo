from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing {label} in {path}")
    p.write_text(text.replace(old, new, 1))

# Add helpers for real cash payments and remaining fixed-term debt.
replace_once(
    "app.js",
    '''function payableCountsTowardTotals(payable) {\n  return !isPayableBreakdownOnly(payable);\n}\n\nfunction getPayableGroupMembers(groupName) {''',
    '''function payableCountsTowardTotals(payable) {\n  return !isPayableBreakdownOnly(payable);\n}\n\nfunction isPayableSyntheticTrackingPayment(payment) {\n  return payment?.source === "group-breakdown-track";\n}\n\nfunction getPayableRealCyclePayments(payable, monthKey) {\n  if (!payableCountsTowardTotals(payable)) return [];\n  return getPayableCyclePayments(payable, monthKey).filter((payment) => !isPayableSyntheticTrackingPayment(payment));\n}\n\nfunction getPayableRemainingDebtTotalPHP() {\n  const activeFixed = cards.filter((item) =>\n    isPayableActive(item) &&\n    item.frequency === "monthly" &&\n    !isVariableMonthlyPayable(item)\n  );\n  const standalone = activeFixed.filter((item) => !getPayableGroupName(item));\n  let total = standalone.reduce((sum, item) => sum + payablePHPValue(item, getPayableBalance(item)), 0);\n\n  const groups = new Map();\n  activeFixed.filter((item) => getPayableGroupName(item)).forEach((item) => {\n    const key = getPayableGroupName(item).toLowerCase();\n    if (!groups.has(key)) groups.set(key, []);\n    groups.get(key).push(item);\n  });\n\n  groups.forEach((items) => {\n    const countedFixed = items.filter((item) => payableCountsTowardTotals(item));\n    const debtItems = countedFixed.length ? countedFixed : items.filter((item) => isPayableBreakdownOnly(item));\n    total += debtItems.reduce((sum, item) => sum + payablePHPValue(item, getPayableBalance(item)), 0);\n  });\n\n  return total;\n}\n\nfunction getPayableGroupMembers(groupName) {''',
    "payment/debt helpers",
)

# Paid entries: include fully covered cycles no matter whether they were paid via checkbox, manual payment, or group payment.
replace_once(
    "app.js",
    '''  const paidCycleEntries = cards\n    .map((item) => ({ item, payment: getPayableCycleCheckPayment(item, currentMonthKey) }))\n    .filter((entry) => entry.payment)\n    .sort((a, b) => String(b.payment.date || "").localeCompare(String(a.payment.date || "")));''',
    '''  const paidCycleEntries = cards\n    .map((item) => {\n      const payments = getPayableRealCyclePayments(item, currentMonthKey);\n      if (!payments.length) return null;\n      const amount = payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0);\n      const storedTarget = payments.reduce((max, payment) => Math.max(max, Number(payment.cycleTargetAmount || 0)), 0);\n      const target = storedTarget > 0 ? storedTarget : getPayableCycleTargetAmount(item, currentMonthKey);\n      if (!(target > 0) || amount + 0.005 < target) return null;\n      const payment = [...payments].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];\n      const undoPayment = [...payments].reverse().find((entry) => entry?.source === "month-check" && entry?.paidMonth === currentMonthKey) || null;\n      return { item, payment, amount, undoPayment };\n    })\n    .filter(Boolean)\n    .sort((a, b) => String(b.payment.date || "").localeCompare(String(a.payment.date || "")));''',
    "paid cycle entries",
)

# Remaining debt should include tracking-only installment balances when they are the group's only fixed-term balances.
replace_once(
    "app.js",
    '''  const totalRemainingUnpaid = cards.reduce((sum, item) => {\n    if (!payableCountsTowardTotals(item) || !isPayableActive(item) || item.frequency !== "monthly" || isVariableMonthlyPayable(item)) return sum;\n    return sum + payablePHPValue(item, getPayableBalance(item));\n  }, 0);''',
    '''  const totalRemainingUnpaid = getPayableRemainingDebtTotalPHP();''',
    "remaining debt total",
)

# Paid this month is actual money paid, excluding internal tracking-only shadow payments.
replace_once(
    "app.js",
    '''  const paidMonth = cards.reduce((sum, item) => {\n    return sum + getPayablePayments(item).reduce((paymentSum, payment) => {\n      const date = createLocalDate(payment.date);\n      if (!date || date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return paymentSum;\n      return paymentSum + payablePHPValue(item, payment.amount);\n    }, 0);\n  }, 0);''',
    '''  const paidMonth = cards.reduce((sum, item) => {\n    if (!payableCountsTowardTotals(item)) return sum;\n    return sum + getPayablePayments(item).reduce((paymentSum, payment) => {\n      if (isPayableSyntheticTrackingPayment(payment)) return paymentSum;\n      const date = createLocalDate(payment.date);\n      if (!date || date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return paymentSum;\n      return paymentSum + payablePHPValue(item, payment.amount);\n    }, 0);\n  }, 0);''',
    "paid month actual cash total",
)

# Paid list: show the full completed-cycle amount; manual/group payments get a static Paid badge instead of a fake undo checkbox.
replace_once(
    "app.js",
    '''          ${paidCycleEntries.map(({ item, payment }) => {''',
    '''          ${paidCycleEntries.map(({ item, payment, amount, undoPayment }) => {''',
    "paid markup destructure",
)
replace_once(
    "app.js",
    '''                  <b>${formatCurrency(payment.amount, item.currency || "PHP")}</b>\n                </button>\n                <label class="payable-month-check is-checked" aria-label="Undo paid status for ${escapeHTML(item.name || getPayableMeta(item).label)}">\n                  <input type="checkbox" data-payable-month-toggle="${escapeHTML(item.id)}" checked>\n                  <span aria-hidden="true">✓</span>\n                  <em>Paid</em>\n                </label>''',
    '''                  <b>${formatCurrency(amount, item.currency || "PHP")}</b>\n                </button>\n                ${undoPayment\n                  ? `<label class="payable-month-check is-checked" aria-label="Undo paid status for ${escapeHTML(item.name || getPayableMeta(item).label)}"><input type="checkbox" data-payable-month-toggle="${escapeHTML(item.id)}" checked><span aria-hidden="true">✓</span><em>Paid</em></label>`\n                  : `<span class="payable-month-check is-checked is-static" aria-label="Paid"><span aria-hidden="true">✓</span><em>Paid</em></span>`}''',
    "paid markup amount and static state",
)

# Cache bump.
replace_once(
    "service-worker.js",
    '`momo-runtime-shell-v${APP_VERSION}-payables-planner-r3`',
    '`momo-runtime-shell-v${APP_VERSION}-payables-planner-r4`',
    "service worker cache bump",
)
