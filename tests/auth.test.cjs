const {test}=require('node:test');
const assert=require('node:assert/strict');

test('Token 登入、工作階段撤銷與換新、管理權限與公開唯讀',async()=>{
  const auth=await require('./auth.cjs')();
  const {db,env}=require('./d1.cjs')();
  Object.assign(env,auth.env);
  const {default:worker}=await import('../worker/src/index.js');
  const request=(path,method='GET',headers={},body)=>new Request('https://worker.test'+path,{method,headers:{origin:'https://worker.test','content-type':'application/json',...headers},body:body&&JSON.stringify(body)});
  const trip={days:[]};
  try {
    assert.equal((await worker.fetch(request('/api/trip','POST',{}, {trip}),env)).status,403);
    assert.equal((await worker.fetch(request('/admin/api/trip','POST',{'cf-access-authenticated-user-email':'admin@example.com'},{trip}),env)).status,401);
    assert.equal((await worker.fetch(request('/admin/api/trip','POST',{'cf-access-jwt-assertion':'forged'},{trip}),env)).status,401);
    assert.equal((await worker.fetch(request('/admin/'),env)).headers.get('location'),'https://worker.test/login');
    const html=await(await worker.fetch(request('/login'),env)).text();
    assert.match(html,/type="password"/);
    assert.equal(html.includes(env.ADMIN_TOKEN),false);
    assert.equal((await worker.fetch(request('/login'),{...env,ADMIN_TOKEN:''})).status,503);
    for(const token of ['wrong','',null,17]) assert.equal((await auth.login(worker,env,undefined,token)).response.status,401);
    assert.equal((await worker.fetch(request('/auth/login','POST',{origin:'https://attacker.test'},{token:env.ADMIN_TOKEN}),env)).status,403);
    const limited={...env,LOGIN_LIMITER:{limit:async()=>({success:false})}};
    assert.equal((await auth.login(worker,limited)).response.status,429);
    const {headers,response,cookie}=await auth.login(worker,env);
    assert.equal(response.status,200);
    assert.match(response.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);
    assert.equal(db.prepare('SELECT id_hash FROM admin_sessions WHERE id_hash = ?').get(cookie.split('=')[1]),undefined);
    assert.equal((await worker.fetch(request('/admin/api/trips','GET',headers),{...env,ADMIN_TOKEN:'rotated-token'})).status,401);
    const created=await worker.fetch(request('/admin/api/trip','POST',headers,{trip}),env);
    assert.equal(created.status,201);
    const {code}=await created.json();
    assert.equal((await worker.fetch(request('/api/trip/'+code),env)).status,200);
    assert.equal((await worker.fetch(request('/api/trip/'+code,'PUT',{'x-edit-key':'old-key'},{trip,version:1}),env)).status,403);
    assert.equal((await worker.fetch(request('/api/expenses/'+code,'POST',{'x-edit-key':'old-key'},{expenses:[]}),env)).status,403);
    assert.equal((await worker.fetch(request('/admin/api/trip/'+code,'PUT',{...headers,origin:'https://attacker.test'},{trip,version:1}),env)).status,403);
    assert.equal((await worker.fetch(request('/admin/api/trip/'+code,'PUT',headers,{trip,version:1}),env)).status,200);
    assert.equal((await worker.fetch(request('/admin/api/expenses/'+code,'POST',headers,{expenses:[]}),env)).status,200);
    assert.equal((await worker.fetch(request('/admin/api/trips','GET',headers),env)).status,200);
    assert.equal((await worker.fetch(request('/auth/logout','POST',headers),env)).status,200);
    assert.equal((await worker.fetch(request('/admin/api/trips','GET',headers),env)).status,401);
    const second=await auth.login(worker,env);
    db.prepare('UPDATE admin_sessions SET expires_at = 1').run();
    assert.equal((await worker.fetch(request('/admin/api/trips','GET',second.headers),env)).status,401);
  } finally {db.close();}
});
