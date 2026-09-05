from pathlib import Path
import re


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing expected snippet in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "app.js",
    'let payableRenderLimit = PAYABLE_RENDER_BATCH;\n\n',
    'let payableRenderLimit = PAYABLE_RENDER_BATCH;\nlet activePayablesView = "due";\n\n'
)

app = Path("app.js")
text = app.read_text()
pattern = re.compile(r'function renderPayables\(\) \{.*?\n\}\n\n\ndocument\.addEventListener\(\n  "click",\n  \(event\) => \{\n\n    if \(\n      !event\.target\.closest\(\n        "\[data-load-more-payables\]"\n      \)\n    \) \{\n\n      return;\n\n    \}\n\n\n    payableRenderLimit \+=\n      PAYABLE_RENDER_BATCH;\n\n\n    renderPayables\(\);\n\n  \}\n\);', re.S)
match = pattern.search(text)
if not match:
    raise SystemExit("Could not locate renderPayables block")

new_block = r'''function renderPayables() {
  const list = document.getElementById("payablesList");
  const empty = document.getElementById("payablesEmpty");
  if (!list || !empty) return;

  const waiting = cards
    .filter((item) => isPayableWaitingThisMonth(item))
    .sort((a, b) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")));

  const allPayables = [...cards].sort((a, b) => {
    const doneA = getPayableBalance(a) <= 0;
    const doneB = getPayableBalance(b) <= 0;
    if (doneA !== doneB) return doneA ? 1 : -1;
    const dateCompare = String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"));
    if (dateCompare) return dateCompare;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

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
    return sum + payablePHPValue(item, getPayableNextPaymentAmount(item));
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
  const kickerEl = document.getElementById("payablesListKicker");
  const titleEl = document.getElementById("payablesListTitle");
  const activeCount = cards.filter((item) => getPayableBalance(item) > 0).length;

  if (totalEl) totalEl.textContent = formatPHP(nextPaymentsTotal);
  if (dueEl) dueEl.textContent = formatPHP(dueSoon);
  if (paidEl) paidEl.textContent = formatPHP(paidMonth);
  if (countEl) countEl.textContent = waiting.length
    ? `${waiting.length} ${waiting.length === 1 ? "payment" : "payments"} left this month`
    : "Nothing waiting this month 🌸";

  const isDueView = activePayablesView !== "all";
  document.querySelectorAll("[data-payables-view]").forEach((button) => {
    const selected = button.dataset.payablesView === (isDueView ? "due" : "all");
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });

  if (kickerEl) kickerEl.textContent = isDueView ? "Your little list" : "Everything saved";
  if (titleEl) titleEl.textContent = isDueView ? "What’s waiting" : "All payables";
  if (activeCountEl) activeCountEl.textContent = isDueView ? `${waiting.length} left` : `${activeCount} active`;

  empty.hidden = cards.length > 0;
  const monthLabel = getPayableMonthLabel(currentMonthKey);

  if (!isDueView) {
    const visibleAll = allPayables.slice(0, payableRenderLimit);
    const allMarkup = visibleAll.map((item) => {
      const meta = getPayableMeta(item);
      const balance = getPayableBalance(item);
      const nextPayment = getPayableNextPaymentAmount(item);
      const original = Number(item.originalAmount || 0);
      const paidPercent = original > 0 ? Math.min(100, Math.max(0, ((original - balance) / original) * 100)) : 0;
      const done = balance <= 0;
      const tone = payableDueTone(item.dueDate);
      const dueCopy = done
        ? "Fully paid 🌸"
        : item.dueDate
          ? `Next · ${formatShortDate(item.dueDate)}`
          : "No due date set";
      return `
        <button class="payable-item ${done ? "is-paid" : ""}" type="button" data-payable-open="${escapeHTML(item.id)}">
          <span class="payable-item-main">
            <span class="payable-item-topline">
              <span>
                <strong>${escapeHTML(item.name || meta.label)}</strong>
                <small>${escapeHTML(item.provider || meta.label)}</small>
              </span>
              <b>${done ? "Paid off" : formatCurrency(nextPayment, item.currency || "PHP")}</b>
            </span>
            <span class="payable-progress"><i style="width:${paidPercent}%"></i></span>
            <span class="payable-item-foot">
              <small class="${tone}">${dueCopy}</small>
              <em>${done ? "finished" : escapeHTML(getPayablePaymentLabel(item))}</em>
            </span>
          </span>
        </button>`;
    }).join("");

    const loadMoreAll = visibleAll.length < allPayables.length
      ? `<button class="secondary-button momo-load-more" type="button" data-load-more-payables>Load more (${allPayables.length - visibleAll.length} remaining)</button>`
      : "";

    list.innerHTML = allMarkup + loadMoreAll;
    return;
  }

  const visiblePayables = waiting.slice(0, payableRenderLimit);
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
    : (cards.length ? `<div class="payables-month-clear"><span>🌸</span><strong>You’re clear for ${escapeHTML(monthLabel)}</strong><small>Future payables are still available under All Payables.</small></div>` : "");

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
}


document.addEventListener("click", (event) => {
  const view = event.target.closest("[data-payables-view]");
  if (!view) return;
  activePayablesView = view.dataset.payablesView === "all" ? "all" : "due";
  payableRenderLimit = PAYABLE_RENDER_BATCH;
  renderPayables();
});


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
);'''

text = text[:match.start()] + new_block + text[match.end():]
app.write_text(text)

replace_once(
    "app.js",
    '''    closePayableEditor();
    renderPayables();
    showToast(existing ? "Payable updated 🌸" : "Payable added ✿");''',
    '''    closePayableEditor();
    const movedOutOfDueView = Boolean(
      existing &&
      activePayablesView === "due" &&
      getPayableBalance(record) > 0 &&
      !isPayableWaitingThisMonth(record)
    );
    if (movedOutOfDueView) activePayablesView = "all";
    renderPayables();
    showToast(
      movedOutOfDueView
        ? "Payable updated · shown in All Payables 🌸"
        : existing
          ? "Payable updated 🌸"
          : "Payable added ✿"
    );'''
)

replace_once(
    "index.html",
    '''        <div class="payables-section-heading">
          <div>
            <p class="section-kicker">Your little list</p>
            <h2>What’s waiting</h2>
          </div>
          <span id="payablesActiveCount" class="momo-soft-pill">0 active</span>
        </div>''',
    '''        <div class="payables-view-switch" role="tablist" aria-label="Payables view">
          <button class="active" type="button" role="tab" data-payables-view="due" aria-selected="true">Due</button>
          <button type="button" role="tab" data-payables-view="all" aria-selected="false">All Payables</button>
        </div>

        <div class="payables-section-heading">
          <div>
            <p id="payablesListKicker" class="section-kicker">Your little list</p>
            <h2 id="payablesListTitle">What’s waiting</h2>
          </div>
          <span id="payablesActiveCount" class="momo-soft-pill">0 left</span>
        </div>'''
)

styles = Path("styles.css")
styles.write_text(styles.read_text() + r'''

/* MOMO — PAYABLES DUE / ALL VIEWS */
.payables-view-switch {
  margin: 20px 0 16px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 18px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  background: color-mix(in srgb, var(--surface) 76%, var(--blush));
}

.payables-view-switch button {
  min-height: 42px;
  padding: 8px 12px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--text-soft);
  font-size: 9px;
  font-weight: 900;
}

.payables-view-switch button.active {
  background: var(--surface);
  color: var(--rose);
  box-shadow: 0 5px 16px rgba(91, 62, 59, 0.08);
}

.payables-view-switch button:active {
  transform: scale(0.985);
}

@media (max-width: 350px) {
  .payables-view-switch button {
    min-height: 40px;
    padding-inline: 8px;
  }
}
''')

replace_once(
    "service-worker.js",
    '`momo-runtime-shell-v${APP_VERSION}-shared-trip-r6`',
    '`momo-runtime-shell-v${APP_VERSION}-shared-trip-r7`'
)
