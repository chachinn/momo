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
    '''            <p id="payablesHeroLabel">Still to pay this month</p>
            <strong id="payablesTotal">₱0.00</strong>
            <small id="payablesCount">Nothing waiting on you 🌸</small>''',
    '''            <div class="payables-hero-label-row">
              <p id="payablesHeroLabel">Still to pay this month</p>
              <button id="payablesRemainingToggle" class="payables-remaining-toggle" type="button" aria-expanded="false" aria-controls="payablesRemainingReveal" aria-label="Show total remaining unpaid">›</button>
            </div>
            <strong id="payablesTotal">₱0.00</strong>
            <small id="payablesCount">Nothing waiting on you 🌸</small>
            <div id="payablesRemainingReveal" class="payables-remaining-reveal" hidden>
              <span>Total remaining unpaid</span>
              <strong id="payablesRemainingTotal">₱0.00</strong>
            </div>''',
    "remaining balance reveal",
)

replace_once(
    "index.html",
    '''        <div id="payablesGroupSummary" class="payables-group-summary"></div>

''',
    '''''',
    "old group summary",
)

replace_once(
    "index.html",
    '''            <label>
              <span>Paid together under <small>(optional)</small></span>
              <input id="payablePaymentGroup" type="text" maxlength="60" list="payablePaymentGroupOptions" placeholder="BPI Credit Card">
              <datalist id="payablePaymentGroupOptions"></datalist>
            </label>
          </div>
          <p class="payable-amount-helper payable-group-helper">Use the same payment account name for installments or loans you pay together in one card statement.</p>''',
    '''            <label>
              <span>Group / payment account <small>(optional)</small></span>
              <input id="payablePaymentGroup" type="text" maxlength="60" list="payablePaymentGroupOptions" placeholder="My credit card">
              <datalist id="payablePaymentGroupOptions"></datalist>
            </label>
          </div>
          <label id="payableGroupRoleField">
            <span>How this item works in the group</span>
            <select id="payableGroupRole">
              <option value="counts">Counts toward the amount to pay</option>
              <option value="breakdown">Breakdown only — already included in the group total</option>
              <option value="parent">This payable is the group total</option>
            </select>
          </label>
          <p class="payable-amount-helper payable-group-helper">Group names and roles are yours to define. Breakdown-only items stay visible for installment tracking but are never added again to totals.</p>''',
    "generic group editor",
)

# ---------- app.js helpers ----------
replace_once(
    "app.js",
    '''function getPayableGroupName(payable) {
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
    '''function getPayableGroupName(payable) {
  return String(payable?.paymentGroup || "").trim();
}

function getPayableGroupRole(payable) {
  const role = String(payable?.paymentGroupRole || "counts");
  return ["counts", "breakdown", "parent"].includes(role) ? role : "counts";
}

function isPayableBreakdownOnly(payable) {
  return Boolean(getPayableGroupName(payable)) && getPayableGroupRole(payable) === "breakdown";
}

function isPayableGroupParent(payable) {
  return Boolean(getPayableGroupName(payable)) && getPayableGroupRole(payable) === "parent";
}

function isPayableFinanciallyCounted(payable) {
  return !isPayableBreakdownOnly(payable);
}

function getPayableGroupMembers(groupName, { activeOnly = true } = {}) {
  const target = String(groupName || "").trim().toLowerCase();
  return cards.filter((item) =>
    (!activeOnly || isPayableActive(item)) &&
    getPayableGroupName(item).toLowerCase() === target
  );
}

function getPayableGroupParent(groupName) {
  return getPayableGroupMembers(groupName).find(isPayableGroupParent) || null;
}

function getPayableGroupCycleRemaining(item) {
  const cycleMonth = getPayablePaymentCycleMonth(item);
  return getPayableCycleRemainingAmount(item, cycleMonth);
}

function getPayableFinancialRemainingTotal() {
  return cards.reduce((sum, item) => {
    if (!isPayableActive(item) || !isPayableFinanciallyCounted(item)) return sum;
    return sum + payablePHPValue(item, getPayableBalance(item));
  }, 0);
}''',
    "group role helpers",
)

# Totals: never double-count breakdown-only children.
replace_once(
    "app.js",
    '''  const nextPaymentsTotal = waiting.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableCycleRemainingAmount(item, currentMonthKey)),
    0
  );
  const fullMonthPayablesTotal = cards.reduce(
    (sum, item) => sum + payablePHPValue(item, getPayableMonthlyPlanAmount(item, currentMonthKey)),
    0
  );''',
    '''  const nextPaymentsTotal = waiting.reduce(
    (sum, item) => isPayableFinanciallyCounted(item)
      ? sum + payablePHPValue(item, getPayableCycleRemainingAmount(item, currentMonthKey))
      : sum,
    0
  );
  const fullMonthPayablesTotal = cards.reduce(
    (sum, item) => isPayableFinanciallyCounted(item)
      ? sum + payablePHPValue(item, getPayableMonthlyPlanAmount(item, currentMonthKey))
      : sum,
    0
  );''',
    "financial totals filter",
)

replace_once(
    "app.js",
    '''    return sum + payablePHPValue(item, getPayableCycleRemainingAmount(item, currentMonthKey));''',
    '''    return isPayableFinanciallyCounted(item)
      ? sum + payablePHPValue(item, getPayableCycleRemainingAmount(item, currentMonthKey))
      : sum;''',
    "due soon filter",
)

replace_once(
    "app.js",
    '''      return paymentSum + payablePHPValue(item, payment.amount);''',
    '''      return isPayableFinanciallyCounted(item)
        ? paymentSum + payablePHPValue(item, payment.amount)
        : paymentSum;''',
    "paid month filter",
)

replace_once(
    "app.js",
    '''    if (item.paydaySlot !== slot || !isPayableActive(item)) return sum;''',
    '''    if (item.paydaySlot !== slot || !isPayableActive(item) || !isPayableFinanciallyCounted(item)) return sum;''',
    "payday filter",
)

# Replace old separate group summary with remaining total update only.
sub_once(
    "app.js",
    r'''  const groupSummary = document\.getElementById\("payablesGroupSummary"\);\n  if \(groupSummary\) \{.*?\n  \}\n  document\.querySelectorAll\("\[data-payables-view\]"\)''',
    '''  const remainingTotalEl = document.getElementById("payablesRemainingTotal");
  if (remainingTotalEl) remainingTotalEl.textContent = formatPHP(getPayableFinancialRemainingTotal());

  document.querySelectorAll("[data-payables-view]")''',
    "remove separate group summary",
    flags=re.S,
)

# Add reusable grouped-list rendering helpers just before renderPayables.
replace_once(
    "app.js",
    '''function renderPayables() {''',
    '''function getPayableListAmount(item, currentMonthKey, dueView) {
  if (dueView) {
    return isPayableWaitingThisMonth(item) ? getPayableCycleRemainingAmount(item, currentMonthKey) : 0;
  }
  return getPayableMonthlyPlanAmount(item, currentMonthKey);
}

function renderPayableCompactItem(item, currentMonthKey, { dueView = false, child = false } = {}) {
  const meta = getPayableMeta(item);
  const done = !isPayableActive(item);
  const amount = getPayableListAmount(item, currentMonthKey, dueView);
  const paidPercent = getPayableOverallProgressPercent(item);
  const tone = payableDueTone(item.dueDate);
  const cyclePaid = dueView ? getPayableCyclePaidAmount(item, currentMonthKey) : 0;
  const cycleTarget = dueView ? getPayableCycleTargetAmount(item, currentMonthKey) : 0;
  const dueCopy = done
    ? "Fully paid 🌸"
    : item.dueDate
      ? `${dueView ? "Due" : "Next"} · ${formatShortDate(item.dueDate)}`
      : "No due date set";
  const roleCopy = isPayableBreakdownOnly(item)
    ? "Breakdown only · included in group total"
    : cyclePaid > 0
      ? `${formatCurrency(cyclePaid, item.currency || "PHP")} paid of ${formatCurrency(cycleTarget, item.currency || "PHP")}`
      : [getPayablePaymentLabel(item), getPayablePaydayLabel(item)].filter(Boolean).join(" · ");
  return `
    <div class="${child ? "payable-group-child" : ""}">
      <button class="payable-item ${done ? "is-paid" : ""}" type="button" data-payable-open="${escapeHTML(item.id)}">
        <span class="payable-item-main">
          <span class="payable-item-topline">
            <span><strong>${escapeHTML(item.name || meta.label)}</strong><small>${escapeHTML(item.provider || meta.label)}</small></span>
            <b>${done ? "Paid off" : (isVariableMonthlyPayable(item) && !(amount > 0) ? "Set amount" : formatCurrency(amount, item.currency || "PHP"))}</b>
          </span>
          <span class="payable-progress"><i style="width:${paidPercent}%"></i></span>
          <span class="payable-item-foot"><small class="${tone}">${dueCopy}</small><em>${escapeHTML(roleCopy)}</em></span>
        </span>
      </button>
      ${dueView && !done && !isPayableBreakdownOnly(item) ? `<label class="payable-month-check" aria-label="Mark ${escapeHTML(item.name || meta.label)} paid"><input type="checkbox" data-payable-month-toggle="${escapeHTML(item.id)}"><span aria-hidden="true">✓</span><em>Paid</em></label>` : ""}
    </div>`;
}

function getPayableGroupedSections(items, currentMonthKey, dueView) {
  const grouped = new Map();
  const standalone = [];
  items.forEach((item) => {
    const group = getPayableGroupName(item);
    if (!group) {
      standalone.push(item);
      return;
    }
    const key = group.toLowerCase();
    if (!grouped.has(key)) grouped.set(key, { name: group, items: [] });
    grouped.get(key).items.push(item);
  });

  const blocks = [];
  standalone.forEach((item) => blocks.push({ sortDate: item.dueDate || "9999-12-31", html: renderPayableCompactItem(item, currentMonthKey, { dueView }) }));

  grouped.forEach(({ name, items: groupItems }) => {
    const activeMembers = getPayableGroupMembers(name);
    const parent = activeMembers.find(isPayableGroupParent) || null;
    const visibleChildren = groupItems.filter((item) => !parent || String(item.id) !== String(parent.id));
    const amount = activeMembers.reduce((sum, item) => {
      if (!isPayableFinanciallyCounted(item)) return sum;
      return sum + payablePHPValue(item, getPayableListAmount(item, currentMonthKey, dueView));
    }, 0);
    const breakdownTotal = activeMembers.reduce((sum, item) => {
      if (!isPayableBreakdownOnly(item)) return sum;
      return sum + payablePHPValue(item, getPayableMonthlyPlanAmount(item, currentMonthKey));
    }, 0);
    const payableNow = activeMembers.reduce((sum, item) => {
      if (!isPayableFinanciallyCounted(item)) return sum;
      return sum + payablePHPValue(item, getPayableGroupCycleRemaining(item));
    }, 0);
    const earliest = activeMembers.map((item) => item.dueDate || "9999-12-31").sort()[0] || "9999-12-31";
    const parentOpen = parent ? `data-payable-open="${escapeHTML(parent.id)}"` : "";
    const header = `
      <section class="payable-group-stack">
        <article class="payable-group-parent">
          <button class="payable-group-parent-main" type="button" ${parentOpen} ${parent ? "" : "disabled"}>
            <span><small>Payment account</small><strong>${escapeHTML(name)}</strong><em>${activeMembers.length} linked ${activeMembers.length === 1 ? "item" : "items"}</em></span>
            <b>${formatPHP(amount)}</b>
          </button>
          <div class="payable-group-parent-meta">
            ${breakdownTotal > 0 ? `<span>Breakdown total <strong>${formatPHP(breakdownTotal)}</strong></span>` : ""}
            ${payableNow > 0 ? `<button type="button" data-payable-group-pay="${escapeHTML(name)}" data-group-scope="${dueView ? "due" : "all"}">Pay</button>` : ""}
          </div>
        </article>
        <div class="payable-group-children">
          ${visibleChildren.map((item) => renderPayableCompactItem(item, currentMonthKey, { dueView, child: true })).join("")}
        </div>
      </section>`;
    blocks.push({ sortDate: earliest, html: header });
  });

  return blocks.sort((a, b) => a.sortDate.localeCompare(b.sortDate)).map((block) => block.html).join("");
}

function renderPayables() {''',
    "grouped render helpers",
)

# Replace the All view's flat mapping with grouped hierarchy.
sub_once(
    "app.js",
    r'''  if \(!isDueView\) \{\n    const visibleAll = allPayables\.slice\(0, payableRenderLimit\);\n    const allMarkup = visibleAll\.map\(\(item\) => \{.*?\n    list\.innerHTML = allMarkup \+ loadMoreAll;\n    return;\n  \}''',
    '''  if (!isDueView) {
    const visibleAll = allPayables.slice(0, payableRenderLimit);
    const allMarkup = getPayableGroupedSections(visibleAll, currentMonthKey, false);
    const loadMoreAll = visibleAll.length < allPayables.length
      ? `<button class="secondary-button momo-load-more" type="button" data-load-more-payables>Load more (${allPayables.length - visibleAll.length} remaining)</button>`
      : "";
    list.innerHTML = allMarkup + loadMoreAll;
    return;
  }''',
    "all grouped list",
    flags=re.S,
)

# Replace due waiting flat mapping with grouped hierarchy.
sub_once(
    "app.js",
    r'''  const visiblePayables = waiting\.slice\(0, payableRenderLimit\);\n  const waitingMarkup = visiblePayables\.length\n    \? visiblePayables\.map\(\(item\) => \{.*?\n      \}\)\.join\(""\)\n    : \(cards\.length \? `<div class="payables-month-clear">''',
    '''  const visiblePayables = waiting.slice(0, payableRenderLimit);
  const waitingMarkup = visiblePayables.length
    ? getPayableGroupedSections(visiblePayables, currentMonthKey, true)
    : (cards.length ? `<div class="payables-month-clear">''',
    "due grouped list",
    flags=re.S,
)

# Editor state/save for group role.
replace_once(
    "app.js",
    '''  document.getElementById("payablePaymentGroup").value = item?.paymentGroup || "";''',
    '''  document.getElementById("payablePaymentGroup").value = item?.paymentGroup || "";
  document.getElementById("payableGroupRole").value = item?.paymentGroupRole || "counts";''',
    "group role editor load",
)

replace_once(
    "app.js",
    '''    paymentGroup: document.getElementById("payablePaymentGroup")?.value.trim() || "",
    startingRemainingMonths:''',
    '''    paymentGroup: document.getElementById("payablePaymentGroup")?.value.trim() || "",
    paymentGroupRole: document.getElementById("payablePaymentGroup")?.value.trim()
      ? (document.getElementById("payableGroupRole")?.value || "counts")
      : "counts",
    startingRemainingMonths:''',
    "group role save",
)

# Generic detail labels.
replace_once(
    "app.js",
    '''      ${getPayableGroupName(item) ? `<div><small>Paid together under</small><strong>${escapeHTML(getPayableGroupName(item))}</strong></div>` : ""}''',
    '''      ${getPayableGroupName(item) ? `<div><small>Payment group</small><strong>${escapeHTML(getPayableGroupName(item))}${isPayableBreakdownOnly(item) ? " · breakdown only" : isPayableGroupParent(item) ? " · group total" : ""}</strong></div>` : ""}''',
    "generic detail group label",
)

# Group payment ignores breakdown-only items as payment allocations.
replace_once(
    "app.js",
    '''  return getPayableGroupMembers(groupName)
    .filter((item) => scope !== "due" || isPayableWaitingThisMonth(item))''',
    '''  return getPayableGroupMembers(groupName)
    .filter(isPayableFinanciallyCounted)
    .filter((item) => scope !== "due" || isPayableWaitingThisMonth(item))''',
    "group payment candidate filter",
)

# Add breakdown auto-sync helper before record group payment.
replace_once(
    "app.js",
    '''async function recordPayableGroupPayment(event) {''',
    '''async function syncBreakdownChildrenForGroup(groupName, paymentDate, groupPaymentId = "") {
  const children = getPayableGroupMembers(groupName).filter(isPayableBreakdownOnly);
  for (const child of children) {
    const remaining = getPayableGroupCycleRemaining(child);
    if (!(remaining > 0)) continue;
    await applyPayablePayment(child, remaining, paymentDate, `Tracked with ${groupName}`, {
      source: "breakdown-sync",
      groupPaymentId,
      groupName
    });
  }
}

async function recordPayableGroupPayment(event) {''',
    "breakdown sync helper",
)

# Sync breakdown terms when an explicit parent total was fully covered by group payment.
replace_once(
    "app.js",
    '''    if (result) recorded += payablePHPValue(item, result.actualAmount);
  }
  closePayableGroupPayment();''',
    '''    if (result) {
      recorded += payablePHPValue(item, result.actualAmount);
      if (result.completedCycle && isPayableGroupParent(item)) {
        await syncBreakdownChildrenForGroup(groupName, paymentDate, groupPaymentId);
      }
    }
  }
  closePayableGroupPayment();''',
    "group breakdown progress sync",
)

# Sync breakdown terms for direct parent payments too.
replace_once(
    "app.js",
    '''  closePayablePayment();
  renderPayables();''',
    '''  if (result.completedCycle && isPayableGroupParent(item)) {
    await syncBreakdownChildrenForGroup(getPayableGroupName(item), paymentDate);
  }
  closePayablePayment();
  renderPayables();''',
    "direct parent breakdown sync",
)

replace_once(
    "app.js",
    '''  if (!result) return;
  renderPayables();''',
    '''  if (!result) return;
  if (result.completedCycle && isPayableGroupParent(item)) {
    await syncBreakdownChildrenForGroup(getPayableGroupName(item), getTodayString());
  }
  renderPayables();''',
    "month-check parent breakdown sync",
)

# Remaining reveal interaction.
replace_once(
    "app.js",
    '''document.getElementById("payableType")?.addEventListener("change", updatePayableSpecialFields);''',
    '''document.getElementById("payablesRemainingToggle")?.addEventListener("click", () => {
  const button = document.getElementById("payablesRemainingToggle");
  const reveal = document.getElementById("payablesRemainingReveal");
  if (!button || !reveal) return;
  const opening = reveal.hidden;
  reveal.hidden = !opening;
  button.classList.toggle("is-open", opening);
  button.setAttribute("aria-expanded", opening ? "true" : "false");
});

document.getElementById("payablePaymentGroup")?.addEventListener("input", () => {
  const field = document.getElementById("payableGroupRoleField");
  if (field) field.hidden = !document.getElementById("payablePaymentGroup")?.value.trim();
});

document.getElementById("payableType")?.addEventListener("change", updatePayableSpecialFields);''',
    "remaining toggle handlers",
)

# Ensure role visibility whenever editor opens/updates.
replace_once(
    "app.js",
    '''  updatePayableCalculatedBalance();
}''',
    '''  const groupRoleField = document.getElementById("payableGroupRoleField");
  if (groupRoleField) groupRoleField.hidden = !document.getElementById("payablePaymentGroup")?.value.trim();
  updatePayableCalculatedBalance();
}''',
    "group role visibility",
)

# ---------- styles.css ----------
styles = Path("styles.css")
styles.write_text(styles.read_text() + r'''

/* Payables grouped hierarchy + quiet remaining-debt reveal */
.payables-hero-label-row { display:flex; align-items:center; gap:6px; }
.payables-hero-label-row p { margin:0; }
.payables-remaining-toggle {
  width:26px; height:26px; padding:0; border:0; border-radius:999px;
  display:grid; place-items:center; background:rgba(255,255,255,.58); color:inherit;
  font-size:20px; line-height:1; transition:transform .18s ease, background .18s ease;
}
.payables-remaining-toggle.is-open { transform:rotate(90deg); background:rgba(255,255,255,.78); }
.payables-remaining-reveal {
  width:max-content; max-width:100%; margin-top:8px; padding:7px 10px; border-radius:13px;
  background:rgba(255,255,255,.52); font-size:.72rem;
}
.payables-remaining-reveal span { opacity:.72; margin-right:6px; }
.payables-remaining-reveal strong { font-size:.8rem; }
.payable-group-stack { margin:0 0 12px; }
.payable-group-parent {
  border:1px solid var(--line,#f2d7df); border-radius:22px 22px 16px 16px;
  background:rgba(255,255,255,.76); overflow:hidden;
}
.payable-group-parent-main {
  width:100%; padding:14px 16px 10px; border:0; display:flex; align-items:flex-start;
  justify-content:space-between; gap:12px; text-align:left; background:transparent; color:inherit;
}
.payable-group-parent-main:disabled { opacity:1; }
.payable-group-parent-main span { min-width:0; }
.payable-group-parent-main small,.payable-group-parent-main strong,.payable-group-parent-main em { display:block; }
.payable-group-parent-main small { color:var(--muted,#9a7e87); font-size:.68rem; }
.payable-group-parent-main strong { margin-top:2px; font-size:1rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.payable-group-parent-main em { margin-top:3px; color:var(--muted,#9a7e87); font-size:.68rem; font-style:normal; }
.payable-group-parent-main b { flex:0 0 auto; font-size:1rem; }
.payable-group-parent-meta {
  padding:0 14px 12px 16px; display:flex; align-items:center; justify-content:space-between; gap:10px;
}
.payable-group-parent-meta span { color:var(--muted,#9a7e87); font-size:.7rem; }
.payable-group-parent-meta span strong { color:inherit; font-size:.72rem; }
.payable-group-parent-meta button {
  border:0; border-radius:999px; padding:7px 12px; background:#fbe3ec; color:#b96087; font-weight:800;
}
.payable-group-children {
  margin:0 8px; padding:8px 0 0 12px; border-left:2px solid rgba(219,151,177,.22);
  display:grid; gap:8px;
}
.payable-group-child { position:relative; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px; }
.payable-group-child::before {
  content:""; position:absolute; left:-13px; top:26px; width:12px; height:1px; background:rgba(219,151,177,.28);
}
.payable-group-child .payable-item { margin:0; }
.payable-group-child .payable-month-check { margin-right:0; }
#payableGroupRoleField[hidden] { display:none !important; }
@media (max-width:390px) {
  .payable-group-parent-main { padding:13px 13px 9px; }
  .payable-group-parent-meta { padding:0 12px 11px 13px; }
  .payable-group-children { margin-right:2px; margin-left:7px; padding-left:10px; }
}
''')

# ---------- service-worker.js ----------
replace_once(
    "service-worker.js",
    '`momo-runtime-shell-v${APP_VERSION}-payables-planner-r1`',
    '`momo-runtime-shell-v${APP_VERSION}-payables-planner-r2`',
    "cache revision",
)
