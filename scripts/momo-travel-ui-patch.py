from pathlib import Path
import re

# -----------------------------
# index.html — compact-by-default converter controls
# -----------------------------
index_path = Path('index.html')
html = index_path.read_text()

html = html.replace(
    'id="inlineConverter"\n          class="card inline-converter"',
    'id="inlineConverter"\n          class="card inline-converter travel-quick-converter"',
    1
)

old_label = '''            <span class="converter-live-label">\n              Two-way\n            </span>'''
new_label = '''            <button\n              id="toggleTravelConverter"\n              class="converter-live-label converter-expand-btn"\n              type="button"\n              aria-expanded="false"\n            >\n              Full\n            </button>'''
if old_label in html:
    html = html.replace(old_label, new_label, 1)
elif 'id="toggleTravelConverter"' not in html:
    raise SystemExit('Converter live label anchor not found')

section_start = html.find('id="inlineConverter"')
section_end = html.find('</section>', section_start)
if section_start < 0 or section_end < 0:
    raise SystemExit('inlineConverter section not found')
section = html[section_start:section_end]
if 'converter-side-a' not in section:
    section = section.replace(
        'class="calculator-currency-block"',
        'class="calculator-currency-block converter-side-a"',
        1
    )
if 'converter-side-b' not in section:
    section = section.replace(
        'class="calculator-currency-block"',
        'class="calculator-currency-block converter-side-b"',
        1
    )
html = html[:section_start] + section + html[section_end:]
index_path.write_text(html)

# -----------------------------
# app.js — put Add Expense first + converter expand/collapse behavior
# -----------------------------
app_path = Path('app.js')
app = app_path.read_text()

card_start = app.find('function createTripCardHTML(')
card_end = app.find('// ========================================\n// RENDER TRIPS', card_start)
if card_start < 0 or card_end < 0:
    raise SystemExit('createTripCardHTML block not found')
card = app[card_start:card_end]

dash_start = card.find('        <button\n          class="trip-dashboard-open"')
quick_start = card.find('        <button\n          class="trip-quick-expense-btn"')
if dash_start < 0 or quick_start < 0:
    raise SystemExit('Trip action buttons not found')
if dash_start < quick_start:
    dash_end = card.find('        </button>', dash_start)
    quick_end = card.find('        </button>', quick_start)
    if dash_end < 0 or quick_end < 0:
        raise SystemExit('Trip action button closing tag not found')
    dash_end += len('        </button>')
    quick_end += len('        </button>')
    dash_block = card[dash_start:dash_end]
    between = card[dash_end:quick_start]
    quick_block = card[quick_start:quick_end]
    card = card[:dash_start] + quick_block + between + dash_block + card[quick_end:]
    app = app[:card_start] + card + app[card_end:]

if 'function setTravelConverterExpanded(' not in app:
    app += '''\n\n\n// ========================================\n// COMPACT TRAVEL CONVERTER\n// Trips defaults to a quick two-way converter; full calculator stays one tap away.\n// ========================================\n\nconst travelInlineConverter =\n  document.getElementById(\n    "inlineConverter"\n  );\n\nconst toggleTravelConverter =\n  document.getElementById(\n    "toggleTravelConverter"\n  );\n\nfunction setTravelConverterExpanded(\n  expanded\n) {\n\n  if (!travelInlineConverter) {\n    return;\n  }\n\n  const next =\n    Boolean(\n      expanded\n    );\n\n  travelInlineConverter.classList.toggle(\n    "is-expanded",\n    next\n  );\n\n  if (toggleTravelConverter) {\n    toggleTravelConverter.setAttribute(\n      "aria-expanded",\n      String(next)\n    );\n\n    toggleTravelConverter.textContent =\n      next\n        ? "Compact"\n        : "Full";\n  }\n}\n\ntoggleTravelConverter?.addEventListener(\n  "click",\n  () => {\n    setTravelConverterExpanded(\n      !travelInlineConverter?.classList.contains(\n        "is-expanded"\n      )\n    );\n  }\n);\n\n// The dedicated Converter shortcut should still open the full calculator.\ndocument\n  .querySelectorAll(\n    "[data-focus-converter]"\n  )\n  .forEach(\n    (button) => {\n      button.addEventListener(\n        "click",\n        () => {\n          setTimeout(\n            () =>\n              setTravelConverterExpanded(\n                true\n              ),\n            0\n          );\n        }\n      );\n    }\n  );\n'''

app_path.write_text(app)

# -----------------------------
# styles.css — compact first-screen travel UX + aesthetic trip money stats
# -----------------------------
styles_path = Path('styles.css')
styles = styles_path.read_text()
marker = '/* MOMO TRAVEL MODE COMPACT FIRST SCREEN */'
if marker not in styles:
    styles += r'''\n\n/* MOMO TRAVEL MODE COMPACT FIRST SCREEN */\n\n.screen[data-screen="trips"] > .page-heading {\n  margin-bottom: 10px;\n}\n\n.screen[data-screen="trips"] #inlineConverter {\n  margin-bottom: 12px;\n}\n\n.converter-expand-btn {\n  border: 0;\n  min-height: 28px;\n  cursor: pointer;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) {\n  padding: 11px;\n  border-radius: 20px;\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) 36px minmax(0, 1fr);\n  grid-template-areas:\n    "heading heading heading"\n    "side-a swap side-b"\n    "rate rate rate";\n  gap: 7px;\n  align-items: center;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-heading {\n  grid-area: heading;\n  align-items: center;\n  margin: 0;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-heading .section-kicker {\n  display: none;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-heading h2 {\n  margin: 0;\n  font-size: 16px;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-help {\n  display: none;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-side-a {\n  grid-area: side-a;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-side-b {\n  grid-area: side-b;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .calculator-currency-block {\n  min-width: 0;\n  padding: 7px 8px;\n  border-radius: 14px;\n  background: rgba(255, 253, 252, 0.96);\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .calculator-currency-top {\n  display: block;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .currency-selector {\n  width: 100%;\n  min-height: 29px;\n  padding: 0 6px;\n  border-radius: 10px;\n  font-size: 9px;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-clear-btn,\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .calculator-total-row,\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .calculator-operator-bar {\n  display: none;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .calculator-input-row {\n  grid-template-columns: auto minmax(0, 1fr);\n  gap: 3px;\n  margin-top: 5px;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .currency-symbol {\n  font-size: 16px;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .calculator-expression-input {\n  font-size: 16px;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-swap-row {\n  grid-area: swap;\n  display: grid;\n  grid-template-columns: 1fr;\n  margin: 0;\n  gap: 0;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-swap-row > span {\n  display: none;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-swap-button {\n  width: 34px;\n  height: 34px;\n  font-size: 15px;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-rate {\n  grid-area: rate;\n  margin: 0;\n  padding: 5px 8px;\n  border-radius: 11px;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  gap: 5px;\n}\n\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-rate span,\n.screen[data-screen="trips"] #inlineConverter:not(.is-expanded) .converter-rate small {\n  display: inline;\n  margin: 0;\n  font-size: 8px;\n}\n\n.screen[data-screen="trips"] .trip-entry-card {\n  margin-bottom: 14px;\n  border: 1px solid var(--border);\n  border-radius: 22px;\n  overflow: hidden;\n  background: rgba(255, 255, 255, 0.92);\n  box-shadow: var(--shadow);\n}\n\n.screen[data-screen="trips"] .trip-entry-banner {\n  padding: 10px 12px 11px;\n  background:\n    radial-gradient(circle at 92% 8%, rgba(243, 169, 178, 0.18), transparent 34%),\n    linear-gradient(135deg, #fff8f6, #fff0f1);\n  color: var(--text);\n}\n\n.screen[data-screen="trips"] .trip-entry-top {\n  min-height: 28px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.screen[data-screen="trips"] .trip-status-pill {\n  display: inline-flex;\n  align-items: center;\n  min-height: 25px;\n  padding: 0 9px;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.78);\n  border: 1px solid var(--border);\n  color: var(--rose);\n  font-size: 9px;\n  font-weight: 700;\n}\n\n.screen[data-screen="trips"] .trip-entry-actions {\n  display: flex;\n  gap: 5px;\n}\n\n.screen[data-screen="trips"] .trip-banner-btn {\n  width: 30px;\n  height: 30px;\n  border: 1px solid rgba(241, 217, 213, 0.82);\n  border-radius: 10px;\n  display: grid;\n  place-items: center;\n  background: rgba(255, 255, 255, 0.72);\n  color: var(--text-soft);\n  font-size: 13px;\n}\n\n.screen[data-screen="trips"] .trip-entry-copy {\n  margin-top: 5px;\n}\n\n.screen[data-screen="trips"] .trip-entry-copy .eyebrow.light {\n  color: var(--rose);\n}\n\n.screen[data-screen="trips"] .trip-entry-copy h2 {\n  margin: 3px 0 3px;\n  font-family: Georgia, serif;\n  font-size: 20px;\n  line-height: 1.08;\n  letter-spacing: -0.35px;\n}\n\n.screen[data-screen="trips"] .trip-entry-copy > p:last-child {\n  margin: 0;\n  color: var(--text-soft);\n  font-size: 10px;\n}\n\n.screen[data-screen="trips"] .trip-entry-body {\n  padding: 10px 12px 12px;\n}\n\n.screen[data-screen="trips"] .trip-quick-expense-btn {\n  min-height: 52px;\n  margin: 0 0 8px;\n  padding: 7px 10px;\n  border-radius: 16px;\n  grid-template-columns: 36px minmax(0, 1fr) auto;\n  gap: 9px;\n}\n\n.screen[data-screen="trips"] .trip-quick-expense-icon {\n  width: 36px;\n  height: 36px;\n  border-radius: 12px;\n  font-size: 22px;\n}\n\n.screen[data-screen="trips"] .trip-quick-expense-copy strong {\n  font-size: 11px;\n}\n\n.screen[data-screen="trips"] .trip-quick-expense-copy small {\n  margin-top: 2px;\n  font-size: 8px;\n}\n\n.screen[data-screen="trips"] .trip-dashboard-open {\n  width: 100%;\n  min-height: 38px;\n  padding: 7px 10px;\n  border: 1px solid var(--border);\n  border-radius: 13px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  background: rgba(255, 249, 247, 0.74);\n  color: var(--rose);\n  font-size: 9px;\n  font-weight: 700;\n}\n\n.screen[data-screen="trips"] .trip-info-row {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 7px;\n  margin-top: 10px;\n}\n\n.screen[data-screen="trips"] .trip-info-cell {\n  min-width: 0;\n  padding: 9px 8px;\n  border: 1px solid rgba(241, 217, 213, 0.88);\n  border-radius: 14px;\n  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,246,244,0.9));\n}\n\n.screen[data-screen="trips"] .trip-info-cell:nth-child(3) {\n  background: linear-gradient(180deg, rgba(250,255,251,0.98), rgba(239,249,242,0.92));\n  border-color: rgba(121, 169, 133, 0.24);\n}\n\n.screen[data-screen="trips"] .trip-info-cell span {\n  display: block;\n  margin-bottom: 3px;\n  color: var(--text-soft);\n  font-size: 8px;\n  font-weight: 650;\n  text-transform: uppercase;\n  letter-spacing: 0.04em;\n}\n\n.screen[data-screen="trips"] .trip-info-cell strong {\n  display: block;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 11px;\n  letter-spacing: -0.15px;\n}\n\n.screen[data-screen="trips"] .trip-entry-body > .progress-track {\n  height: 6px;\n  margin-top: 9px;\n}\n\n.screen[data-screen="trips"] .trip-daily-row {\n  margin-top: 8px;\n  padding: 7px 9px;\n  border-radius: 12px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  background: var(--blush);\n  color: var(--text-soft);\n  font-size: 9px;\n}\n\n.screen[data-screen="trips"] .trip-daily-row strong {\n  color: var(--text);\n}\n\n.screen[data-screen="trips"] .trip-notes-preview {\n  margin: 8px 2px 0;\n  color: var(--text-soft);\n  font-size: 9px;\n}\n\n@media (max-width: 520px) {\n  .screen[data-screen="trips"] {\n    padding-top: 14px;\n  }\n\n  .screen[data-screen="trips"] > .page-heading .page-description {\n    display: none;\n  }\n\n  .screen[data-screen="trips"] > .page-heading h1 {\n    font-size: 30px;\n  }\n}\n'''
styles_path.write_text(styles)

# -----------------------------
# service-worker.js — coherent PWA shell refresh
# -----------------------------
sw_path = Path('service-worker.js')
sw = sw_path.read_text()
old = '`momo-runtime-shell-v${APP_VERSION}-trip-ux-r1`'
new = '`momo-runtime-shell-v${APP_VERSION}-travel-compact-r1`'
if new not in sw:
    if old not in sw:
        raise SystemExit('Expected current PWA cache key not found')
    sw = sw.replace(old, new, 1)
sw_path.write_text(sw)
