const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'C:/Users/tlogin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');

// 正式站個人旅程驗收：只修改測試瀏覽器資料，不呼叫雲端寫入 API。
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const response=await page.goto('https://okd8888.github.io/trip-japan/',{waitUntil:'domcontentloaded',timeout:25000});
    assert.equal(response.status(),200);
    await page.waitForSelector('#nextStop h2');
    for(const view of ['today','plan','money','fx','more']){
      await page.locator(`[data-view="${view}"]`).click();
      assert.equal(await page.locator('#view-'+view).isVisible(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    }
    await page.screenshot({path:path.join(__dirname,'live-mobile.png'),fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-view="plan"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(__dirname,'live-desktop.png'),fullPage:true,animations:'disabled'});
    const version=await page.evaluate(async()=>await(await fetch('version.json',{cache:'no-store'})).json());
    assert.equal(version.version,'2.1.1');
    assert.equal(await page.evaluate(()=>TripSync.readOnly()),false);
    assert.equal(await page.evaluate(()=>TripSync.canEdit()),false);
    await page.locator('[data-view="more"]').click();
    await page.locator('[data-go="edit"]').click();
    page.on('dialog',dialog=>dialog.accept());
    await page.locator('#setDest').selectOption('tokyo');
    await page.locator('#setStart').fill('2027-05-01');
    await page.locator('#setEnd').fill('2027-05-04');
    await page.locator('#setApply').click();
    assert.equal(await page.evaluate(()=>TripApp.trip.destId),'tokyo');
    assert.equal(await page.evaluate(()=>TripApp.trip.days.length),4);
    assert.ok(await page.evaluate(()=>TripApp.trip.days.every(day=>day.items.length>0)));
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload({waitUntil:'domcontentloaded',timeout:25000});
    assert.equal(await page.evaluate(()=>TripApp.trip.destId),'tokyo');
    await page.locator('[data-view="today"]').click();
    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded',timeout:25000});
    assert.equal(await page.locator('#nextStop h2').count(),1);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({result:'PASS',version:version.version,checks:['手機五分頁','桌面版面','免登入自動排程','本機保存','離線閱讀','無 JavaScript 例外']}));
  } finally {await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
