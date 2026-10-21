const assert = require("node:assert/strict");
const http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const { chromium } = require("playwright");
const root = process.cwd();
const types = {".js":"application/javascript",".html":"text/html",".css":"text/css",".json":"application/json"};
const server = http.createServer((req,res) => {
  const p = path.resolve(root,"." + (req.url.split("?")[0]==="/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0])));
  if (!p.startsWith(root+path.sep) || !fs.existsSync(p) || !fs.statSync(p).isFile()) {
    res.writeHead(404);res.end("Not found");return;
  }
  res.setHeader("Content-Type",types[path.extname(p)]||"application/octet-stream");
  fs.createReadStream(p).pipe(res);
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(8765,"127.0.0.1",resolve));
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  await page.addInitScript(()=>localStorage.setItem("momo_welcome_tour_complete_v1","yes"));
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.MomoLocalTripShare && !!window.MomoTripSharing
    && typeof openTripModal==="function", {timeout:20000});
  await page.evaluate(async()=>{
    document.getElementById("welcomeTour")?.remove();
    document.querySelectorAll(".tutorial-overlay,.tutorial-backdrop").forEach(x=>x.remove());
    const db = await new Promise((resolve,reject)=>{
      const r=indexedDB.open("momo_database",4);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    const tx=db.transaction("trips","readwrite");
    tx.objectStore("trips").put({
      id:"qa-trip",name:"Japan Shared Trip",destination:"Tokyo",
      startDate:"2026-10-18",endDate:"2026-10-26",currency:"JPY",budget:50000,
      dailyBudget:5000,sharedTripCode:"qa-share",sharedTripToken:"qa-token",
      sharedTripOwnerUid:"qa-owner",sharedTripRole:"owner",sharedTripStatus:"active"
    });
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
    db.close();
    await loadAppData();
    window.MomoTripCloud={
      getUser:()=>({uid:"qa-owner",displayName:"Test owner"}),
      watchInvite:()=>()=>{},
      watchExpenses:(_,callback)=>{window.qaRemoteCallback=callback;return()=>{}},
      upsertExpense:async (code,payload)=>{
        window.qaRemoteCallback?.({docs:[{...payload,updatedAtMs:payload.updatedAtMs}]});
      },
      tombstoneExpense:async()=>{},
      updateTripMeta:async()=>{}
    };
    window.MomoTripSharing.watchAllSharedTrips();
  });
  assert.equal(await page.evaluate(()=>typeof window.qaRemoteCallback),"function");
  const local = {
    id:"qa-local", type:"expense", title:"Noodles", amount:200,currency:"JPY",
    category:"Food", paymentMethod:"Cash", date:"2026-10-21", tripId:"qa-trip",
    sharedTripExpense:true,sharedTripCode:"qa-share",sharedTripToken:"qa-token",
    sharedTripOwnerUid:"qa-owner",sharedTripRole:"owner",
    sharedExpenseId:"qa-local",sharedUpdatedAtMs:100,updatedAt:"2026-10-21T00:00:00.000Z"
  };
  await page.evaluate(async (record)=>{
    // Mimic saving a new shared expense to IndexedDB before its UI array refreshes.
    await window.MomoLocalTripShare.upsertExpense(record,{refresh:false});
    window.qaRemoteCallback({docs:[{
      expenseId:"qa-local",updatedAtMs:100,updatedAt:record.updatedAt,
      createdByUid:"qa-owner",createdByName:"Test owner",
      expense:{title:"Noodles",amount:200,currency:"JPY",category:"Food",date:"2026-10-21"}
    }]});
  },local);
  await page.waitForTimeout(250);
  let raw=await page.evaluate(()=>window.MomoLocalTripShare.getStoredExpenses());
  assert.equal(raw.filter(x=>x.sharedExpenseId==="qa-local").length,1,
    "Cloud echo of just-saved local expense must not insert remote-prefixed duplicate");
  await page.evaluate(()=>{
    window.qaRemoteCallback({docs:[{
      expenseId:"qa-remote",updatedAtMs:110,updatedAt:"2026-10-21T00:01:00.000Z",
      createdByUid:"partner",createdByName:"Partner",
      expense:{title:"Sushi",amount:400,currency:"JPY",category:"Food",date:"2026-10-21"}
    }]});
  });
  await page.waitForTimeout(250);
  raw=await page.evaluate(()=>window.MomoLocalTripShare.getStoredExpenses());
  assert.equal(raw.filter(x=>x.sharedExpenseId==="qa-remote").length,1,
    "A different cloud expense should be imported exactly once");
  await page.evaluate(()=>{
    window.qaRemoteCallback({docs:[{
      expenseId:"qa-remote",updatedAtMs:110,updatedAt:"2026-10-21T00:01:00.000Z",
      createdByUid:"partner",createdByName:"Partner",
      expense:{title:"Sushi",amount:400,currency:"JPY",category:"Food",date:"2026-10-21"}
    }]});
  });
  await page.waitForTimeout(250);
  raw=await page.evaluate(()=>window.MomoLocalTripShare.getStoredExpenses());
  assert.equal(raw.length,2,"Repeated Firestore snapshot must not create new records");

  await page.evaluate(async (record)=>{
    // Simulate a historical duplicate. Never remove either stored record.
    await window.MomoLocalTripShare.upsertExpense({
      ...record,id:"shared-trip-qa-token-qa-local",sharedUpdatedAtMs:90
    },{refresh:false});
    await window.MomoLocalTripShare.upsertExpense({
      ...record,id:"qa-distinct",sharedExpenseId:"qa-distinct",amount:200,title:"Noodles",
      sharedUpdatedAtMs:115
    },{refresh:false});
    await loadAppData();
  },local);
  const counts=await page.evaluate(()=>{
    const trip=trips.find(x=>x.id==="qa-trip");
    return {visible:getTripExpenses(trip).length,total:getTripSpent(trip)};
  });
  assert.deepEqual(counts,{visible:3,total:800},
    "One shared cloud identity is counted once, but legitimate same-title expenses remain distinct");
  raw=await page.evaluate(()=>window.MomoLocalTripShare.getStoredExpenses());
  assert.equal(raw.length,4,"No historical records deleted by read-only collapse");

  await page.evaluate(()=>showScreen("add"));
  await page.locator("#expenseTitle").fill("Double tap protection");
  await page.locator("#amount").fill("1000");
  await page.locator("#currency").selectOption("JPY");
  await page.locator("#expenseTrip").selectOption("qa-trip");
  await page.locator("#expenseDate").fill("2026-10-21");
  await page.evaluate(()=>{
    const form=document.getElementById("expenseForm");
    form.requestSubmit();form.requestSubmit();
  });
  await page.waitForFunction(async()=>{
    const raw=await window.MomoLocalTripShare.getStoredExpenses();
    return raw.filter(x=>x.title==="Double tap protection").length>0;
  },null,{timeout:15000});
  await page.waitForTimeout(400);
  raw=await page.evaluate(()=>window.MomoLocalTripShare.getStoredExpenses());
  assert.equal(raw.filter(x=>x.title==="Double tap protection").length,1,
    "Two synchronous submits must save one expense");
  await page.evaluate(async()=>{await loadAppData();showScreen("trips");renderTrips();});
  await page.locator(".trip-entry-card").filter({hasText:"Japan Shared Trip"}).locator(".trip-dashboard-open").click();
  const section=page.locator(".trip-dashboard-section").filter({has:page.locator(".trip-dashboard-expense-list")});
  assert.equal(await section.locator(".transaction-swipe-shell").count(),4);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,
    "390x844 dashboard must have no horizontal overflow");
  assert.equal(errors.filter(x=>!/Firebase|network|fetch|Authentication/i.test(x)).length,0,
    "Unexpected JS errors: "+errors.join(" | "));
  console.log("PASS: IndexedDB cloud echo, repeat snapshots, read-only historical mirror collapse, legitimate same-title expenses, double submission lock, 390x844.");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{try{await browser?.close()}catch{}server.close()});