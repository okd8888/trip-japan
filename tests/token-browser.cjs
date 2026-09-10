const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'C:/Users/tlogin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');

(async()=>{
  const {default:worker}=await import('../worker/src/index.js');
  const {db,env}=require('./d1.cjs')(),auth=await require('./auth.cjs')();
  Object.assign(env,auth.env);
  env.ASSETS={fetch:async request=>{
    let name=new URL(request.url).pathname.slice('/admin/'.length) || 'index.html';
    const data=await fs.readFile(path.join(__dirname,'..',name));
    return new Response(data,{headers:{'content-type':name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'application/json'}});
  }};
  const server=http.createServer(async(req,res)=>{
    try {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const url=`http://${req.headers.host}${req.url}`;
      const response=req.url.includes('/api/rate')?Response.json({rate:0.22,source:'test'}):await worker.fetch(new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),env);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    } catch(error){res.writeHead(500);res.end(error.message);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://**/*',route=>route.abort());
    await page.goto(origin+'/admin/');
    await page.waitForURL('**/login');
    await page.locator('#token').fill('wrong');await page.locator('#submit').click();
    await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Token 不正確'));
    await page.locator('#token').fill(auth.env.ADMIN_TOKEN);await page.locator('#submit').click();
    await page.waitForURL('**/admin/');
    assert.equal(await page.evaluate(()=>TripSync.readOnly()),false);
    await page.locator('[data-view="more"]').click();
    assert.equal(await page.locator('[data-go="edit"]').isVisible(),true);
    await page.locator('#syncAdvanced summary').first().click();await page.locator('#syncCreate').click();
    await page.waitForFunction(()=>TripSync.version===1);
    assert.equal(await page.evaluate(value=>JSON.stringify(localStorage).includes(value),auth.env.ADMIN_TOKEN),false);
    await page.locator('#adminLogout').click();await page.waitForURL('**/login');
    await page.goto(origin+'/admin/');await page.waitForURL('**/login');
    assert.deepEqual(errors,[]);
    console.log('PASS Token 表單、錯誤提示、Cookie 登入、建立行程、無明文保存、登出阻擋');
  } finally {await browser.close();server.close();db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
