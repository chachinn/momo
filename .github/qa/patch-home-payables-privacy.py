from pathlib import Path


def replace_once(path, old, new):
    text = Path(path).read_text()
    if old not in text:
        raise SystemExit(f'missing expected snippet in {path}: {old[:120]!r}')
    text = text.replace(old, new, 1)
    Path(path).write_text(text)

# index.html: mark the Home payable area and add a Customize Home privacy toggle.
replace_once(
    'index.html',
    '<div class="momo-today-payables-heading">',
    '<div class="momo-today-payables-heading" data-home-payables>'
)
replace_once(
    'index.html',
    '<div id="momoActivePayables" class="momo-today-payables"></div>',
    '<div id="momoActivePayables" class="momo-today-payables" data-home-payables></div>'
)
replace_once(
    'index.html',
    '        <section class="momo-tool-card">\n          <div class="momo-tool-heading"><div><p class="section-kicker">CARD DENSITY</p><h2>How roomy should Home feel?</h2></div></div>\n          <div id="momoHomeDensity" class="momo-density-choice"><button type="button" data-momo-density="cozy">Cozy</button><button type="button" data-momo-density="compact">Compact</button></div>\n        </section>\n        <section class="momo-tool-card"><div class="momo-tool-heading"><div><p class="section-kicker">HOME CARDS</p><h2>Show, hide & reorder</h2></div></div><div id="momoHomeModuleList" class="momo-home-module-list"></div></section>',
    '        <section class="momo-tool-card">\n          <div class="momo-tool-heading"><div><p class="section-kicker">CARD DENSITY</p><h2>How roomy should Home feel?</h2></div></div>\n          <div id="momoHomeDensity" class="momo-density-choice"><button type="button" data-momo-density="cozy">Cozy</button><button type="button" data-momo-density="compact">Compact</button></div>\n        </section>\n        <section class="momo-tool-card">\n          <div class="momo-tool-heading"><div><p class="section-kicker">HOME PRIVACY</p><h2>What can Home reveal?</h2></div></div>\n          <div class="momo-home-module-list">\n            <article class="momo-home-module-row">\n              <label>\n                <input type="checkbox" data-momo-home-payables-visible>\n                <span><strong>Show Payables on Home</strong><small>Show payable balances, payoff insights, and active payable cards on Home.</small></span>\n              </label>\n            </article>\n          </div>\n          <p class="page-description">Off by default for privacy. Your Payables screen and calculations still work normally.</p>\n        </section>\n        <section class="momo-tool-card"><div class="momo-tool-heading"><div><p class="section-kicker">HOME CARDS</p><h2>Show, hide & reorder</h2></div></div><div id="momoHomeModuleList" class="momo-home-module-list"></div></section>'
)

# app.js: make the privacy setting part of Customize Home, defaulting OFF.
replace_once(
    'app.js',
    'let momoHomeLayout = { order: [...MOMO_HOME_DEFAULT_ORDER], hidden: [], density: "cozy" };',
    'let momoHomeLayout = { order: [...MOMO_HOME_DEFAULT_ORDER], hidden: [], density: "cozy", showPayablesOnHome: false };'
)
replace_once(
    'app.js',
    '    momoHomeLayout = { order: [...order, ...MOMO_HOME_DEFAULT_ORDER.filter((id) => !order.includes(id))], hidden: Array.isArray(setting.hidden) ? setting.hidden.filter((id) => MOMO_HOME_DEFAULT_ORDER.includes(id)) : [], density: setting.density === "compact" ? "compact" : "cozy" };',
    '    momoHomeLayout = { order: [...order, ...MOMO_HOME_DEFAULT_ORDER.filter((id) => !order.includes(id))], hidden: Array.isArray(setting.hidden) ? setting.hidden.filter((id) => MOMO_HOME_DEFAULT_ORDER.includes(id)) : [], density: setting.density === "compact" ? "compact" : "cozy", showPayablesOnHome: setting.showPayablesOnHome === true };'
)
replace_once(
    'app.js',
    '  home.querySelectorAll("[data-home-module]").forEach((element) => { element.hidden = momoHomeLayout.hidden.includes(element.dataset.homeModule); });\n  document.body.classList.toggle("momo-home-compact", momoHomeLayout.density === "compact");',
    '  home.querySelectorAll("[data-home-module]").forEach((element) => { element.hidden = momoHomeLayout.hidden.includes(element.dataset.homeModule); });\n  home.querySelectorAll("[data-home-payables]").forEach((element) => { element.hidden = momoHomeLayout.showPayablesOnHome !== true; });\n  document.body.classList.toggle("momo-home-compact", momoHomeLayout.density === "compact");'
)
replace_once(
    'app.js',
    '  document.querySelectorAll("[data-momo-density]").forEach((button) => button.classList.toggle("active", button.dataset.momoDensity === momoHomeLayout.density));\n}',
    '  document.querySelectorAll("[data-momo-density]").forEach((button) => button.classList.toggle("active", button.dataset.momoDensity === momoHomeLayout.density));\n  document.querySelectorAll("[data-momo-home-payables-visible]").forEach((input) => { input.checked = momoHomeLayout.showPayablesOnHome === true; });\n}'
)
replace_once(
    'app.js',
    '  const visible = event.target.closest("[data-momo-home-visible]");',
    '  const payablesVisible = event.target.closest("[data-momo-home-payables-visible]");\n  if (payablesVisible) {\n    momoHomeLayout.showPayablesOnHome = Boolean(payablesVisible.checked);\n    await saveMomoHomeLayout(); applyMomoHomeLayout(); renderMomoHomeCustomizer();\n    document.dispatchEvent(new CustomEvent("momo-data-changed"));\n    showToast(momoHomeLayout.showPayablesOnHome ? "Payables will show on Home." : "Payables are hidden from Home.");\n    return;\n  }\n  const visible = event.target.closest("[data-momo-home-visible]");'
)

# smart-money.js: suppress explicit debt/payable insight unless the user opts in.
replace_once(
    'smart-money.js',
    '    if (debt && debt.count > 0) {',
    '    const homeLayout = snapshot.settingMap.get("momo_home_layout_v1");\n    const showPayablesOnHome = Boolean(homeLayout && homeLayout.showPayablesOnHome === true);\n\n    if (showPayablesOnHome && debt && debt.count > 0) {'
)

# Force installed PWAs to pick up the privacy change.
replace_once(
    'service-worker.js',
    '`momo-runtime-shell-v${APP_VERSION}-shared-trip-r3`',
    '`momo-runtime-shell-v${APP_VERSION}-shared-trip-r4`'
)
