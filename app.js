/* 旅遊行程手冊 — 檢視端。純前端，沒有後端，資料都存在瀏覽器。
   對外公開 window.TripApp，給 editor.js 使用。 */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const OVERRIDE_KEY = 'tripOverride';

  /* ---------------- 狀態 ---------------- */
  const fileTrip = window.TRIP || { title: '尚未設定行程', days: [] };
  let trip = fileTrip, usingOverride = false;
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (raw) { trip = JSON.parse(raw); usingOverride = true; }
  } catch (_) { localStorage.removeItem(OVERRIDE_KEY); }

  const CUR  = () => trip.currency     || { code: 'JPY', symbol: '¥',   name: '當地幣' };
  const HOME = () => trip.homeCurrency || { code: 'TWD', symbol: 'NT$', name: '台幣' };
  const DAYS = () => trip.days || [];
  const KEY  = { exp: () => `expenses:${trip.id || 'trip'}`, check: () => `checklist:${trip.id || 'trip'}` };

  /* ---------------- 小工具 ---------------- */
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const parseDate = s => { const [y, m, d] = String(s || '').split('-').map(Number); return (y && m && d) ? new Date(y, m - 1, d) : null; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const fmtDate = d => d ? `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）` : '';
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayCount = (a, b) => Math.round((b - a) / 86400000);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString('en-US');
  const money = (n, c) => `${c.symbol}${num(Math.round(n))}`;
  const mapUrl = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  /* 車程估算：直線距離 × 1.35（一般道路繞路係數）÷ 平均時速 40 km/h。
     不需要任何 API 金鑰，離線可用，誤差約 ±15%，足夠判斷「會不會開太久」。 */
  const DETOUR = 1.35, KMH = 40;
  const hasGeo = p => p && typeof p.lat === 'number' && typeof p.lng === 'number';
  function driveInfo(a, b) {
    if (!hasGeo(a) || !hasGeo(b)) return null;
    const rad = d => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    const km = 6371 * 2 * Math.asin(Math.sqrt(h)) * DETOUR;
    return { km, min: Math.round(km / KMH * 60) };
  }

  const startDate = () => parseDate(trip.startDate);
  const dateOf = i => { const s = startDate(); return s ? addDays(s, i) : null; };
  /* dayOffset：今天與出發日相差幾天（負數＝還沒出發） */
  const dayOffset = () => { const s = startDate(); return s ? dayCount(s, startOfToday()) : 0; };
  /* todayIndex：-1 = 還沒出發，days.length = 已結束 */
  const todayIndex = () => {
    const s = startDate(); if (!s) return 0;
    const n = dayOffset(), len = DAYS().length;
    return n < 0 ? -1 : (n >= len ? len : n);
  };

  const download = (name, text, type = 'text/plain;charset=utf-8') => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ---------------- 航班 ---------------- */
  function flightText(f) {
    if (!f || (!f.no && !f.from && !f.to)) return '';
    const route = [f.from, f.to].filter(Boolean).join(' → ');
    const time = [f.depTime, f.arrTime].filter(Boolean).join(' – ');
    const d = parseDate(f.date);
    return [[f.airline, f.no].filter(Boolean).join(' '), d ? fmtDate(d) : (f.date || ''), route, time]
      .filter(Boolean).join('　');
  }

  function renderFlights() {
    const fl = trip.flights || {};
    const rows = [['去程', fl.outbound], ['回程', fl.inbound]]
      .map(([label, f]) => [label, flightText(f), f])
      .filter(r => r[1]);
    const panel = $('#flightPanel');
    if (!panel) return;
    panel.hidden = !rows.length;
    $('#flightList').innerHTML = rows.map(([label, text, f]) => `<div class="card">
      <h3>${label}</h3><p>${esc(text)}</p>${f.note ? `<p class="note">${esc(f.note)}</p>` : ''}</div>`).join('');
  }

  /* ---------------- 標題區 ---------------- */
  function renderHeader() {
    document.title = trip.title ? `${trip.title}｜行程手冊` : '旅遊行程手冊';
    $('#brand').textContent = trip.title || '旅遊行程手冊';
    $('#heroTitle').textContent = trip.title || '旅遊行程手冊';
    $('#heroSubtitle').textContent = trip.subtitle || '';
    $('#heroEyebrow').textContent = trip.eyebrow || 'TRIP HANDBOOK';
    const s = startDate(), len = DAYS().length;
    $('#dateRange').textContent = s && len ? `${fmtDate(s)} — ${fmtDate(dateOf(len - 1))}` : `${len} 天`;

    const fl = trip.flights || {};
    const auto = [
      flightText(fl.outbound) && `去程 ${flightText(fl.outbound)}`,
      flightText(fl.inbound) && `回程 ${flightText(fl.inbound)}`
    ].filter(Boolean);
    $('#heroMeta').innerHTML = [...auto, ...(trip.highlights || [])].map(h => `<span>${esc(h)}</span>`).join('');

    const cp = $('#chartPanel');
    cp.hidden = !trip.chart;
    if (trip.chart) { $('#chartImg').src = trip.chart; $('#chartLink').href = trip.chart; }
  }

  /* ---------------- 時間軸 ---------------- */
  function stopHtml(it) {
    const target = it.mapUrl || (it.map === false ? '' : (it.map || it.name));
    const nav = !target ? '' :
      `<a class="nav-btn" target="_blank" rel="noreferrer" href="${esc(it.mapUrl || mapUrl(it.map || it.name))}">開啟導航 ↗</a>`;
    const link = it.link ? `<a class="nav-btn ghost" target="_blank" rel="noreferrer" href="${esc(it.link)}">官網 ↗</a>` : '';
    const tag = it.tag ? `<span class="tag">${esc(it.tag)}</span>` : '';
    const cost = it.cost ? `<span class="tag cost">約 ${money(it.cost, CUR())}</span>` : '';
    return `<article class="stop">
      <div class="time">${esc(it.time || '')}</div>
      <div>
        <h3>${esc(it.name || '')}</h3>
        ${it.desc ? `<p class="desc">${esc(it.desc)}</p>` : ''}
        <div class="chips">${tag}${cost}${nav}${link}</div>
      </div>
    </article>`;
  }

  /* 兩站之間的車程；超過 90 分鐘標紅提醒 */
  function legHtml(a, b) {
    const d = driveInfo(a, b);
    if (!d || d.min < 3) return '';
    return `<div class="leg${d.min > 90 ? ' far' : ''}">🚗 車程約 ${d.min} 分・${d.km.toFixed(0)} km${d.min > 90 ? '（偏長，考慮拆天或換順序）' : ''}</div>`;
  }

  const timelineHtml = day => {
    const items = day.items || [];
    if (!items.length) return '<p class="empty">這一天還沒有安排，到「設定」分頁加入行程點。</p>';
    return items.map((it, i) => (i ? legHtml(items[i - 1], it) : '') + stopHtml(it)).join('');
  };

  function stayInner(day) {
    if (!day.stay || !day.stay.name) return '';
    const q = day.stay.map ?? day.stay.name;
    return `<strong>今晚落腳</strong>${esc(day.stay.name)}
      ${q ? `<div style="margin-top:8px"><a class="nav-btn" target="_blank" rel="noreferrer" href="${esc(mapUrl(q))}">開啟導航 ↗</a></div>` : ''}`;
  }
  const stayHtml = day => { const i = stayInner(day); return i ? `<div class="stay">${i}</div>` : ''; };

  /* ---------------- 今天 ---------------- */
  function renderToday() {
    const days = DAYS(), ti = todayIndex(), off = dayOffset();
    const before = ti < 0, after = ti >= days.length;
    const idx = days.length ? (before ? 0 : (after ? days.length - 1 : ti)) : -1;
    const day = days[idx];

    if (!day) {
      $('#todayEyebrow').textContent = '尚未設定';
      $('#todayTitle').textContent = '還沒有行程';
      $('#todayBadge').textContent = '—';
      $('#todayStay').innerHTML = '';
      $('#todayTimeline').innerHTML = '<p class="empty">到「設定」分頁選擇目的地與日期，就會自動建立行程框架。</p>';
      $('#countdownLabel').textContent = '狀態';
      $('#countdownValue').textContent = '—';
      $('#nextHighlight').textContent = '—';
      return;
    }

    $('#todayEyebrow').textContent = before ? '出發第一天預覽' : (after ? '旅程回顧・最後一天' : `${fmtDate(dateOf(idx))}　今天`);
    $('#todayTitle').textContent = day.title || `Day ${idx + 1}`;
    $('#todayBadge').textContent = `DAY ${idx + 1}`;
    $('#todayStay').innerHTML = stayHtml(day);
    $('#todayTimeline').innerHTML = timelineHtml(day);

    if (before) {
      $('#countdownLabel').textContent = '距離出發';
      $('#countdownValue').textContent = -off === 1 ? '明天出發' : `${-off} 天`;
    } else if (after) {
      $('#countdownLabel').textContent = '旅程狀態';
      $('#countdownValue').textContent = '已結束';
    } else {
      $('#countdownLabel').textContent = '旅程進度';
      $('#countdownValue').textContent = `Day ${ti + 1} / ${days.length}`;
    }
    const next = days[idx + 1];
    $('#nextHighlight').textContent = next ? `Day ${idx + 2}・${next.title || ''}`
      : (after ? '沒有下一站了，回家整理照片吧。' : '這是最後一天。');
  }

  /* ---------------- 行程 ---------------- */
  let selectedDay = 0;
  function clampSelected() {
    const len = DAYS().length;
    if (!len) { selectedDay = 0; return; }
    const ti = todayIndex();
    if (selectedDay >= len) selectedDay = len - 1;
    if (selectedDay < 0) selectedDay = ti < 0 ? 0 : Math.min(ti, len - 1);
  }

  function renderPlan() {
    const days = DAYS(); clampSelected();
    const ti = todayIndex();
    $('#dayTabs').innerHTML = days.map((d, i) =>
      `<button data-day="${i}" class="${i === selectedDay ? 'active' : ''}${i === ti ? ' today' : ''}">Day ${i + 1}<small>${esc(fmtDate(dateOf(i)))}</small></button>`
    ).join('');
    const d = days[selectedDay];
    if (!d) {
      $('#planTitle').textContent = '還沒有行程';
      $('#planDate').textContent = '—';
      $('#planTimeline').innerHTML = '<p class="empty">到「設定」分頁建立行程。</p>';
      $('#planStay').hidden = true; $('#planNotes').textContent = '';
      return;
    }
    $('#planTitle').textContent = `Day ${selectedDay + 1}　${d.title || ''}`;
    $('#planDate').textContent = fmtDate(dateOf(selectedDay)) || `第 ${selectedDay + 1} 天`;
    $('#planTimeline').innerHTML = timelineHtml(d);
    const stay = stayInner(d);
    $('#planStay').innerHTML = stay;
    $('#planStay').hidden = !stay;
    $('#planNotes').textContent = d.notes || '';
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('#dayTabs [data-day]');
    if (b) { selectedDay = +b.dataset.day; renderPlan(); }
  });

  /* ---------------- 打包清單 ---------------- */
  function renderChecklist() {
    const items = trip.checklist || [];
    $('#checklistPanel').hidden = !items.length;
    if (!items.length) return;
    const done = readChecked();
    $('#checklist').innerHTML = items.map((t, i) =>
      `<label class="${done.includes(t) ? 'done' : ''}"><input type="checkbox" data-check="${i}" ${done.includes(t) ? 'checked' : ''}><span>${esc(t)}</span></label>`
    ).join('');
    $('#checkProgress').textContent = `${items.filter(t => done.includes(t)).length}/${items.length}`;
  }

  /* 勾選狀態以「項目文字」記錄，清單增刪或改順序後才不會勾錯 */
  function readChecked() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY.check()) || '[]');
      return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
    } catch (_) { return []; }
  }

  document.addEventListener('change', e => {
    const c = e.target.closest('[data-check]');
    if (!c) return;
    const text = (trip.checklist || [])[+c.dataset.check];
    if (text === undefined) return;
    const done = readChecked();
    const next = c.checked ? [...new Set([...done, text])] : done.filter(x => x !== text);
    localStorage.setItem(KEY.check(), JSON.stringify(next));
    renderChecklist();
  });

  /* ---------------- 匯率 ---------------- */
  let rate = trip.defaultRate || 0.21, rateSource = '預設值';
  const rateKey = () => `rate:${CUR().code}-${HOME().code}`;
  try {
    const cached = JSON.parse(localStorage.getItem(rateKey()) || 'null');
    if (cached && cached.rate > 0) { rate = cached.rate; rateSource = `${cached.source}（上次抓取 ${cached.at}）`; }
  } catch (_) {}

  const rateSources = () => {
    const a = CUR().code.toLowerCase(), b = HOME().code.toLowerCase();
    const list = [
      { name: 'currency-api', url: `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${a}.json`, pick: d => d?.[a]?.[b] },
      { name: 'currency-api（備援）', url: `https://latest.currency-api.pages.dev/v1/currencies/${a}.json`, pick: d => d?.[a]?.[b] },
      { name: 'open.er-api.com', url: `https://open.er-api.com/v6/latest/${CUR().code}`, pick: d => d?.rates?.[HOME().code] }
    ];

    /* 設了同步端點就排第 0 順位。出國時擋掉 CDN 的是「你當地的網路」，
       Worker 在 Cloudflare 邊緣去抓不受影響，而且上游全掛時還有昨天的值可回，
       不會一路掉到 trip.js 裡寫死的 defaultRate。只要端點就好，不需要行程碼。 */
    const api = window.TripSync && window.TripSync.base();
    if (api) list.unshift({
      name: '自己的匯率端點',
      url: `${api}/api/rate?from=${CUR().code}&to=${HOME().code}`,
      pick: d => d?.rate
    });
    return list;
  };

  async function fetchRate() {
    $('#fxSource').textContent = '正在抓取最新匯率…';
    for (const s of rateSources()) {
      try {
        const r = await fetch(s.url, { cache: 'no-store' });
        if (!r.ok) continue;
        const v = Number(s.pick(await r.json()));
        if (!Number.isFinite(v) || v <= 0) continue;
        rate = v; rateSource = s.name;
        localStorage.setItem(rateKey(), JSON.stringify({ rate: v, source: s.name, at: new Date().toLocaleString('zh-TW') }));
        $('#fxRate').value = v.toFixed(4);
        fxFrom('foreign'); renderExpenses();
        $('#fxSource').textContent = `匯率來源：${s.name}｜更新於 ${new Date().toLocaleString('zh-TW')}｜僅供參考，實際以刷卡／換匯為準。`;
        return;
      } catch (_) {}
    }
    $('#fxSource').textContent = `抓不到線上匯率（可能離線），目前使用：${rateSource}。可直接手動修改上面的匯率。`;
  }

  function renderFxStatic() {
    $('#fxHeading').textContent = `${CUR().name} ⇄ ${HOME().name}`;
    $('#fxForeignLabel').textContent = `${CUR().name}（${CUR().code}）`;
    $('#fxHomeLabel').textContent = `${HOME().name}（${HOME().code}）`;
    $('#fxRate').value = Number(rate).toFixed(4);
    $('#fxSource').textContent = `目前匯率來源：${rateSource}`;
  }

  function fxTable() {
    const r = +$('#fxRate').value || rate;
    $('#fxTable').innerHTML = [100, 500, 1000, 3000, 5000, 10000, 30000]
      .map(v => `<tr><td>${money(v, CUR())}</td><td>${money(v * r, HOME())}</td></tr>`).join('');
  }

  function fxFrom(which) {
    const r = +$('#fxRate').value || rate;
    rate = r;
    if (which === 'home') {
      $('#fxForeign').value = r ? Math.round((+$('#fxHome').value || 0) / r) : 0;
    } else {
      $('#fxHome').value = Math.round((+$('#fxForeign').value || 0) * r);
    }
    $('#fxResult').textContent = `${money(+$('#fxForeign').value || 0, CUR())} ≈ ${money(+$('#fxHome').value || 0, HOME())}`;
    fxTable();
  }

  /* ---------------- 花費 ---------------- */
  /* expenses 裡會混著已刪除的「墓碑」（deleted:true）。留著是為了跨裝置同步：
     直接把列拿掉的話，另一台裝置下次同步就會把它當成新資料再塞回來。
     所有畫面與統計都走 live()，看不到墓碑。 */
  let expenses = [];
  const live = () => expenses.filter(x => !x.deleted);

  /* 舊資料的 id 是 Date.now()，兩台裝置同一毫秒記帳就會撞號，改成加隨機尾碼 */
  const newExpId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizeExp = x => ({
    ...x,
    id: String(x.id ?? newExpId()),
    updatedAt: Number(x.updatedAt) || Number(x.id) || Date.now(),
    deleted: !!x.deleted
  });

  const loadExpenses = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY.exp()) || '[]');
      expenses = Array.isArray(v) ? v.map(normalizeExp) : [];
    } catch (_) { expenses = []; }
  };
  const saveExpenses = () => localStorage.setItem(KEY.exp(), JSON.stringify(expenses));
  loadExpenses();

  function renderExpenseForm() {
    $('#expCategory').innerHTML = (trip.categories || ['餐飲', '交通', '購物', '門票', '住宿', '其他'])
      .map(c => `<option>${esc(c)}</option>`).join('');
    const days = DAYS(), ti = todayIndex();
    const cur = days.length ? (ti < 0 ? 0 : Math.min(ti, days.length - 1)) : 0;
    $('#expDay').innerHTML = days.map((d, i) =>
      `<option value="${i}" ${i === cur ? 'selected' : ''}>Day ${i + 1}　${esc(d.title || '')}</option>`).join('')
      || '<option value="0">Day 1</option>';
  }

  function bars(el, rows, total) {
    if (!rows.length || !total) { el.innerHTML = ''; return; }
    el.innerHTML = rows.map(([label, v]) => `<div class="bar-row">
      <div class="bar-label"><span>${esc(label)}</span><span>${money(v, CUR())}　${Math.round(v / total * 100)}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(v / total * 100).toFixed(1)}%"></div></div>
    </div>`).join('');
  }

  function renderExpenses() {
    const r = +($('#fxRate')?.value) || rate;
    const rows = live();
    const total = rows.reduce((s, x) => s + x.amount, 0);
    const totalHome = rows.reduce((s, x) => s + (x.amount * (x.rate || r)), 0);

    $('#expTotal').innerHTML = `${money(total, CUR())}<small>約 ${money(totalHome, HOME())}</small>`;
    $('#todaySpend').textContent = money(total, CUR());
    $('#todaySpendSub').textContent = `約 ${money(totalHome, HOME())}・共 ${rows.length} 筆`;

    $('#expList').innerHTML = rows.length ? [...rows].reverse().map(x =>
      `<div class="exp">
        <span class="meta"><b>${esc(x.category)}</b> ${esc(x.note || '')}<em>Day ${x.day + 1}・${esc(x.date || '')}${x.by ? '・' + esc(x.by) : ''}</em></span>
        <span class="amt">${money(x.amount, CUR())}<small>約 ${money(x.amount * (x.rate || r), HOME())}</small></span>
        <button data-del="${esc(x.id)}" title="刪除">刪除</button>
      </div>`).join('') : '<p class="empty">還沒有紀錄，從第一筆旅費開始。</p>';

    const byCat = {}, byDay = {};
    rows.forEach(x => {
      byCat[x.category] = (byCat[x.category] || 0) + x.amount;
      byDay[x.day] = (byDay[x.day] || 0) + x.amount;
    });
    bars($('#expBars'), Object.entries(byCat).sort((a, b) => b[1] - a[1]), total);
    bars($('#expDayBars'), Object.entries(byDay).sort((a, b) => a[0] - b[0]).map(([d, v]) => [`Day ${+d + 1}`, v]), total);
    $('#expBarsEmpty').hidden = rows.length > 0;
  }

  function bindExpenses() {
    $('#expForm').addEventListener('submit', e => {
      e.preventDefault();
      const amount = +$('#expAmount').value;
      if (!(amount > 0)) return;
      expenses.push({
        id: newExpId(), date: new Date().toLocaleDateString('zh-TW'),
        day: +$('#expDay').value || 0, category: $('#expCategory').value,
        amount, note: $('#expNote').value.trim(), rate: +$('#fxRate').value || rate,
        by: syncName(), updatedAt: Date.now(), deleted: false
      });
      saveExpenses();
      $('#expAmount').value = ''; $('#expNote').value = '';
      renderExpenses(); pushExpenses();
    });

    $('#expList').addEventListener('click', e => {
      const b = e.target.closest('[data-del]');
      if (!b || !confirm('確定刪除這筆花費？')) return;
      const row = expenses.find(x => String(x.id) === b.dataset.del);
      if (!row) return;
      row.deleted = true; row.updatedAt = Date.now();
      saveExpenses(); renderExpenses(); pushExpenses();
    });

    $('#expExport').addEventListener('click', () => {
      const rows = live();
      if (!rows.length) return alert('目前沒有花費紀錄。');
      const head = ['日期', '第幾天', '分類', `金額(${CUR().code})`, `約(${HOME().code})`, '匯率', '記錄者', '備註'];
      const body = rows.map(x => [x.date, `Day ${x.day + 1}`, x.category, x.amount,
        Math.round(x.amount * (x.rate || rate)), x.rate || rate, x.by || '', x.note || '']);
      const csv = [head, ...body].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      download(`${trip.id || 'trip'}-花費.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
    });

    $('#expClear').addEventListener('click', () => {
      if (!live().length || !confirm('會刪掉全部花費紀錄，且無法復原。確定嗎？')) return;
      const t = Date.now();
      expenses.forEach(x => { x.deleted = true; x.updatedAt = t; });
      saveExpenses(); renderExpenses(); pushExpenses();
    });
  }

  /* ---------------- 跨裝置同步（選用） ----------------
     沒設定端點時 syncOn() 一律 false，底下每個函式都直接 return，
     網站行為和純靜態版本完全一樣。 */
  const S = () => window.TripSync;
  const syncOn = () => !!(S() && S().enabled());
  const syncName = () => (S() ? S().config.name || '' : '');
  const syncStatus = (state, msg) => { if (S()) S().setStatus(state, msg); };

  let applyingRemote = false;   // 套用遠端資料時不能再推回去，否則兩台裝置會無限互推
  let expTimer = 0, tripTimer = 0;

  function applyRemoteTrip(next) {
    if (!next || !next.days) return;
    applyingRemote = true;
    try { window.TripApp.setTrip(next); } finally { applyingRemote = false; }
  }

  async function pullExpenses() {
    if (!syncOn()) return;
    expenses = (await S().syncExpenses(expenses)).map(normalizeExp);
    saveExpenses();
    renderExpenses();
  }

  /* 記一筆帳就同步一次，但連按時要合併成一次請求 */
  function pushExpenses() {
    if (!syncOn()) return;
    clearTimeout(expTimer);
    expTimer = setTimeout(() => {
      pullExpenses()
        .then(() => syncStatus('ok', `花費已同步（${new Date().toLocaleTimeString('zh-TW')}）`))
        .catch(err => syncStatus('error', '花費同步失敗：' + err.message));
    }, 800);
  }

  /* 編輯器每改一個欄位就會 commit 一次，所以行程要壓得比花費更久才送 */
  function pushTrip() {
    if (!syncOn() || !S().canEdit() || applyingRemote) return;
    clearTimeout(tripTimer);
    tripTimer = setTimeout(async () => {
      try {
        const out = await S().pushTrip(trip);
        syncStatus('ok', `行程已同步 v${out.version}（${new Date().toLocaleTimeString('zh-TW')}）`);
      } catch (err) {
        if (err.status === 409 && err.remote) {
          syncStatus('conflict', '這份行程已被其他裝置更新');
          if (confirm('這份行程已被其他裝置更新。\n\n確定＝載入對方的版本（你剛才的修改會不見）\n取消＝保留你的版本，蓋過對方')) {
            applyRemoteTrip(err.remote.trip);
            syncStatus('ok', '已載入其他裝置的版本');
          } else {
            pushTrip();   // sync.js 已把 version 更新成伺服器現況，重送就會成功
          }
        } else {
          syncStatus('error', '行程同步失敗：' + err.message);
        }
      }
    }, 2500);
  }

  /** 手動或開站時的完整同步：先拉行程，再對帳。行程沒拉到就不動花費，避免帳本錯本。 */
  async function syncNow() {
    if (!syncOn()) return;
    syncStatus('syncing', '同步中…');
    try {
      const out = await S().pullTrip();
      if (out && out.trip) applyRemoteTrip(out.trip);
      await pullExpenses();
      syncStatus('ok', `已同步（${new Date().toLocaleTimeString('zh-TW')}）`);
    } catch (err) {
      syncStatus('error', err.status === 404 ? '找不到這個行程碼' : '同步失敗：' + err.message);
    }
  }

  /* ---------------- 分頁切換 ---------------- */
  function showView(name, push = true) {
    const target = $('#view-' + name);
    if (!target) return;
    $$('.view').forEach(v => v.classList.remove('active'));
    target.classList.add('active');
    $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'plan') renderPlan();
    if (push && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 整體重繪 ---------------- */
  function renderAll() {
    renderHeader(); renderFlights(); renderToday(); renderPlan(); renderChecklist();
    renderExpenseForm(); renderFxStatic(); loadExpenses(); renderExpenses(); fxFrom('foreign');
  }

  /* ---------------- 對外 API（給 editor.js） ---------------- */
  window.TripApp = {
    get trip() { return trip; },
    get fileTrip() { return fileTrip; },
    get usingOverride() { return usingOverride; },
    /** 更新行程；persist=false 時只重繪不寫入 localStorage */
    setTrip(next, persist = true) {
      trip = next;
      if (persist) { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next)); usingOverride = true; }
      renderAll();
      if (persist) pushTrip();
    },
    clearOverride() { localStorage.removeItem(OVERRIDE_KEY); trip = fileTrip; usingOverride = false; renderAll(); },
    renderAll, showView, download, esc, fmtDate, parseDate, iso, addDays, dayCount, driveInfo,
    syncNow, pullExpenses, applyRemoteTrip,
    get expenses() { return expenses; },
    get selectedDay() { return selectedDay; },
    set selectedDay(v) { selectedDay = v; renderPlan(); }
  };

  /* ---------------- 啟動 ---------------- */
  clampSelected();
  renderAll();
  bindExpenses();

  $$('.tabbar button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#fxForeign').addEventListener('input', () => fxFrom('foreign'));
  $('#fxHome').addEventListener('input', () => fxFrom('home'));
  $('#fxRate').addEventListener('input', () => { fxFrom('foreign'); renderExpenses(); });
  $('#fxRefresh').addEventListener('click', fetchRate);
  window.addEventListener('hashchange', () => showView(location.hash.slice(1) || 'today', false));

  showView(location.hash.slice(1) || 'today', false);
  fetchRate();

  /* 分享連結 ?trip=CODE&api=... 會在這裡被吃掉並寫進設定，網址列隨即清乾淨 */
  if (S()) {
    const adopted = S().adoptFromUrl();
    if (syncOn()) syncNow();
    else if (adopted) syncStatus('error', '這個分享連結沒有帶同步端點，請到「設定」分頁補上。');
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
