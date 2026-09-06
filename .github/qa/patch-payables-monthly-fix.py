from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing {label}")
    p.write_text(text.replace(old, new, 1))

# Ensure Payable Detail has the state needed by its new template copy. Work inside
# the function slice so earlier renderer occurrences cannot steal the replacement.
app = Path("app.js")
text = app.read_text()
start = text.find("function renderPayableDetail(id) {")
end = text.find("\nfunction closePayableDetail()", start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate renderPayableDetail")
segment = text[start:end]
anchor = '  const balance = getPayableBalance(item);'
if anchor not in segment:
    raise SystemExit("Could not locate Payable Detail balance state")
if 'const active = isPayableActive(item);' not in segment:
    segment = segment.replace(
        anchor,
        anchor + '\n  const active = isPayableActive(item);\n  const variableMonthly = isVariableMonthlyPayable(item);\n  const remainingPayments = getPayableRemainingPayments(item);',
        1,
    )
app.write_text(text[:start] + segment + text[end:])

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

# Bump the cache one more notch so retries of the QA harness cannot leave a stale shell.
replace_once(
    "service-worker.js",
    '`momo-runtime-shell-v${APP_VERSION}-payables-monthly-r1`',
    '`momo-runtime-shell-v${APP_VERSION}-payables-monthly-r2`',
    "payables monthly cache retry",
)
