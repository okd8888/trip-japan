# 同步後端（選用）

這是**選配**的後端。不裝它，網站就是原本的純靜態版本，一切正常。
裝了它，行程與花費就會在你的手機、電腦、同行的人之間同步，不用再下載 `trip.js` 重新發布。

重點：**這支 Worker 是你部署到「你自己的」Cloudflare 帳號**。
專案 repo 裡永遠只有程式碼，沒有任何人的行程、花費或端點設定。
別人 fork 這個專案，也是開他自己的一份，兩邊資料互不相干。

---

## 方法 A：完全用網頁介面（推薦）

不用終端機、不用裝任何東西，全程在 Cloudflare 後台點一點，十分鐘完成。

1. 後台 → **Workers & Pages** → **Create** → **Start from Hello World** → 命名 `trip-sync` → **Deploy**
2. 進 Worker 的 **Edit code**，把編輯器內容全選刪掉，換成 [`src/index.js`](src/index.js)
   的**全部內容**（352 行，最後一行是 `};`，貼完檢查有沒有貼完整）→ **Deploy**
3. 後台 → **Storage & Databases** → **D1 SQL Database** → **Create** → 命名 `trip-sync`
4. 回到 Worker → **Settings** → **Bindings** → **Add** → **D1 database**
   → Variable name 填 **`DB`**（一定要叫這個，程式碼是用 `env.DB` 取用的），
   選剛才建的資料庫 → **Deploy**

資料表不用手動建，Worker 第一次收到請求時會自己建好。

> 這條路徑少了「每天自動更新匯率」的排程。要的話到 Worker →
> **Settings** → **Trigger Events** → 加一個 Cron Trigger `0 21 * * *`。
> 不加也沒差，匯率照樣會在你查的時候即時抓，只是少了預先暖好的那一層。

---

## 方法 B：用指令部署（有 Node 的話最快）

```bash
cd worker
npm install
npm run deploy
```

wrangler 4 會偵測到 `wrangler.json` 裡的 D1 還不存在，直接問你要不要建，
按 Enter 讓它建就好，**`database_id` 不用手動填**。

如果它沒問（wrangler 版本太舊），手動建一個再把印出來的 ID 填進 `d1_databases`：

```bash
npx wrangler d1 create trip-sync
```

本機開發：

```bash
npm run dev
```

---

## 方法 C：一鍵部署按鈕（實測在這個 repo 佈局下失敗）

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/okd8888/trip-japan/tree/main/worker)

> ⚠️ **實測結果：這顆按鈕在本專案的佈局下跑不起來，請直接用方法 B 或 C。**
>
> Worker 放在 repo 的 `worker/` 子資料夾裡，而 Cloudflare 的部署按鈕
> [對子資料夾的支援還不完整](https://github.com/cloudflare/workers-sdk/issues/14553)
> （對話框自己也掛著 "Monorepos are not yet fully supported" 的警告）。
> 實際會遇到的兩個錯誤：
>
> - **`Repository not found. Are you sure it's public?`**
>   跟公開與否無關。代表那個路徑不存在——通常是功能還沒合併進 `main`。
> - **`There was a problem parsing the Wrangler configuration file`**
>   設定檔本身沒問題（`wrangler.json` 是嚴格合法的 JSON，`wrangler deploy --dry-run`
>   也完全通過），是按鈕的 parser 沒讀到子資料夾裡的設定檔。
>   換 TOML／JSONC／JSON、拿掉 `database_id`、註解改英文都試過，都一樣。
>
> 想讓按鈕能用的話，唯一可靠的辦法是把 `worker/` 拆成一個獨立的 repo，
> 讓設定檔位在根目錄。但為了一顆按鈕拆專案不划算，方法 C 十分鐘就做完了。

---

## 接到網站上

1. 打開你的行程網站 → 底部「**編輯**」分頁 → 拉到最下面的「**跨裝置同步**」。
2. **同步端點**填上面那串 `https://trip-sync.你的帳號.workers.dev`。
3. **你的顯示名稱**填一個名字（記帳時會標記是誰記的，回國分帳看得出來）。
4. 按「**建立同步行程**」。行程碼與編輯金鑰會自動填好。

要讓同行的人也看到，按「**複製分享連結**」把網址傳給他們。
他們打開就是**唯讀**版本——看得到行程，改不了你的東西。

想讓對方也能一起改（例如另一半也要記帳），把**編輯金鑰**另外傳給他，
他在自己的「跨裝置同步」面板填上端點＋行程碼＋金鑰，按「連結現有行程」即可。

---

## 怎麼確認裝好了

部署完先跑這三個，全部都不用開終端機以外的東西（把網址換成你自己的）：

```bash
# 1. 活著嗎
curl https://trip-sync.你的帳號.workers.dev/api/health
# 期望：{"ok":true}

# 2. 匯率端點通嗎（第一次會去抓上游，cached 是 false）
curl "https://trip-sync.你的帳號.workers.dev/api/rate?from=JPY&to=TWD"
# 期望：{"rate":0.21...,"source":"currency-api","updatedAt":...,"cached":false}

# 3. 再打一次，應該走快取
curl "https://trip-sync.你的帳號.workers.dev/api/rate?from=JPY&to=TWD"
# 期望：同樣的 rate，但 "cached":true
```

Windows 的 cmd 沒有 curl 的話，直接把網址貼到瀏覽器網址列也一樣。

`/api/health` 有回應就代表 **Worker 活著、D1 綁對了、資料表也自動建好了**
（資料表是在第一次收到請求時建的，所以這一步同時驗證了三件事）。

完整的驗證流程（含跨裝置分享、共同編輯、刪除不復活）見專案根目錄的
[`VERIFY.md`](../VERIFY.md)。

## 權限模型

刻意做得很輕，因為使用情境是同行三五個人，不是公開服務：

| 東西 | 長度 | 能做什麼 | 存在哪 |
|---|---|---|---|
| **行程碼** | 10 碼亂數 | 讀行程、讀花費 | D1 明文（它就是識別碼） |
| **編輯金鑰** | 32 碼亂數 | 改行程、記／刪花費 | D1 只存 SHA-256；明文只在你自己的瀏覽器 |

沒有帳號、沒有 email、沒有密碼，所以也沒有帳號可以被盜。

> ⚠️ **行程碼等同「知道網址就看得到」。**
> 訂房代號、護照號碼、信用卡卡號這類東西不要寫進行程備註。
> 這條限制和原本用 GitHub Pages 公開 repo 時是一樣的。

---

## API

| 方法 | 路徑 | 需要金鑰 | 說明 |
|---|---|---|---|
| `GET` | `/api/health` | — | 健康檢查 |
| `POST` | `/api/trip` | — | 建立行程，回傳 `code` 與 `editKey`（只出現這一次） |
| `GET` | `/api/trip/:code` | — | 讀行程 |
| `PUT` | `/api/trip/:code` | ✔ | 寫行程。帶 `version` 做樂觀鎖，撞到回 `409` 與伺服器現況 |
| `GET` | `/api/expenses/:code?since=` | — | 增量拉取花費（含已刪除的墓碑） |
| `POST` | `/api/expenses/:code` | ✔ | 推送花費，並把 `since` 之後的增量一起回傳 |
| `GET` | `/api/rate?from=JPY&to=TWD` | — | 匯率。公開資料，不需要行程碼 |

金鑰放在 `X-Edit-Key` 標頭。

**花費為什麼要有墓碑？** 兩台裝置各存一份，如果刪除只是把列拿掉，
另一台下次同步就會把它當成「對方沒有的新資料」再塞回來。
所以刪除是標記 `deleted:true` 同步出去，畫面上過濾掉。同一筆比 `updated_at`，後寫的贏。

---

## 匯率端點

網站本來就會自己去打三個公開匯率 API。設了同步端點之後，這支 Worker 會被排在**第 0 順位**。

多這一層的理由只有一個：**出國當地的網路**。
飯店 Wi-Fi 擋掉 jsdelivr、或行動網路慢到 timeout 時，原本會一路 fallback 到
`trip.js` 裡寫死的 `defaultRate`，記帳的換算就開始不準。走 Worker 的話：

- 去抓上游的是 Cloudflare 邊緣節點，**網路品質和你的手機無關**
- 抓到就存進 D1，12 小時內的重複查詢直接走快取
- **就算上游全掛，也還有昨天的值可以回**，不會掉到寫死的預設值
- Cron Trigger 每天更新一次（只更新最近 30 天真的有人查過的幣別組合）

端點掛掉時前端會自動往下一個來源試，所以多這一層不會讓事情變得更脆弱。

## 費用

Cloudflare 免費方案：Workers 每天 10 萬次請求、D1 5GB 儲存與每天 500 萬次列讀取。
一趟旅行大概用掉其中的萬分之一。基本上就是免費。
