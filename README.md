# 旅遊行程手冊

一個**純靜態**的旅遊行程網站：今天的行程、每日時間軸、Google Maps 一鍵導航、花費記錄、即時匯率換算。
沒有後端、沒有資料庫、不需要建置工具 —— 直接丟上 GitHub Pages 就能用。

## 檔案結構

```
index.html            版面與樣式（單檔）
app.js                檢視端邏輯，對外開放 window.TripApp
editor.js             「設定」分頁的表單編輯器
data/trip.js          ★ 行程資料，平常只要改這個檔案
data/presets.js       目的地預設（幣別、建議景點、打包清單）
assets/icon.svg       App 圖示
manifest.webmanifest  「加入主畫面」用
sw.js                 Service Worker：出國沒網路也能開
.nojekyll             告訴 GitHub Pages 不要跑 Jekyll
```

## 怎麼改成自己的行程

**方法 A（推薦）：在網頁上改。** 打開網站 → 底部「編輯」分頁，全部都是表單：

1. **基本資料** — 目的地下拉選單、出發／回程日期、幣別、行程名稱。
   按「套用基本資料」會依日期自動增減天數，選目的地會自動帶入幣別與打包清單。
   換了目的地想連每日行程一起換掉，按「**依目的地重新產生行程**」——
   會用該目的地的建議景點鋪滿所有天數（第一天自動加「抵達」、最後一天加「返程」），
   並詢問是否一併清空住宿；航班與打包清單一律保留。之後每一站都還能自己調整。
2. **航班資訊** — 去程／回程的航空公司、班號、機場、起降時間。填了就會出現在首頁與「今天」分頁。
3. **每晚住宿** — 每一天一列，有「同前一晚」快捷鍵。
4. **每日行程** — 每個行程點可新增、刪除、上下移動、複製，欄位含時間／名稱／說明／標籤／
   預估花費／導航關鍵字；也可以從該目的地的建議景點清單一鍵加入，或延長、刪除某一天。
5. **打包清單** — 一行一項，可一鍵帶入目的地的建議清單。

改完的內容**即時存在你的瀏覽器**（只有你看得到）。要讓所有人看到，按「下載 trip.js」，
覆蓋專案裡的 `data/trip.js`，再 `git push`。

> 縮短天數或刪除某一天時，被移除的內容會暫存在這個分頁裡。
> 只要不關掉分頁，把日期改回來或按「延長一天」就能原封不動救回來。

**方法 B：直接改 `data/trip.js`**，存檔後 `git push`，網站幾十秒後自動更新。

行程資料的欄位：

```js
window.TRIP = {
  id: "okinawa-2026",          // 換一趟旅程就換 id（花費紀錄會分開存）
  destId: "okinawa",           // 對應 data/presets.js，決定建議景點清單
  destName: "沖繩",
  title: "沖繩 5 日自駕",
  subtitle: "副標題",
  startDate: "2026-08-31",     // 第一天，之後每天日期自動推算
  chart: "assets/chart.png",   // 選填，行程總覽圖
  currency:     { code: "JPY", symbol: "¥",   name: "日圓" },
  homeCurrency: { code: "TWD", symbol: "NT$", name: "台幣" },
  defaultRate: 0.21,           // 抓不到線上匯率時的備援值
  highlights: ["去程 IT796 · 15:05"],
  categories: ["餐飲", "交通", "購物", "門票", "住宿", "其他"],
  checklist: ["護照", "駕照日文譯本"],
  flights: {                   // 選填，兩段都可留空
    outbound: { airline:"虎航", no:"IT796", date:"2026-12-07",
                from:"TPE", depTime:"15:05", to:"OKA", arrTime:"17:50", note:"" },
    inbound:  { }
  },
  days: [{
    title: "抵達那霸",
    stay: { name: "旅館名稱", map: "導航關鍵字" },
    notes: "這一天的備註",
    items: [{
      time: "17:50",
      name: "抵達那霸機場",
      desc: "說明文字",
      tag: "標籤",             // 選填
      cost: 3000,              // 選填，預估花費（當地幣別）
      map: "導航關鍵字",        // 選填，預設用 name；填 false 則不顯示導航按鈕
      mapUrl: "https://…",     // 選填，直接指定連結
      link: "https://…"        // 選填，官網
    }]
  }]
};
```

## 新增目的地

`data/presets.js` 的 `destinations` 陣列決定「設定」分頁的目的地下拉選單。照格式加一筆即可：

```js
{
  id: "kyushu", name: "九州", eyebrow: "KYUSHU",
  currency: { code: "JPY", symbol: "¥", name: "日圓" },
  tips: "給自己看的提醒",
  checklist: ["護照", "駕照日文譯本"],
  spots: [
    { name: "太宰府天滿宮", desc: "說明文字", tag: "門票", cost: 500 }
  ]
}
```

`spots` 就是「從建議景點加入」下拉選單的來源，加入後仍可自由編輯。
目前內建：沖繩、東京、大阪・京都、福岡・九州、北海道、首爾、曼谷、峴港・會安、新加坡、香港，
以及「其他（自行輸入）」。

選「其他」時沒有建議景點，按「依目的地重新產生行程」會提示你手動新增，
或把該目的地補進 `presets.js`。

## 佈署到 GitHub Pages

```bash
git init && git add -A && git commit -m "init"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo 名稱>.git
git push -u origin main
```

然後到 GitHub repo 的 **Settings → Pages → Build and deployment**：
Source 選 **Deploy from a branch**，Branch 選 **main** / **/ (root)**，按 Save。

約 1 分鐘後網址是：`https://<你的帳號>.github.io/<repo 名稱>/`

### 幾個佈署上的注意事項

- **repo 必須是 Public**（免費帳號的 Pages 只支援公開 repo）。也就是說**行程內容任何人都看得到**，
  訂房代號、護照號碼、電話這類資料不要寫進 `data/trip.js`。
- 所有路徑都用**相對路徑**（`app.js`、`data/trip.js`），所以放在 `使用者名稱.github.io/repo名稱/`
  這種子目錄底下也不會壞掉。不要改成 `/app.js` 開頭。
- 已放 `.nojekyll`，避免 Jekyll 忽略底線開頭的檔案。
- Service Worker 需要 HTTPS，GitHub Pages 本來就是 HTTPS，沒問題。
- 圖片檔名建議用英文（例如 `assets/chart.png`），中文檔名雖然多半能動，但在某些瀏覽器／
  分享連結時容易出現編碼問題。

## 資料存在哪裡

| 資料 | 位置 | 說明 |
|---|---|---|
| 行程內容 | `data/trip.js`（在 repo 裡） | 所有人看到的都一樣，公開 |
| 花費紀錄 | 瀏覽器 localStorage | 只在你自己的手機上，不會上傳；換裝置或清除瀏覽資料就沒了 |
| 打包清單勾選 | 瀏覽器 localStorage | 以項目文字記錄，清單改順序也不會勾錯 |
| 編輯中的行程 | 瀏覽器 localStorage | 只有你看得到；按「下載 trip.js」覆蓋檔案後 push 才會公開 |
| 匯率 | 線上抓取 + localStorage 快取 | 依序試 currency-api 與 open.er-api.com，失敗就用預設值，也可手動改 |

> 花費是本機資料，**旅程結束前記得按「匯出 CSV」備份**。
> 如果需要多人共用花費，就得接後端（Google Apps Script、Supabase 之類），GitHub Pages 本身只能放靜態檔。

## 本機預覽

```bash
python3 -m http.server 4173
```

打開 http://localhost:4173 。（直接用檔案總管點開 `index.html` 也能跑，因為行程資料是 `.js` 不是 `.json`。）
