/* 旅遊行程手冊 — 同步後端（Cloudflare Worker + D1）
 *
 * 這支 Worker 由「每個使用者自己部署到自己的 Cloudflare 帳號」，
 * 前端網站本身仍然是純靜態、不綁任何後端。沒填端點的人完全不受影響。
 *
 * 權限模型（刻意做得很輕，因為這是給同行三五個人用的）：
 *   行程碼 code       10 碼亂數，知道就能「讀」——分享連結就是靠它
 *   編輯金鑰 editKey  32 碼亂數，有才能「寫」——只存 SHA-256 在資料庫
 *
 * 所以：行程碼等同「知道網址就看得到」。護照號碼、信用卡卡號這類東西
 * 不要放進行程備註，這點前端設定面板也有寫。
 */

const JSON_HEADERS = { 'content-type': 'application/json;charset=utf-8' };

/* 「Deploy to Cloudflare」按鈕會幫你把 D1 建好，但不會跑 schema.sql，
   所以第一次收到請求時自己把表建起來，一鍵部署才真的是一鍵。
   全部都是 IF NOT EXISTS，重跑無害；每個 isolate 只會做一次。 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS trips (
     code TEXT PRIMARY KEY, edit_key_hash TEXT NOT NULL, trip TEXT NOT NULL,
     version INTEGER NOT NULL, updated_by TEXT, updated_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS expenses (
     code TEXT NOT NULL, id TEXT NOT NULL, day INTEGER NOT NULL DEFAULT 0, category TEXT,
     amount REAL NOT NULL DEFAULT 0, note TEXT, rate REAL, date TEXT, by TEXT,
     deleted INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (code, id))`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_sync ON expenses (code, updated_at)`
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
   所以放行任何 origin。安全性靠 editKey，不靠 origin 白名單。 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,x-edit-key',
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

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* 長度相同才逐位元比較，避免用字串 === 洩漏前綴資訊 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
    'SELECT code, edit_key_hash, trip, version, updated_by, updated_at FROM trips WHERE code = ?'
  ).bind(code).first();
}

/* 有 editKey 且對得上才回 true；讀取端點不需要呼叫這個 */
async function canWrite(request, row) {
  const key = request.headers.get('x-edit-key') || '';
  if (!key) return false;
  return timingSafeEqual(await sha256(key), row.edit_key_hash);
}

const publicTrip = row => ({
  code: row.code,
  trip: JSON.parse(row.trip),
  version: row.version,
  updatedBy: row.updated_by || '',
  updatedAt: row.updated_at
});

/* ---------------- 行程 ---------------- */

/* POST /api/trip — 開一個新的同步行程，回傳 code + editKey（editKey 只在這時候出現一次） */
async function createTrip(request, env) {
  const body = await readBody(request);
  if (!body.trip || typeof body.trip !== 'object') return fail(400, '缺少 trip');

  const code = randomId(10);
  const editKey = randomId(32);
  const t = now();

  await env.DB.prepare(
    `INSERT INTO trips (code, edit_key_hash, trip, version, updated_by, updated_at, created_at)
     VALUES (?, ?, ?, 1, ?, ?, ?)`
  ).bind(code, await sha256(editKey), JSON.stringify(body.trip), String(body.by || ''), t, t).run();

  return json({ code, editKey, version: 1, updatedAt: t }, 201);
}

/* GET /api/trip/:code — 唯讀，分享連結走這裡 */
async function getTrip(env, code) {
  const row = await loadTrip(env, code);
  if (!row) return fail(404, '找不到這個行程碼');
  return json(publicTrip(row));
}

/* PUT /api/trip/:code — 需要 editKey。帶 version 做樂觀鎖，撞到回 409 與伺服器現況 */
async function putTrip(request, env, code) {
  const row = await loadTrip(env, code);
  if (!row) return fail(404, '找不到這個行程碼');
  if (!await canWrite(request, row)) return fail(403, '編輯金鑰不正確，目前是唯讀狀態');

  const body = await readBody(request);
  if (!body.trip || typeof body.trip !== 'object') return fail(400, '缺少 trip');

  if (Number.isFinite(body.version) && body.version !== row.version) {
    return json({ error: '這份行程已被其他裝置更新', conflict: true, ...publicTrip(row) }, 409);
  }

  const t = now(), version = row.version + 1;
  await env.DB.prepare(
    'UPDATE trips SET trip = ?, version = ?, updated_by = ?, updated_at = ? WHERE code = ?'
  ).bind(JSON.stringify(body.trip), version, String(body.by || ''), t, code).run();

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
  if (!await canWrite(request, row)) return fail(403, '編輯金鑰不正確，目前是唯讀狀態');

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

/* ---------------- 路由 ---------------- */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (!env.DB) return fail(500, 'Worker 還沒綁定 D1 資料庫（binding 名稱要叫 DB）');

    try { await ensureSchema(env); }
    catch (err) { return fail(500, '資料表建立失敗：' + (err.message || err)); }

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);   // ['api','trip','abc']

    try {
      if (parts[0] === 'api' && parts[1] === 'health') return json({ ok: true });

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
  }
};
