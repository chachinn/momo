const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright");
const root=process.cwd();
const mime={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  const pathPart=decodeURIComponent(req.url.split("?")[0]);
  const filename=path.resolve(root,"."+(pathPart==="/" ? "/index.html" : pathPart));
  if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){
    res.writeHead(404);res.end("Not found");return;
  }
  res.setHeader("Content-Type",mime[path.extname(filename)]||"text/plain");
  fs.createReadStream(filename).pipe(res);
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
  await page.waitForFunction(()=>typeof renderTripDashboard==="function"&&typeof loadAppData==="function",{timeout:20000});
  await page.evaluate(async()=>{
    document.getElementById("welcomeTour")?.remove();
    document.querySelectorAll(".tutorial-overlay,.tutorial-backdrop").forEach(e=>e.remove());
    const db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open("momo_database",4);
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    const tx=db.transaction(["trips","expenses"],"readwrite");
    const tripStore=tx.objectStore("trips"),expStore=tx.objectStore("expenses");
    tripStore.put({id:"qa-trip-all",name:"Japan QA all expenses",destination:"Tokyo",
      startDate:"2026-10-18",endDate:"2026-10-26",budget:100000,
      dailyBudget:3000,dailyBudgets:{"2026-10-21":5000},currency:"JPY"});
    tripStore.put({id:"qa-trip-other",name:"Unrelated QA trip",destination:"Osaka",
      startDate:"2026-10-18",endDate:"2026-10-26",budget:10000,currency:"JPY"});
    for(let i=1;i<=25;i++){
      expStore.put({id:"qa-expense-"+String(i).padStart(2,"0"),type:"expense",
        title:"QA logged expense "+i,tripId:"qa-trip-all",amount:i*100,currency:"JPY",
        date:"2026-10-21",category:"Food",paymentMethod:"Cash",
        createdAt:"2026-10-21T01:00:00.000Z"});
    }
    for(let i=1;i<=3;i++){
      expStore.put({id:"qa-other-"+i,type:"expense",title:"Other trip only "+i,
        tripId:"qa-trip-other",amount:200,currency:"JPY",date:"2026-10-21",
        category:"Food",paymentMethod:"Cash"});
    }
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    db.close();
    await loadAppData();
    showScreen("trips");
    renderTrips();
  });
  const tripCard=page.locator(".trip-entry-card").filter({hasText:"Japan QA all expenses"});
  await tripCard.locator(".trip-dashboard-open").click();
  const section=page.locator(".trip-dashboard-section").filter({has:page.locator(".trip-dashboard-expense-list")});
  await section.waitFor();
  assert.match(await section.locator(".eyebrow").innerText(),/All logged · 25 expenses/i);
  assert.equal(await section.locator(".transaction-swipe-shell").count(),25);
  assert.equal(await section.locator('[data-expense-detail-id="qa-expense-01"]').count(),1);
  assert.equal(await section.locator('[data-expense-detail-id="qa-expense-25"]').count(),1);
  assert.equal(await section.getByText("Other trip only 1").count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,"horizontal overflow at 390px");
  const preserved=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open("momo_database",4);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    const values=await new Promise((resolve,reject)=>{
      const r=db.transaction("expenses","readonly").objectStore("expenses").getAll();
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    db.close();
    return values;
  });
  assert.equal(preserved.length,28,"all expense records retained");
  assert.equal(preserved.filter(x=>x.tripId==="qa-trip-all").length,25);
  assert.equal(preserved.find(x=>x.id==="qa-expense-25").amount,2500);
  assert.equal(await page.locator("#tripDashboardModal").isVisible(),true);
  assert.equal(errors.filter(e=>!/Firebase|network|fetch|Authentication/i.test(e)).length,0,
    "Unexpected browser errors: "+errors.join(" | "));
  console.log("PASS: 25/25 trip expenses displayed, other trip excluded, original IndexedDB entries intact, 390x844 no horizontal overflow.");
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{try{await browser?.close();}catch{}server.close();});