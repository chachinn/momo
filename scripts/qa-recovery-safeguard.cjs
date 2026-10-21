const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright");
const root=process.cwd(),mimes={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json"};
const server=http.createServer((req,res)=>{
  const p=path.resolve(root,"."+(req.url.split("?")[0]==="/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0])));
  if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);res.end("missing");return;}
  res.setHeader("Content-Type",mimes[path.extname(p)]||"application/octet-stream");
  fs.createReadStream(p).pipe(res);
});
let browser;
(async()=>{
 await new Promise(ok=>server.listen(8765,"127.0.0.1",ok));
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on("dialog",d=>d.accept());
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem("momo_welcome_tour_complete_v1","yes"));
 await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.MomoLocalTripShare&&!!window.MomoTripSharing,{timeout:20000});
 const before=await page.evaluate(async()=>{
  const trip={id:"qa-japan",name:"Japan QA Recovery",destination:"Tokyo",startDate:"2026-10-18",endDate:"2026-10-26",currency:"JPY",
    budget:10000,sharedTripCode:"qa-share",sharedTripToken:"qa-token",sharedTripOwnerUid:"qa-owner",sharedTripRole:"owner",sharedTripStatus:"active"};
  const local={id:"qa-meal",type:"expense",tripId:trip.id,title:"Original preserved meal",amount:600,currency:"JPY",
    category:"Food & Drinks",paymentMethod:"Cash",date:"2026-10-21",sharedTripExpense:true,
    sharedTripCode:trip.sharedTripCode,sharedTripToken:trip.sharedTripToken,sharedTripOwnerUid:trip.sharedTripOwnerUid,
    sharedExpenseId:"cloud-meal",sharedUpdatedAtMs:100};
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open("momo_database",4);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const tx=db.transaction(["trips","expenses"],"readwrite");
  tx.objectStore("trips").put(trip);tx.objectStore("expenses").put(local);
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  db.close();
  await loadAppData();
  window.qaUpload=[];
  window.MomoTripCloud={
   getUser:()=>({uid:"qa-owner",displayName:"QA owner"}),
   watchInvite:()=>()=>{},
   watchExpenses:(_,callback)=>{window.qaWatcher=callback;return()=>{}},
   upsertExpense:async (code,payload)=>{window.qaUpload.push({code,payload});return true;}
  };
  window.MomoTripSharing.watchAllSharedTrips();
  return (await window.MomoLocalTripShare.getStoredExpenses()).length;
 });
 assert.equal(before,1);
 await page.evaluate(()=>{
  const tombstone={expenseId:"cloud-deleted",deleted:true,updatedAtMs:999999,
    expense:{title:"Recover missing train ticket",amount:900,currency:"JPY",
      date:"2026-10-20",category:"Transportation",notes:"Return ticket"}};
  const conflict={expenseId:"cloud-meal",deleted:false,updatedAtMs:99999999,updatedAt:"2026-10-21T09:00:00Z",
    expense:{title:"Cloud stale incorrect overwrite",amount:9999,currency:"JPY",date:"2026-10-21",category:"Food"}};
  const newRemote={expenseId:"cloud-new",deleted:false,updatedAtMs:500,updatedAt:"2026-10-21T09:00:00Z",
    expense:{title:"Partner local expense",amount:250,currency:"JPY",date:"2026-10-21",category:"Food"}};
  window.qaDocs=[conflict,tombstone,newRemote];
  // Two listener emissions before the first IndexedDB refresh; must serialize.
  window.qaWatcher({docs:window.qaDocs});
  window.qaWatcher({docs:window.qaDocs});
 });
 await page.waitForFunction(async()=>{
  const rows=await window.MomoLocalTripShare.getStoredExpenses();
  return rows.some(x=>x.sharedExpenseId==="cloud-new");
 },null,{timeout:15000});
 await page.waitForTimeout(300);
 let state=await page.evaluate(async()=>{
  const rows=await window.MomoLocalTripShare.getStoredExpenses();
  return {rows:rows.map(x=>({id:x.id,title:x.title,amount:x.amount})),recover:window.MomoTripSharing.getRecoverableExpenses(trips.find(x=>x.id==="qa-japan"))};
 });
 assert.equal(state.rows.length,2,"No duplicates from concurrent snapshots");
 assert.equal(state.rows.find(x=>x.id==="qa-meal").title,"Original preserved meal","Cloud must not overwrite original");
 assert.equal(state.rows.find(x=>x.id==="qa-meal").amount,600);
 assert.equal(state.recover.length,1,"Cloud deletion history should be visible for review");
 assert.equal(state.recover[0].title,"Recover missing train ticket");
 await page.evaluate(()=>{showScreen("trips");renderTrips();document.getElementById("contextTipModal")?.remove();});
 await page.locator(".trip-entry-card").filter({hasText:"Japan QA Recovery"}).locator(".trip-dashboard-open").click();
 let modal=page.locator("#tripDashboardModal");
 assert.match(await modal.innerText(),/Cloud-deleted entries available for review \(1\)/);
 assert.match(await modal.innerText(),/Recover missing train ticket/);
 assert.equal(await modal.locator("[data-recover-shared-expense]").count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"No mobile overflow");
 await modal.locator("[data-recover-shared-expense]").click();
 await page.waitForFunction(async()=>{
   const rows=await window.MomoLocalTripShare.getStoredExpenses();
   return rows.some(x=>x.sharedExpenseId==="recovered-cloud-deleted");
 },null,{timeout:15000});
 await page.waitForTimeout(250);
 state=await page.evaluate(async()=>{
  const rows=await window.MomoLocalTripShare.getStoredExpenses();
  return {rows:rows.map(x=>({id:x.id,title:x.title,amount:x.amount,sharedExpenseId:x.sharedExpenseId})),
   uploads:window.qaUpload.map(x=>x.payload.expenseId),
   visible:getTripExpenses(trips.find(x=>x.id==="qa-japan")).map(x=>x.title),
   spent:getTripSpent(trips.find(x=>x.id==="qa-japan"))};
 });
 assert.equal(state.rows.length,3,"Restoration must be additive only");
 assert.equal(state.spent,1750,"Trip totals include restored one, old original, partner expense");
 assert.ok(state.visible.includes("Recover missing train ticket"));
 assert.ok(state.uploads.includes("recovered-cloud-deleted"),"Restored item should sync as separate cloud identity");
 await modal.locator("[data-recover-shared-expense]").click();
 await page.waitForTimeout(250);
 assert.equal((await page.evaluate(()=>window.MomoLocalTripShare.getStoredExpenses())).length,3,
  "Repeat recover click must not create copies");
 assert.equal(errors.filter(x=>!/Firebase|network|fetch|Authentication/i.test(x)).length,0,"Browser errors: "+errors.join("|"));
 console.log("PASS: additive concurrent cloud imports, no local overwrite, cloud deleted candidates reviewed, explicit restore once, 3/3 IndexedDB retained, restored totals correct, mobile 390px.");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{try{await browser?.close()}catch{}server.close()});