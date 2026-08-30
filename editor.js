/* 行程編輯器 — 表單化編輯，即時存進 localStorage，可下載成 data/trip.js 發布 */
(() => {
  'use strict';
  const T = window.TripApp, P = window.PRESETS || { destinations: [], currencies: [], categories: [] };
  if (!T) return;

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = T.esc;

  let draft = clone(T.trip);
  let edDay = 0;
  let trimmed = [];   // 這次縮短天數時被裁掉的日子，重新延長時可救回（只存在本次瀏覽）

  const days = () => (draft.days || (draft.days = []));
  const curCode = () => (draft.currency || {}).code || 'JPY';
  const dateOf = i => { const s = T.parseDate(draft.startDate); return s ? T.addDays(s, i) : null; };
  const endDate = () => { const s = T.parseDate(draft.startDate); return s && days().length ? T.addDays(s, days().length - 1) : null; };
  const findDest = id => P.destinations.find(d => d.id === id);
  const findCur = code => P.currencies.find(c => c.code === code);

  const commit = () => T.setTrip(clone(draft));
  const flash = sel => { const e = $(sel); if (!e) return; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 1400); };
  const msg = (sel, t, ok = true) => { const e = $(sel); e.textContent = t; e.style.color = ok ? '' : 'var(--hot)'; };

  /* ================= 基本資料 ================= */
  function renderBasic() {
    $('#setDest').innerHTML = P.destinations.map(d =>
      `<option value="${d.id}" ${d.id === draft.destId ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
    if (!draft.destId) $('#setDest').value = 'custom';

    const curOpts = sel => P.currencies.map(c =>
      `<option value="${c.code}" ${c.code === sel ? 'selected' : ''}>${esc(c.name)}（${c.code}）</option>`).join('');
    $('#setCur').innerHTML = curOpts(curCode());
    $('#setHome').innerHTML = curOpts((draft.homeCurrency || {}).code || 'TWD');

    $('#setTitle').value = draft.title || '';
    $('#setSubtitle').value = draft.subtitle || '';
    $('#setDestName').value = draft.destName || '';
    $('#setId').value = draft.id || '';
    $('#setStart').value = draft.startDate || '';
    const e = endDate();
    $('#setEnd').value = e ? T.iso(e) : '';
    updateDaysInfo();
    $('#editState').textContent = T.usingOverride ? '本機修改版' : '檔案版本';
  }

  function updateDaysInfo() {
    const s = T.parseDate($('#setStart').value), e = T.parseDate($('#setEnd').value);
    if (!s || !e) { $('#setDaysInfo').textContent = '請選擇出發與回程日期。'; return; }
    const n = T.dayCount(s, e) + 1;
    $('#setDaysInfo').textContent = n < 1
      ? '⚠️ 回程日期不能早於出發日期。'
      : `共 ${n} 天 ${n - 1} 夜　（目前行程有 ${days().length} 天，按「套用基本資料」會調整成 ${n} 天）`;
  }

  function applyBasic() {
    const s = T.parseDate($('#setStart').value), e = T.parseDate($('#setEnd').value);
    if (!s || !e) return msg('#setMsg', '請先選擇出發與回程日期。', false);
    const n = T.dayCount(s, e) + 1;
    if (n < 1) return msg('#setMsg', '回程日期不能早於出發日期。', false);
    if (n > 60) return msg('#setMsg', '天數超過 60 天，請確認日期是否正確。', false);

    const len = days().length;
    if (n < len && !confirm(`天數從 ${len} 天縮短為 ${n} 天，第 ${n + 1} 天之後的行程會被移除。\n（在關掉這個分頁前，把日期改回來就能救回）確定嗎？`)) return;

    const dest = findDest($('#setDest').value);
    const prevDest = findDest(draft.destId);
    /* 打包清單：使用者沒改過（仍等於原目的地的預設）才跟著新目的地換 */
    const untouchedChecklist = !draft.checklist || !draft.checklist.length ||
      (prevDest && JSON.stringify(draft.checklist) === JSON.stringify(prevDest.checklist || []));
    const destChanged = draft.destId !== $('#setDest').value;
    draft.destId = $('#setDest').value;
    draft.destName = $('#setDestName').value.trim() || (dest ? dest.name : '');
    draft.title = $('#setTitle').value.trim() || `${draft.destName} ${n} 日遊`;
    draft.subtitle = $('#setSubtitle').value.trim();
    draft.eyebrow = (dest && dest.id !== 'custom' ? dest.eyebrow : (draft.destName || 'TRIP')).toUpperCase();
    draft.id = $('#setId').value.trim() || `${draft.destId}-${$('#setStart').value.slice(0, 7)}`;
    draft.startDate = $('#setStart').value;
    draft.currency = findCur($('#setCur').value) || draft.currency;
    draft.homeCurrency = findCur($('#setHome').value) || draft.homeCurrency;
    if (!draft.categories || !draft.categories.length) draft.categories = clone(P.categories);
    if (dest && (destChanged || !draft.checklist) && untouchedChecklist) draft.checklist = clone(dest.checklist || []);
    if (!draft.defaultRate) draft.defaultRate = 0.21;

    if (n > len) {
      /* 先把剛才被裁掉的日子接回來，不夠的才補空白 */
      for (let i = len; i < n; i++) days().push(trimmed.shift() || blankDay());
    }
    if (n < len) { trimmed = days().slice(n).concat(trimmed); draft.days = days().slice(0, n); }

    if (edDay >= days().length) edDay = days().length - 1;
    commit(); renderAll();
    msg('#setMsg', `已套用：${draft.title}，共 ${n} 天。`);
  }

  const blankDay = () => ({ title: '', stay: { name: '', map: '' }, notes: '', items: [] });

  function resetBlank() {
    if (!confirm('會清空所有天數的行程點與住宿（保留目的地與日期設定）。確定嗎？')) return;
    draft.days = days().map(() => blankDay());
    commit(); renderAll();
    msg('#setMsg', '已清空成空白行程。');
  }

  /* ================= 航班 ================= */
  const FLIGHTS = [['outbound', '去程'], ['inbound', '回程']];

  function renderFlights() {
    const fl = draft.flights || {};
    $('#flightForm').innerHTML = FLIGHTS.map(([k, label]) => {
      const f = fl[k] || {};
      const inp = (key, ph, type = 'text') =>
        `<input ${type !== 'text' ? `type="${type}"` : ''} data-fl="${k}" data-k="${key}" placeholder="${ph}" value="${esc(f[key] || '')}">`;
      return `<div class="ed-item">
        <div class="ed-head"><b>${label}</b></div>
        <div class="grid4">
          <label class="field"><span>航空公司</span>${inp('airline', '例如：虎航')}</label>
          <label class="field"><span>班機號碼</span>${inp('no', '例如：IT796')}</label>
          <label class="field"><span>日期</span>${inp('date', '', 'date')}</label>
          <label class="field"><span>備註</span>${inp('note', '例如：託運 20kg')}</label>
        </div>
        <div class="grid4">
          <label class="field"><span>出發機場</span>${inp('from', '例如：TPE')}</label>
          <label class="field"><span>起飛時間</span>${inp('depTime', '', 'time')}</label>
          <label class="field"><span>抵達機場</span>${inp('to', '例如：OKA')}</label>
          <label class="field"><span>抵達時間</span>${inp('arrTime', '', 'time')}</label>
        </div>
      </div>`;
    }).join('');
  }

  /* ================= 住宿 ================= */
  function renderStay() {
    $('#stayEditor').innerHTML = days().map((d, i) => {
      const st = d.stay || {};
      const last = i === days().length - 1;
      return `<div class="stay-row">
        <span class="d">Day ${i + 1}${last ? '（最後一晚）' : ''}<br>${esc(T.fmtDate(dateOf(i)))}</span>
        <input data-stay="${i}" data-k="name" placeholder="飯店名稱" value="${esc(st.name || '')}">
        <input data-stay="${i}" data-k="map" placeholder="導航關鍵字（留空用飯店名）" value="${esc(st.map || '')}">
        <button class="mini" data-copyprev="${i}" ${i === 0 ? 'disabled' : ''}>同前一晚</button>
      </div>`;
    }).join('') || '<p class="empty">還沒有天數，請先在上面設定日期。</p>';
  }

  /* ================= 每日行程 ================= */
  function renderItems() {
    const ds = days();
    if (edDay >= ds.length) edDay = Math.max(0, ds.length - 1);
    $('#edDayTabs').innerHTML = ds.map((d, i) =>
      `<button data-edday="${i}" class="${i === edDay ? 'active' : ''}">Day ${i + 1}<small>${esc(T.fmtDate(dateOf(i)))}</small></button>`).join('');

    const day = ds[edDay];
    $('#edDayTitle').value = day ? (day.title || '') : '';
    $('#edDayNotes').value = day ? (day.notes || '') : '';
    $('#edDelDay').disabled = ds.length <= 1;

    const items = day ? (day.items || []) : [];
    $('#itemEditor').innerHTML = items.map((it, i) => `<div class="ed-item">
      <div class="ed-head"><b>第 ${i + 1} 站</b><div class="mini-row">
        <button class="mini" data-mv="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑ 上移</button>
        <button class="mini" data-mv="${i}" data-dir="1" ${i === items.length - 1 ? 'disabled' : ''}>↓ 下移</button>
        <button class="mini" data-dup="${i}">複製</button>
        <button class="mini warn" data-rm="${i}">刪除</button>
      </div></div>
      <div class="row">
        <label class="field"><span>時間</span><input data-it="${i}" data-k="time" placeholder="09:00 或 上午" value="${esc(it.time || '')}"></label>
        <label class="field"><span>名稱</span><input data-it="${i}" data-k="name" placeholder="景點或餐廳名稱" value="${esc(it.name || '')}"></label>
      </div>
      <label class="field"><span>說明</span><input data-it="${i}" data-k="desc" placeholder="這一站要注意什麼" value="${esc(it.desc || '')}"></label>
      <div class="grid3">
        <label class="field"><span>標籤</span><input data-it="${i}" data-k="tag" placeholder="例如：門票" value="${esc(it.tag || '')}"></label>
        <label class="field"><span>預估花費（${esc(curCode())}）</span><input type="number" min="0" data-it="${i}" data-k="cost" value="${it.cost || ''}"></label>
        <label class="field"><span>導航關鍵字</span><input data-it="${i}" data-k="map" placeholder="留空則用名稱" value="${esc(it.map === false ? '' : (it.map || ''))}"></label>
      </div>
    </div>`).join('') || '<p class="empty">這一天還沒有行程點，按下面的「新增行程點」開始。</p>';

    const dest = findDest(draft.destId);
    const spots = dest ? (dest.spots || []) : [];
    $('#edSpot').innerHTML = spots.length
      ? spots.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('')
      : '<option value="">（這個目的地還沒有建議景點）</option>';
    $('#edAddSpot').disabled = !spots.length;
  }

  /* ================= 打包清單 ================= */
  function renderChecklist() {
    $('#edChecklist').value = (draft.checklist || []).join('\n');
  }

  /* ================= 發布 ================= */
  function renderJson() { $('#tripJson').value = JSON.stringify(draft, null, 2); }

  function downloadTripJs() {
    T.download('trip.js',
      '/* 行程資料：覆蓋到專案的 data/trip.js，然後 git push */\nwindow.TRIP = '
      + JSON.stringify(draft, null, 2) + ';\n', 'text/javascript;charset=utf-8');
    msg('#tripMsg', '已下載 trip.js。把它覆蓋到專案的 data/trip.js，然後 git add -A && git commit && git push。');
  }

  /* ================= 事件 ================= */
  const root = $('#view-edit');

  root.addEventListener('change', e => {
    const t = e.target;

    if (t.matches('#setStart, #setEnd')) { updateDaysInfo(); return; }

    if (t.id === 'setDest') {
      const d = findDest(t.value);
      if (d) {
        $('#setDestName').value = d.name === '其他（自行輸入）' ? '' : d.name;
        $('#setCur').value = d.currency.code;
        if (!$('#setTitle').value.trim() && d.id !== 'custom') $('#setTitle').value = `${d.name} 之旅`;
      }
      return;
    }

    if (t.dataset.fl) {
      draft.flights = draft.flights || {};
      const f = draft.flights[t.dataset.fl] = draft.flights[t.dataset.fl] || {};
      f[t.dataset.k] = t.value.trim();
      commit(); flash('#savedFlights'); return;
    }

    if (t.dataset.stay !== undefined) {
      const d = days()[+t.dataset.stay];
      d.stay = d.stay || {};
      d.stay[t.dataset.k] = t.value.trim();
      commit(); flash('#savedStay'); return;
    }

    if (t.dataset.it !== undefined) {
      const it = days()[edDay].items[+t.dataset.it], k = t.dataset.k, v = t.value.trim();
      if (k === 'cost') { const n = Number(v); if (n > 0) it.cost = n; else delete it.cost; }
      else if (v) it[k] = v; else delete it[k];
      commit(); flash('#savedItems'); return;
    }

    if (t.id === 'edChecklist') {
      draft.checklist = t.value.split('\n').map(x => x.trim()).filter(Boolean);
      commit(); flash('#savedCheck'); return;
    }

    if (t.id === 'edDayTitle' || t.id === 'edDayNotes') {
      const day = days()[edDay]; if (!day) return;
      day[t.id === 'edDayTitle' ? 'title' : 'notes'] = t.value.trim();
      commit(); flash('#savedItems'); renderItems(); return;
    }
  });

  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;

    if (b.dataset.edday !== undefined) { edDay = +b.dataset.edday; renderItems(); return; }

    if (b.dataset.copyprev !== undefined) {
      const i = +b.dataset.copyprev;
      days()[i].stay = clone(days()[i - 1].stay || { name: '' });
      commit(); renderStay(); flash('#savedStay'); return;
    }

    const items = () => days()[edDay].items || (days()[edDay].items = []);

    if (b.dataset.mv !== undefined) {
      const i = +b.dataset.mv, dir = +b.dataset.dir, arr = items();
      if (arr[i + dir]) { [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]]; commit(); renderItems(); flash('#savedItems'); }
      return;
    }
    if (b.dataset.dup !== undefined) {
      const i = +b.dataset.dup; items().splice(i + 1, 0, clone(items()[i]));
      commit(); renderItems(); flash('#savedItems'); return;
    }
    if (b.dataset.rm !== undefined) {
      const i = +b.dataset.rm;
      if (!confirm(`刪除「${items()[i].name || '這個行程點'}」？`)) return;
      items().splice(i, 1); commit(); renderItems(); flash('#savedItems'); return;
    }

    switch (b.id) {
      case 'setApply': applyBasic(); break;
      case 'setReset': resetBlank(); break;

      case 'edAddItem':
        items().push({ time: '', name: '新的行程點', desc: '' });
        commit(); renderItems(); flash('#savedItems');
        $$('#itemEditor [data-k="name"]').pop()?.focus();
        break;

      case 'edAddSpot': {
        const dest = findDest(draft.destId), i = +$('#edSpot').value;
        const s = dest && dest.spots[i];
        if (!s) break;
        items().push({ time: '', name: s.name, desc: s.desc || '', ...(s.tag ? { tag: s.tag } : {}), ...(s.cost ? { cost: s.cost } : {}) });
        commit(); renderItems(); flash('#savedItems');
        break;
      }

      case 'edAddDay':
        days().push(trimmed.shift() || blankDay());
        edDay = days().length - 1;
        commit(); renderAll(); flash('#savedItems');
        break;

      case 'edDelDay': {
        if (days().length <= 1) break;
        if (!confirm(`刪除 Day ${edDay + 1}（${days()[edDay].title || '未命名'}）？之後的日期會往前遞補。`)) return;
        trimmed.unshift(days().splice(edDay, 1)[0]);
        if (edDay >= days().length) edDay = days().length - 1;
        commit(); renderAll(); flash('#savedItems');
        break;
      }

      case 'edChecklistPreset': {
        const d = findDest(draft.destId);
        if (!d || !(d.checklist || []).length) { alert('這個目的地沒有預設清單。'); break; }
        if ((draft.checklist || []).length && !confirm('會覆蓋現有的打包清單，確定嗎？')) break;
        draft.checklist = clone(d.checklist);
        commit(); renderChecklist(); flash('#savedCheck');
        break;
      }

      case 'tripDownload': downloadTripJs(); break;

      case 'tripExport':
        T.download(`${draft.id || 'trip'}-備份.json`, JSON.stringify(draft, null, 2), 'application/json;charset=utf-8');
        msg('#tripMsg', '已匯出 JSON 備份。');
        break;

      case 'tripImport': $('#tripFile').click(); break;

      case 'tripRevert':
        if (!confirm('會丟掉本機所有修改，回到 data/trip.js 的內容。確定嗎？')) return;
        T.clearOverride(); draft = clone(T.trip); renderAll();
        msg('#tripMsg', '已還原成檔案版本。');
        break;

      case 'jsonApply': {
        let t; try { t = JSON.parse($('#tripJson').value); }
        catch (err) { return msg('#tripMsg', 'JSON 格式有誤：' + err.message, false); }
        draft = t; commit(); renderAll();
        msg('#tripMsg', '已套用 JSON。');
        break;
      }
      case 'jsonFormat': {
        let t; try { t = JSON.parse($('#tripJson').value); }
        catch (err) { return msg('#tripMsg', 'JSON 格式有誤：' + err.message, false); }
        $('#tripJson').value = JSON.stringify(t, null, 2);
        msg('#tripMsg', '格式化完成，JSON 沒有問題。');
        break;
      }
    }
  });

  $('#tripFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const t = JSON.parse(fr.result);
        if (!t.days) throw new Error('這個檔案裡沒有 days 欄位');
        draft = t; commit(); renderAll();
        msg('#tripMsg', `已匯入「${t.title || '未命名行程'}」。`);
      } catch (err) { msg('#tripMsg', '匯入失敗：' + err.message, false); }
    };
    fr.readAsText(file);
    e.target.value = '';
  });

  /* ================= 啟動 ================= */
  function renderAll() { renderBasic(); renderFlights(); renderStay(); renderItems(); renderChecklist(); renderJson(); }
  renderAll();
})();
