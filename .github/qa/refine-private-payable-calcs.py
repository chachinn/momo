from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing expected snippet in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "app.js",
    '''  const monthSchedule = buildScheduledCashFlow(today, monthEnd, { includePayables });
  const sevenDaySchedule = buildScheduledCashFlow(today, sevenDayEnd, { includePayables });
  const cushion = baseAmount > 0
    ? baseAmount - spent - saved - protectedSavingsRemaining - monthSchedule.totalPHP
    : null;''',
    '''  const monthSchedule = buildScheduledCashFlow(today, monthEnd, { includePayables });
  const sevenDaySchedule = buildScheduledCashFlow(today, sevenDayEnd, { includePayables });
  const financialMonthSchedule = includePayables
    ? monthSchedule
    : buildScheduledCashFlow(today, monthEnd, { includePayables: true });
  const cushion = baseAmount > 0
    ? baseAmount - spent - saved - protectedSavingsRemaining - financialMonthSchedule.totalPHP
    : null;'''
)

replace_once(
    "app.js",
    '''    protectedSavingsRemaining,
    projectedCommitments: monthSchedule.totalPHP,
    dueNext7Days: sevenDaySchedule.totalPHP,
    cushion,''',
    '''    protectedSavingsRemaining,
    projectedCommitments: monthSchedule.totalPHP,
    dueNext7Days: sevenDaySchedule.totalPHP,
    protectedCommitments: financialMonthSchedule.totalPHP,
    cushion,'''
)

replace_once(
    "app.js",
    '''    } else {
      explanation.textContent =
        `Based on your ${snapshot.baseLabel}, minus ${formatPHP(snapshot.spent)} already spent, ${formatPHP(snapshot.saved)} saved this month, ${formatPHP(snapshot.protectedSavingsRemaining)} still protected for Peach Jars, and ${formatPHP(snapshot.projectedCommitments)} in known upcoming commitments. ${snapshot.daysRemaining} day${snapshot.daysRemaining === 1 ? "" : "s"} remain this month.`;
    }''',
    '''    } else if (showPayablesOnHome) {
      explanation.textContent =
        `Based on your ${snapshot.baseLabel}, minus ${formatPHP(snapshot.spent)} already spent, ${formatPHP(snapshot.saved)} saved this month, ${formatPHP(snapshot.protectedSavingsRemaining)} still protected for Peach Jars, and ${formatPHP(snapshot.projectedCommitments)} in known upcoming commitments. ${snapshot.daysRemaining} day${snapshot.daysRemaining === 1 ? "" : "s"} remain this month.`;
    } else {
      explanation.textContent =
        `Based on your ${snapshot.baseLabel}, spending, savings, and known upcoming commitments. Payable amounts stay private on Home but are still protected in Safe to Spend. ${snapshot.daysRemaining} day${snapshot.daysRemaining === 1 ? "" : "s"} remain this month.`;
    }'''
)

# Smart Money keeps payable commitments in calculations, but filters explicit Home disclosures.
replace_once(
    "smart-money.js",
    '''    if (payablesVisibleOnHome(snapshot)) {
      snapshot.cards.forEach((item) => {
        const due = parseDate(item?.dueDate || item?.nextDueDate || item?.paymentDueDate);
        if (!due || due < startOfDay(now) || due > end) return;
        const amount = toPHP(item?.regularPayment || item?.minimumDue || item?.minimumPayment || item?.dueAmount || item?.paymentAmount || 0, item?.currency || "PHP");
        if (amount <= 0) return;
        items.push({ type: "Payable", name: text(item?.name || item?.title || "Payable"), amount, date: due });
      });
    }''',
    '''    snapshot.cards.forEach((item) => {
      const due = parseDate(item?.dueDate || item?.nextDueDate || item?.paymentDueDate);
      if (!due || due < startOfDay(now) || due > end) return;
      const amount = toPHP(item?.regularPayment || item?.minimumDue || item?.minimumPayment || item?.dueAmount || item?.paymentAmount || 0, item?.currency || "PHP");
      if (amount <= 0) return;
      items.push({ type: "Payable", name: text(item?.name || item?.title || "Payable"), amount, date: due });
    });'''
)

replace_once(
    "smart-money.js",
    '''    const debt = debtSuggestion(snapshot);

    const insights = [];

    if (safe.base > 0) {
      insights.push({
        icon: "🍑",
        tone: "good",
        title: `About ${money(safe.today)} is flexible today`,
        body: `${money(safe.flexible)} remains after Momo protects upcoming commitments${safe.protectedAmount > 0 ? ` (${money(safe.protectedAmount)})` : ""}.`
      });
    }''',
    '''    const debt = debtSuggestion(snapshot);
    const showPayablesOnHome = payablesVisibleOnHome(snapshot);

    const insights = [];

    if (safe.base > 0) {
      insights.push({
        icon: "🍑",
        tone: "good",
        title: `About ${money(safe.today)} is flexible today`,
        body: showPayablesOnHome
          ? `${money(safe.flexible)} remains after Momo protects upcoming commitments${safe.protectedAmount > 0 ? ` (${money(safe.protectedAmount)})` : ""}.`
          : `${money(safe.flexible)} remains after Momo protects your upcoming commitments and savings. Payable amounts stay private on Home.`
      });
    }'''
)

replace_once(
    "smart-money.js",
    '''    if (upcoming.length) {
      const firstWeek = upcoming.filter((item) => daysBetween(now, item.date) <= 7);
      const pressure = firstWeek.reduce((sum, item) => sum + item.amount, 0);''',
    '''    const visibleUpcoming = showPayablesOnHome
      ? upcoming
      : upcoming.filter((item) => item.type !== "Payable");

    if (visibleUpcoming.length) {
      const firstWeek = visibleUpcoming.filter((item) => daysBetween(now, item.date) <= 7);
      const pressure = firstWeek.reduce((sum, item) => sum + item.amount, 0);'''
)

replace_once(
    "smart-money.js",
    '''    const homeLayout = snapshot.settingMap.get("momo_home_layout_v1");
    const showPayablesOnHome = Boolean(homeLayout && homeLayout.showPayablesOnHome === true);

    if (showPayablesOnHome && debt && debt.count > 0) {''',
    '''    if (showPayablesOnHome && debt && debt.count > 0) {'''
)

replace_once(
    "smart-money.js",
    '''    return { insights, safe, forecastData, upcoming, learnedMerchants: merchantLearning(snapshot) };''',
    '''    return { insights, safe, forecastData, upcoming, showPayablesOnHome, learnedMerchants: merchantLearning(snapshot) };'''
)

replace_once(
    "smart-money.js",
    '''  function updateExistingSafeToSpend(safe) {
    const amount = document.getElementById("momoSafeToday");
    const explanation = document.getElementById("momoSafeExplanation");
    if (!amount || !explanation || safe.base <= 0) return;
    amount.textContent = money(safe.today);
    explanation.textContent = `${money(safe.flexible)} flexible after protecting ${money(safe.protectedAmount)} in upcoming commitments and savings.`;
  }''',
    '''  function updateExistingSafeToSpend(safe, showPayablesOnHome) {
    const amount = document.getElementById("momoSafeToday");
    const explanation = document.getElementById("momoSafeExplanation");
    if (!amount || !explanation || safe.base <= 0) return;
    amount.textContent = money(safe.today);
    explanation.textContent = showPayablesOnHome
      ? `${money(safe.flexible)} flexible after protecting ${money(safe.protectedAmount)} in upcoming commitments and savings.`
      : `${money(safe.flexible)} flexible after protecting your upcoming commitments and savings. Payable amounts stay private on Home.`;
  }'''
)

replace_once(
    "smart-money.js",
    '''    updateExistingSafeToSpend(result.safe);''',
    '''    updateExistingSafeToSpend(result.safe, result.showPayablesOnHome);'''
)
