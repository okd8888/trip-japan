/* 跨裝置同步（選用）— 沒設定就完全不動作，網站照舊是純靜態。
 *
 * 設定本身也存在 localStorage，不會進 git，所以 repo 永遠只有程式碼。
 * 後端請自己部署一份 worker/（見 worker/README.md），端點填在「設定」分頁。
 */
(() => {
  'use strict';

  const CONFIG_KEY = 'tripSync';
  const CURSOR_KEY = code => `tripSyncCursor:${code}`;

  let config = { endpoint: '', code: '', editKey: '', name: '' };
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) config = { ...config, ...JSON.parse(raw) };
  } catch (_) { localStorage.removeItem(CONFIG_KEY); }

  const listeners = new Set();
  let status = { state: 'idle', message: '', at: 0 };

  function setStatus(state, message) {
    status = { state, message, at: Date.now() };
    listeners.forEach(fn => { try { fn(status); } catch (_) {} });
  }

  const base = () => String(config.endpoint || '').replace(/\/+$/, '');
  const enabled = () => !!(base() && config.code);
  const canEdit = () => !!(enabled() && config.editKey);

  async function api(path, { method = 'GET', body, auth = false } = {}) {
    if (!base()) throw new Error('還沒設定同步端點');
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (auth) {
      if (!config.editKey) throw new Error('沒有編輯金鑰，目前是唯讀狀態');
      headers['x-edit-key'] = config.editKey;
    }
    const res = await fetch(base() + path, {
      method, headers, cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || `伺服器回應 ${res.status}`);
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }

  /* ---------------- 行程 ---------------- */

  let version = 0;   // 上次看到的伺服器版本，寫入時用來偵測衝突

  async function createTrip(trip) {
    const out = await api('/api/trip', { method: 'POST', body: { trip, by: config.name } });
    setConfig({ code: out.code, editKey: out.editKey });
    version = out.version;
    localStorage.setItem(CURSOR_KEY(out.code), '0');
    return out;
  }

  async function pullTrip() {
    const out = await api('/api/trip/' + encodeURIComponent(config.code));
    version = out.version;
    return out;
  }

  /** 推送行程。衝突時丟出的 error 會帶 remote（伺服器現況），讓呼叫端決定怎麼辦 */
  async function pushTrip(trip) {
    try {
      const out = await api('/api/trip/' + encodeURIComponent(config.code), {
        method: 'PUT', auth: true, body: { trip, version, by: config.name }
      });
      version = out.version;
      return out;
    } catch (err) {
      if (err.status === 409 && err.data) {
        version = err.data.version;
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
    config = { ...config, ...patch };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return config;
  }

  function disconnect() {
    const code = config.code;
    localStorage.removeItem(CONFIG_KEY);
    if (code) localStorage.removeItem(CURSOR_KEY(code));
    config = { endpoint: '', code: '', editKey: '', name: '' };
    version = 0;
  }

  /** 分享連結：只帶行程碼與端點，不帶編輯金鑰，所以拿到的人是唯讀 */
  function shareUrl() {
    if (!enabled()) return '';
    const u = new URL(location.href);
    u.hash = '';
    u.search = `?trip=${encodeURIComponent(config.code)}&api=${encodeURIComponent(base())}`;
    return u.toString();
  }

  /** 讀網址上的分享參數；有的話寫進設定（唯讀，不覆蓋既有的編輯金鑰） */
  function adoptFromUrl() {
    const q = new URLSearchParams(location.search);
    const code = q.get('trip'), endpoint = q.get('api');
    if (!code) return false;

    const sameTrip = config.code === code;
    setConfig({
      code,
      endpoint: endpoint || config.endpoint,
      editKey: sameTrip ? config.editKey : ''   // 換一份行程就不該沿用舊金鑰
    });
    /* 網址列留著參數會讓分享連結被一直複製傳下去，讀完就清掉 */
    history.replaceState(null, '', location.pathname + location.hash);
    return true;
  }

  window.TripSync = {
    get config() { return { ...config }; },
    get version() { return version; },
    get status() { return { ...status }; },
    base, enabled, canEdit, setConfig, disconnect, setStatus,
    createTrip, pullTrip, pushTrip, syncExpenses, mergeExpenses,
    shareUrl, adoptFromUrl,
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
