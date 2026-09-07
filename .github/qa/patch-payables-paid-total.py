from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing {label} in {path}")
    p.write_text(text.replace(old, new, 1))

old = '''  const now = new Date();\n  const paidMonth = cards.reduce((sum, item) => {\n    if (!payableCountsTowardTotals(item)) return sum;\n    return sum + getPayablePayments(item).reduce((paymentSum, payment) => {\n      if (isPayableSyntheticTrackingPayment(payment)) return paymentSum;\n      const date = createLocalDate(payment.date);\n      if (!date || date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return paymentSum;\n      return paymentSum + payablePHPValue(item, payment.amount);\n    }, 0);\n  }, 0);'''
new = '''  // Keep the hero "Paid this month" amount reconciled to the exact completed\n  // cycles shown in "Done for <month>". Partial/early transactions that have\n  // not completed a cycle must not inflate this summary.\n  const paidMonth = paidCycleEntries.reduce(\n    (sum, entry) => sum + payablePHPValue(entry.item, entry.amount),\n    0\n  );'''
replace_once('app.js', old, new, 'paid month calculation')
replace_once(
    'service-worker.js',
    '`momo-runtime-shell-v${APP_VERSION}-payables-planner-r4`',
    '`momo-runtime-shell-v${APP_VERSION}-payables-planner-r5`',
    'service worker cache bump',
)
