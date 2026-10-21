const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright");
const root=process.cwd();
const mime={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json"};
const server=http.createServer((req,res)=>{
  const n=path.resolve(root,"."+(req.url.split("?")[0]==="/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0])));
  if(!n.startsWith(root+path.sep)||!fs.existsSync(n)||!fs.statSync(n).isFile()){res.writeHead(404);res.end("not found");return;}
  res.setHeader("Content-Type",mime[path.extname(n)]||"application/octet-stream");
  fs.createReadStream(n).pipe(res);
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(8765,"127.0.0.1",resolve));
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.addInitScript(()=>localStorage.setItem("momo_welcome_tour_complete_v1","yes"));
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.MomoLocalTripShare&&!!window.MomoTripSharing&&typeof getAllMomoStoreSnapshots==="function",{timeout:15000});
  const initial=await page.evaluate(async()=>{
    document.getElementById("welcomeTour")?.remove();
    document.querySelectorAll(".tutorial-overlay,.tutorial-backdrop").forEach(e=>e.remove());
    const trip={id:"qa-trip",name:"Japan recovery QA",destination:"Tokyo",startDate:"2026-10-18",
       endDate:"2026-10-26",budget:10000,currency:"JPY",sharedTripCode:"qa-share",
       sharedTripToken:"qa-token",sharedTripOwnerUid:"qa-owner",sharedTripRole:"owner",sharedTripStatus:"active"};
    const base={type:"expense",tripId:"qa-trip",sharedTripExpense:true,sharedTripCode:"qa-share",
       sharedTripToken:"qa-token",sharedTripOwnerUid:"qa-owner",sharedTripRole:"owner",
       currency:"JPY",category:"Food",date:"2026-10-21",location:"",notes:"",paymentMethod:"Cash",
       tags:[],photo:"",sharedUpdatedAtMs:100};
    const originals=[
      {...base,id:"qa-meal",sharedExpenseId:"cloud-one",title:"Meal",amount:200},
      {...base,id:"qa-different",sharedExpenseId:"cloud-one",title:"Souvenir",amount:1200},
      {...base,id:"qa-mirror",sharedExpenseId:"cloud-one",title:"Meal",amount:200,sharedUpdatedAtMs:90},
      {...base,id:"qa-other",sharedExpenseId:"cloud-two",title:"Train",amount:300}
    ];
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open("momo_database",4);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const tx=db.transaction(["trips","expenses"],"readwrite");
    tx.objectStore("trips").put(trip);
    originals.forEach(x=>tx.objectStore("expenses").put(x));
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
    db.close();
    await loadAppData();
    return {visible:expenses.map(x=>x.id),hidden:hiddenSharedExpenseCopies.map(x=>x.id),
      backedUp:(await getAllMomoStoreSnapshots()).expenses.length,
      total:getTripSpent(trips.find(x=>x.id==="qa-trip"))};
  });
  assert.deepEqual(initial.visible,["qa-meal","qa-different","qa-other"]);
  assert.deepEqual(initial.hidden,["qa-mirror"]);
  assert.equal(initial.backedUp,4);
  assert.equal(initial.total,1700);
  await page.evaluate(()=>{
    showScreen("trips");renderTrips();
  });
  await page.locator(".trip-entry-card").filter({hasText:"Japan recovery QA"}).locator(".trip-dashboard-open").click();
  const list=page.locator(".trip-dashboard-expense-list").first();
  assert.equal(await list.locator(".transaction-swipe-shell").count(),3);
  assert.match(await page.locator("#tripDashboardModal").innerText(),/Other saved copies \(1\)/);
  assert.match(await page.locator("#tripDashboardModal").innerText(),/Souvenir/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.evaluate(()=>{
    window.MomoTripCloud={
      getUser:()=>({uid:"qa-owner",displayName:"Owner"}),
      watchInvite:()=>()=>{},
      watchExpenses:(code,callback)=>{window.recoveryWatch=callback;return()=>{}}
    };
    window.MomoTripSharing.watchAllSharedTrips();
    window.recoveryWatch({docs:[{expenseId:"cloud-two",deleted:true,updatedAtMs:9999999999999}]});
  });
  await page.waitForTimeout(300);
  const after=await page.evaluate(async()=>{
    const a=await getAllMomoStoreSnapshots();
    return {records:a.expenses.map(x=>x.id),count:a.expenses.length};
  });
  assert.equal(after.count,4,"cloud tombstones must never erase locally saved expenses");
  assert.ok(after.records.includes("qa-other"));
  assert.equal(errors.filter(x=>!/Firebase|network|fetch|Authentication/i.test(x)).length,0,
    "Unexpected JS errors: "+errors.join(" | "));
  console.log("PASS: Distinct same-sync-ID records visible, exact mirrors reviewable, all four records exported unchanged, remote tombstone non-destructive, 390x844.");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{try{await browser?.close()}catch{}server.close()});