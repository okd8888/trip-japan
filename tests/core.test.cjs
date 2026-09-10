const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../companion-core.js');
test('下一站略過已完成站點，抵達後指向下一站',()=>{
  assert.equal(C.nextIndex([{status:'done'},{status:'current'},{status:'skipped'},{name:'next'}]),3);
  assert.equal(C.nextIndex([{status:'done'}]),-1);
});
test('日本跨日依目的地時區計算',()=>{
  assert.deepEqual(C.localTime('Asia/Tokyo',new Date('2026-09-09T15:30:00Z')),{date:'2026-09-10',minutes:30});
});
test('延誤只以有停留時間的目前站點計算',()=>{
  assert.equal(C.delay([{status:'current',time:'13:00',stayMinutes:30}],14*60+5),35);
  assert.equal(C.delay([{status:'current',time:'下午',stayMinutes:30}],845),0);
  assert.equal(C.delay([{status:'current',time:'13:00'}],845),0);
  assert.equal(C.minutes('25:10'),null);
  assert.equal(C.clock(-10),'前日 23:50');
});
test('延後只處理目前站之後，並正確跨午夜且保留預約',()=>{
  const items=[{time:'10:00'},{time:'23:00',stayMinutes:30,status:'current'},{arrivalTime:'23:50',reservationTime:'23:55'},{time:'11:00',status:'skipped'}];
  C.shiftPending(items,35);
  assert.equal(items[0].time,'10:00');
  assert.equal(C.arrivalLabel(items[2]),'翌日 00:25');
  assert.equal(items[2].reservationTime,'23:55');
  assert.equal(items[3].time,'11:00');
  assert.equal(C.delay(items,1440+5),0);
});
test('公開資料移除私人欄位，不影響本機備份',()=>{
  const trip={days:[{stay:{reservationNo:'secret',name:'hotel'}}]};
  assert.equal(C.publicTrip(trip).days[0].stay.reservationNo,undefined);
  assert.equal(trip.days[0].stay.reservationNo,'secret');
});
test('導航 URL 阻擋腳本且文字正確編碼',()=>{
  assert.equal(C.safeUrl('javascript:alert(1)'),'');
  assert.match(C.navigation({googleMaps:'javascript:alert(1)',name:'A & B'}),/A%20%26%20B/);
  assert.equal(C.validTrip({days:[{items:[null]}]}),false);
});
test('Worker 檢查授權、衝突、私人欄位與讀取',async()=>{
  const {default:worker}=await import('../worker/src/index.js');
  const {db,env}=require('./d1.cjs')();
  const auth=await require('./auth.cjs')();
  Object.assign(env,auth.env);
  const {headers}=await auth.login(worker,env);
  const trip={days:[{stay:{reservationNo:'private'}}]};
  const created=await worker.fetch(new Request('https://worker.test/admin/api/trip',{method:'POST',headers,body:JSON.stringify({trip})}),env);
  assert.equal(created.status,201);
  const {code}=await created.json();
  const put=version=>new Request(`https://worker.test/admin/api/trip/${code}`,{method:'PUT',headers,body:JSON.stringify({version,trip})});
  const simultaneous=await Promise.all([worker.fetch(put(1),env),worker.fetch(put(1),env)]);
  assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
  assert.equal((await worker.fetch(put(1),env)).status,409);
  const read=await (await worker.fetch(new Request(`https://worker.test/api/trip/${code}`),env)).json();
  assert.equal(read.trip.days[0].stay.reservationNo,undefined);
  assert.equal(JSON.parse(db.prepare('SELECT trip FROM trips').get().trip).days[0].stay.reservationNo,undefined);
  const expense=new Request(`https://worker.test/admin/api/expenses/${code}`,{method:'POST',headers,body:JSON.stringify({expenses:[{id:'e1',category:'停車',amount:500,updatedAt:Date.now()}]})});
  assert.equal((await worker.fetch(expense,env)).status,200);
  assert.equal((await (await worker.fetch(new Request(`https://worker.test/api/expenses/${code}`),env)).json()).expenses[0].amount,500);
  db.close();
});
