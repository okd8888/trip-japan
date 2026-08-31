-- 跨裝置同步用的資料表。一個「行程碼」＝一趟旅程＝一本帳本。
-- 這裡只存使用者自己放進來的行程與花費，沒有帳號、沒有 email、沒有密碼。

CREATE TABLE IF NOT EXISTS trips (
  code          TEXT PRIMARY KEY,   -- 行程碼，知道就能讀（10 碼亂數）
  edit_key_hash TEXT NOT NULL,      -- 編輯金鑰的 SHA-256，明文不落地
  trip          TEXT NOT NULL,      -- 行程 JSON，整包存
  version       INTEGER NOT NULL,   -- 樂觀鎖：每次寫入 +1
  updated_by    TEXT,               -- 顯示名稱，讓同行的人知道是誰改的
  updated_at    INTEGER NOT NULL,   -- epoch ms
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  code       TEXT NOT NULL,
  id         TEXT NOT NULL,         -- 前端產生，跨裝置唯一
  day        INTEGER NOT NULL DEFAULT 0,
  category   TEXT,
  amount     REAL NOT NULL DEFAULT 0,
  note       TEXT,
  rate       REAL,
  date       TEXT,
  by         TEXT,                  -- 誰記的／誰付的，回國分帳用
  deleted    INTEGER NOT NULL DEFAULT 0,  -- 墓碑：刪除也要同步出去，否則別台會把它復活
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (code, id)
);

-- 增量同步靠這個索引：只撈 updated_at > since 的列
CREATE INDEX IF NOT EXISTS idx_expenses_sync ON expenses (code, updated_at);
