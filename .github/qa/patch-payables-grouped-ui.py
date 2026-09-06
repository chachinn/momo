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

# index.html
replace_once("index.html", '''            <p id="payablesHeroLabel">Still to pay this month</p>
            <strong id="payablesTotal">₱0.00</strong>
            <small id="payablesCount">Nothing waiting on you 🌸</small>''', '''            <div class="payables-hero-label-row">
              <p id="payablesHeroLabel">Still to pay this month</p>
              <button id="payablesRemainingToggle" class="payables-remaining-toggle" type="button" aria-expanded="false" aria-controls="payablesRemainingPanel" aria-label="Show total remaining unpaid">›</button>
            </div>
            <strong id="payablesTotal">₱0.00</strong>
            <small id="payablesCount">Nothing waiting on you 🌸</small>
            <div id="payablesRemainingPanel" class="payables-remaining-panel" hidden>
              <span>Total remaining unpaid</span>
              <b id="payablesRemainingTotal">₱0.00</b>
              <small>Across active fixed monthly payables</small>
            </div>''', "remaining disclosure")

replace_once("index.html", '''            <label>
              <span>Paid together under <small>(optional)</small></span>
              <input id="payablePaymentGroup" type="text" maxlength="60" list="payablePaymentGroupOptions" placeholder="BPI Credit Card">
              <datalist id="payablePaymentGroupOptions"></datalist>
            </label>
          </div>
          <p class="payable-amount-helper payable-group-helper">Use the same payment account name for installments or loans you pay together in one card statement.</p>''', '''            <label>
              <span>Payment account <small>(optional)</small></span>
              <input id="payablePaymentGroup" type="text" maxlength="60" list="payablePaymentGroupOptions" placeholder="My credit card">
              <datalist id="payablePaymentGroupOptions"></datalist>
            </label>
          </div>
          <label id="payablePaymentGroupRoleField">
            <span>How this item counts</span>
            <select id="payablePaymentGroupRole">
              <option value="counts">Counts toward the amount to pay</option>
              <option value="breakdown">Breakdown only — already included in the account total</option>
            </select>
          </label>
          <p class="payable-amount-helper payable-group-helper">Use one payment account name to nest related items. Choose whether each item adds to what you owe or is only a tracking breakdown already included in the account total.</p>''', "generic payment account fields")

# app.js helpers
replace_once("app.js", '''function getPayableGroupName(payable) {
  return String(payable?.paymentGroup || "").trim();
}''', '''function getPayableGroupName(payable) {
  return String(payable?.paymentGroup || "").trim();
}

function isPayableBreakdownOnly(payable) {
  return Boolean(getPayableGroupName(payable)) && payable?.paymentGroupRole === "breakdown";
}

function payableCountsTowardTotals(payable) {
  return !isPayableBreakdownOnly(payable);
}''', "group role helpers")

replace_once("app.js", '''  const nextPaymentsTotal = waiting.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableCycleRemainingAmount(item, currentMonthKey)),
    0
  );
  const fullMonthPayablesTotal = cards.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableMonthlyPlanAmount(item, currentMonthKey)),
    0
  );''', '''  const nextPaymentsTotal = waiting.reduce(
    (sum, item) => sum + (payableCountsTowardTotals(item) ? payablePHPValue(item, getPayableCycleRemainingAmount(item, currentMonthKey)) : 0),
    0
  );
  const fullMonthPayablesTotal = cards.reduce(
    (sum, item) => sum + (payableCountsTowardTotals(item) ? payablePHPValue(item, getPayableMonthlyPlanAmount(item, currentMonthKey)) : 0),
    0
  );
  const totalRemainingUnpaid = cards.reduce((sum, item) => {
    if (!payableCountsTowardTotals(item) || !isPayableActive(item) || item.frequency !== "monthly" || isVariableMonthlyPayable(item)) return sum;
    return sum + payablePHPValue(item, getPayableBalance(item));
  }, 0);''', "payable totals")

replace_once("app.js", '''    return sum + payablePHPValue(item, getPayableCycleRemainingAmount(item, currentMonthKey));''', '''    return sum + (payableCountsTowardTotals(item) ? payablePHPValue(item, getPayableCycleRemainingAmount(item, currentMonthKey)) : 0);''', "due soon counted")
replace_once("app.js", '''    const activeMonthly = cards.filter((item) => isPayableActive(item) && getPayableMonthlyPlanAmount(item, currentMonthKey) > 0).length;''', '''    const activeMonthly = cards.filter((item) => payableCountsTowardTotals(item) && isPayableActive(item) && getPayableMonthlyPlanAmount(item, currentMonthKey) > 0).length;''', "active monthly counted")
replace_once("app.js", '''    if (item.paydaySlot !== slot || !isPayableActive(item)) return sum;''', '''    if (item.paydaySlot !== slot || !isPayableActive(item) || !payableCountsTowardTotals(item)) return sum;''', "payday counted")

sub_once("app.js", r'''  const groupSummary = document\.getElementById\("payablesGroupSummary"\);\n  if \(groupSummary\) \{.*?\n  \}\n  document\.querySelectorAll\("\[data-payables-view\]"\)''', '''  const remainingTotalEl = document.getElementById("payablesRemainingTotal");
  if (remainingTotalEl) remainingTotalEl.textContent = formatPHP(totalRemainingUnpaid);

  const groupSummary = document.getElementById("payablesGroupSummary");
  if (groupSummary) {
    groupSummary.innerHTML = "";
    groupSummary.hidden = true;
  }
  document.querySelectorAll("[data-payables-view]")''', "standalone group summary", re.S)

# Replace list renderer with grouped parent/children units.
pattern = r'''  if \(!isDueView\) \{\n    const visibleAll = allPayables\.slice\(0, payableRenderLimit\);.*?  const paidMarkup = paidCycleEntries\.length'''
replacement = r'''  const nestedTitle = (item, groupName) => {
    const provider = String(item.provider || "").trim();
    const name = String(item.name || "").trim();
    if (provider && provider.toLowerCase() !== String(groupName || "").toLowerCase()) return provider;
    return name || getPayableMeta(item).label;
  };

  const groupUnits = (items) => {
    const units = [];
    const seen = new Set();
    items.forEach((item) => {
      const group = getPayableGroupName(item);
      if (!group) { units.push({ type: "item", item }); return; }
      const key = group.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      units.push({ type: "group", name: group, items: items.filter((entry) => getPayableGroupName(entry).toLowerCase() === key) });
    });
    return units;
  };

  const renderAllItem = (item, nested = false, groupName = "") => {
    const meta = getPayableMeta(item);
    const done = !isPayableActive(item);
    const paidPercent = getPayableOverallProgressPercent(item);
    const tone = payableDueTone(item.dueDate);
    const dueCopy = done ? "Fully paid 🌸" : (item.dueDate ? `Next · ${formatShortDate(item.dueDate)}` : "No due date set");
    const title = nested ? nestedTitle(item, groupName) : (item.name || meta.label);
    const subtitle = nested
      ? [getPayablePaymentLabel(item), getPayablePaydayLabel(item), isPayableBreakdownOnly(item) ? "tracking only" : ""].filter(Boolean).join(" · ")
      : (item.provider || meta.label);
    return `<button class="payable-item ${nested ? "payable-nested-item" : ""} ${done ? "is-paid" : ""}" type="button" data-payable-open="${escapeHTML(item.id)}">
      <span class="payable-item-main"><span class="payable-item-topline"><span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(subtitle)}</small></span><b>${done ? "Paid off" : (isVariableMonthlyPayable(item) && !(getPayableMonthlyPlanAmount(item, currentMonthKey) > 0) ? "Set amount" : formatCurrency(getPayableMonthlyPlanAmount(item, currentMonthKey), item.currency || "PHP"))}</b></span>
      <span class="payable-progress"><i style="width:${paidPercent}%"></i></span><span class="payable-item-foot"><small class="${tone}">${dueCopy}</small>${nested ? "" : `<em>${escapeHTML([getPayablePaymentLabel(item), getPayablePaydayLabel(item)].filter(Boolean).join(" · "))}</em>`}</span></span></button>`;
  };

  const renderDueItem = (item, nested = false, groupName = "") => {
    const meta = getPayableMeta(item);
    const paidPercent = getPayableOverallProgressPercent(item);
    const cycleTarget = getPayableCycleTargetAmount(item, currentMonthKey);
    const cyclePaid = getPayableCyclePaidAmount(item, currentMonthKey);
    const cycleRemaining = getPayableCycleRemainingAmount(item, currentMonthKey);
    const tone = payableDueTone(item.dueDate);
    const dueCopy = item.dueDate ? `Due · ${formatShortDate(item.dueDate)}` : "No due date set";
    const title = nested ? nestedTitle(item, groupName) : (item.name || meta.label);
    const subtitle = nested
      ? [cyclePaid > 0 ? `${formatCurrency(cyclePaid, item.currency || "PHP")} paid of ${formatCurrency(cycleTarget, item.currency || "PHP")}` : getPayablePaymentLabel(item), getPayablePaydayLabel(item), isPayableBreakdownOnly(item) ? "tracking only" : ""].filter(Boolean).join(" · ")
      : (item.provider || meta.label);
    return `<div class="payable-cycle-row ${nested ? "payable-nested-cycle-row" : ""}"><button class="payable-item ${nested ? "payable-nested-item" : ""}" type="button" data-payable-open="${escapeHTML(item.id)}"><span class="payable-item-main"><span class="payable-item-topline"><span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(subtitle)}</small></span><b>${isVariableMonthlyPayable(item) && !(cycleTarget > 0) ? "Set amount" : formatCurrency(cycleRemaining, item.currency || "PHP")}</b></span><span class="payable-progress"><i style="width:${paidPercent}%"></i></span><span class="payable-item-foot"><small class="${tone}">${dueCopy}</small>${nested ? "" : `<em>${escapeHTML([cyclePaid > 0 ? `${formatCurrency(cyclePaid, item.currency || "PHP")} paid of ${formatCurrency(cycleTarget, item.currency || "PHP")}` : getPayablePaymentLabel(item), getPayablePaydayLabel(item)].filter(Boolean).join(" · "))}</em>`}</span></span></button>${isPayableBreakdownOnly(item) ? "" : `<label class="payable-month-check" aria-label="Mark ${escapeHTML(title)} paid for ${escapeHTML(monthLabel)}"><input type="checkbox" data-payable-month-toggle="${escapeHTML(item.id)}"><span aria-hidden="true">✓</span><em>Paid</em></label>`}</div>`;
  };

  const renderGroup = (unit, dueView) => {
    const counted = unit.items.filter((item) => payableCountsTowardTotals(item) && isPayableActive(item));
    const amount = counted.reduce((sum, item) => sum + payablePHPValue(item, dueView ? getPayableCycleRemainingAmount(item, currentMonthKey) : getPayableMonthlyPlanAmount(item, currentMonthKey)), 0);
    const payableNow = counted.reduce((sum, item) => sum + payablePHPValue(item, getPayableGroupCycleRemaining(item)), 0);
    const primary = unit.items.find((item) => payableCountsTowardTotals(item) && String(item.name || "").trim().toLowerCase() === unit.name.toLowerCase());
    const children = unit.items.filter((item) => item !== primary);
    const paydayLabels = [...new Set(counted.map((item) => getPayablePaydayLabel(item)).filter(Boolean))];
    const meta = [`${unit.items.length} ${unit.items.length === 1 ? "item" : "items"}`, paydayLabels.length === 1 ? paydayLabels[0] : (paydayLabels.length > 1 ? "mixed paydays" : "")].filter(Boolean).join(" · ");
    return `<section class="payable-account-group"><div class="payable-account-header" ${primary ? `data-payable-open="${escapeHTML(primary.id)}"` : ""}><div class="payable-account-copy"><strong>${escapeHTML(unit.name)}</strong><small>${escapeHTML(meta)}</small></div><div class="payable-account-total"><b>${formatPHP(amount)}</b>${payableNow > 0 ? `<button type="button" data-payable-group-pay="${escapeHTML(unit.name)}" data-group-scope="${dueView ? "due" : "all"}">Pay</button>` : ""}</div></div><div class="payable-account-children">${children.map((item) => dueView ? renderDueItem(item, true, unit.name) : renderAllItem(item, true, unit.name)).join("")}</div></section>`;
  };

  if (!isDueView) {
    const units = groupUnits(allPayables);
    const visible = units.slice(0, payableRenderLimit);
    list.innerHTML = visible.map((unit) => unit.type === "group" ? renderGroup(unit, false) : renderAllItem(unit.item)).join("") + (visible.length < units.length ? `<button class="secondary-button momo-load-more" type="button" data-load-more-payables>Load more (${units.length - visible.length} remaining)</button>` : "");
    return;
  }

  const units = groupUnits(waiting);
  const visible = units.slice(0, payableRenderLimit);
  const waitingMarkup = visible.length ? visible.map((unit) => unit.type === "group" ? renderGroup(unit, true) : renderDueItem(unit.item)).join("") : (cards.length ? `<div class="payables-month-clear"><span>🌸</span><strong>You’re clear for ${escapeHTML(monthLabel)}</strong><small>Future payables are still available under All Payables.</small></div>` : "");
  const loadMoreMarkup = visible.length < units.length ? `<button class="secondary-button momo-load-more" type="button" data-load-more-payables>Load more (${units.length - visible.length} remaining)</button>` : "";

  const paidMarkup = paidCycleEntries.length'''
sub_once("app.js", pattern, replacement, "grouped payables rendering", re.S)

# Editor role value + save.
replace_once("app.js", '''  document.getElementById("payablePaymentGroup").value = item?.paymentGroup || "";''', '''  document.getElementById("payablePaymentGroup").value = item?.paymentGroup || "";
  document.getElementById("payablePaymentGroupRole").value = item?.paymentGroupRole === "breakdown" ? "breakdown" : "counts";''', "editor group role")
replace_once("app.js", '''    paymentGroup: document.getElementById("payablePaymentGroup")?.value.trim() || "",''', '''    paymentGroup: document.getElementById("payablePaymentGroup")?.value.trim() || "",
    paymentGroupRole: document.getElementById("payablePaymentGroup")?.value.trim() && document.getElementById("payablePaymentGroupRole")?.value === "breakdown" ? "breakdown" : "counts",''', "save group role")

# Detail naming becomes generic.
replace_once("app.js", '''${getPayableGroupName(item) ? `<div><small>Paid together under</small><strong>${escapeHTML(getPayableGroupName(item))}</strong></div>` : ""}''', '''${getPayableGroupName(item) ? `<div><small>Payment account</small><strong>${escapeHTML(getPayableGroupName(item))}${isPayableBreakdownOnly(item) ? " · tracking only" : ""}</strong></div>` : ""}''', "detail group naming")

# Group payment candidates exclude tracking-only rows. When counted obligation is fully covered, advance tracking-only children automatically.
replace_once("app.js", '''  return getPayableGroupMembers(groupName)
    .filter((item) => scope !== "due" || isPayableWaitingThisMonth(item))''', '''  return getPayableGroupMembers(groupName)
    .filter((item) => payableCountsTowardTotals(item))
    .filter((item) => scope !== "due" || isPayableWaitingThisMonth(item))''', "group candidates")

replace_once("app.js", '''  for (const allocation of allocations) {
    const item = cards.find((entry) => String(entry.id) === String(allocation.id));
    if (!item) continue;
    const result = await applyPayablePayment(item, allocation.amount, paymentDate, note || `Paid together via ${groupName}`, {
      source: "group-payment",
      groupPaymentId,
      groupName
    });
    if (result) recorded += payablePHPValue(item, result.actualAmount);
  }
  closePayableGroupPayment();''', '''  for (const allocation of allocations) {
    const item = cards.find((entry) => String(entry.id) === String(allocation.id));
    if (!item) continue;
    const result = await applyPayablePayment(item, allocation.amount, paymentDate, note || `Paid via ${groupName}`, {
      source: "group-payment",
      groupPaymentId,
      groupName
    });
    if (result) recorded += payablePHPValue(item, result.actualAmount);
  }

  const countedStillDue = getPayableGroupMembers(groupName)
    .filter((item) => payableCountsTowardTotals(item))
    .some((item) => getPayableGroupCycleRemaining(item) > 0.005);
  if (!countedStillDue) {
    const trackingItems = getPayableGroupMembers(groupName).filter((item) => isPayableBreakdownOnly(item));
    for (const item of trackingItems) {
      const trackingAmount = getPayableGroupCycleRemaining(item);
      if (!(trackingAmount > 0)) continue;
      await applyPayablePayment(item, trackingAmount, paymentDate, note || `Tracked with ${groupName} payment`, {
        source: "group-breakdown-track",
        groupPaymentId,
        groupName
      });
    }
  }
  closePayableGroupPayment();''', "tracking children advance")

# Remaining toggle and group role field visibility.
replace_once("app.js", '''document.getElementById("payableBalanceMode")?.addEventListener("change", updatePayableSpecialFields);''', '''document.getElementById("payableBalanceMode")?.addEventListener("change", updatePayableSpecialFields);
document.getElementById("payablePaymentGroup")?.addEventListener("input", updatePayableSpecialFields);
document.getElementById("payablesRemainingToggle")?.addEventListener("click", () => {
  const panel = document.getElementById("payablesRemainingPanel");
  const button = document.getElementById("payablesRemainingToggle");
  if (!panel || !button) return;
  const opening = panel.hidden;
  panel.hidden = !opening;
  button.setAttribute("aria-expanded", opening ? "true" : "false");
  button.classList.toggle("is-open", opening);
});''', "toggle listeners")

replace_once("app.js", '''  const balanceField = document.getElementById("payableBalance")?.closest("label");''', '''  const balanceField = document.getElementById("payableBalance")?.closest("label");
  const groupRoleField = document.getElementById("payablePaymentGroupRoleField");''', "group role field ref")
replace_once("app.js", '''  if (regularLabel) regularLabel.innerHTML = variableMonthly''', '''  if (groupRoleField) groupRoleField.hidden = !String(document.getElementById("payablePaymentGroup")?.value || "").trim();
  if (regularLabel) regularLabel.innerHTML = variableMonthly''', "group role field visibility")

# styles.css
sub_once("styles.css", r'''\.payables-group-summary \{ display:grid; gap:10px; margin: 0 0 18px; \}.*?\.payable-group-helper \{ margin-top:-4px; \}''', '''.payables-group-summary { display:none !important; }
.payables-hero-label-row { display:flex; align-items:center; gap:7px; }
.payables-hero-label-row p { margin:0; }
.payables-remaining-toggle { width:23px; height:23px; padding:0; border:0; border-radius:999px; display:grid; place-items:center; background:rgba(255,255,255,.58); color:var(--momo-cocoa-soft); font-size:18px; line-height:1; transition:transform .18s ease; }
.payables-remaining-toggle.is-open { transform:rotate(90deg); }
.payables-remaining-panel { margin-top:10px; padding:9px 11px; border:1px solid var(--momo-hairline); border-radius:14px; background:rgba(255,255,255,.34); }
.payables-remaining-panel span,.payables-remaining-panel b,.payables-remaining-panel small { display:block; }
.payables-remaining-panel span,.payables-remaining-panel small { color:var(--momo-cocoa-soft); font-size:8px; }
.payables-remaining-panel b { margin:2px 0; color:var(--momo-cocoa); font-size:13px; }
.payable-account-group { overflow:hidden; border:1px solid var(--momo-hairline); border-radius:24px; background:rgba(255,255,255,.62); }
.payable-account-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 15px 12px; }
.payable-account-header[data-payable-open] { cursor:pointer; }
.payable-account-copy { min-width:0; }
.payable-account-copy strong,.payable-account-copy small { display:block; }
.payable-account-copy strong { color:var(--momo-cocoa); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.payable-account-copy small { margin-top:3px; color:var(--momo-cocoa-soft); font-size:8px; }
.payable-account-total { flex:0 0 auto; text-align:right; }
.payable-account-total b { display:block; color:var(--momo-cocoa); }
.payable-account-total button { margin-top:5px; border:0; border-radius:999px; padding:6px 11px; background:var(--momo-blush); color:var(--momo-peach-deep); font-weight:800; }
.payable-account-children { display:grid; padding:0 9px 9px; }
.payable-account-children > * { border-top:1px solid var(--momo-hairline); }
.payable-account-children .payable-nested-item { border-left:0; border-right:0; border-bottom:0; border-radius:0; background:transparent; box-shadow:none; }
.payable-nested-cycle-row { border-radius:0; }
.payable-group-helper { margin-top:-4px; }''', "grouped payables styles", re.S)
replace_once("styles.css", '''  .payable-group-card { align-items:flex-start; }''', '''  .payable-account-header { align-items:flex-start; padding:12px 13px 10px; }
  .payable-account-children { padding:0 7px 7px; }''', "mobile group style")

# service-worker.js
replace_once("service-worker.js", '''`momo-runtime-shell-v${APP_VERSION}-payables-planner-r1`''', '''`momo-runtime-shell-v${APP_VERSION}-payables-planner-r2`''', "cache bump")
