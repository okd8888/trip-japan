/* 旅行模式：今天的下一步、每日路線與旅途操作。 */
(() => {
  'use strict';
  const T = window.TripApp, C = window.TripCore, $ = s => document.querySelector(s), esc = T.esc;
  window.TripCompanionReady = true;
  const readOnly = () => !!window.TripSync?.readOnly();
  let compact = localStorage.getItem('tripCompact') !== 'false', routeMode = false;
  let resetDetails = false;
  let weatherKey = '', weatherText = '', weatherRain = 0;
  const nav = it => `<a class="nav-btn" href="${esc(C.navigation(it))}" target="_blank" rel="noreferrer">開始導航 ↗</a>`;
  const labels = { pending: '○ 尚未前往', current: '● 現在', done: '✓ 已完成', skipped: '↷ 已跳過' };
  for (const [source, target] of [['flightPanel','moreFlights'],['checklistPanel','moreChecklist'],['chartPanel','moreChart']]) $('#'+target).append($('#'+source));
  $('#syncAdvancedFields').append($('#syncBadge').closest('.panel'));
  $('#syncAdvanced').hidden = !window.TripSync.isAdmin;
  $('#shareCopy').hidden = !window.TripSync.enabled();
  $('#syncPull').hidden = !window.TripSync.enabled();
  $('#personalTrip').hidden = !window.TripSync.isShared;
  if (!window.TripSync.isAdmin && !window.TripSync.isShared) {
    $('#adminStatus').textContent = '個人旅程：免登入即可修改目的地與自動排行程，修改只儲存在這個瀏覽器。可在「編輯行程／備份」匯出備份。';
  }
  if (window.TripSync.isAdmin && !window.TripSync.isShared) {
    $('#adminStatus').textContent = '管理模式已開啟。管理入口需連線登入；唯讀分享頁可離線查看。';
    $('#adminLogin').hidden = true;
    $('#adminLogout').hidden = false;
    $('#adminLogout').onclick = async () => {
      try {
        const response = await fetch('/auth/logout', {method:'POST'});
        if (!response.ok) throw new Error('登出失敗，請重試');
        location.replace('/login');
      } catch (error) { $('#adminStatus').textContent = error.message; }
    };
    $('#adminTripsField').hidden = false;
    $('#syncEndpoint').readOnly = true;
    $('#syncName').readOnly = true;
    fetch('/admin/api/trips', {cache:'no-store'}).then(async response => {
      if (!response.ok) throw new Error('無法讀取行程清單，請重新登入');
      const {trips} = await response.json();
      for (const trip of trips) $('#adminTrips').add(new Option(trip.title, trip.code));
      $('#adminTrips').value = window.TripSync.config.code;
    }).catch(error => { $('#adminStatus').textContent = error.message; });
    $('#adminTrips').onchange = () => {
      const code = $('#adminTrips').value;
      if (code && confirm('切換行程前請確認修改已同步。繼續？')) location.href = '/admin/?code=' + encodeURIComponent(code);
    };
  } else if (window.TripSync.config.code) {
    $('#adminLogin').href += '?code=' + encodeURIComponent(window.TripSync.config.code);
  }
  $('#shareCopy').onclick = () => $('#syncShare').click();
  $('#syncPull').onclick = async () => {
    if (!window.TripSync.enabled()) { $('#syncStatus').textContent='同步尚未啟用，請先完成進階設定。'; return; }
    if (!readOnly() && !confirm('取得最新行程會覆蓋本機修改，確定繼續？')) return;
    await T.syncNow();
  };
  window.TripSync.onStatus(state => {
    $('#syncStatus').textContent=state.message;
    if (window.TripSync.isAdmin && readOnly()) {
      $('#adminLogin').hidden=false;
      $('#adminLogin').href='/admin/?code='+encodeURIComponent(window.TripSync.config.code);
      $('#adminStatus').textContent='登入已逾時，請重新登入；本機修改已保留。';
    }
    render();
  });
  let quickKind = 'item';
  $('#quickCancel').onclick = () => $('#quickDialog').close();
  $('#quickForm').onsubmit = event => {
    event.preventDefault();
    if (readOnly()) return;
    const trip=structuredClone(T.trip), day=trip.days[+$('#quickDay').value];
    if (!day) return;
    if (quickKind==='item') {
      if (!$('#quickName').value.trim()) return;
      (day.items ||= []).push({name:$('#quickName').value.trim(),time:$('#quickTime').value,note:$('#quickNote').value.trim()});
    } else {
      if (!$('#quickNote').value.trim()) return;
      day.notes=[day.notes,$('#quickNote').value.trim()].filter(Boolean).join('\n');
    }
    T.setTrip(trip); $('#quickDialog').close(); $('#notice').textContent=quickKind==='item'?'已新增景點':'已新增當日備註';
  };
  function leg(items, i) {
    const it = items[i], estimate = i ? T.driveInfo(items[i - 1], it) : null;
    return { min: it.driveMinutes ?? estimate?.min, km: it.distanceKm ?? estimate?.km, estimated: it.driveMinutes == null && !!estimate };
  }
  const drive = d => [d.min != null ? `${Math.round(d.min)} 分` : '車程待補', d.km != null ? `${Number(d.km).toFixed(1)} km` : '距離待補'].join(' · ') + (d.estimated ? '（粗估，非即時路況）' : '');
  function timeline(day, di, pane) {
    const items = day.items || [];
    return items.map((it, i) => `<article class="stop ${C.status(it)}">
      <div class="time">${esc(C.arrivalLabel(it))}</div><div>
      <span class="status">${labels[C.status(it)]}</span><h3>${esc(it.name)}</h3>
      <p class="note">🚗 ${drive(leg(items, i))}${it.stayMinutes != null ? ` · 停留 ${esc(it.stayMinutes)} 分` : ''}</p>
      <div class="chips">${nav(it)}${readOnly() ? '' : `<button class="mini" data-status="${di}:${i}">${C.status(it) === 'current' ? '完成此站' : C.status(it) === 'pending' ? '已抵達' : '重設狀態'}</button>`}${it.critical ? '<span class="tag">重要</span>' : ''}</div>
      <details data-detail-key="${pane}:${di}:${i}" ${compact ? '' : 'open'}><summary>更多資訊</summary><p>${esc(it.desc || '尚無說明')}</p>${it.note ? `<p>${esc(it.note)}</p>` : ''}${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ''}
      <dl class="facts"><dt>停車</dt><dd>${esc(it.parking || '待補')}${it.parkingFee ? ` · ${esc(it.parkingFee)}` : ''}</dd>
      ${['mapCode', 'phone', 'reservationTime', 'ticket', 'rainPlan'].map(k => it[k] ? `<dt>${({mapCode:'MapCode',phone:'電話',reservationTime:'預約',ticket:'門票',rainPlan:'雨備'})[k]}</dt><dd>${esc(it[k])}</dd>` : '').join('')}</dl>
      ${it.reservation ? '<span class="tag">需預約／已安排預約</span>' : ''}${it.cost ? `<p>預估花費 ${esc(T.trip.currency?.symbol || '¥')}${esc(it.cost)}</p>` : ''}
      ${C.safeUrl(it.link) ? `<a href="${esc(C.safeUrl(it.link))}" target="_blank" rel="noreferrer">官網 ↗</a>` : ''}</details></div></article>`).join('') || '<p class="empty">這一天尚無行程，從「更多 → 編輯行程」新增。</p>';
  }
  function hotel(st) {
    if (!st?.name) return '<p class="empty">住宿尚未安排。</p>';
    return `<h3>${esc(st.name)}</h3><dl class="facts">${[['checkIn','Check-in'],['checkOut','Check-out'],['parking','停車'],['parkingFee','停車費'],['breakfast','早餐'],['address','地址'],['phone','電話']].map(([k,l]) => `<dt>${l}</dt><dd>${esc(st[k] || '待補')}</dd>`).join('')}</dl><div class="chips">${nav(st)}${st.address ? `<button class="mini" data-copy="${esc(st.address)}">複製地址</button>` : ''}${C.safeUrl(st.website) ? `<a href="${esc(C.safeUrl(st.website))}" target="_blank" rel="noreferrer">飯店官網 ↗</a>` : ''}</div>`;
  }
  function render() {
    const expanded = new Map([...document.querySelectorAll('[data-detail-key]')].map(el => [el.dataset.detailKey, el.open]));
    const local = C.localTime(T.trip.timeZone);
    const days = T.trip.days || [], offset = T.trip.startDate ? T.dayCount(T.parseDate(T.trip.startDate), T.parseDate(local.date)) : -1;
    const di = Math.max(0, Math.min(offset, days.length - 1)), day = days[di], items = day?.items || [];
    loadWeather(day, di);
    document.body.classList.toggle('readonly', readOnly());
    $('#modeLabel').textContent = readOnly() ? '同行者唯讀模式' : $('#view-edit').classList.contains('active') ? '編輯模式 · 修改自動儲存' : '旅行模式';
    $('#compactToggle').textContent = compact ? '切換詳細' : '切換精簡';
    $('#compactToggle').setAttribute('aria-pressed', String(compact));
    $('#todayTimeline').innerHTML = day ? timeline(day, di, 'today') + (day.notes ? `<details data-detail-key="notes:${di}"><summary>今日備註</summary><p class="day-note">${esc(day.notes)}</p></details>` : '') : '<p class="empty">尚未安排旅程。</p>';
    $('#todayStay').innerHTML = '';
    const summaryDate = T.parseDate(T.trip.startDate);
    $('#tonight').innerHTML = hotel(day?.stay);
    const ni = C.nextIndex(items), next = items[ni], current = items.find(it => C.status(it) === 'current');
    const late = offset === di ? C.delay(items, local.minutes) : 0;
    const total = items.reduce((sum, _, i) => { const d = leg(items,i); sum.km += Number(d.km || 0); sum.min += Number(d.min || 0); sum.missing ||= d.min == null || d.km == null; return sum; }, {km:0,min:0,missing:false});
    $('#daySummary').innerHTML = day ? `<p class="route-names">${esc(items.map(it => it.name).join(' → '))}</p><div class="summary-metrics"><span>🚗 ${total.km.toFixed(1)} km</span><span>⏱ ${Math.round(total.min)} 分</span><span>🏨 ${esc(day.stay?.name || '住宿待安排')}</span></div><p class="note">${total.missing ? '部分路段資料待補；總計僅含已填或可粗估路段。' : '路程依填寫資料或座標粗估，不含即時路況。'}</p><p id="weatherInfo">${esc(weatherText || '天氣資訊準備中')}</p>${weatherRain > 70 ? `<p class="warning">降雨機率高，請備雨具。${esc(items.filter(it => it.outdoor).map(it => `${it.name}：${it.rainPlan || '考慮室內替代行程'}`).join('；'))}</p>` : ''}` : '';
    if (day) $('#daySummary').insertAdjacentHTML('afterbegin', `<p class="note">DAY ${di+1} · ${summaryDate ? esc(T.fmtDate(T.addDays(summaryDate,di))) : '日期待設定'}${offset < 0 && summaryDate ? ` · 還有 ${-offset} 天出發` : ''}</p><h2>${esc(day.title || '今日路線')}</h2>`);
    $('#nextStop').innerHTML = offset >= days.length && days.length ? `<p>旅程回顧</p><h2>${days.length} 天旅程已結束</h2><p>已完成 ${days.flatMap(d => d.items || []).filter(it => C.status(it) === 'done').length} 站</p><p>已知總里程 ${days.reduce((s,d) => s + (d.items || []).reduce((v,_,i) => v + Number(leg(d.items,i).km || 0),0),0).toFixed(1)} km</p><button class="btn" data-go="money">查看旅費統計</button>` : next ? `<p>${offset < 0 ? '出發前預覽 · ' : ''}下一站${current ? ` · 目前在 ${esc(current.name)}` : ''}</p><h2><span>${esc(C.arrivalLabel(next))}</span> ${esc(next.name)}</h2><p>🚗 ${drive(leg(items,ni))}</p><p>建議出發：${C.arrivalMinutes(next) !== null && leg(items,ni).min != null ? C.clock(C.arrivalMinutes(next) - Math.round(leg(items,ni).min)) : '請補抵達時間與車程'}</p><p>🅿 ${esc(next.parking || '停車資訊待補')} ${esc(next.parkingFee || '')}${next.mapCode ? `<br>MapCode：${esc(next.mapCode)}` : ''}</p><div class="chips">${nav(next)}${readOnly() ? '' : `<button class="btn sub" data-status="${di}:${ni}">已抵達</button>`}</div>` : `<p>下一步</p><h2>${current ? `目前：${esc(current.name)}` : day ? '今日行程已完成' : '先安排你的旅程'}</h2>${current ? nav(current) : ''}`;
    $('#delayPanel').hidden = !late;
    $('#delayPanel').innerHTML = late ? `<h3>行程落後 ${late} 分鐘</h3><p>${next && C.arrivalMinutes(next) !== null ? `下一站原定 ${esc(C.arrivalLabel(next))}，目前預估 ${C.clock(C.arrivalMinutes(next) + late)}` : '請確認後續安排與預約時間。'}</p>${readOnly() ? '' : `<div class="chips"><button class="mini" data-delay="keep">維持行程</button><button class="mini" data-delay="shift" data-min="${late}" data-day="${di}">延後後續行程</button>${next ? `<button class="mini" data-skip="${di}:${ni}">跳過下一站</button>` : ''}</div>`}` : '';
    $('#important').innerHTML = items.filter(it => it.critical || it.reservationTime).map(it => `<p class="warning"><b>${esc(it.reservationTime || C.arrivalLabel(it))}</b> ${esc(it.name)} · ${esc(it.note || it.desc || '')}</p>`).join('') || '<p class="note">今天沒有設定重要提醒。</p>';
    const pi = T.selectedDay, planned = days[pi];
    $('#planTimeline').innerHTML = planned ? timeline(planned,pi, 'plan') : '';
    $('#planStay').innerHTML = hotel(planned?.stay); $('#planStay').hidden = !planned?.stay?.name;
    $('#planTimeline').hidden = routeMode; $('#routeMap').hidden = !routeMode;
    const pts = planned?.items || [];
    $('#routeMap').innerHTML = `<p class="note">每日路線總覽；導航與實際道路地圖於 Google Maps 開啟。</p>${pts.map((it,i) => `<div class="route-point"><b>${i+1}</b><div>${esc(it.name)}<p class="note">${drive(leg(pts,i))}</p>${nav(it)}</div></div>`).join('')}${pts.length > 1 ? `<a class="nav-btn" target="_blank" rel="noreferrer" href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pts[0].map || pts[0].name)}&destination=${encodeURIComponent(pts.at(-1).map || pts.at(-1).name)}&waypoints=${encodeURIComponent(pts.slice(1,-1).map(it => it.map || it.name).join('|'))}&travelmode=driving">在 Google Maps 查看全日路線 ↗</a><p class="note">導航服務可能限制中途站數；若未完整顯示，請使用各站導航。</p>` : ''}`;
    $('#allHotels').innerHTML = days.map((d,i) => `<details data-detail-key="hotel:${i}"><summary>Day ${i+1} · ${esc(d.stay?.name || '住宿待安排')}</summary>${hotel(d.stay)}</details>`).join('');
    const cats = ['加油','高速公路','ETC','停車','租車'];
    for (const c of cats) if (![...$('#expCategory').options].some(o => o.value === c)) $('#expCategory').add(new Option(c,c));
    const expenses = T.expenses.filter(x => !x.deleted);
    const driving = expenses.filter(x => [...cats,'加油停車'].includes(x.category));
    $('#drivingCosts').innerHTML = [...cats,'加油停車'].map(c => `<p>${c}<b>${esc(T.trip.currency?.symbol || '¥')}${driving.filter(x=>x.category===c).reduce((s,x)=>s+x.amount,0).toLocaleString()}</b></p>`).join('') + `<p><strong>自駕成本合計</strong><b>${esc(T.trip.currency?.symbol || '¥')}${driving.reduce((s,x)=>s+x.amount,0).toLocaleString()}</b></p>`;
    if (!resetDetails) document.querySelectorAll('[data-detail-key]').forEach(el => { if(expanded.has(el.dataset.detailKey)) el.open=expanded.get(el.dataset.detailKey); });
    resetDetails = false;
    $('#quickAmounts').innerHTML = [500,1000,2000,5000].map(n=>`<button type="button" class="mini" data-amount="${n}">${esc(T.trip.currency?.symbol || '¥')}${n.toLocaleString()}</button>`).join('');
  }
  async function loadWeather(day, di) {
    const point = day?.items?.find(it => Number.isFinite(it.lat) && Number.isFinite(it.lng));
    const date = T.parseDate(T.trip.startDate), target = date ? T.iso(T.addDays(date,di)) : '';
    const key = `${target}:${point?.lat}:${point?.lng}`;
    if (weatherKey === key) return;
    weatherKey = key; weatherRain = 0; weatherText = '';
    const diff = date ? T.dayCount(T.parseDate(C.localTime(T.trip.timeZone).date),T.addDays(date,di)) : -1;
    if (!point || diff < 0 || diff > 15) { weatherText = !point ? '補上景點經緯度即可查詢天氣。' : '天氣預報尚未涵蓋此行程日期。'; $('#weatherInfo') && ($('#weatherInfo').textContent = weatherText); return; }
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lng}&daily=temperature_2m_max,precipitation_probability_max,wind_speed_10m_max&timezone=auto&start_date=${target}&end_date=${target}`, {signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error();
      const data = await response.json(); if (weatherKey !== key) return;
      weatherRain = data.daily.precipitation_probability_max[0] || 0;
      weatherText = `最高 ${data.daily.temperature_2m_max[0]}°C · 降雨 ${weatherRain}% · 最大風速 ${data.daily.wind_speed_10m_max[0]} km/h（Open-Meteo，每日預報）`;
      localStorage.setItem(`weather:${key}`, JSON.stringify({text:weatherText,rain:weatherRain,time:new Date().toLocaleString()}));
    } catch (_) {
      if (weatherKey !== key) return;
      let cached; try { cached = JSON.parse(localStorage.getItem(`weather:${key}`)); } catch (_) {}
      weatherText = cached ? `${cached.text} · 快取於 ${cached.time}` : '天氣暫時無法取得，請稍後重試。'; weatherRain = cached?.rain || 0;
    }
    render();
  }
  function updateItem(value, action) {
    if (readOnly()) return;
    const [di,i] = value.split(':').map(Number), trip = structuredClone(T.trip), items = trip.days[di].items;
    if (action === 'skip') items[i].status = 'skipped';
    else { const state = C.status(items[i]); if (state === 'pending') items.forEach(it => { if(C.status(it)==='current') it.status='done'; }); items[i].status = state === 'pending' ? 'current' : state === 'current' ? 'done' : 'pending'; }
    T.setTrip(trip);
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.quick && !readOnly()) {
      if (!T.trip.days.length) { T.showView('edit'); $('#notice').textContent='請先設定旅程日期與天數。'; return; }
      quickKind=b.dataset.quick; $('#quickForm').reset();
      $('#quickTitle').textContent=quickKind==='item'?'新增景點':'新增備註';
      $('#quickNameField').hidden=$('#quickTimeField').hidden=quickKind==='note';
      $('#quickName').required=quickKind==='item'; $('#quickNote').required=quickKind==='note';
      $('#quickDay').innerHTML=T.trip.days.map((d,i)=>`<option value="${i}">Day ${i+1} · ${esc(d.title)}</option>`).join('');
      const date=T.parseDate(T.trip.startDate), today=T.parseDate(C.localTime(T.trip.timeZone).date);
      $('#quickDay').value=String(Math.max(0,Math.min(date?T.dayCount(date,today):0,T.trip.days.length-1)));
      $('#quickDialog').showModal();
    }
    if (b.dataset.go) { T.showView(b.dataset.go); if(b.dataset.go==='money') $('#expAmount').focus(); }
    if (b.dataset.status) updateItem(b.dataset.status);
    if (b.dataset.skip) updateItem(b.dataset.skip,'skip');
    if (b.dataset.copy) { try { await navigator.clipboard.writeText(b.dataset.copy); $('#notice').textContent='已複製地址'; } catch (_) { $('#notice').textContent=`請手動複製：${b.dataset.copy}`; } }
    if (b.dataset.amount) { $('#expAmount').value=b.dataset.amount; $('#expNote').focus(); }
    if (b.id==='compactToggle') { compact=!compact;resetDetails=true;localStorage.setItem('tripCompact',compact);render(); }
    if (b.dataset.route) { routeMode=b.dataset.route==='map'; document.querySelectorAll('[data-route]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));render(); }
    if (b.dataset.delay==='keep') $('#delayPanel').hidden=true;
    if (b.dataset.delay==='shift' && !readOnly()) {
      const trip=structuredClone(T.trip), items=trip.days[+b.dataset.day].items;
      C.shiftPending(items, +b.dataset.min);
      T.setTrip(trip); $('#notice').textContent='已延後後續行程；跨午夜會顯示翌日，預約時間不變。';
    }
  });
  document.addEventListener('triprender',render);
  document.addEventListener('tripview',e=>{ $('#modeLabel').textContent=e.detail==='edit'?'編輯模式 · 修改自動儲存':readOnly()?'同行者唯讀模式':'旅行模式'; });
  setInterval(()=>{ if(!document.hidden && !$('#view-edit').classList.contains('active')) render(); },60000);
  window.addEventListener('online',()=>{ weatherKey='';render();$('#networkState').textContent='已連線'; });
  window.addEventListener('offline',()=>$('#networkState').textContent='離線 · 行程仍可查看，導航需要網路');
  $('#networkState').textContent=navigator.onLine?'已連線':'離線 · 行程仍可查看';
  render();
})();
