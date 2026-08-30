from pathlib import Path

styles_path = Path("styles.css")
styles = styles_path.read_text()

old = '''.screen[data-screen="add"] .expense-form-actions {
  min-height: 34px;
  padding: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.screen[data-screen="add"] .expense-form-actions > .primary-btn {
  display: none;
}

.screen[data-screen="add"] .favorite-save-btn {
  width: auto;
  min-height: 32px;
  padding: 6px 11px;
  border-radius: 11px;
  font-size: 9px;
}
'''

new = '''.screen[data-screen="add"] .expense-form-actions {
  min-height: 40px;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.screen[data-screen="add"] .expense-form-actions > .primary-btn {
  width: 100%;
  min-height: 38px;
  padding: 7px 14px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  white-space: nowrap;
}

.screen[data-screen="add"] .favorite-save-btn {
  width: auto;
  min-height: 38px;
  padding: 7px 11px;
  border-radius: 11px;
  font-size: 9px;
  white-space: nowrap;
}
'''

if old not in styles:
    raise SystemExit("Expected compact Add Expense action CSS was not found; refusing an unsafe patch.")
styles_path.write_text(styles.replace(old, new, 1))

sw_path = Path("service-worker.js")
sw = sw_path.read_text()
old_cache = '`momo-runtime-shell-v${APP_VERSION}`'
new_cache = '`momo-runtime-shell-v${APP_VERSION}-save-action-r1`'
if old_cache not in sw:
    raise SystemExit("Expected service-worker cache key was not found; refusing an unsafe patch.")
sw_path.write_text(sw.replace(old_cache, new_cache, 1))
