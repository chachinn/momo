from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing {label} in {path}")
    p.write_text(text.replace(old, new, 1))

# index.html: make Statement Balance + Minimum Due individually hideable for variable monthly cards.
replace_once(
    "index.html",
    '<label><span>Statement Balance</span><input id="payableStatementBalance" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0"></label>',
    '<label id="payableStatementBalanceField"><span>Statement Balance</span><input id="payableStatementBalance" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0"></label>',
    "statement balance field id",
)
replace_once(
    "index.html",
    '<label><span>Minimum Due</span><input id="payableMinimumDue" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0"></label>',
    '<label id="payableMinimumDueField"><span>Minimum Due</span><input id="payableMinimumDue" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0"></label>',
    "minimum due field id",
)

# app.js: variable monthly amount is the actual statement-cycle amount; hide duplicate statement/minimum inputs.
replace_once(
    "app.js",
    '  const groupRoleField = document.getElementById("payablePaymentGroupRoleField");\n',
    '  const groupRoleField = document.getElementById("payablePaymentGroupRoleField");\n  const statementBalanceField = document.getElementById("payableStatementBalanceField");\n  const minimumDueField = document.getElementById("payableMinimumDueField");\n',
    "variable credit field declarations",
)
replace_once(
    "app.js",
    '  if (groupRoleField) groupRoleField.hidden = !String(document.getElementById("payablePaymentGroup")?.value || "").trim();\n  if (regularLabel) regularLabel.innerHTML = variableMonthly\n',
    '  if (groupRoleField) groupRoleField.hidden = !String(document.getElementById("payablePaymentGroup")?.value || "").trim();\n  if (statementBalanceField) statementBalanceField.hidden = variableMonthly;\n  if (minimumDueField) minimumDueField.hidden = variableMonthly;\n  if (regularLabel) regularLabel.innerHTML = variableMonthly\n',
    "hide duplicate variable fields",
)
replace_once(
    "app.js",
    '    statementBalance,\n    minimumDue: type === "credit-card" ? Number(document.getElementById("payableMinimumDue").value || 0) : 0,\n',
    '    statementBalance: paymentMode === "variable" ? 0 : statementBalance,\n    minimumDue: type === "credit-card" && paymentMode !== "variable" ? Number(document.getElementById("payableMinimumDue").value || 0) : 0,\n',
    "variable card duplicate values",
)

# Group hierarchy: one counted item + tracking-only children means the counted item is the mother payment.
old_group = '''  const renderGroup = (unit, dueView) => {\n    const counted = unit.items.filter((item) => payableCountsTowardTotals(item) && isPayableActive(item));\n    const amount = counted.reduce((sum, item) => sum + payablePHPValue(item, dueView ? getPayableCycleRemainingAmount(item, currentMonthKey) : getPayableMonthlyPlanAmount(item, currentMonthKey)), 0);\n    const payableNow = counted.reduce((sum, item) => sum + payablePHPValue(item, getPayableGroupCycleRemaining(item)), 0);\n    const primary = unit.items.find((item) => payableCountsTowardTotals(item) && String(item.name || "").trim().toLowerCase() === unit.name.toLowerCase());\n    const children = unit.items.filter((item) => item !== primary);\n    const paydayLabels = [...new Set(counted.map((item) => getPayablePaydayLabel(item)).filter(Boolean))];\n    const meta = [`${unit.items.length} ${unit.items.length === 1 ? "item" : "items"}`, paydayLabels.length === 1 ? paydayLabels[0] : (paydayLabels.length > 1 ? "mixed paydays" : "")].filter(Boolean).join(" · ");\n    return `<section class="payable-account-group"><div class="payable-account-header" ${primary ? `data-payable-open="${escapeHTML(primary.id)}"` : ""}><div class="payable-account-copy"><strong>${escapeHTML(unit.name)}</strong><small>${escapeHTML(meta)}</small></div><div class="payable-account-total"><b>${formatPHP(amount)}</b>${payableNow > 0 ? `<button type="button" data-payable-group-pay="${escapeHTML(unit.name)}" data-group-scope="${dueView ? "due" : "all"}">Pay</button>` : ""}</div></div><div class="payable-account-children">${children.map((item) => dueView ? renderDueItem(item, true, unit.name) : renderAllItem(item, true, unit.name)).join("")}</div></section>`;\n  };'''
new_group = '''  const renderGroup = (unit, dueView) => {\n    const counted = unit.items.filter((item) => payableCountsTowardTotals(item) && isPayableActive(item));\n    const breakdowns = unit.items.filter((item) => isPayableBreakdownOnly(item) && isPayableActive(item));\n    const amount = counted.reduce((sum, item) => sum + payablePHPValue(item, dueView ? getPayableCycleRemainingAmount(item, currentMonthKey) : getPayableMonthlyPlanAmount(item, currentMonthKey)), 0);\n    const breakdownTotal = breakdowns.reduce((sum, item) => sum + payablePHPValue(item, dueView ? getPayableCycleRemainingAmount(item, currentMonthKey) : getPayableMonthlyPlanAmount(item, currentMonthKey)), 0);\n    const payableNow = counted.reduce((sum, item) => sum + payablePHPValue(item, getPayableGroupCycleRemaining(item)), 0);\n    const namedPrimary = unit.items.find((item) => payableCountsTowardTotals(item) && String(item.name || "").trim().toLowerCase() === unit.name.toLowerCase());\n    const primary = namedPrimary || (counted.length === 1 ? counted[0] : null);\n    const children = unit.items.filter((item) => item !== primary);\n    const paydayLabels = [...new Set(counted.map((item) => getPayablePaydayLabel(item)).filter(Boolean))];\n    const meta = [`${unit.items.length} ${unit.items.length === 1 ? "item" : "items"}`, paydayLabels.length === 1 ? paydayLabels[0] : (paydayLabels.length > 1 ? "mixed paydays" : "")].filter(Boolean).join(" · ");\n    const heading = primary ? (primary.name || unit.name) : unit.name;\n    const breakdownCopy = breakdownTotal > 0 ? `<span class="payable-breakdown-total">Tracked breakdown · ${formatPHP(breakdownTotal)} · included in this payment</span>` : "";\n    return `<section class="payable-account-group"><div class="payable-account-header" ${primary ? `data-payable-open="${escapeHTML(primary.id)}"` : ""}><div class="payable-account-copy"><strong>${escapeHTML(heading)}</strong><small>${escapeHTML(meta)}</small>${breakdownCopy}</div><div class="payable-account-total"><b>${formatPHP(amount)}</b>${payableNow > 0 ? `<button type="button" data-payable-group-pay="${escapeHTML(unit.name)}" data-group-scope="${dueView ? "due" : "all"}">Pay</button>` : ""}</div></div><div class="payable-account-children">${children.map((item) => dueView ? renderDueItem(item, true, unit.name) : renderAllItem(item, true, unit.name)).join("")}</div></section>`;\n  };'''
replace_once("app.js", old_group, new_group, "mother payment render group")

# Keep tracking-only children in step when their mother/group payment cycle is fully covered.
insert_before = '''function closePayableGroupPayment() {\n  const modal = document.getElementById("payableGroupPaymentModal");'''
helper = '''async function syncPayableGroupBreakdowns(groupName, paymentDate, note = "", groupPaymentId = "") {\n  if (!groupName) return;\n  const countedStillDue = getPayableGroupMembers(groupName)\n    .filter((item) => payableCountsTowardTotals(item))\n    .some((item) => getPayableGroupCycleRemaining(item) > 0.005);\n  if (countedStillDue) return;\n\n  const trackingItems = getPayableGroupMembers(groupName).filter((item) => isPayableBreakdownOnly(item));\n  for (const item of trackingItems) {\n    const trackingAmount = getPayableGroupCycleRemaining(item);\n    if (!(trackingAmount > 0)) continue;\n    await applyPayablePayment(item, trackingAmount, paymentDate, note || `Tracked with ${groupName} payment`, {\n      source: "group-breakdown-track",\n      groupPaymentId,\n      groupName\n    });\n  }\n}\n\nfunction closePayableGroupPayment() {\n  const modal = document.getElementById("payableGroupPaymentModal");'''
replace_once("app.js", insert_before, helper, "group breakdown sync helper")

replace_once(
    "app.js",
    '  if (!result) {\n    showToast(isVariableMonthlyPayable(item) ? "Set this month’s statement amount first." : "There is nothing left to apply to this payment cycle.");\n    return;\n  }\n  closePayablePayment();\n',
    '  if (!result) {\n    showToast(isVariableMonthlyPayable(item) ? "Set this month’s statement amount first." : "There is nothing left to apply to this payment cycle.");\n    return;\n  }\n  if (result.completedCycle && getPayableGroupName(item) && payableCountsTowardTotals(item)) {\n    await syncPayableGroupBreakdowns(getPayableGroupName(item), paymentDate, document.getElementById("payablePaymentNote").value.trim());\n  }\n  closePayablePayment();\n',
    "manual mother payment sync",
)
replace_once(
    "app.js",
    '  if (!result) return;\n  renderPayables();\n',
    '  if (!result) return;\n  if (result.completedCycle && getPayableGroupName(item) && payableCountsTowardTotals(item)) {\n    await syncPayableGroupBreakdowns(getPayableGroupName(item), getTodayString(), `Paid for ${getPayableMonthLabel(monthKey)}`);\n  }\n  renderPayables();\n',
    "paid checkbox mother sync",
)

old_tracking = '''  const countedStillDue = getPayableGroupMembers(groupName)\n    .filter((item) => payableCountsTowardTotals(item))\n    .some((item) => getPayableGroupCycleRemaining(item) > 0.005);\n  if (!countedStillDue) {\n    const trackingItems = getPayableGroupMembers(groupName).filter((item) => isPayableBreakdownOnly(item));\n    for (const item of trackingItems) {\n      const trackingAmount = getPayableGroupCycleRemaining(item);\n      if (!(trackingAmount > 0)) continue;\n      await applyPayablePayment(item, trackingAmount, paymentDate, note || `Tracked with ${groupName} payment`, {\n        source: "group-breakdown-track",\n        groupPaymentId,\n        groupName\n      });\n    }\n  }'''
replace_once(
    "app.js",
    old_tracking,
    '  await syncPayableGroupBreakdowns(groupName, paymentDate, note, groupPaymentId);',
    "group payment tracking refactor",
)

# styles.css: quiet informational breakdown total.
with Path("styles.css").open("a") as f:
    f.write('''\n\n/* Mother payable + tracking-only breakdown context */\n.payable-breakdown-total {\n  display: block;\n  margin-top: 5px;\n  color: var(--text-soft);\n  font-size: 0.78rem;\n  font-weight: 600;\n  line-height: 1.3;\n}\n''')

# PWA cache bump.
replace_once(
    "service-worker.js",
    '`momo-runtime-shell-v${APP_VERSION}-payables-planner-r2`',
    '`momo-runtime-shell-v${APP_VERSION}-payables-planner-r3`',
    "service worker cache bump",
)
