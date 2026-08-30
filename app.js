/* 旅遊行程手冊 — 純前端，沒有後端，資料都存在瀏覽器 */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const OVERRIDE_KEY = 'tripOverride';

  /* ---------------- 資料載入（檔案版本 + 本機預覽版本） ---------------- */
  const fileTrip = window.TRIP || { title: '尚未設定行程', days: [] };
  let TRIP = fileTrip, usingOverride = false;
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (raw) { TRIP = JSON.parse(raw); usingOverride = true; }
  } catch (_) { localStorage.removeItem(OVERRIDE_KEY); }

  const CUR  = TRIP.currency     || { code: 'JPY', symbol: '¥',   name: '當地幣' };
  const HOME = TRIP.homeCurrency || { code: 'TWD', symbol: 'NT$', name: '台幣' };
  const TRIP_ID = TRIP.id || 'trip';
  const K = { exp: `expenses:${TRIP_ID}`, check: `checklist:${TRIP_ID}`, rate: `rate:${CUR.code}-${HOME.code}` };

  /* ---------------- 小工具 ---------------- */
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const parseDate = s => { const [y, m, d] = String(s || '').split('-').map(Number); return (y && m && d) ? new Date(y, m - 1, d) : null; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const fmtDate = d => d ? `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）` : '';
  const dayCount = (a, b) => Math.round((b - a) / 86400000);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString('en-US');
  const money = (n, c) => `${c.symbol}${num(Math.round(n))}`;
  const mapUrl = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  const startDate = parseDate(TRIP.startDate);
  const days = TRIP.days || [];
  const dateOf = i => startDate ? addDays(startDate, i) : null;
  /* dayOffset：今天與出發日相差幾天（負數＝還沒出發）
     todayIndex：-1 = 還沒出發，days.length = 已結束 */
  const dayOffset = startDate ? dayCount(startDate, startOfToday()) : 0;
  const todayIndex = !startDate ? 0
    : (dayOffset < 0 ? -1 : (dayOffset >= days.length ? days.length : dayOffset));

  const download = (name, text, type = 'text/plain;charset=utf-8') => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ---------------- 標題區 ---------------- */
  function renderHeader() {
    document.title = TRIP.title ? `${TRIP.title}｜行程手冊` : '旅遊行程手冊';
    $('#brand').textContent = TRIP.title || '旅遊行程手冊';
    $('#heroTitle').textContent = TRIP.title || '旅遊行程手冊';
    $('#heroSubtitle').textContent = TRIP.subtitle || '';
    $('#heroEyebrow').textContent = TRIP.eyebrow || 'TRIP HANDBOOK';
    $('#dateRange').textContent = startDate && days.length
      ? `${fmtDate(startDate)} — ${fmtDate(dateOf(days.length - 1))}`
      : `${days.length} 天`;
    $('#heroMeta').innerHTML = (TRIP.highlights || []).map(h => `<span>${esc(h)}</span>`).join('');
    if (TRIP.chart) {
      $('#chartPanel').hidden = false;
      $('#chartImg').src = TRIP.chart;
      $('#chartLink').href = TRIP.chart;
    }
  }

  /* ---------------- 時間軸 ---------------- */
  function stopHtml(it) {
    const target = it.mapUrl || (it.map || it.name);
    const nav = (it.map === false || !target) ? '' :
      `<a class="nav-btn" target="_blank" rel="noreferrer" href="${esc(it.mapUrl || mapUrl(it.map || it.name))}">開啟導航 ↗</a>`;
    const link = it.link ? `<a class="nav-btn ghost" target="_blank" rel="noreferrer" href="${esc(it.link)}">官網 ↗</a>` : '';
    const tag = it.tag ? `<span class="tag">${esc(it.tag)}</span>` : '';
    const cost = it.cost ? `<span class="tag cost">約 ${money(it.cost, CUR)}</span>` : '';
    return `<article class="stop">
      <div class="time">${esc(it.time || '')}</div>
      <div>
        <h3>${esc(it.name || '')}</h3>
        ${it.desc ? `<p class="desc">${esc(it.desc)}</p>` : ''}
        <div class="chips">${tag}${cost}${nav}${link}</div>
      </div>
    </article>`;
  }

  const timelineHtml = day => (day.items || []).map(stopHtml).join('') || '<p class="empty">這一天還沒有安排。</p>';

  function stayInner(day) {
    if (!day.stay || !day.stay.name) return '';
    const q = day.stay.map ?? day.stay.name;
    return `<strong>今晚落腳</strong>${esc(day.stay.name)}
      ${q ? `<div style="margin-top:8px"><a class="nav-btn" target="_blank" rel="noreferrer" href="${esc(mapUrl(q))}">開啟導航 ↗</a></div>` : ''}`;
  }
  const stayHtml = day => { const i = stayInner(day); return i ? `<div class="stay">${i}</div>` : ''; };

  /* ---------------- 今天 ---------------- */
  function renderToday() {
    const before = todayIndex < 0, after = todayIndex >= days.length;
    const idx = before ? 0 : (after ? days.length - 1 : todayIndex);
    const day = days[idx];
    if (!day) return;

    $('#todayEyebrow').textContent = before ? '出發第一天預覽' : (after ? '旅程回顧・最後一天' : `${fmtDate(dateOf(idx))}　今天`);
    $('#todayTitle').textContent = day.title || `Day ${idx + 1}`;
    $('#todayBadge').textContent = `DAY ${idx + 1}`;
    $('#todayStay').innerHTML = stayHtml(day);
    $('#todayTimeline').innerHTML = timelineHtml(day);

    if (before) {
      $('#countdownLabel').textContent = '距離出發';
      $('#countdownValue').textContent = -dayOffset === 1 ? '明天出發' : `${-dayOffset} 天`;
    } else if (after) {
      $('#countdownLabel').textContent = '旅程狀態';
      $('#countdownValue').textContent = '已結束';
    } else {
      $('#countdownLabel').textContent = '旅程進度';
      $('#countdownValue').textContent = `Day ${todayIndex + 1} / ${days.length}`;
    }
    const next = days[idx + 1];
    $('#nextHighlight').textContent = next
      ? `Day ${idx + 2}・${next.title || ''}`
      : (after ? '沒有下一站了，回家整理照片吧。' : '這是最後一天。');
  }

  /* ---------------- 行程 ---------------- */
  let selectedDay = todayIndex < 0 ? 0 : Math.min(todayIndex, days.length - 1);

  function renderPlan() {
    $('#dayTabs').innerHTML = days.map((d, i) =>
      `<button data-day="${i}" class="${i === selectedDay ? 'active' : ''}${i === todayIndex ? ' today' : ''}">Day ${i + 1}<small>${esc(fmtDate(dateOf(i)))}</small></button>`
    ).join('');
    const d = days[selectedDay];
    if (!d) return;
    $('#planTitle').textContent = `Day ${selectedDay + 1}　${d.title || ''}`;
    $('#planDate').textContent = fmtDate(dateOf(selectedDay)) || `第 ${selectedDay + 1} 天`;
    $('#planTimeline').innerHTML = timelineHtml(d);
    const stay = stayInner(d);
    $('#planStay').innerHTML = stay;
    $('#planStay').hidden = !stay;
    $('#planNotes').textContent = d.notes || '';
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-day]');
    if (b) { selectedDay = +b.dataset.day; renderPlan(); }
  });

  /* ---------------- 打包清單 ---------------- */
  function renderChecklist() {
    const items = TRIP.checklist || [];
    if (!items.length) return;
    $('#checklistPanel').hidden = false;
    let done = [];
    try { done = JSON.parse(localStorage.getItem(K.check) || '[]'); } catch (_) {}
    $('#checklist').innerHTML = items.map((t, i) =>
      `<label class="${done.includes(i) ? 'done' : ''}"><input type="checkbox" data-check="${i}" ${done.includes(i) ? 'checked' : ''}><span>${esc(t)}</span></label>`
    ).join('');
    $('#checkProgress').textContent = `${done.filter(i => i < items.length).length}/${items.length}`;
  }

  document.addEventListener('change', e => {
    const c = e.target.closest('[data-check]');
    if (!c) return;
    let done = [];
    try { done = JSON.parse(localStorage.getItem(K.check) || '[]'); } catch (_) {}
    const i = +c.dataset.check;
    done = c.checked ? [...new Set([...done, i])] : done.filter(x => x !== i);
    localStorage.setItem(K.check, JSON.stringify(done));
    renderChecklist();
  });

  /* ---------------- 匯率 ---------------- */
  let rate = TRIP.defaultRate || 0.21, rateSource = '預設值';
  try {
    const cached = JSON.parse(localStorage.getItem(K.rate) || 'null');
    if (cached && cached.rate > 0) { rate = cached.rate; rateSource = `${cached.source}（上次抓取 ${cached.at}）`; }
  } catch (_) {}

  const RATE_SOURCES = [
    { name: 'currency-api', url: `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${CUR.code.toLowerCase()}.json`,
      pick: d => d?.[CUR.code.toLowerCase()]?.[HOME.code.toLowerCase()] },
    { name: 'currency-api（備援）', url: `https://latest.currency-api.pages.dev/v1/currencies/${CUR.code.toLowerCase()}.json`,
      pick: d => d?.[CUR.code.toLowerCase()]?.[HOME.code.toLowerCase()] },
    { name: 'open.er-api.com', url: `https://open.er-api.com/v6/latest/${CUR.code}`,
      pick: d => d?.rates?.[HOME.code] }
  ];

  async function fetchRate() {
    $('#fxSource').textContent = '正在抓取最新匯率…';
    for (const s of RATE_SOURCES) {
      try {
        const r = await fetch(s.url, { cache: 'no-store' });
        if (!r.ok) continue;
        const v = Number(s.pick(await r.json()));
        if (!Number.isFinite(v) || v <= 0) continue;
        rate = v; rateSource = s.name;
        localStorage.setItem(K.rate, JSON.stringify({ rate: v, source: s.name, at: new Date().toLocaleString('zh-TW') }));
        $('#fxRate').value = v.toFixed(4);
        fxFrom('foreign'); renderExpenses();
        $('#fxSource').textContent = `匯率來源：${s.name}｜更新於 ${new Date().toLocaleString('zh-TW')}｜僅供參考，實際以刷卡／換匯為準。`;
        return;
      } catch (_) { /* 換下一個來源 */ }
    }
    $('#fxSource').textContent = `抓不到線上匯率（可能離線），目前使用：${rateSource}。可直接手動修改上面的匯率。`;
  }

  function renderFxStatic() {
    $('#fxHeading').textContent = `${CUR.name} ⇄ ${HOME.name}`;
    $('#fxForeignLabel').textContent = `${CUR.name}（${CUR.code}）`;
    $('#fxHomeLabel').textContent = `${HOME.name}（${HOME.code}）`;
    $('#fxRate').value = Number(rate).toFixed(4);
    $('#fxSource').textContent = `目前匯率來源：${rateSource}`;
  }

  function fxTable() {
    const r = +$('#fxRate').value || rate;
    $('#fxTable').innerHTML = [100, 500, 1000, 3000, 5000, 10000, 30000]
      .map(v => `<tr><td>${money(v, CUR)}</td><td>${money(v * r, HOME)}</td></tr>`).join('');
  }

  function fxFrom(which) {
    const r = +$('#fxRate').value || rate;
    rate = r;
    if (which === 'home') {
      const h = +$('#fxHome').value || 0;
      $('#fxForeign').value = r ? Math.round(h / r) : 0;
    } else {
      $('#fxForeign').value = $('#fxForeign').value || 0;
      $('#fxHome').value = Math.round((+$('#fxForeign').value || 0) * r);
    }
    $('#fxResult').textContent = `${money(+$('#fxForeign').value || 0, CUR)} ≈ ${money(+$('#fxHome').value || 0, HOME)}`;
    fxTable();
  }

  /* ---------------- 花費 ---------------- */
  let expenses = [];
  try { expenses = JSON.parse(localStorage.getItem(K.exp) || '[]'); } catch (_) {}
  const saveExpenses = () => localStorage.setItem(K.exp, JSON.stringify(expenses));

  function renderExpenseForm() {
    $('#expCategory').innerHTML = (TRIP.categories || ['餐飲', '交通', '購物', '門票', '住宿', '其他'])
      .map(c => `<option>${esc(c)}</option>`).join('');
    const cur = todayIndex < 0 ? 0 : Math.min(todayIndex, days.length - 1);
    $('#expDay').innerHTML = days.map((d, i) =>
      `<option value="${i}" ${i === cur ? 'selected' : ''}>Day ${i + 1}　${esc(d.title || '')}</option>`).join('')
      || '<option value="0">Day 1</option>';
  }

  function bars(el, rows, total) {
    if (!rows.length || !total) { el.innerHTML = ''; return; }
    el.innerHTML = rows.map(([label, v]) => `<div class="bar-row">
      <div class="bar-label"><span>${esc(label)}</span><span>${money(v, CUR)}　${Math.round(v / total * 100)}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(v / total * 100).toFixed(1)}%"></div></div>
    </div>`).join('');
  }

  function renderExpenses() {
    const r = +$('#fxRate')?.value || rate;
    const total = expenses.reduce((s, x) => s + x.amount, 0);
    const totalHome = expenses.reduce((s, x) => s + (x.amount * (x.rate || r)), 0);

    $('#expTotal').innerHTML = `${money(total, CUR)}<small>約 ${money(totalHome, HOME)}</small>`;
    $('#todaySpend').textContent = money(total, CUR);
    $('#todaySpendSub').textContent = `約 ${money(totalHome, HOME)}・共 ${expenses.length} 筆`;

    $('#expList').innerHTML = expenses.length ? expenses.slice().reverse().map(x => {
      const i = expenses.indexOf(x);
      return `<div class="exp">
        <span class="meta"><b>${esc(x.category)}</b> ${esc(x.note || '')}<em>Day ${x.day + 1}・${esc(x.date || '')}</em></span>
        <span class="amt">${money(x.amount, CUR)}<small>約 ${money(x.amount * (x.rate || r), HOME)}</small></span>
        <button data-del="${i}" title="刪除">刪除</button>
      </div>`;
    }).join('') : '<p class="empty">還沒有紀錄，從第一筆旅費開始。</p>';

    const byCat = {}, byDay = {};
    expenses.forEach(x => {
      byCat[x.category] = (byCat[x.category] || 0) + x.amount;
      byDay[x.day] = (byDay[x.day] || 0) + x.amount;
    });
    bars($('#expBars'), Object.entries(byCat).sort((a, b) => b[1] - a[1]), total);
    bars($('#expDayBars'), Object.entries(byDay).sort((a, b) => a[0] - b[0])
      .map(([d, v]) => [`Day ${+d + 1}`, v]), total);
    $('#expBarsEmpty').hidden = expenses.length > 0;
  }

  function bindExpenses() {
    $('#expForm').addEventListener('submit', e => {
      e.preventDefault();
      const amount = +$('#expAmount').value;
      if (!(amount > 0)) return;
      expenses.push({
        id: Date.now(),
        date: new Date().toLocaleDateString('zh-TW'),
        day: +$('#expDay').value || 0,
        category: $('#expCategory').value,
        amount,
        note: $('#expNote').value.trim(),
        rate: +$('#fxRate').value || rate
      });
      saveExpenses();
      $('#expAmount').value = ''; $('#expNote').value = '';
      renderExpenses();
    });

    $('#expList').addEventListener('click', e => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      if (!confirm('確定刪除這筆花費？')) return;
      expenses.splice(+b.dataset.del, 1); saveExpenses(); renderExpenses();
    });

    $('#expExport').addEventListener('click', () => {
      if (!expenses.length) return alert('目前沒有花費紀錄。');
      const head = ['日期', '第幾天', '分類', `金額(${CUR.code})`, `約(${HOME.code})`, '匯率', '備註'];
      const rows = expenses.map(x => [x.date, `Day ${x.day + 1}`, x.category, x.amount,
        Math.round(x.amount * (x.rate || rate)), x.rate || rate, x.note || '']);
      const csv = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      download(`${TRIP_ID}-花費.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
    });

    $('#expClear').addEventListener('click', () => {
      if (!expenses.length) return;
      if (!confirm('會刪掉全部花費紀錄，且無法復原。確定嗎？')) return;
      expenses = []; saveExpenses(); renderExpenses();
    });
  }

  /* ---------------- 編輯行程 ---------------- */
  function bindEditor() {
    const ta = $('#tripJson');
    ta.value = JSON.stringify(TRIP, null, 2);
    $('#editState').textContent = usingOverride ? '本機預覽版本' : '檔案版本';

    const msg = (t, ok = true) => { $('#tripMsg').textContent = t; $('#tripMsg').style.color = ok ? '' : 'var(--hot)'; };
    const parse = () => { try { return JSON.parse(ta.value); } catch (err) { msg('JSON 格式有誤：' + err.message, false); return null; } };

    $('#tripApply').addEventListener('click', () => {
      const t = parse(); if (!t) return;
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(t));
      msg('已套用，重新載入中…'); setTimeout(() => location.reload(), 400);
    });
    $('#tripFormat').addEventListener('click', () => {
      const t = parse(); if (!t) return;
      ta.value = JSON.stringify(t, null, 2); msg('格式化完成，JSON 沒有問題。');
    });
    $('#tripDownload').addEventListener('click', () => {
      const t = parse(); if (!t) return;
      download('trip.js', '/* 行程資料：覆蓋到專案的 data/trip.js */\nwindow.TRIP = '
        + JSON.stringify(t, null, 2) + ';\n', 'text/javascript;charset=utf-8');
      msg('已下載 trip.js，把它覆蓋到專案的 data/trip.js 再 push 上 GitHub。');
    });
    $('#tripReset').addEventListener('click', () => {
      if (!confirm('會丟掉本機的預覽修改，回到 data/trip.js 的內容。確定嗎？')) return;
      localStorage.removeItem(OVERRIDE_KEY); location.reload();
    });
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

  /* ---------------- 啟動 ---------------- */
  renderHeader();
  renderToday();
  renderPlan();
  renderChecklist();
  renderExpenseForm();
  renderFxStatic();
  bindExpenses();
  bindEditor();
  renderExpenses();
  fxFrom('foreign');

  $$('.tabbar button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#fxForeign').addEventListener('input', () => fxFrom('foreign'));
  $('#fxHome').addEventListener('input', () => fxFrom('home'));
  $('#fxRate').addEventListener('input', () => { fxFrom('foreign'); renderExpenses(); });
  $('#fxRefresh').addEventListener('click', fetchRate);
  window.addEventListener('hashchange', () => showView(location.hash.slice(1) || 'today', false));

  showView(location.hash.slice(1) || 'today', false);
  fetchRate();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
