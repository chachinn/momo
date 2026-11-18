/**
 * Isolated JPY/PHP rate QA. Only synthetic data in a fresh browser profile.
 * No real Firebase credentials or user's original IndexedDB are accessed.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {chromium}=require("playwright");
const root=process.cwd();
const mime={".js":"application/javascript",".html":"text/html",".css":"text/css",".json":"application/json"};
function assertMoney(actual, expected, label="currency conversion") {
  assert.ok(Math.abs(actual - expected) < 0.001,
    label + ": expected " + expected + ", got " + actual);
}
const server=http.createServer((req,res)=>{
  const route=req.url.split("?")[0]==="/"?"/index.html":decodeURIComponent(req.url.split("?")[0]);
  const file=path.resolve(root,"."+route);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end("Not found");return;
  }
  res.setHeader("Content-Type",mime[path.extname(file)]||"application/octet-stream");
  fs.createReadStream(file).pipe(res);
});
let browser;
(async()=>{
 await new Promise(ok=>server.listen(8766,"127.0.0.1",ok));
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
 let mockRate=0.39970;
 let offline=false;
 await context.route("https://api.frankfurter.dev/v2/rate/jpy/php",route=>{
   if(offline)return route.abort("failed");
   return route.fulfill({status:200,contentType:"application/json",
     body:JSON.stringify({date:"2026-11-18",base:"JPY",quote:"PHP",rate:mockRate})});
 });
 const page=await context.newPage();
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem("momo_welcome_tour_complete_v1","yes"));
 await page.goto("http://127.0.0.1:8766/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>typeof effectiveJpyPhpRate==="function" &&
   Math.abs(effectiveJpyPhpRate()-.39970)<1e-8, null,{timeout:20000});
 assert.equal(await page.evaluate(()=>jpyPhpRateMode),"market","Fresh install must default to market");
 assert.ok((await page.locator("#jpyPhpRateStatus").innerText()).includes("Frankfurter"));
 assertMoney(await page.evaluate(()=>convertCurrency(10000,"JPY","PHP")),3997);
 assert.equal(await page.evaluate(()=>Math.round(convertCurrency(3997,"PHP","JPY"))),10000);
 assert.equal(await page.evaluate(()=>EXCHANGE_RATES.USD),0.0175,"Other currency rates unchanged");
 assert.match(await page.locator("#converterRateText").innerText(),/0\.399700/);

 // Separate synthetic trip fixtures, never real user records.
 const baseline=await page.evaluate(async()=>{
   const database=await new Promise((resolve,reject)=>{
     const request=indexedDB.open("momo_database",4);
     request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
   });
   const tx=database.transaction(["expenses","trips","cards","budgets","settings"],"readwrite");
   tx.objectStore("trips").put({
     id:"test-trip",name:"Japan synthetic",destination:"Tokyo",
     startDate:"2026-10-18",endDate:"2026-10-25",currency:"PHP",budget:100000
   });
   tx.objectStore("expenses").put({
     id:"synthetic-expense",title:"Keep this yen amount",amount:10000,
     currency:"JPY",date:"2026-10-20",category:"Shopping",
     tripId:"test-trip",photo:"synthetic-photo",notes:"Original untouched"
   });
   tx.objectStore("cards").put({id:"synthetic-card",name:"Do not modify payable",amount:2000});
   tx.objectStore("budgets").put({id:"synthetic-budget",name:"Keep budget",amount:12345});
   tx.objectStore("settings").put({key:"synthetic-setting",value:{safety:true}});
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
   database.close();
   await loadAppData();
   renderAll();
   const snapshots=await getAllMomoStoreSnapshots();
   return {
     expense:snapshots.expenses.find(x=>x.id==="synthetic-expense"),
     card:snapshots.cards.find(x=>x.id==="synthetic-card"),
     budget:snapshots.budgets.find(x=>x.id==="synthetic-budget"),
     setting:snapshots.settings.find(x=>x.key==="synthetic-setting")
   };
 });
 assert.equal(baseline.expense.amount,10000);
 assertMoney(await page.evaluate(()=>getTripSpent(trips.find(t=>t.id==="test-trip"))),3997);

 await page.evaluate(()=>{showScreen("trips");renderTrips();document.getElementById("contextTipModal")?.remove()});
 await page.locator("#openJpyPhpRateSettings").click();
 assert.equal(await page.evaluate(()=>document.getElementById("inlineConverter").classList.contains("is-expanded")),true);
 assert.equal(await page.evaluate(()=>document.getElementById("jpyPhpRateSettings").open),true);

 await page.locator("#jpyPhpCustomRate").fill("0.40855");
 await page.locator("#saveJpyPhpCustomRate").click();
 await page.waitForFunction(()=>jpyPhpRateMode==="custom" &&
   Math.abs(effectiveJpyPhpRate()-.40855)<1e-10);
 assertMoney(await page.evaluate(()=>convertCurrency(10000,"JPY","PHP")),4085.5);
 assertMoney(await page.evaluate(()=>getTripSpent(trips.find(t=>t.id==="test-trip"))),4085.5);
 assert.match(await page.locator("#jpyPhpRateStatus").innerText(),/Your card rate/);
 assert.match(await page.locator("#converterRateText").innerText(),/0\.408550/);
 const pref=await page.evaluate(async()=>(
   await getAllMomoStoreSnapshots()).settings.find(x=>x.key==="jpy_php_rate_preference"));
 assert.deepEqual(pref.value,{mode:"custom",rate:.40855});
 const savedBackup=await page.evaluate(()=>buildMomoBackup());
 assert.deepEqual(savedBackup.storeSnapshots.expenses.find(x=>x.id==="synthetic-expense"),baseline.expense);
 assert.deepEqual(savedBackup.storeSnapshots.settings.find(x=>x.key==="jpy_php_rate_preference").value,
   {mode:"custom",rate:.40855});

 // Invalid rate cannot change saved preference or mutate financial records.
 await page.locator("#jpyPhpCustomRate").fill("0");
 await page.locator("#saveJpyPhpCustomRate").click();
 assert.equal(await page.evaluate(()=>effectiveJpyPhpRate()),.40855);
 await page.locator("#jpyPhpCustomRate").fill("-1");
 await page.locator("#saveJpyPhpCustomRate").click();
 assert.equal(await page.evaluate(()=>effectiveJpyPhpRate()),.40855);

 // Restart PWA; daily market reference changes, but manual rate remains selected.
 mockRate=.39880;
 await page.reload({waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>jpyPhpRateMode==="custom" &&
   Math.abs(jpyPhpMarket.rate-.3988)<1e-8,null,{timeout:20000});
 assert.equal(await page.evaluate(()=>effectiveJpyPhpRate()),.40855);
 assertMoney(await page.evaluate(()=>convertCurrency(10000,"JPY","PHP")),4085.5);
 await page.evaluate(()=>{showScreen("trips");renderTrips();document.getElementById("contextTipModal")?.remove()});
 await page.locator("#openJpyPhpRateSettings").click();
 assert.match(await page.locator("#jpyPhpRateStatus").innerText(),/Market ≈ ₱0\.398800/);

 // Market button resets the setting and uses the newest source.
 await page.locator("#useJpyPhpMarketRate").click();
 await page.waitForFunction(()=>jpyPhpRateMode==="market" &&
   Math.abs(effectiveJpyPhpRate()-.3988)<1e-8);
 assertMoney(await page.evaluate(()=>convertCurrency(10000,"JPY","PHP")),3988);
 const resetPref=await page.evaluate(async()=>(
   await getAllMomoStoreSnapshots()).settings.find(x=>x.key==="jpy_php_rate_preference"));
 assert.deepEqual(resetPref.value,{mode:"market"});

 // Cached rate remains available without network, visibly labeled.
 offline=true;
 await page.reload({waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>Math.abs(effectiveJpyPhpRate()-.3988)<1e-8,null,{timeout:20000});
 await page.waitForFunction(()=>
   document.getElementById("jpyPhpRateStatus")?.textContent.includes("Latest update unavailable"),null,{timeout:20000});
 assert.match(await page.locator("#jpyPhpRateStatus").innerText(),/cached/);

 // Full backup and underlying records are unchanged by the rate setting.
 const after=await page.evaluate(async()=>{
   const snapshots=await getAllMomoStoreSnapshots();
   return {
     expense:snapshots.expenses.find(x=>x.id==="synthetic-expense"),
     card:snapshots.cards.find(x=>x.id==="synthetic-card"),
     budget:snapshots.budgets.find(x=>x.id==="synthetic-budget"),
     setting:snapshots.settings.find(x=>x.key==="synthetic-setting"),
     version:db.version
   };
 });
 assert.deepEqual(after,{...baseline,version:4});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,
   "Mobile must not develop horizontal overflow");
 await context.close();

 // Fresh installation without network has a clearly dated fallback.
 const offlineContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
 await offlineContext.route("https://api.frankfurter.dev/v2/rate/jpy/php",route=>route.abort());
 const offlinePage=await offlineContext.newPage();
 await offlinePage.addInitScript(()=>localStorage.setItem("momo_welcome_tour_complete_v1","yes"));
 await offlinePage.goto("http://127.0.0.1:8766/",{waitUntil:"domcontentloaded"});
 await offlinePage.waitForFunction(()=>typeof effectiveJpyPhpRate==="function" &&
   !!document.getElementById("jpyPhpRateStatus")?.textContent.includes("offline estimate"),null,{timeout:20000});
 assert.equal(await offlinePage.evaluate(()=>effectiveJpyPhpRate()),.4005);
 assert.match(await offlinePage.locator("#jpyPhpRateStatus").innerText(),/BSP fallback reference/);
 await offlineContext.close();
 assert.equal(errors.filter(x=>!/Firebase|network|fetch|Authentication/i.test(x)).length,0,
   "Unexpected JavaScript errors: "+errors.join(" | "));
 console.log("PASS: live reference default, six-decimal display, custom rate persistence, market reset, cached offline and first-run BSP fallback, accurate JPY totals, invalid input rejected, backup preserved, identical finance records, DB v4, 390x844.");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 try{await browser?.close()}catch{}
 server.close();
});