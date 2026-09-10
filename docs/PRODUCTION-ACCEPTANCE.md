# 正式站驗收進度

檢查日期：2026-09-10。管理員 Token 後端 v2.1.0 已部署；公開網站發布及真人 Token 登入結果另依實測確認。

## 已通過

- Worker `/api/health` 回應 HTTP 200、`{"ok":true}`。
- 正式 GitHub Pages 網站以 Edge 瀏覽器完成手機五分頁、桌面寬度與離線重新載入檢查，沒有 JavaScript 例外。
- 本機 Token 表單登入、錯誤 Token 拒絕、Cookie 管理權限、登出／換 Token 失效、同步衝突與私人欄位過濾測試通過。
- 手機／桌面整合測試與 Worker 打包檢查通過。
- `ADMIN_TOKEN` Secret 已設定；正式登入頁回應 200，未登入管理 API 回應 401、公開寫入回應 403、錯誤 Token 回應 401。
- Worker 部署版本：`9d8e3132-a096-4837-9956-b58170d742fe`。

正式頁面檢查可重跑 `node tests/live-public.cjs`。此程式只瀏覽、不呼叫寫入 API。截圖輸出 `tests/live-mobile.png`、`tests/live-desktop.png`，不納入 Git。

受限環境的正式站 HTTP 與瀏覽器請求曾逾時；在允許外部連線的環境執行瀏覽器檢查後通過。不能以單次逾時認定網站故障。

## 尚未通過，不能視為完整驗收

1. 以自己設定的 Token 驗證正式登入、登出及工作階段到期；設定方式見 [管理員 Token](ADMIN-TOKEN.md)。
3. 正式站管理者編輯、跨裝置同步、版本衝突、公開分享及未授權寫入拒絕。
4. 更新正式前端與版本後重跑瀏覽器驗收。

以上完成後，再依使用者指定順序進行 AI 建議功能。
