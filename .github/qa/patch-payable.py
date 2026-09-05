from pathlib import Path

app_path = Path("app.js")
app = app_path.read_text()

old_due = '''function nextPayableDueDate(currentDate, frequency) {
  const base = createLocalDate(currentDate) || new Date();
  const next = new Date(base);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "biweekly") next.setDate(next.getDate() + 14);
  else if (frequency === "quarterly") next.setMonth(next.getMonth() + 3);
  else if (frequency === "one-time" || frequency === "custom") return "";
  else next.setMonth(next.getMonth() + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}'''

new_due = '''function getPayableDueDay(dateString) {
  const date = createLocalDate(dateString);
  return date ? date.getDate() : 0;
}

function nextPayableDueDate(currentDate, frequency, dueDayOfMonth = 0) {
  const base = createLocalDate(currentDate) || new Date();

  if (frequency === "one-time" || frequency === "custom") {
    return "";
  }

  const next = new Date(base);

  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "biweekly") {
    next.setDate(next.getDate() + 14);
  } else {
    const monthsToAdd = frequency === "quarterly" ? 3 : 1;
    const anchorDay = Math.max(
      1,
      Math.min(31, Number(dueDayOfMonth) || base.getDate())
    );

    next.setDate(1);
    next.setMonth(next.getMonth() + monthsToAdd);

    const lastDayOfTargetMonth = new Date(
      next.getFullYear(),
      next.getMonth() + 1,
      0
    ).getDate();

    next.setDate(Math.min(anchorDay, lastDayOfTargetMonth));
  }

  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}'''

if "function getPayableDueDay(dateString)" not in app:
    if old_due not in app:
        raise SystemExit("Expected nextPayableDueDate block not found")
    app = app.replace(old_due, new_due, 1)

if "function normalizePayableEditorAmount(value) {" not in app:
    old_open = 'function openPayableEditor(id = "") {'
    new_open = '''function normalizePayableEditorAmount(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "";
  }

  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function openPayableEditor(id = "") {'''
    if old_open not in app:
        raise SystemExit("Expected openPayableEditor marker not found")
    app = app.replace(old_open, new_open, 1)

replacements = {
    'document.getElementById("payableOriginalAmount").value = item?.originalAmount ?? "";': 'document.getElementById("payableOriginalAmount").value = normalizePayableEditorAmount(item?.originalAmount);',
    'document.getElementById("payableBalance").value = item?.balance ?? "";': 'document.getElementById("payableBalance").value = normalizePayableEditorAmount(item?.balance);',
    'document.getElementById("payableRegularPayment").value = item?.regularPayment ?? "";': 'document.getElementById("payableRegularPayment").value = normalizePayableEditorAmount(item?.regularPayment);',
    'document.getElementById("payableCreditLimit").value = item?.creditLimit ?? "";': 'document.getElementById("payableCreditLimit").value = normalizePayableEditorAmount(item?.creditLimit);',
    'document.getElementById("payableStatementBalance").value = item?.statementBalance ?? "";': 'document.getElementById("payableStatementBalance").value = normalizePayableEditorAmount(item?.statementBalance);',
    'document.getElementById("payableMinimumDue").value = item?.minimumDue ?? "";': 'document.getElementById("payableMinimumDue").value = normalizePayableEditorAmount(item?.minimumDue);',
    'if (payableInterestAPR) payableInterestAPR.value = item?.interestAPR ?? "";': 'if (payableInterestAPR) payableInterestAPR.value = normalizePayableEditorAmount(item?.interestAPR);',
    'document.getElementById("payableStatementDay").value = item?.statementDay ?? "";': 'document.getElementById("payableStatementDay").value = Number(item?.statementDay || 0) >= 1 ? Math.min(31, Math.floor(Number(item.statementDay))) : "";',
    'document.getElementById("payableInstallmentCount").value = item?.installmentCount ?? "";': 'document.getElementById("payableInstallmentCount").value = Number(item?.installmentCount || 0) >= 1 ? Math.floor(Number(item.installmentCount)) : "";',
    'document.getElementById("payableInstallmentsPaid").value = item?.installmentsPaid ?? "";': 'document.getElementById("payableInstallmentsPaid").value = Number.isFinite(Number(item?.installmentsPaid)) ? Math.max(0, Math.floor(Number(item.installmentsPaid))) : "";'
}

for old, new in replacements.items():
    if old in app:
        app = app.replace(old, new, 1)
    elif new not in app:
        raise SystemExit(f"Expected payable editor assignment not found: {old}")

record_anchor = '''    updatedAt: new Date().toISOString()
  };
  if (!record.name) {'''
record_anchor_new = '''    updatedAt: new Date().toISOString()
  };

  record.dueDayOfMonth =
    (record.frequency === "monthly" || record.frequency === "quarterly") && record.dueDate
      ? getPayableDueDay(record.dueDate)
      : 0;

  if (!record.name) {'''
if "record.dueDayOfMonth =" not in app:
    if record_anchor not in app:
        raise SystemExit("Expected payable record anchor not found")
    app = app.replace(record_anchor, record_anchor_new, 1)

old_balance = "const nextBalance = Math.max(0, getPayableBalance(item) - actualAmount);"
new_balance = '''const nextBalance = Math.max(
    0,
    Math.round((getPayableBalance(item) - actualAmount + Number.EPSILON) * 100) / 100
  );'''
if old_balance in app:
    app = app.replace(old_balance, new_balance, 1)
elif new_balance not in app:
    raise SystemExit("Expected nextBalance line not found")

old_payment_due = 'dueDate: nextBalance > 0 ? nextPayableDueDate(item.dueDate || payment.date, item.frequency || "monthly") : "",'
new_payment_due = '''dueDate: nextBalance > 0
      ? nextPayableDueDate(
          item.dueDate || payment.date,
          item.frequency || "monthly",
          item.dueDayOfMonth || getPayableDueDay(item.dueDate || payment.date)
        )
      : "",'''
if old_payment_due in app:
    app = app.replace(old_payment_due, new_payment_due, 1)
elif new_payment_due not in app:
    raise SystemExit("Expected payable due advancement line not found")

old_save = '''  await putRecord(STORES.cards, record);
  const index = cards.findIndex((item) => String(item.id) === String(id));
  if (index >= 0) cards[index] = record;
  else cards.push(record);
  closePayableEditor();
  renderPayables();
  showToast(existing ? "Payable updated 🌸" : "Payable added ✿");
}'''
new_save = '''  try {
    await putRecord(STORES.cards, record);
    const index = cards.findIndex((item) => String(item.id) === String(id));
    if (index >= 0) cards[index] = record;
    else cards.push(record);
    closePayableEditor();
    renderPayables();
    showToast(existing ? "Payable updated 🌸" : "Payable added ✿");
  } catch (error) {
    console.error("Could not save payable:", error);
    showToast("Could not save this payable. Try again.");
  }
}'''
if 'Could not save payable:' not in app:
    if old_save not in app:
        raise SystemExit("Expected payable save tail not found")
    app = app.replace(old_save, new_save, 1)

app_path.write_text(app)

sw_path = Path("service-worker.js")
sw = sw_path.read_text()
if "shared-trip-r3" not in sw:
    old_cache = '`momo-runtime-shell-v${APP_VERSION}-shared-trip-r2`'
    new_cache = '`momo-runtime-shell-v${APP_VERSION}-shared-trip-r3`'
    if old_cache not in sw:
        raise SystemExit("Expected service worker cache key not found")
    sw = sw.replace(old_cache, new_cache, 1)
    sw_path.write_text(sw)
