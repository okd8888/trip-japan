# 管理員 Token

在「更多 → 管理者登入」輸入自訂 Token，驗證成功後即可編輯行程與記帳。公開分享頁維持唯讀；不使用 Google 或 Cloudflare Access 登入。

## 設定 Token

Cloudflare → Workers & Pages → `jolly-field-3c8a` → Settings → Variables and Secrets：

1. 新增 **Secret**，名稱填 `ADMIN_TOKEN`。
2. 值填自行設定的 Token，建議至少 24 個隨機字元。
3. 儲存。不要把 Token 放進公開原始碼、網址或對話。

也可在 `worker` 目錄執行 `npx wrangler secret put ADMIN_TOKEN`，透過互動提示輸入。

Windows 可在專案根目錄執行 `powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File worker/set-admin-token.ps1`，透過密碼輸入視窗直接儲存至 Cloudflare，不將 Token 寫入檔案或命令列。

## 使用與權限

- Token 正確才建立 12 小時管理工作階段，登入憑證由 Secure／HttpOnly Cookie 保存。
- Token 不會儲存在 localStorage，也不會包含在分享網址；D1 只儲存雜湊。
- 後端逐次檢查管理權限，僅更改前端畫面不能取得寫入權限。
- 登出會撤銷目前工作階段；更新 `ADMIN_TOKEN` 後，舊工作階段也會失效。
- 登入入口限制同一來源 IP 每分鐘約 10 次嘗試，依 Cloudflare 節點計數。
- 管理頁需連線登入。已開啟頁面的離線修改保留在本機，恢復連線後可同步；公開分享頁可離線重新載入。
- 持有同一組 Token 的人具有相同管理權限，能管理所有行程。

## 部署與驗收

先設定 Secret，再於 `worker` 目錄執行：

```powershell
npm install
npx wrangler deploy --dry-run
npm run deploy
```

沿用既有 D1 行程與花費，新增 `admin_sessions` 表，不刪除既有資料。部署會打包管理介面，不能只貼 `src/index.js`。

專案根目錄的驗證命令：

```powershell
node --test tests/core.test.cjs tests/auth.test.cjs
node tests/browser.cjs
node tests/token-browser.cjs
node tests/live-public.cjs
```

正式部署後仍需以自己設定的 Token 完成登入、編輯、分享及登出驗收。
