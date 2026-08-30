from pathlib import Path
import re

# Move the existing inline converter above the trip list without duplicating it.
index_path = Path('index.html')
html = index_path.read_text()

converter_match = re.search(r'<section\b[^>]*\bid="inlineConverter"[^>]*>', html)
if not converter_match:
    raise SystemExit('inlineConverter section not found')
start = converter_match.start()
depth = 0
end = None
for token in re.finditer(r'</?section\b[^>]*>', html[start:], re.I):
    tag = token.group(0).lower()
    if tag.startswith('</section'):
        depth -= 1
        if depth == 0:
            end = start + token.end()
            break
    else:
        depth += 1
if end is None:
    raise SystemExit('Could not find balanced inlineConverter section')
converter_block = html[start:end]
html_without = html[:start] + html[end:]
trip_list_marker = '<div id="tripList"></div>'
insert_at = html_without.find(trip_list_marker)
if insert_at < 0:
    raise SystemExit('tripList marker not found')
html = html_without[:insert_at] + converter_block.strip() + '\n\n        ' + html_without[insert_at:]
index_path.write_text(html)

# Add a pending trip target used only when opening the standard Add Expense flow from Trips.
app_path = Path('app.js')
app = app_path.read_text()
state_anchor = 'let openingExpenseEditor =\n  false;'
if 'let pendingTripExpenseId' not in app:
    if state_anchor not in app:
        raise SystemExit('openingExpenseEditor state anchor not found')
    app = app.replace(
        state_anchor,
        state_anchor + '\n\n\nlet pendingTripExpenseId =\n  "";',
        1
    )

# After the normal Add form is prepared, apply the trip requested by the travel shortcut.
if 'pendingTripExpenseId &&\n      document.getElementById(\n        "expenseTrip"' not in app:
    add_branch = app.find('name ===\n    "add"')
    if add_branch < 0:
        raise SystemExit('Add screen branch not found')
    prepare_at = app.find('    prepareExpenseForm();', add_branch)
    if prepare_at < 0:
        raise SystemExit('prepareExpenseForm call in Add screen branch not found')
    prepare_end = prepare_at + len('    prepareExpenseForm();')
    injection = '''\n\n\n    if (\n      pendingTripExpenseId &&\n      document.getElementById(\n        "expenseTrip"\n      )\n    ) {\n\n      const tripSelect =\n        document.getElementById(\n          "expenseTrip"\n        );\n\n      tripSelect.value =\n        String(\n          pendingTripExpenseId\n        );\n\n      tripSelect.dispatchEvent(\n        new Event(\n          "change",\n          { bubbles: true }\n        )\n      );\n\n      pendingTripExpenseId =\n        "";\n\n    }'''
    app = app[:prepare_end] + injection + app[prepare_end:]

# Add a large trip-specific Add Expense button directly below View Trip Dashboard.
if 'class="trip-quick-expense-btn"' not in app:
    marker = 'View Trip Dashboard'
    marker_at = app.find(marker)
    if marker_at < 0:
        raise SystemExit('View Trip Dashboard marker not found')
    button_end = app.find('</button>', marker_at)
    if button_end < 0:
        raise SystemExit('Trip dashboard button end not found')
    button_end += len('</button>')
    quick_button = '''\n\n\n        <button\n          class="trip-quick-expense-btn"\n          type="button"\n          data-trip-expense-id="${escapeHTML(\n            trip.id\n          )}"\n          aria-label="Add expense to ${escapeHTML(\n            trip.name ||\n            "this trip"\n          )}"\n        >\n          <span class="trip-quick-expense-icon" aria-hidden="true">＋</span>\n          <span class="trip-quick-expense-copy">\n            <strong>Add Expense</strong>\n            <small>Automatically add it to this trip</small>\n          </span>\n          <span class="trip-quick-expense-arrow" aria-hidden="true">›</span>\n        </button>'''
    app = app[:button_end] + quick_button + app[button_end:]

# Delegate clicks so dynamically-rendered trip cards stay lightweight.
if 'TRIP QUICK ADD EXPENSE' not in app:
    app += '''\n\n\n// ========================================\n// TRIP QUICK ADD EXPENSE\n// Uses the normal Add Expense form and only presets the trip.\n// ========================================\n\ndocument.addEventListener(\n  "click",\n  (event) => {\n\n    const button =\n      event.target.closest?.(\n        ".trip-quick-expense-btn"\n      );\n\n    if (!button) {\n      return;\n    }\n\n    const tripId =\n      String(\n        button.dataset.tripExpenseId ||\n        ""\n      );\n\n    if (!tripId) {\n      return;\n    }\n\n    pendingTripExpenseId =\n      tripId;\n\n    editingExpenseId =\n      "";\n\n    openingExpenseEditor =\n      false;\n\n    showScreen(\n      "add"\n    );\n\n  }\n);\n'''

app_path.write_text(app)

# Make the travel quick-add visually unmistakable and thumb friendly.
styles_path = Path('styles.css')
styles = styles_path.read_text()
if 'MOMO TRIP QUICK EXPENSE' not in styles:
    styles += '''\n\n/* ========================================\n   MOMO TRIP QUICK EXPENSE\n======================================== */\n\n.trip-quick-expense-btn {\n  width: 100%;\n  min-height: 58px;\n  margin: 10px 0 6px;\n  padding: 9px 12px;\n  border: 1px solid color-mix(in srgb, var(--pink) 58%, var(--border));\n  border-radius: 17px;\n  display: grid;\n  grid-template-columns: 40px minmax(0, 1fr) auto;\n  gap: 10px;\n  align-items: center;\n  background: linear-gradient(135deg, color-mix(in srgb, var(--pink) 74%, white), color-mix(in srgb, var(--blush) 86%, white));\n  color: var(--text);\n  text-align: left;\n  box-shadow: 0 7px 18px color-mix(in srgb, var(--rose) 9%, transparent);\n  cursor: pointer;\n  -webkit-tap-highlight-color: transparent;\n}\n\n.trip-quick-expense-btn:active {\n  transform: translateY(1px);\n}\n\n.trip-quick-expense-icon {\n  width: 40px;\n  height: 40px;\n  border-radius: 13px;\n  display: grid;\n  place-items: center;\n  background: rgba(255, 255, 255, 0.74);\n  color: var(--rose);\n  font-size: 25px;\n  font-weight: 500;\n}\n\n.trip-quick-expense-copy {\n  min-width: 0;\n}\n\n.trip-quick-expense-copy strong,\n.trip-quick-expense-copy small {\n  display: block;\n}\n\n.trip-quick-expense-copy strong {\n  font-size: 12px;\n  line-height: 1.25;\n}\n\n.trip-quick-expense-copy small {\n  margin-top: 3px;\n  color: var(--text-soft);\n  font-size: 9px;\n  line-height: 1.3;\n}\n\n.trip-quick-expense-arrow {\n  color: var(--rose);\n  font-size: 22px;\n}\n\n.screen[data-screen="trips"] #inlineConverter {\n  margin-top: 4px;\n  margin-bottom: 16px;\n}\n'''
styles_path.write_text(styles)

# Force installed PWAs onto the new travel layout shell after user accepts Refresh.
sw_path = Path('service-worker.js')
sw = sw_path.read_text()
old_cache = '`momo-runtime-shell-v${APP_VERSION}-save-action-r1`'
new_cache = '`momo-runtime-shell-v${APP_VERSION}-trip-ux-r1`'
if new_cache not in sw:
    if old_cache not in sw:
        raise SystemExit('Expected current cache key not found')
    sw = sw.replace(old_cache, new_cache, 1)
sw_path.write_text(sw)
