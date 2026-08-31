# 同步後端（選用）

這是**選配**的後端。不裝它，網站就是原本的純靜態版本，一切正常。
裝了它，行程與花費就會在你的手機、電腦、同行的人之間同步，不用再下載 `trip.js` 重新發布。

重點：**這支 Worker 是你部署到「你自己的」Cloudflare 帳號**。
專案 repo 裡永遠只有程式碼，沒有任何人的行程、花費或端點設定。
別人 fork 這個專案，也是開他自己的一份，兩邊資料互不相干。

---

## 方法 A：一鍵部署（最快，但有前提，見下方）

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/okd8888/trip-japan/tree/main/worker)

按下去之後 Cloudflare 會請你登入（沒帳號就註冊，免費），
它會在你的 GitHub 建一個新 repo，並自動把 Worker 和 D1 資料庫都建好。
全程大概兩分鐘，不用開終端機。

設定檔是 `wrangler.jsonc`，裡面**刻意不填 `database_id`**——留空 Cloudflare 才會
幫你新建一個資料庫並把 ID 填進去。自己補一個假的 ID 上去的話，部署按鈕會回報
「problem parsing the Wrangler configuration file」。

> ⚠️ **兩個前提，不符合的話按鈕不會動：**
>
> 1. 按鈕網址指向 `main` 分支的 `worker/` 資料夾。**功能還沒合併進 `main` 的話會找不到檔案**，
>    先合併。錯誤訊息會寫「Repository not found. Are you sure it's public?」，很誤導——
>    跟 repo 公不公開無關，是那個路徑不存在。
> 2. Cloudflare 這個按鈕在「repo 子資料夾」的情況下有
>    [已知問題](https://github.com/cloudflare/workers-sdk/issues/14553)，
>    有時候會建出一個只有兩個檔案、Worker 停在 Hello World 的空專案。
>    部署完發現 `/api/health` 沒反應、或 Worker 內容是 Hello World，就是踩到這個雷，
>    改用下面的方法 B 或 C。

完成後你會拿到一個網址，長得像：

```
https://trip-sync.你的帳號.workers.dev
```

**資料表會在第一次收到請求時自動建立**，你不用做任何事。
想確認有沒有活著，直接開這個網址加上 `/api/health`，看到 `{"ok":true}` 就成了。

---

## 方法 B：用指令部署（最可靠）

```bash
cd worker
npm install
npm run deploy
```

wrangler 4 會偵測到 `wrangler.jsonc` 裡的 D1 還不存在，直接問你要不要建，
按 Enter 讓它建就好，**`database_id` 不用手動填**。

如果它沒問（wrangler 版本太舊），手動建一個再把印出來的 ID 填進 `d1_databases`：

```bash
npx wrangler d1 create trip-sync
```

本機開發：

```bash
npm run dev
```

## 方法 C：完全用網頁介面

不想碰終端機、按鈕又壞掉的話走這條，一樣不用裝任何東西：

1. Cloudflare 後台 → **Workers & Pages** → **Create** → **Start from Hello World** → 命名 `trip-sync`
2. 進 Worker 的 **Edit code**，把 `src/index.js` 全部內容貼上去 → **Deploy**
3. 後台 → **Storage & Databases** → **D1** → **Create database**，命名 `trip-sync`
4. 回到 Worker → **Settings** → **Bindings** → **Add** → **D1 database**
   → Variable name 填 **`DB`**（一定要叫這個，程式碼是用 `env.DB` 取用的），
   選剛才建的資料庫 → **Deploy**

資料表不用手動建，Worker 第一次收到請求時會自己建好。

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
