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
  let lastLeft = 0;   // 上一次重排後沒排進行程的建議景點數

  const days = () => (draft.days || (draft.days = []));
  const curCode = () => (draft.currency || {}).code || 'JPY';
  const dateOf = i => { const s = T.parseDate(draft.startDate); return s ? T.addDays(s, i) : null; };
  const endDate = () => { const s = T.parseDate(draft.startDate); return s && days().length ? T.addDays(s, days().length - 1) : null; };
  const findDest = id => P.destinations.find(d => d.id === id);
  /* 「福岡・九州」→「福岡」，用在標題與導航關鍵字 */
  const shortName = n => String(n || '').split('・')[0].trim();
  const findCur = code => P.currencies.find(c => c.code === code);
  /* 花費紀錄以行程代號分開存放（app.js 的 KEY.exp），換代號＝換一本帳本 */
  const ledgerCount = id => { try { return (JSON.parse(localStorage.getItem(`expenses:${id}`) || '[]') || []).length; } catch (_) { return 0; } };

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
    updateRebuildChoice();
    $('#editState').textContent = T.usingOverride ? '本機修改版' : '檔案版本';
  }

  /* 只有「目的地被改動」時才需要問行程要不要跟著換 —— 把決定拉到按下套用之前 */
  function updateRebuildChoice() {
    const changed = $('#setDest').value !== draft.destId;
    $('#setRebuildChoice').hidden = !changed;
    if (!changed) $('input[name="rebuildMode"][value="rebuild"]').checked = true;
  }

  function updateDaysInfo() {
    const s = T.parseDate($('#setStart').value), e = T.parseDate($('#setEnd').value);
    if (!s || !e) { $('#setDaysInfo').textContent = '請選擇出發與回程日期。'; return; }
    const n = T.dayCount(s, e) + 1;
    $('#setDaysInfo').textContent = n < 1
      ? '⚠️ 回程日期不能早於出發日期。'
      : `共 ${n} 天 ${n - 1} 夜　（目前行程有 ${days().length} 天，按「套用設定」會調整成 ${n} 天）`;
  }

  function applyBasic() {
    const s = T.parseDate($('#setStart').value), e = T.parseDate($('#setEnd').value);
    if (!s || !e) return msg('#setMsg', '請先選擇出發與回程日期。', false);
    const n = T.dayCount(s, e) + 1;
    if (n < 1) return msg('#setMsg', '回程日期不能早於出發日期。', false);
    if (n > 60) return msg('#setMsg', '天數超過 60 天，請確認日期是否正確。', false);

    const len = days().length;
    const destId = $('#setDest').value;
    const dest = findDest(destId), prevDest = findDest(draft.destId);
    const destChanged = draft.destId !== destId;
    const spots = dest ? (dest.spots || []) : [];
    const hasContent = days().some(d => (d.items || []).length);
    const prevId = draft.id;
    const newId = $('#setId').value.trim() || `${destId}-${$('#setStart').value.slice(0, 7)}`;
    const idChanged = !!prevId && newId !== prevId;
    const mode = ($('input[name="rebuildMode"]:checked') || {}).value;
    const willRebuild = destChanged && spots.length > 0 && mode !== 'keep';

    /* 即將變更摘要：把原本散在三處的 confirm 收成一次確認，沒有破壞性改動就直接套用 */
    const plan = [], risky = [];
    if (destChanged) plan.push(`目的地：${prevDest ? prevDest.name : '未設定'} → ${dest ? dest.name : destId}`);
    if (n !== len) plan.push(`天數：${len} → ${n} 天`);
    if (n < len) risky.push(`Day ${n + 1} 之後的 ${len - n} 天行程會被移除（改回日期就能救回）`);
    if (willRebuild) {
      plan.push(`每日行程：依「${dest.name}」的 ${spots.length} 個景點重新產生`);
      if (hasContent) risky.push('目前每一天的行程點都會被覆蓋');
      if (destChanged) plan.push('住宿：一併清空（換了目的地，舊飯店名沒有意義）');
    } else if (destChanged && hasContent) {
      plan.push('每日行程：保留現有內容不動');
    }
    if (idChanged) plan.push(`行程代號：${prevId} → ${newId}`);
    const dropHighlights = destChanged && (draft.highlights || []).length;
    if (dropHighlights) plan.push('首頁重點標籤：清空（原本寫的是上一個目的地的資訊）');
    if (risky.length && !confirm(
      '即將變更：\n' + plan.map(x => '・' + x).join('\n') +
      '\n\n請注意：\n' + risky.map(x => '⚠ ' + x).join('\n') +
      '\n\n確定套用嗎？')) return;

    /* 打包清單：使用者沒改過（仍等於原目的地的預設）才跟著新目的地換 */
    const untouchedChecklist = !draft.checklist || !draft.checklist.length ||
      (prevDest && JSON.stringify(draft.checklist) === JSON.stringify(prevDest.checklist || []));
    draft.destId = destId;
    draft.destName = $('#setDestName').value.trim() || (dest ? dest.name : '');
    draft.title = $('#setTitle').value.trim() || `${draft.destName} ${n} 日遊`;
    draft.subtitle = $('#setSubtitle').value.trim();
    draft.eyebrow = (dest && dest.id !== 'custom' ? dest.eyebrow : (draft.destName || 'TRIP')).toUpperCase();
    draft.id = newId;
    draft.startDate = $('#setStart').value;
    draft.currency = findCur($('#setCur').value) || draft.currency;
    draft.homeCurrency = findCur($('#setHome').value) || draft.homeCurrency;
    if (!draft.categories || !draft.categories.length) draft.categories = clone(P.categories);
    if (dest && (destChanged || !draft.checklist) && untouchedChecklist) draft.checklist = clone(dest.checklist || []);
    if (!draft.defaultRate) draft.defaultRate = 0.21;
    /* highlights 只在首頁大圖顯示、編輯器裡看不到，換了目的地就一定是錯的 */
    if (dropHighlights) draft.highlights = [];

    if (n > len) {
      /* 先把剛才被裁掉的日子接回來，不夠的才補空白 */
      for (let i = len; i < n; i++) days().push(trimmed.shift() || blankDay());
    }
    if (n < len) { trimmed = days().slice(n).concat(trimmed); draft.days = days().slice(0, n); }

    if (edDay >= days().length) edDay = days().length - 1;
    commit();

    const done = willRebuild && rebuildFromDest({ silent: true, clearStay: destChanged });
    renderAll();

    const note = [`已套用：${draft.title}，共 ${n} 天。`];
    if (done) note.push(`每日行程已依「${dest.name}」重新產生，可再自行增刪。` +
      (lastLeft ? `（另有 ${lastLeft} 個建議景點沒排進去，可在「每日行程」用下拉清單補上）` : ''));
    else if (destChanged && !willRebuild) note.push('每日行程維持原樣。');
    else if (destChanged && !spots.length) note.push(`「${dest ? dest.name : destId}」還沒有建議景點，請到下方「每日行程」手動新增。`);
    if (idChanged) {
      const k = ledgerCount(prevId);
      note.push(k
        ? `花費已切換到新帳本「${newId}」；舊代號「${prevId}」的 ${k} 筆紀錄仍留在這台裝置上，把代號改回去就會再出現。`
        : `花費帳本已切換到「${newId}」（舊代號沒有紀錄）。`);
    }
    msg('#setMsg', note.join('　'));
  }

  const blankDay = () => ({ title: '', stay: { name: '', map: '' }, notes: '', items: [] });

  /* ======================= 依目的地重排行程 =======================
     排法：區域（areas）已依自駕動線排好 → 依各區景點數把天數分配下去 →
     每天只落在同一區，時間表用「停留時間＋估算車程」累加，並插入該區的餐廳。
     沒有經緯度的目的地（例如東京、首爾）退回原本的固定時段排法。            */
  const MEAL = { lunch: 11 * 60 + 30, dinner: 18 * 60 };
  const hhmm = m => { const r = Math.round(m / 5) * 5; return `${String(Math.floor(r / 60) % 24).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`; };
  const driveMin = (a, b) => ((T.driveInfo(a, b) || {}).min) || 15;

  /* 最大餘數法：天數依各區景點數按比例分配，分不到的區併進前一天 */
  function allocDays(groups, n) {
    const total = groups.reduce((sum, g) => sum + g.length, 0);
    const raw = groups.map(g => g.length / total * n);
    const alloc = raw.map(Math.floor);
    let rest = n - alloc.reduce((a, b) => a + b, 0);
    raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0])
      .forEach(([, i]) => { if (rest > 0) { alloc[i]++; rest--; } });
    return alloc;
  }

  function splitByArea(spots, areas, n) {
    const ids = (areas || []).map(a => a.id);
    const groups = ids.map(id => spots.filter(sp => sp.area === id));
    const rest = spots.filter(sp => !ids.includes(sp.area));
    if (rest.length) groups.push(rest);
    const used = groups.filter(g => g.length);
    if (!used.length) return Array.from({ length: n }, () => []);

    const alloc = allocDays(used, n), out = [];
    used.forEach((g, i) => {
      const k = alloc[i];
      if (!k) {
        /* 天數不夠、分不到一天的區：離前一天太遠就不硬塞（會變成單日長途移動），
           讓它留在「沒排進去的建議景點」裡，由使用者決定要不要加 */
        const prev = out[out.length - 1];
        if (!prev) out.push(g.slice());
        else if (driveMin(prev[prev.length - 1], g[0]) <= 90) prev.push(...g);
        return;
      }
      const base = Math.floor(g.length / k), extra = g.length % k;
      let p = 0;
      for (let d = 0; d < k; d++) { const size = base + (d < extra ? 1 : 0); out.push(g.slice(p, p + size)); p += size; }
    });
    while (out.length < n) out.push([]);
    return out.slice(0, n);
  }

  /* 同一趟不重複推薦同一家店；找不到同區的就退而求其次挑任何一家 */
  function foodPicker(dest) {
    const used = new Set(), all = dest.foods || [];
    return (areas, meal, at) => {
      /* meal 沒填＝午晚餐都可以；標了 snack 的點心不會被當成正餐 */
      const pool = all.filter(f => !f.meal || f.meal === meal);
      const near = list => (at ? list.slice().sort((a, b) => driveMin(at, a) - driveMin(at, b)) : list)[0];
      const inArea = pool.filter(f => areas.includes(f.area));
      /* 優先同區沒推薦過的；同區選完了寧可再吃一次，也不要為了換一家開一小時 */
      const f = near(inArea.filter(f => !used.has(f.name))) || near(inArea) || near(pool);
      if (f) used.add(f.name);
      return f;
    };
  }

  const spotItem = (sp, t) => ({
    time: hhmm(t), name: sp.name, desc: sp.desc || '',
    ...(sp.tag ? { tag: sp.tag } : {}), ...(sp.cost ? { cost: sp.cost } : {}),
    ...(typeof sp.lat === 'number' ? { lat: sp.lat, lng: sp.lng } : {})
  });

  /* 一天的時間表；用餐後直接接下一站，不再另計餐廳到景點的車程（同區內通常 10 分鐘內） */
  function buildItems(picked, pickFood, opts) {
    const items = [], areas = [...new Set(picked.map(sp => sp.area))];
    let t = opts.start, prev = null, lunch = opts.lunch === false, dinner = false;

    const eat = (label, key) => {
      const f = pickFood(areas, key, prev);
      items.push(f
        ? { time: hhmm(t), name: `${label}：${f.name}`, desc: f.desc || '', tag: label,
            ...(f.cost ? { cost: f.cost } : {}),
            ...(typeof f.lat === 'number' ? { lat: f.lat, lng: f.lng } : {}) }
        : { time: hhmm(t), name: `${label}：在地食堂`, desc: '沿路挑一家順路的店，或前一晚先查好備案。', tag: label });
      if (f && typeof f.lat === 'number') prev = f;
      t += 60;
    };

    picked.forEach(sp => {
      if (prev) t += driveMin(prev, sp);
      if (!lunch && t >= MEAL.lunch) { lunch = true; eat('午餐', 'lunch'); }
      else if (lunch && !dinner && t >= MEAL.dinner) { dinner = true; eat('晚餐', 'dinner'); }
      items.push(spotItem(sp, t));
      t += sp.stay || 60;
      prev = sp;
    });
    /* 最後一站結束才過午／過晚的日子，補上這兩餐 */
    if (!lunch && t < MEAL.dinner) { lunch = true; t = Math.max(t, MEAL.lunch); eat('午餐', 'lunch'); }
    if (opts.dinner && !dinner) { t = Math.max(t, MEAL.dinner); eat('晚餐', 'dinner'); }
    return items;
  }

  function rebuildFromDest(opts = {}) {
    const { silent = false, clearStay = false } = opts;
    const out = silent ? null : '#rebuildMsg';
    const dest = findDest(draft.destId);
    const spots = dest ? (dest.spots || []) : [];
    const n = days().length;
    if (!n) { if (out) msg(out, '請先設定出發與回程日期。', false); return false; }
    if (!spots.length) {
      if (out) msg(out,
        `「${draft.destName || '這個目的地'}」還沒有建議景點清單，無法自動產生。` +
        '請在上面手動新增，或在 data/presets.js 補上這個目的地的 spots。', false);
      return false;
    }
    if (!silent && days().some(d => (d.items || []).length) && !confirm(
      `會用「${dest.name}」的 ${spots.length} 個建議景點重新排出 ${n} 天行程，` +
      '目前每一天的行程點都會被覆蓋。\n（航班、住宿與打包清單會保留）確定嗎？')) return false;

    const name = shortName(draft.destName || dest.name);
    const geo = spots.some(sp => typeof sp.lat === 'number');
    const areaName = id => ((dest.areas || []).find(a => a.id === id) || {}).name || '';

    if (!geo) {
      /* 沒有經緯度的目的地：維持原本的固定時段平均切法 */
      const TIMES = ['09:00', '10:30', '12:00', '14:00', '16:00', '18:00'];
      const per = Math.max(1, Math.min(5, Math.ceil(spots.length / n)));
      let k = 0;
      for (let i = 0; i < n; i++) {
        const picked = spots.slice(k, k + per); k += per;
        const items = picked.map((sp, j) => ({ ...spotItem(sp, 0), time: TIMES[Math.min(j, TIMES.length - 1)] }));
        writeDay(i, n, items, picked, name, clearStay, '');
      }
    } else {
      const plan = splitByArea(spots, dest.areas, n);
      const pickFood = foodPicker(dest);
      for (let i = 0; i < n; i++) {
        const first = i === 0, last = i === n - 1;
        /* 第一天下午才落地、最後一天要趕飛機，各只排 3 站 */
        const picked = first ? plan[i].slice(0, 3) : (last ? plan[i].slice(-3) : plan[i]);
        const items = buildItems(picked, pickFood, {
          start: first ? 15 * 60 : 9 * 60,
          lunch: !first,          // 下午才落地，第一餐直接算晚餐
          dinner: !last
        });
        const areas = [...new Set(picked.map(sp => areaName(sp.area)))].filter(Boolean);
        writeDay(i, n, items, picked, name, clearStay,
          areas.length ? `今天主要在${areas.join('、')}一帶活動。` : '');
      }
    }

    edDay = 0;
    commit();
    /* 第一天與最後一天各只排 3 站，景點多的目的地會用不完 —— 講清楚，別讓人以為漏掉了 */
    const used = new Set();
    days().forEach(d => (d.items || []).forEach(it => used.add(it.name)));
    const left = spots.filter(sp => !used.has(sp.name)).length;
    lastLeft = left;
    if (!silent) {
      renderAll();
      msg(out, `已依「${dest.name}」重新產生 ${n} 天行程，可再自行增刪調整。` +
        (left ? `　另有 ${left} 個建議景點沒排進去，可用下方的「從建議景點／美食加入」補上。` : ''));
    }
    return true;
  }

  /* 寫回第 i 天：補上抵達／返程，並決定標題與備註 */
  function writeDay(i, n, items, picked, name, clearStay, notes) {
    if (i === 0) items.unshift({ time: '抵達', name: `抵達${name}`, desc: '入境、領行李、取車，再前往第一晚的落腳處。', map: name });
    if (i === n - 1) items.push({ time: '返程', name: '前往機場・返程', desc: '先加滿油拿收據再還車，抓起飛前 2.5 小時到機場。', map: `${name} 機場` });
    const day = days()[i];
    day.items = items;
    day.notes = notes;
    if (clearStay) day.stay = { name: '', map: '' };
    day.title = i === 0 ? `抵達${name}`
      : (i === n - 1 ? '最後採買・返程'
      : (picked.length ? picked.slice(0, 2).map(sp => sp.name).join('・') : `${name} 自由行`));
  }

  function resetBlank() {
    if (!confirm('會清空所有天數的行程點與住宿（保留目的地與日期設定）。確定嗎？')) return;
    draft.days = days().map(() => blankDay());
    commit(); renderAll();
    msg('#rebuildMsg', '已清空成空白行程。');
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
    const foods = dest ? (dest.foods || []) : [];
    const opts = (arr, kind) => arr.map((x, i) =>
      `<option value="${kind}:${i}">${esc(x.name)}</option>`).join('');
    $('#edSpot').innerHTML = (spots.length || foods.length)
      ? (spots.length ? `<optgroup label="景點">${opts(spots, 's')}</optgroup>` : '') +
        (foods.length ? `<optgroup label="美食">${opts(foods, 'f')}</optgroup>` : '')
      : '<option value="">（這個目的地還沒有建議清單）</option>';
    $('#edAddSpot').disabled = !(spots.length || foods.length);
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
        if (!$('#setTitle').value.trim() && d.id !== 'custom') $('#setTitle').value = `${shortName(d.name)} 之旅`;
      }
      updateRebuildChoice();
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
      case 'setRebuild': rebuildFromDest(); break;
      case 'setReset': resetBlank(); break;

      case 'edAddItem':
        items().push({ time: '', name: '新的行程點', desc: '' });
        commit(); renderItems(); flash('#savedItems');
        $$('#itemEditor [data-k="name"]').pop()?.focus();
        break;

      case 'edAddSpot': {
        const dest = findDest(draft.destId);
        const [kind, idx] = String($('#edSpot').value).split(':');
        const s = dest && (kind === 'f' ? (dest.foods || [])[+idx] : (dest.spots || [])[+idx]);
        if (!s) break;
        const it = spotItem(s, 0); it.time = '';
        if (kind === 'f' && !it.tag) it.tag = '美食';
        items().push(it);
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
