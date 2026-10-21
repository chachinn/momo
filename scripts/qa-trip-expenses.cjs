/**
 * Momo trip-expense regression QA.
 * Uses a fresh browser profile and synthetic IndexedDB only.
 * Never connects to a user's account or modifies production records.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = process.cwd();
const mime = { ".js":"application/javascript", ".html":"text/html", ".css":"text/css", ".json":"application/json" };
const server = http.createServer((req, res) => {
  const route = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const file = path.resolve(root, "." + route);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end("Not found"); return;
  }
  res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});

let browser;
(async () => {
  await new Promise(resolve => server.listen(8765, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless:true, args:["--no-sandbox"] });
  const page = await browser.newPage({ viewport:{width:390,height:844} });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem("momo_welcome_tour_complete_v1","yes"));
  await page.goto("http://127.0.0.1:8765/", {waitUntil:"domcontentloaded"});
  await page.waitForFunction(() => Boolean(window.MomoLocalTripShare && window.MomoTripSharing &&
    typeof getAllMomoStoreSnapshots === "function"), null, {timeout:30000});

  const seed = await page.evaluate(async () => {
    document.getElementById("contextTipModal")?.remove();
    document.getElementById("welcomeTour")?.remove();
    document.querySelectorAll(".tutorial-overlay,.tutorial-backdrop").forEach(node=>node.remove());
    const trip = {
      id:"qa-trip",name:"Synthetic Japan Trip",destination:"Tokyo",
      startDate:"2026-10-18",endDate:"2026-10-26",budget:10000,currency:"JPY",
      dailyBudget:1000,sharedTripCode:"qa-share",sharedTripToken:"qa-token",
      sharedTripOwnerUid:"qa-owner",sharedTripRole:"owner",sharedTripStatus:"active"
    };
    const base = {
      type:"expense",tripId:"qa-trip",date:"2026-10-21",currency:"JPY",
      category:"Shopping",paymentMethod:"Cash",sharedTripExpense:true,
      sharedTripCode:"qa-share",sharedTripToken:"qa-token",
      sharedTripOwnerUid:"qa-owner",sharedTripRole:"owner",
      sharedCreatedByUid:"qa-owner",sharedUpdatedAtMs:100,
      createdAt:"2026-10-21T00:00:00.000Z",updatedAt:"2026-10-21T00:00:00.000Z"
    };
    const rows = [
      {...base,id:"qa-original",sharedExpenseId:"share-original",title:"Actual meal",amount:500},
      {...base,id:"qa-historical-copy",sharedExpenseId:"share-original",title:"Legacy separate record",amount:600},
      {...base,id:"qa-local-other",sharedExpenseId:"share-other",title:"Transport",amount:150}
    ];
    const database = await new Promise((resolve, reject) => {
      const request=indexedDB.open("momo_database",4);
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    const tx=database.transaction(["expenses","trips","budgets","cards","settings"],"readwrite");
    tx.objectStore("trips").put(trip);
    rows.forEach(row=>tx.objectStore("expenses").put(row));
    tx.objectStore("budgets").put({id:"qa-budget",name:"Unrelated budget",period:"monthly",amount:2000});
    tx.objectStore("cards").put({id:"qa-payable",name:"Do not touch payable",amount:987});
    tx.objectStore("settings").put({key:"qa-marker",value:"sentinel-settings"});
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
    database.close();
    await loadAppData();
    const snapshot=await getAllMomoStoreSnapshots();
    window.qaSeedSnapshot=snapshot;
    window.qaUploads=[];
    window.MomoTripCloud={
      getUser:()=>({uid:"qa-owner",displayName:"QA user"}),
      watchInvite:()=>()=>{},
      watchExpenses:(_,handler)=>{window.qaCloudCallback=handler;return()=>{}},
      upsertExpense:async (code, payload)=>{window.qaUploads.push({code, payload});return true;},
      tombstoneExpense:async()=>true,
      updateTripMeta:async()=>true
    };
    window.MomoTripSharing.watchAllSharedTrips();
    return {rows:snapshot.expenses.length,tripId:trip.id};
  });
  assert.equal(seed.rows,3,"QA fixture must have three real IndexedDB expenses");
  assert.equal(await page.evaluate(()=>typeof window.qaCloudCallback),"function");

  // Incoming cloud edits, deletions, rapid snapshots, and fresh partner expense.
  await page.evaluate(() => {
    window.qaDocs=[
      {expenseId:"share-original",updatedAtMs:9999999999,updatedAt:"2026-10-21T01:00:00Z",
       expense:{title:"Cloud must NOT overwrite",amount:9999,currency:"JPY",date:"2026-10-21"}},
      {expenseId:"share-other",deleted:true,updatedAtMs:9999999999},
      {expenseId:"share-remote",updatedAtMs:500,updatedAt:"2026-10-21T01:00:00Z",
       createdByUid:"partner",createdByName:"QA partner",
       expense:{title:"Partner purchase",amount:250,currency:"JPY",date:"2026-10-21",category:"Shopping"}}
    ];
    window.qaCloudCallback({docs:window.qaDocs});
    window.qaCloudCallback({docs:window.qaDocs});
    window.qaCloudCallback({docs:window.qaDocs});
  });
  await page.waitForFunction(async () => (await window.MomoLocalTripShare.getStoredExpenses())
    .some(x=>x.sharedExpenseId==="share-remote"), null, {timeout:15000});
  await page.waitForTimeout(150);
  let details=await page.evaluate(async () => {
    const saved=await window.MomoLocalTripShare.getStoredExpenses();
    const orig=saved.find(x=>x.id==="qa-original");
    return {count:saved.length,originalTitle:orig.title,originalAmount:orig.amount,
      deletedStillPresent:saved.some(x=>x.id==="qa-local-other"),
      imported:saved.filter(x=>x.sharedExpenseId==="share-remote").length,
      legacy:saved.filter(x=>x.sharedExpenseId==="share-original").length};
  });
  assert.deepEqual(details,{count:4,originalTitle:"Actual meal",originalAmount:500,
    deletedStillPresent:true,imported:1,legacy:2},
    "Rapid cloud updates may not overwrite, delete, or duplicate any local records");

  await page.evaluate(() => {showScreen("trips");renderTrips();});
  await page.locator(".trip-entry-card").filter({hasText:"Synthetic Japan Trip"})
    .locator(".trip-dashboard-open").click();
  const dashboard=page.locator("#tripDashboardModal");
  assert.match(await dashboard.innerText(),/All logged · 4 expenses/i);
  assert.match(await dashboard.innerText(),/Actual meal/);
  assert.match(await dashboard.innerText(),/Legacy separate record/);
  assert.match(await dashboard.innerText(),/Partner purchase/);
  assert.match(await dashboard.innerText(),/Review 1 possible synced copy/);
  assert.equal(await dashboard.locator(".trip-dashboard-expense-list").first().locator(".transaction-swipe-shell").count(),4);
  // Preserve an open dashboard's position and update its totals after a new cloud addition.
  await page.evaluate(() => {
    window.qaCloudCallback({docs:[...window.qaDocs,{
      expenseId:"share-second",updatedAtMs:600,
      expense:{title:"New while dashboard open",amount:100,currency:"JPY",date:"2026-10-21",category:"Travel"}
    }]});
  });
  await page.waitForFunction(() => document.querySelector("#tripDashboardBody")?.textContent.includes("New while dashboard open"), null,{timeout:15000});
  assert.match(await dashboard.innerText(),/All logged · 5 expenses/i);
  const spent=await page.evaluate(()=>getTripSpent(trips.find(t=>t.id==="qa-trip")));
  assert.equal(spent,1600,"Dashboard metrics count all five existing saved records");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,
    "Trip Dashboard should not overflow a 390px-wide mobile screen");

  // A quick double tap in the actual expense form must only write one record.
  await page.evaluate(()=>{closeTripDashboard();showScreen("add");});
  await page.locator("#expenseTitle").fill("Double tap test");
  await page.locator("#amount").fill("300");
  await page.locator("#currency").selectOption("JPY");
  await page.locator("#expenseTrip").selectOption("qa-trip");
  await page.locator("#expenseDate").fill("2026-10-21");
  await page.evaluate(()=>{
    const form=document.getElementById("expenseForm");
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.waitForFunction(async () =>
    (await window.MomoLocalTripShare.getStoredExpenses()).some(x=>x.title==="Double tap test"),null,{timeout:15000});
  await page.waitForTimeout(200);
  const added=await page.evaluate(async ()=>(await window.MomoLocalTripShare.getStoredExpenses())
    .filter(x=>x.title==="Double tap test"));
  assert.equal(added.length,1,"Multiple save taps should produce one record");

  // Test queuing a second offline expense while an earlier queued upload is in flight.
  await page.evaluate(async () => {
    localStorage.setItem("momo_shared_trip_outbox_v1",JSON.stringify([{
      key:"expense:qa-share:share-original",kind:"expense",code:"qa-share",
      expenseId:"share-original",queuedAt:111,revision:"old"
    }]));
    window.qaUploadBlocked=true;
    window.MomoTripCloud.upsertExpense=(code,payload)=>{
      if(window.qaUploadBlocked){
        window.qaUploadBlocked=false;
        return new Promise(resolve=>{window.qaResolveUpload=resolve;});
      }
      throw new Error("Simulated offline upload");
    };
    window.qaFlushPending=window.MomoTripSharing.flushOutbox();
  });
  await page.waitForFunction(()=>typeof window.qaResolveUpload==="function",null,{timeout:15000});
  await page.evaluate(async()=>{
    const expense=(await window.MomoLocalTripShare.getStoredExpenses())
      .find(x=>x.sharedExpenseId==="share-remote");
    await window.MomoTripSharing.onExpenseSaved(expense,null);
    window.qaResolveUpload(true);
    await window.qaFlushPending;
  });
  const queue=await page.evaluate(()=>JSON.parse(localStorage.getItem("momo_shared_trip_outbox_v1")||"[]"));
  assert.equal(queue.length,1,"New queued upload must survive an in-flight flush");
  assert.equal(queue[0].expenseId,"share-remote");

  // Read-only backup must include ALL saved records, including legacy duplicates.
  const after=await page.evaluate(async()=>{
    const snapshots=await getAllMomoStoreSnapshots();
    const backup=await buildMomoBackup();
    return {
      expenseCount:snapshots.expenses.length,backupExpenseCount:backup.storeSnapshots.expenses.length,
      originalIds:snapshots.expenses.map(x=>x.id),
      tripCount:snapshots.trips.length,card:snapshots.cards.find(x=>x.id==="qa-payable")?.name,
      budget:snapshots.budgets.find(x=>x.id==="qa-budget")?.amount,
      marker:snapshots.settings.find(x=>x.key==="qa-marker")?.value,
      dbVersion:backup.databaseVersion
    };
  });
  assert.equal(after.expenseCount,6);
  assert.equal(after.backupExpenseCount,6);
  for(const id of ["qa-original","qa-historical-copy","qa-local-other"])
    assert.ok(after.originalIds.includes(id),"Original expense missing: "+id);
  assert.deepEqual({trips:after.tripCount,card:after.card,budget:after.budget,
    marker:after.marker,dbVersion:after.dbVersion},
    {trips:1,card:"Do not touch payable",budget:2000,marker:"sentinel-settings",dbVersion:4});
  assert.equal(errors.filter(x=>!/Firebase|network|fetch|Authentication/i.test(x)).length,0,
    "Unexpected browser JavaScript errors: "+errors.join(" | "));
  console.log("PASS: 6/6 IndexedDB expenses intact, no automatic deletes or overwrites, 3 rapid sync snapshots idempotent, open dashboard refresh, legacy duplicate audit, one double-tap save, concurrent outbox safe, all backup/payable/budget/settings preserved, 390x844.");
})().catch(err=>{console.error(err);process.exitCode=1}).finally(async()=>{
  try{await browser?.close()}catch{} server.close();
});