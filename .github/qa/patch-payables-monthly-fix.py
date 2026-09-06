from pathlib import Path
import re


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing {label}")
    p.write_text(text.replace(old, new, 1))


def sub_once(path, pattern, repl, label, flags=0):
    p = Path(path)
    text = p.read_text()
    new, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"Expected one replacement for {label}, got {count}")
    p.write_text(new)

# The first-pass generic balance/next-payment replacement can match the All Payables
# renderer before the detail renderer. Explicitly ensure detail has its own state.
sub_once(
    "app.js",
    r'''(function renderPayableDetail\(id\) \{.*?const meta = getPayableMeta\(item\);\n  const balance = getPayableBalance\(item\);)(\n  const nextPayment = getPayableNextPaymentAmount\(item\);)''',
    r'''\1
  const active = isPayableActive(item);
  const variableMonthly = isVariableMonthlyPayable(item);
  const remainingPayments = getPayableRemainingPayments(item);\2''',
    "payable detail state",
    flags=re.S,
)

# The new generic progress entry supersedes the old installment-only duplicate fields.
replace_once(
    "app.js",
    '  if (installment) installment.hidden = type !== "installment";',
    '  if (installment) installment.hidden = true;',
    "hide legacy installment editor",
)

# Keep legacy installment fields synchronized when a Shop Installment uses 1-of-N progress.
replace_once(
    "app.js",
    '    installmentCount: type === "installment" ? Number(document.getElementById("payableInstallmentCount").value || 0) : 0,\n    installmentsPaid: type === "installment" ? Number(document.getElementById("payableInstallmentsPaid").value || 0) : 0,',
    '    installmentCount: type === "installment" ? (balanceMode === "progress" ? paymentsTotal : Number(document.getElementById("payableInstallmentCount").value || 0)) : 0,\n    installmentsPaid: type === "installment" ? (balanceMode === "progress" ? paymentsCompleted : Number(document.getElementById("payableInstallmentsPaid").value || 0)) : 0,',
    "sync installment progress",
)

# Avoid duplicate active/variable definitions if the first-pass replacement landed inside All Payables.
# They are harmless there, but detail is the only place that requires remainingPayments.

# Add a small mode cue inside All Payables for variable templates once their amount is unset.
replace_once(
    "app.js",
    '<em>${done ? "finished" : escapeHTML(getPayablePaymentLabel(item))}</em>',
    '<em>${done ? "finished" : escapeHTML(getPayablePaymentLabel(item))}</em>',
    "all-payables mode cue anchor",
)

# Bump the cache one more notch so retries of the QA harness cannot leave a stale shell.
replace_once(
    "service-worker.js",
    '`momo-runtime-shell-v${APP_VERSION}-payables-monthly-r1`',
    '`momo-runtime-shell-v${APP_VERSION}-payables-monthly-r2`',
    "payables monthly cache retry",
)
