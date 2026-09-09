# 自駕助手 v2.0.0

規格來源：`data/trip_japan_ui_ux_optimization_recommendations.md`。本版完成目前階段的旅行 UI 與自駕功能，保留遠端既有 Worker＋D1、花費同步及匯率端點；未另建 KV 後端。逐章核對結果見 [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)。

## 入口

- **今天**：每日主題／日期、下一站、目前位置、建議出發、車程、時間軸、重要提醒與今晚住宿。出發前倒數、旅行中當日資訊、結束後完成站數和已知總里程。
- **行程**：時間軸、精簡／詳細、編號路線總覽、Google Maps 全日道路地圖。桌面固定日期清單；編輯器可拖曳或用上下按鈕重排。
- **＋記帳**：快速金額與新增景點／備註入口；自駕成本包含租車、加油、高速公路、ETC、停車及舊版合併分類。
- **匯率**：大型雙向計算器、常用金額表，保留 Worker 匯率及公開來源備援。
- **更多**：住宿、航班、打包、費用統計、編輯／備份、分享與手動更新；技術設定收在進階設定。

## 資料與計算

| 對象 | 新增欄位 |
| --- | --- |
| 旅程 | `timeZone`（日本為 `Asia/Tokyo`） |
| 行程點 | `arrivalTime`、`arrivalDayOffset`、`stayMinutes`、`driveMinutes`、`distanceKm`、`parking`、`parkingFee`、`mapCode`、`googleMaps`、`phone`、`reservation`、`reservationTime`、`ticket`、`note`、`critical`、`outdoor`、`rainPlan`、`lat`、`lng`、`status` |
| 住宿 | `checkIn`、`checkOut`、`parking`、`parkingFee`、`breakfast`、`address`、`phone`、`googleMaps`、`website`、`reservationNo` |

資料皆為選填。保留既有範例行程，未填入虛構飯店／停車／預約資料。舊 `time`、`desc`、`map`、`mapUrl`、`cost`、`link` 繼續使用。導航總會提供可搜尋的目的地。

車程／距離是「前站到此站」，優先使用填寫值，有前後站座標時才粗估。總計只含已知或可估路段，不含即時路況。未知資料顯示待補。使用 [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)，無須 API 金鑰；全日連結可能受中途站數限制，可改用各站導航。

狀態為尚未前往、目前、完成，另可跳過／重設。下一站為目前站之後第一個尚未前往站點。較早但沒處理的站點不會被自動算成已造訪。

延誤以目前站「抵達＋停留」計算。延後操作只修改目前站之後的待訪站點，不動固定預約；跨午夜記入 `arrivalDayOffset`，顯示翌日或數日後。今天與延誤採目的地時區。未知時間不推測延誤。

天氣採當天第一個有座標的景點及 [Open-Meteo 每日預報](https://open-meteo.com/en/docs)。超出 16 天預報範圍不顯示假天氣；降雨機率 >70% 提示戶外及所填雨備。失敗時使用帶時間的快取，或顯示無法取得。

## 同步與私人資料

沿用 `worker/src/index.js` 的 D1 方案，部署方式見 [worker/README.md](../worker/README.md)。本機未提供實際 Worker 網址與 D1 綁定，因此此版的網站部署不等同於每位使用者的 Worker 已升級。既有 Worker 使用者需重新部署後端程式，才具備伺服器端私人欄位過濾與同時寫入防護。

前端建立／自動同步行程時過濾 `reservationNo`，Worker 寫入及公開讀取亦過濾。JSON 備份保留完整私人行程；發布 `trip.js` 不含訂房編號。修改後尚未成功同步的資料有待同步標記，重新載入時先嘗試發布，不直接用雲端覆蓋。

分享連結只含行程碼與端點，不含編輯金鑰。分享頁使用分開的本機行程／花費儲存，不能修改行程或花費，且不會清掉擁有者原有金鑰。持有連結即可查看，不是登入式私人存取。共同編輯者透過既有行程碼及編輯金鑰連結；沒有帳號邀請管理系統。

D1 更新使用版本條件寫入；同時寫入時只有一個版本成功，另一個收到衝突。取消衝突提示會保留本機修改，暫停發布。花費保留既有 ID／更新時間／刪除墓碑合併。

## 離線與版本

PWA 預快取 HTML、CSS、所有 JS、行程、manifest、版本與 PNG／SVG 圖示。首次成功載入後，即使離線重新整理，也能讀取地址、MapCode、預約及本機行程。導航、首次天氣及同步需要網路。

版本記錄於 `version.json`、畫面與 Worker package；Service Worker 快取為 `trip-handbook-v2.0.0`。

## 驗證

- `node --test tests/core.test.cjs`：狀態、時區、延誤／跨午夜、URL、私人欄位、Worker 授權及 D1 同時寫入衝突。
- `node tests/browser.cjs`：手機與桌面、快速新增、記帳、雨備、離線、實際 Worker＋SQLite 同步、重新載入、分享隔離與空白行程。
- 測試使用 Node 24 的 SQLite、Playwright 與本機 Edge；`PLAYWRIGHT_PATH` 可指定已安裝的 Playwright 路徑。HTTP 伺服器、瀏覽器與資料庫均為測試專用，不改實際行程。
