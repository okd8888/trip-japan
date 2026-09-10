import { administrator, loginPage, authenticate, logout } from './auth.js';

/* 旅遊行程手冊 — 同步後端（Cloudflare Worker + D1）
 *
 * 這支 Worker 由「每個使用者自己部署到自己的 Cloudflare 帳號」，
 * 前端網站本身仍然是純靜態、不綁任何後端。沒填端點的人完全不受影響。
 *
 * 權限模型：
 *   行程碼 code       10 碼亂數，知道就能「讀」——分享連結就是靠它
 *   /admin/ 輸入管理員 Token 後開放，Worker 逐次驗證登入工作階段。
 *
 * 所以：行程碼等同「知道網址就看得到」。護照號碼、信用卡卡號這類東西
 * 不要放進行程備註，這點前端設定面板也有寫。
 */

const JSON_HEADERS = { 'content-type': 'application/json;charset=utf-8' };

/* 「Deploy to Cloudflare」按鈕會幫你把 D1 建好，但不會跑 schema.sql，
   所以第一次收到請求時自己把表建起來，一鍵部署才真的是一鍵。
   全部都是 IF NOT EXISTS，重跑無害；每個 isolate 只會做一次。 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_sessions (
     id_hash TEXT PRIMARY KEY, token_hash TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS trips (
     code TEXT PRIMARY KEY, edit_key_hash TEXT NOT NULL, trip TEXT NOT NULL,
     version INTEGER NOT NULL, updated_by TEXT, updated_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS expenses (
     code TEXT NOT NULL, id TEXT NOT NULL, day INTEGER NOT NULL DEFAULT 0, category TEXT,
     amount REAL NOT NULL DEFAULT 0, note TEXT, rate REAL, date TEXT, by TEXT,
     deleted INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (code, id))`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_sync ON expenses (code, updated_at)`,
  `CREATE TABLE IF NOT EXISTS rates (
     pair TEXT PRIMARY KEY, rate REAL NOT NULL, source TEXT,
     updated_at INTEGER NOT NULL, asked_at INTEGER NOT NULL)`
];

let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch(SCHEMA.map(sql => env.DB.prepare(sql)))
      .catch(err => { schemaReady = null; throw err; });   // 失敗就別記住，下次重試
  }
  return schemaReady;
}

/* 前端可能被託管在 GitHub Pages、Cloudflare Pages 或本機，來源不固定，
   所以公開讀取放行任何 origin。管理入口另驗證登入及同源寫入。 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400'
};

const MAX_TRIP_BYTES = 512 * 1024;   // 一份行程 512KB 綽綽有餘，擋住誤傳大檔
const MAX_BATCH = 500;               // 一次最多同步 500 筆花費

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...CORS } });
const fail = (status, message) => json({ error: message }, status);

const now = () => Date.now();

/* 不用 Math.random：行程碼是唯一的存取憑證 */
function randomId(len) {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';   // 去掉 0/1/i/l/o 避免抄錯
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map(b => alphabet[b % alphabet.length]).join('');
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_TRIP_BYTES) throw new Error('資料太大（上限 512KB）');
  if (!text) return {};
  try { return JSON.parse(text); }
  catch (_) { throw new Error('請求不是合法的 JSON'); }
}

async function loadTrip(env, code) {
  return env.DB.prepare(
    'SELECT code, trip, version, updated_by, updated_at FROM trips WHERE code = ?'
  ).bind(code).first();
}

const cleanTrip = trip => JSON.parse(JSON.stringify(trip, (key, value) => ['reservationNo', 'editKey', 'syncKey'].includes(key) ? undefined : value));
const validTrip = trip => trip && Array.isArray(trip.days) && trip.days.every(d => d && typeof d === 'object' && (!d.items || (Array.isArray(d.items) && d.items.every(it => it && typeof it === 'object'))));

const publicTrip = row => ({
  code: row.code,
  trip: cleanTrip(JSON.parse(row.trip)),
  version: row.version,
  updatedBy: row.updated_by || '',
  updatedAt: row.updated_at
});

/* ---------------- 行程 ---------------- */

/* POST /admin/api/trip — 管理者建立行程，沿用既有資料表。 */
async function createTrip(request, env) {
  const body = await readBody(request);
  if (!validTrip(body.trip)) return fail(400, '缺少有效的 trip.days');

  const code = randomId(10);
  const t = now();

  await env.DB.prepare(
    `INSERT INTO trips (code, edit_key_hash, trip, version, updated_by, updated_at, created_at)
     VALUES (?, ?, ?, 1, ?, ?, ?)`
  ).bind(code, '', JSON.stringify(cleanTrip(body.trip)), String(body.by || ''), t, t).run();

  return json({ code, version: 1, updatedAt: t }, 201);
}

/* GET /api/trip/:code — 唯讀，分享連結走這裡 */
async function getTrip(env, code) {
  const row = await loadTrip(env, code);
  if (!row) return fail(404, '找不到這個行程碼');
  return json(publicTrip(row));
}

/* PUT /admin/api/trip/:code — 路由已驗證管理者。帶 version 做樂觀鎖，撞到回 409。 */
async function putTrip(request, env, code) {
  const row = await loadTrip(env, code);
  if (!row) return fail(404, '找不到這個行程碼');

  const body = await readBody(request);
  if (!validTrip(body.trip)) return fail(400, '缺少有效的 trip.days');
  if (!Number.isInteger(body.version)) return fail(400, '缺少有效的 version');

  if (Number.isFinite(body.version) && body.version !== row.version) {
    return json({ error: '這份行程已被其他裝置更新', conflict: true, ...publicTrip(row) }, 409);
  }

  const t = now(), version = row.version + 1;
  const result = await env.DB.prepare(
    'UPDATE trips SET trip = ?, version = ?, updated_by = ?, updated_at = ? WHERE code = ? AND version = ?'
  ).bind(JSON.stringify(cleanTrip(body.trip)), version, String(body.by || ''), t, code, row.version).run();
  if (!result.meta.changes) return json({error:'這份行程已被其他裝置更新',conflict:true,...publicTrip(await loadTrip(env, code))},409);

  return json({ code, version, updatedAt: t, updatedBy: String(body.by || '') });
}

/* ---------------- 花費 ---------------- */

const rowToExpense = r => ({
  id: r.id, day: r.day, category: r.category, amount: r.amount,
  note: r.note, rate: r.rate, date: r.date, by: r.by,
  deleted: !!r.deleted, updatedAt: r.updated_at
});

/* GET /api/expenses/:code?since=<epoch ms> — 增量拉取，含已刪除的墓碑 */
async function getExpenses(env, code, since) {
  const row = await loadTrip(env, code);
  if (!row) return fail(404, '找不到這個行程碼');

  const { results } = await env.DB.prepare(
    'SELECT * FROM expenses WHERE code = ? AND updated_at > ? ORDER BY updated_at'
  ).bind(code, since).all();

  return json({ expenses: (results || []).map(rowToExpense), serverTime: now() });
}

/* POST /api/expenses/:code — 推送本機新增／修改／刪除，後寫的贏（比 updated_at） */
async function postExpenses(request, env, code) {
  const row = await loadTrip(env, code);
  if (!row) return fail(404, '找不到這個行程碼');

  const body = await readBody(request);
  const list = Array.isArray(body.expenses) ? body.expenses : [];
  if (list.length > MAX_BATCH) return fail(400, `一次最多 ${MAX_BATCH} 筆`);

  const t = now();
  const stmt = env.DB.prepare(
    `INSERT INTO expenses (code, id, day, category, amount, note, rate, date, by, deleted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (code, id) DO UPDATE SET
       day = excluded.day, category = excluded.category, amount = excluded.amount,
       note = excluded.note, rate = excluded.rate, date = excluded.date, by = excluded.by,
       deleted = excluded.deleted, updated_at = excluded.updated_at
     WHERE excluded.updated_at >= expenses.updated_at`
  );

  const batch = list
    .filter(x => x && x.id !== undefined && x.id !== null)
    .map(x => stmt.bind(
      code, String(x.id), Number(x.day) || 0, String(x.category || ''),
      Number(x.amount) || 0, String(x.note || ''),
      Number.isFinite(Number(x.rate)) ? Number(x.rate) : null,
      String(x.date || ''), String(x.by || ''),
      x.deleted ? 1 : 0, Number(x.updatedAt) || t
    ));

  if (batch.length) await env.DB.batch(batch);

  /* 推完直接把對方需要的增量一起回去，省一趟往返 */
  const since = Number(body.since) || 0;
  const { results } = await env.DB.prepare(
    'SELECT * FROM expenses WHERE code = ? AND updated_at > ? ORDER BY updated_at'
  ).bind(code, since).all();

  return json({ saved: batch.length, expenses: (results || []).map(rowToExpense), serverTime: now() });
}

/* ---------------- 匯率 ----------------
 *
 * 前端本來就會自己去打三個公開匯率 API，這個端點是插在它們前面的第 0 順位。
 * 值得多這一層的理由只有一個：**出國當地的網路**。
 * 飯店 Wi-Fi 擋掉 jsdelivr、或行動網路慢到 timeout 時，前端就會一路 fallback
 * 到 trip.js 裡寫死的 defaultRate，記帳的換算就開始不準。
 *
 * 走這裡的話：Cloudflare 邊緣節點去抓上游（它的網路品質和你的手機無關），
 * 抓到就存進 D1；就算上游全掛，也還有昨天的值可以回，不會掉回寫死的預設值。
 * 這是公開資料，不需要行程碼也不需要金鑰。
 */

const RATE_FRESH_MS = 12 * 60 * 60 * 1000;   // 12 小時內的快取直接用
const CODE_RE = /^[A-Za-z]{3}$/;

/* 和前端同一組來源，順序也一樣 */
function rateUpstreams(from, to) {
  const a = from.toLowerCase(), b = to.toLowerCase();
  return [
    { name: 'currency-api', url: `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${a}.json`, pick: d => d?.[a]?.[b] },
    { name: 'currency-api（備援）', url: `https://latest.currency-api.pages.dev/v1/currencies/${a}.json`, pick: d => d?.[a]?.[b] },
    { name: 'open.er-api.com', url: `https://open.er-api.com/v6/latest/${from}`, pick: d => d?.rates?.[to] }
  ];
}

async function fetchUpstream(from, to) {
  for (const s of rateUpstreams(from, to)) {
    try {
      const r = await fetch(s.url, { cf: { cacheTtl: 3600 } });
      if (!r.ok) continue;
      const v = Number(s.pick(await r.json()));
      if (Number.isFinite(v) && v > 0) return { rate: v, source: s.name };
    } catch (_) { /* 換下一個來源 */ }
  }
  return null;
}

async function saveRate(env, pair, got, t) {
  await env.DB.prepare(
    `INSERT INTO rates (pair, rate, source, updated_at, asked_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (pair) DO UPDATE SET
       rate = excluded.rate, source = excluded.source, updated_at = excluded.updated_at`
  ).bind(pair, got.rate, got.source, t, t).run();
}

/* GET /api/rate?from=JPY&to=TWD */
async function getRate(env, url) {
  const from = String(url.searchParams.get('from') || '').toUpperCase();
  const to   = String(url.searchParams.get('to') || '').toUpperCase();
  if (!CODE_RE.test(from) || !CODE_RE.test(to)) return fail(400, 'from 與 to 必須是三個字母的幣別代碼');
  if (from === to) return json({ rate: 1, source: '同一種幣別', updatedAt: now(), cached: false });

  const pair = `${from}-${to}`, t = now();
  const row = await env.DB.prepare('SELECT rate, source, updated_at FROM rates WHERE pair = ?').bind(pair).first();

  /* 記下這組幣別有人在用，每天的排程只會去更新真的被查過的組合 */
  if (row) await env.DB.prepare('UPDATE rates SET asked_at = ? WHERE pair = ?').bind(t, pair).run();

  if (row && t - row.updated_at < RATE_FRESH_MS) {
    return json({ rate: row.rate, source: row.source, updatedAt: row.updated_at, cached: true });
  }

  const got = await fetchUpstream(from, to);
  if (got) {
    await saveRate(env, pair, got, t);
    return json({ rate: got.rate, source: got.source, updatedAt: t, cached: false });
  }

  /* 上游全掛：有舊值就回舊值，總比讓前端掉回寫死的 defaultRate 好 */
  if (row) return json({ rate: row.rate, source: row.source + '（過期快取）', updatedAt: row.updated_at, cached: true, stale: true });
  return fail(502, '上游匯率來源目前都取不到');
}

/* 每天排程：只更新最近 30 天有人查過的幣別組合 */
async function refreshRates(env) {
  const cutoff = now() - 30 * 24 * 60 * 60 * 1000;
  const { results } = await env.DB.prepare('SELECT pair FROM rates WHERE asked_at > ?').bind(cutoff).all();
  for (const { pair } of results || []) {
    const [from, to] = pair.split('-');
    const got = await fetchUpstream(from, to);
    if (got) await saveRate(env, pair, got, now());
  }
}

/* ---------------- 路由 ---------------- */

export default {
  async fetch(request, env) {
    if (!env.DB) return fail(500, 'Worker 還沒綁定 D1 資料庫（binding 名稱要叫 DB）');
    try { await ensureSchema(env); }
    catch (err) { return fail(500, '資料表建立失敗：' + (err.message || err)); }
    const url = new URL(request.url);
    if (url.pathname === '/login' && request.method === 'GET') return loginPage(env);
    if (url.pathname === '/auth/login' && request.method === 'POST') return authenticate(request, env);
    if (url.pathname === '/auth/logout' && request.method === 'POST') return logout(request, env);
    const adminPath = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    let identity = null;
    if (adminPath) {
      identity = await administrator(request, env);
      if (!identity) {
        if (request.method === 'GET' && !url.pathname.startsWith('/admin/api/')) {
          const code = url.searchParams.get('code');
          return Response.redirect(url.origin + '/login' + (code ? '?code='+encodeURIComponent(code) : ''),302);
        }
        return fail(401, '請輸入管理員 Token 登入');
      }
      if (write && request.headers.get('origin') !== url.origin) return fail(403, '管理操作必須從本站送出');
      if (write && !request.headers.get('content-type')?.startsWith('application/json')) return fail(415, '管理操作必須使用 JSON');
      if (url.pathname === '/admin') return Response.redirect(url.origin + '/admin/', 302);
      if (!url.pathname.startsWith('/admin/api/')) {
        if (!['GET', 'HEAD'].includes(request.method)) return fail(405, '不支援的方法');
        if (!env.ASSETS) return fail(503, '管理介面尚未部署');
        const asset = await env.ASSETS.fetch(request);
        const headers = new Headers(asset.headers);
        headers.set('cache-control', 'no-store');
        headers.set('x-content-type-options', 'nosniff');
        if (asset.headers.get('content-type')?.includes('text/html') && request.method === 'GET') {
          const script = `<script>window.TripIdentity=${JSON.stringify(identity).replace(/</g, '\\u003c')};</script>`;
          headers.delete('content-length');
          headers.delete('etag');
          return new Response((await asset.text()).replace('<head>', '<head>' + script), {status:asset.status, headers});
        }
        return new Response(asset.body, {status:asset.status, headers});
      }
    } else if (write) return fail(403, '公開端點僅供讀取，請從管理入口登入');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (adminPath) url.pathname = url.pathname.slice('/admin'.length);
    const parts = url.pathname.split('/').filter(Boolean);   // ['api','trip','abc']

    try {
      if (parts[0] === 'api' && parts[1] === 'health') return json({ ok: true });

      if (adminPath && url.pathname === '/api/trips' && request.method === 'GET') {
        const {results} = await env.DB.prepare('SELECT code, trip, updated_at FROM trips ORDER BY updated_at DESC').all();
        return json({trips:results.map(row => ({code:row.code, title:JSON.parse(row.trip).title || row.code}))});
      }

      if (parts[0] === 'api' && parts[1] === 'rate') {
        if (request.method !== 'GET') return fail(405, '不支援的方法');
        return await getRate(env, url);
      }

      if (parts[0] === 'api' && parts[1] === 'trip') {
        const code = parts[2];
        if (!code) {
          if (request.method === 'POST') return await createTrip(request, env);
          return fail(405, '這個網址只接受 POST');
        }
        if (request.method === 'GET') return await getTrip(env, code);
        if (request.method === 'PUT') return await putTrip(request, env, code);
        return fail(405, '不支援的方法');
      }

      if (parts[0] === 'api' && parts[1] === 'expenses') {
        const code = parts[2];
        if (!code) return fail(400, '缺少行程碼');
        if (request.method === 'GET') return await getExpenses(env, code, Number(url.searchParams.get('since')) || 0);
        if (request.method === 'POST') return await postExpenses(request, env, code);
        return fail(405, '不支援的方法');
      }

      return fail(404, '沒有這個端點');
    } catch (err) {
      return fail(400, err.message || '請求處理失敗');
    }
  },

  /* Cron Trigger：每天先把匯率抓好放著，早上開 App 就是現成的 */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(ensureSchema(env).then(() => refreshRates(env)));
  }
};
