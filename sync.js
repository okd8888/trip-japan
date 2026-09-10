/* 跨裝置同步（選用）— 沒設定就完全不動作，網站照舊是純靜態。
 *
 * 設定本身也存在 localStorage，不會進 git，所以 repo 永遠只有程式碼。
 * 後端請自己部署一份 worker/（見 worker/README.md），端點填在「設定」分頁。
 */
(() => {
  'use strict';

  const CONFIG_KEY = 'tripSync';
  const CURSOR_KEY = code => `tripSyncCursor:${code}`;
  const query = new URLSearchParams(location.search);
  const isShared = query.has('trip');
  const isAdmin = window.TripIdentity?.role === 'admin' && location.pathname.startsWith('/admin/');

  let config = { endpoint: '', code: '', editKey: '', name: '' };
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) config = { ...config, ...JSON.parse(raw) };
  } catch (_) { localStorage.removeItem(CONFIG_KEY); }
  if (isAdmin && !isShared) {
    config = {...config, endpoint:location.origin, editKey:'', name:window.TripIdentity.name};
    if (query.get('code')) config.code = query.get('code');
  }

  const listeners = new Set();
  let status = { state: 'idle', message: '', at: 0 };
  let sessionExpired = false;

  function setStatus(state, message) {
    status = { state, message, at: Date.now() };
    listeners.forEach(fn => { try { fn(status); } catch (_) {} });
  }

  const base = () => String(config.endpoint || '').replace(/\/+$/, '');
  const enabled = () => !!(base() && config.code);
  const canEdit = () => !readOnly() && enabled();
  const readOnly = () => isShared || !isAdmin || sessionExpired;

  async function api(path, { method = 'GET', body, auth = false } = {}) {
    if (!base()) throw new Error('還沒設定同步端點');
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (auth) {
      if (readOnly()) throw new Error('請從管理入口登入');
    }
    const res = await fetch(base() + (isAdmin && !isShared ? '/admin' : '') + path, {
      method, headers, cache: 'no-store', signal: AbortSignal.timeout(15000),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      if (res.status === 401 && isAdmin) {
        sessionExpired = true;
        setStatus('error', '登入已逾時，請重新登入；本機修改已保留。');
      }
      const err = new Error((data && data.error) || `伺服器回應 ${res.status}`);
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }

  /* ---------------- 行程 ---------------- */

  const versionKey = () => `tripSyncVersion:${base()}:${config.code}`;
  let version = Number(localStorage.getItem(versionKey())) || 0;
  const saveVersion = value => { version = value; localStorage.setItem(versionKey(), String(value)); };

  async function createTrip(trip) {
    const out = await api('/api/trip', { method: 'POST', auth:true, body: { trip: window.TripCore.publicTrip(trip), by: config.name } });
    setConfig({ code: out.code, editKey: '' });
    localStorage.setItem(`adminTrip:${base()}:${config.code}`, JSON.stringify(trip));
    saveVersion(out.version);
    localStorage.setItem(CURSOR_KEY(out.code), '0');
    return out;
  }

  async function pullTrip() {
    const out = await api('/api/trip/' + encodeURIComponent(config.code));
    saveVersion(out.version);
    return out;
  }

  /** 推送行程。衝突時丟出的 error 會帶 remote（伺服器現況），讓呼叫端決定怎麼辦 */
  async function pushTrip(trip) {
    try {
      const out = await api('/api/trip/' + encodeURIComponent(config.code), {
        method: 'PUT', auth: true, body: { trip: window.TripCore.publicTrip(trip), version, by: config.name }
      });
      saveVersion(out.version);
      return out;
    } catch (err) {
      if (err.status === 409 && err.data) {
        err.remote = err.data;
      }
      throw err;
    }
  }

  /* ---------------- 花費 ---------------- */

  /* 本機與遠端各有一份，靠 id + updatedAt 收斂：同一筆取 updatedAt 較新的那份，
     刪除留成 deleted 墓碑，否則另一台會在下次同步時把它復活。 */
  function mergeExpenses(local, remote) {
    const map = new Map();
    const put = x => {
      if (!x || x.id === undefined || x.id === null) return;
      const id = String(x.id);
      const prev = map.get(id);
      const t = Number(x.updatedAt) || 0;
      if (!prev || t >= (Number(prev.updatedAt) || 0)) map.set(id, { ...x, id, updatedAt: t });
    };
    local.forEach(put);
    remote.forEach(put);
    return [...map.values()];
  }

  /**
   * 同步花費。
   * @param {Array} local 本機全部紀錄（含 deleted 墓碑）
   * @returns {Array} 合併後的結果，呼叫端負責存回 localStorage 並重繪
   */
  async function syncExpenses(local) {
    const code = encodeURIComponent(config.code);
    const since = Number(localStorage.getItem(CURSOR_KEY(config.code))) || 0;

    let out;
    if (canEdit()) {
      /* 有寫入權：推本機、順便把增量帶回來，一趟往返搞定 */
      out = await api('/api/expenses/' + code, {
        method: 'POST', auth: true, body: { expenses: local, since }
      });
    } else {
      out = await api(`/api/expenses/${code}?since=${since}`);
    }

    const merged = mergeExpenses(local, out.expenses || []);
    localStorage.setItem(CURSOR_KEY(config.code), String(out.serverTime || since));
    return merged;
  }

  /* ---------------- 設定 ---------------- */

  function setConfig(patch) {
    const previous = versionKey();
    config = { ...config, ...patch };
    if (isAdmin && !isShared) config = {...config, endpoint:location.origin, editKey:'', name:window.TripIdentity.name};
    if (isShared) config.editKey = '';
    else localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    if (previous !== versionKey()) version = Number(localStorage.getItem(versionKey())) || 0;
    return config;
  }

  function disconnect() {
    const code = config.code;
    localStorage.removeItem(CONFIG_KEY);
    if (code) localStorage.removeItem(CURSOR_KEY(code));
    config = { endpoint: isAdmin ? location.origin : '', code: '', editKey: '', name: isAdmin ? window.TripIdentity.name : '' };
    version = 0;
  }

  /** 分享連結：只帶行程碼與端點，不帶編輯金鑰，所以拿到的人是唯讀 */
  function shareUrl() {
    if (!enabled()) return '';
    const u = new URL(isAdmin ? 'https://okd8888.github.io/trip-japan/' : location.href);
    u.hash = '';
    u.search = `?trip=${encodeURIComponent(config.code)}&api=${encodeURIComponent(base())}`;
    return u.toString();
  }

  /** 分享設定只套用目前頁面，保留原有裝置的編輯金鑰與設定。 */
  function adoptFromUrl() {
    const q = new URLSearchParams(location.search);
    const code = q.get('trip'), endpoint = q.get('api');
    if (!code) return false;

    if (!window.TripCore.safeUrl(endpoint) || !endpoint.startsWith('https://')) return false;
    setConfig({
      code,
      endpoint,
      editKey: ''
    });
    return true;
  }

  if (isShared) { config = {endpoint:'',code:'',editKey:'',name:''}; adoptFromUrl(); }
  else if (isAdmin) setConfig({});

  window.TripSync = {
    get config() { return { ...config }; },
    get version() { return version; },
    get status() { return { ...status }; },
    base, enabled, canEdit, readOnly, isShared, isAdmin, setConfig, disconnect, setStatus,
    createTrip, pullTrip, pushTrip, syncExpenses, mergeExpenses,
    shareUrl, adoptFromUrl,
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
