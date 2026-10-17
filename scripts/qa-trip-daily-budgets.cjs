const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const root = process.cwd();
const mime = {".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".png":"image/png"};
let browser;
const server = http.createServer((req,res) => {
  const filename=path.resolve(root, "." + decodeURIComponent(req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]));
  if(!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()){res.writeHead(404);res.end("Not found");return;}
  res.setHeader("Content-Type",mime[path.extname(filename)]||"text/plain");
  fs.createReadStream(filename).pipe(res);
});
const put = async (page,store,obj)=>{
  await page.evaluate(async ([storeName,value])=>{
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open("momo_database",4);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction(storeName,"readwrite");tx.objectStore(storeName).put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    db.close();
  },[store,obj]);
};
const all = async (page,store)=>page.evaluate(async (storeName)=>{
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open("momo_database",4);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const data=await new Promise((resolve,reject)=>{const req=db.transaction(storeName).objectStore(storeName).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  db.close();return data;
},store);
(async()=>{
  await new Promise(resolve=>server.listen(8765,"127.0.0.1",resolve));
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on("pageerror",error=>errors.push(String(error)));
  await page.addInitScript(()=>{
    localStorage.setItem("momo_welcome_tour_complete_v1","yes");
  });
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof openTripModal === "function" && typeof renderTripDailyBudgetInputs === "function",{timeout:15000});
  await page.evaluate(()=>{
    document.getElementById("welcomeTour")?.remove();
    document.querySelectorAll(".tutorial-overlay,.tutorial-backdrop").forEach(node=>node.remove());
    openTripModal();
    document.getElementById("tripStartDate").value="2026-10-18";
    document.getElementById("tripEndDate").value="2026-10-20";
    renderTripDailyBudgetInputs();
  });
  await page.locator("#tripName").fill("QA Japan Trip");
  await page.locator("#tripDestination").fill("Tokyo");
  await page.locator("#tripBudget").fill("25000");
  await page.locator("#tripDailyBudget").fill("3000");
  await page.locator("#tripDailyBudgetDetails summary").click();
  assert.equal(await page.locator("[data-trip-budget-date]").count(),3);
  await page.locator('[data-trip-budget-date="2026-10-18"]').fill("8000");
  await page.locator('[data-trip-budget-date="2026-10-20"]').fill("0");
  assert.match(await page.locator("#tripDailyBudgetPlanSummary").innerText(),/11,000/);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+1);
  assert.equal(overflow,false,"Trip form horizontal overflow at 390px");
  await page.locator('#tripForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.getElementById("tripModal").hidden);
  let records=await all(page,"trips");
  assert.equal(records.length,1);
  const trip=records[0];
  assert.equal(trip.dailyBudget,3000);
  assert.deepEqual(trip.dailyBudgets,{"2026-10-18":8000,"2026-10-20":0});
  assert.equal(trip.budget,25000);
  console.log("Trip saved to IndexedDB; opening dashboard");
  await page.evaluate(()=>{renderTrips();showScreen("trips");});
  await page.locator(".trip-dashboard-open").first().click();
  await page.locator(".trip-daily-budget-section").waitFor();
  assert.equal(await page.locator(".trip-day-budget-row").count(),3);
  assert.match(await page.locator(".trip-day-budget-row").nth(0).innerText(),/8,000/);
  assert.match(await page.locator(".trip-day-budget-row").nth(1).innerText(),/3,000/);
  assert.match(await page.locator(".trip-day-budget-row").nth(2).innerText(),/0/);
  assert.match(await page.locator(".trip-day-budget-row").nth(2).innerText(),/Custom target/);
  const overflowDash=await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1);
  assert.equal(overflowDash,false,"Dashboard horizontal overflow at 390px");
  await put(page,"expenses",{id:"qa-trip-expense",type:"expense",title:"Dinner",tripId:trip.id,
    amount:1500,currency:"JPY",date:"2026-10-18",category:"Food",paymentMethod:"Cash",createdAt:new Date().toISOString()});
  await page.evaluate(async()=>{await loadAppData();renderTripDashboard(trips[0]);});
  assert.match(await page.locator(".trip-day-budget-row").first().innerText(),/Spent.*1,500/);
  assert.match(await page.locator(".trip-day-budget-row").first().innerText(),/Left.*6,500/);
  await page.locator(".trip-daily-budget-edit").click();
  assert.equal(await page.locator('[data-trip-budget-date="2026-10-18"]').inputValue(),"8000");
  await page.locator("#tripDailyBudget").fill("4000");
  await page.locator('[data-trip-budget-date="2026-10-18"]').fill("");
  await page.locator('#tripForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.getElementById("tripModal").hidden);
  records=await all(page,"trips");
  assert.equal(records[0].dailyBudget,4000);
  assert.deepEqual(records[0].dailyBudgets,{"2026-10-20":0},"blank day uses default; explicit zero preserved");
  await put(page,"trips",{id:"legacy-trip",name:"Old trip",destination:"Tokyo",startDate:"2026-11-01",endDate:"2026-11-02",
    budget:5000,currency:"JPY",dailyBudget:1200});
  await page.evaluate(async()=>{await loadAppData();renderTrips();});
  assert.match(await page.locator(".trip-entry-card").filter({hasText:"Old trip"}).innerText(),/1,200/);
  assert.equal(errors.filter(x=>!/Firebase|network|fetch|Authentication/i.test(x)).length,0,"unexpected page errors: "+errors.join(" | "));
  console.log("PASS: Real IndexedDB trip create/edit + default/custom/zero budgets + daily expense, 390x844 overflow, legacy compatibility.");
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{try{await browser?.close();}catch{}server.close();});