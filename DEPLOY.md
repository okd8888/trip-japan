# 部署到 GitHub Pages — 完整步驟

> 這個專案是**純靜態網站**（只有 HTML / CSS / JS，沒有後端、不用建置），
> 所以 GitHub Pages 可以直接免費託管，還附 HTTPS。
> 以下步驟在 macOS 終端機執行，`git` 你電腦上已經有了。

---

## 第 0 步：設定 Git 身分（只要做一次）

沒設定的話 commit 會失敗，或是 GitHub 上顯示不出你的頭像。

```bash
git config --global user.name "你的名字"
git config --global user.email "你註冊 GitHub 用的 email"
```

> ⚠️ email 必須和你 GitHub 帳號裡的 email 一致，commit 才會算在你的貢獻紀錄上。
> 確認目前設定：`git config --global --list`

---

## 第 1 步：有 GitHub 帳號

還沒有的話到 <https://github.com/signup> 註冊，記下你的**帳號名稱（username）**，
等一下網址會用到：`https://<username>.github.io/<repo名稱>/`

---

## 第 2 步：在 GitHub 網頁建立一個空的 repository

1. 登入 GitHub，右上角 **＋** → **New repository**
2. **Repository name**：例如 `okinawa-trip`（只能用英數字、`-`、`_`，不要用中文）
3. **Description**：隨意，可留空
4. 選 **Public**
   - 免費帳號的 GitHub Pages **只支援 Public repo**
   - Public 代表**任何人都看得到你的行程內容**，所以護照號碼、訂房代號、
     信用卡末四碼這類資料不要寫進 `data/trip.js`
5. 下面的 **Add a README file / .gitignore / license 三個都不要勾**
   （本地已經有內容了，勾了反而會衝突）
6. 按 **Create repository**

建好後畫面會出現一段 `…or push an existing repository from the command line`，
裡面就是你的 repo 網址，長這樣：`https://github.com/<username>/okinawa-trip.git`

---

## 第 3 步：把本機專案推上去

在專案資料夾裡執行（把 `<username>` 和 `<repo名稱>` 換成你的）：

```bash
cd /Users/lung/claudeAI/code/旅遊行程規劃
git remote add origin https://github.com/<username>/<repo名稱>.git
git branch -M main
git push -u origin main
```

### 認證：會跳出來要帳號密碼怎麼辦？

GitHub **從 2021 年起就不接受帳號密碼**了，密碼欄要填 **Personal Access Token（PAT）**。

產生 PAT：

1. GitHub 右上角頭像 → **Settings**
2. 左邊拉到最底 → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
4. **Note** 填 `mac-git`，**Expiration** 選 90 days 或 No expiration
5. **Select scopes** 只勾 **`repo`** 這一整項
6. 按 **Generate token**，複製那串 `ghp_…`
   （⚠️ 只會出現這一次，關掉就看不到了，先貼到備忘錄）

回到終端機再 push 一次：

- `Username:` → 你的 GitHub 帳號名稱
- `Password:` → 貼上剛剛那串 `ghp_…`（貼上時畫面不會有任何變化，這是正常的，直接按 Enter）

macOS 的鑰匙圈會記住，之後就不用再輸入了。

<details>
<summary>不想用 PAT？改用 SSH 金鑰（一次設定，永久免密碼）</summary>

```bash
ssh-keygen -t ed25519 -C "你的email"        # 一路按 Enter 即可
pbcopy < ~/.ssh/id_ed25519.pub              # 複製公鑰
```

到 GitHub → Settings → **SSH and GPG keys** → **New SSH key** → 貼上 → Add。

然後把 remote 改成 SSH 網址：

```bash
git remote set-url origin git@github.com:<username>/<repo名稱>.git
git push -u origin main
```
</details>

---

## 第 4 步：開啟 GitHub Pages

1. 進到你的 repo 頁面 → 上方 **Settings**（齒輪那排最右邊）
2. 左側選單 → **Pages**
3. **Source** 選 **Deploy from a branch**
4. **Branch** 選 **`main`**，右邊資料夾選 **`/ (root)`**
5. 按 **Save**

---

## 第 5 步：等它蓋好，然後打開網址

- 到 repo 的 **Actions** 分頁，會看到一個 `pages build and deployment` 的工作在跑
- 打勾（約 30 秒 ~ 2 分鐘）之後，回到 **Settings → Pages**，最上面會顯示網址

```
https://<username>.github.io/<repo名稱>/
```

第一次部署偶爾要等 5–10 分鐘才會生效，開起來是 404 的話先泡杯茶再重整。

---

## 之後要改行程怎麼辦？

改 `data/trip.js`（或在網站「編輯」分頁改完下載覆蓋），然後：

```bash
git add -A
git commit -m "更新行程"
git push
```

推上去約 1 分鐘後網站自動更新，**不用再碰任何設定**。

---

## 疑難排解

| 症狀 | 原因與解法 |
|---|---|
| 網址 404 | ①Pages 還在建，等幾分鐘 ②Settings→Pages 的 Branch 沒選對 ③repo 是 Private（免費帳號不支援） |
| 開起來沒有樣式、一片白 | 通常是路徑被改成 `/app.js` 這種絕對路徑。本專案全部用相對路徑，不要改 |
| 改了 push 了但網站沒變 | 瀏覽器快取。手機：關掉分頁重開；電腦：`Cmd + Shift + R` 強制重整 |
| 行程圖片顯示不出來 | 圖檔名用英文（`assets/chart.png`），中文檔名容易出編碼問題；也注意大小寫要完全一致 |
| push 時說 `rejected` | 遠端有你本機沒有的 commit，先 `git pull --rebase origin main` 再 push |
| 想改成私人的 | 免費帳號做不到（Pages 必為公開）。要不公開就改用 Netlify / Cloudflare Pages 的密碼保護，或乾脆不要放敏感資料 |

---

## 加到手機主畫面（像 App 一樣用）

- **iPhone Safari**：開網址 → 下方分享鍵 → **加入主畫面**
- **Android Chrome**：右上角 ⋮ → **加到主畫面**

專案裡有 Service Worker，**開過一次之後即使在沖繩沒網路也能打開**（匯率會用上次抓到的值）。

---

## 選配：換成自己的網域

1. repo 根目錄新增一個檔案 `CNAME`，內容只有一行你的網域（例如 `trip.example.com`）
2. 到你的網域 DNS 新增 `CNAME` 記錄指向 `<username>.github.io`
3. Settings → Pages → Custom domain 填入該網域，勾選 **Enforce HTTPS**

---

## 完全不想碰終端機的替代做法

GitHub 網頁可以直接上傳檔案：

1. 建好 repo 後，在 repo 首頁按 **Add file** → **Upload files**
2. 把專案資料夾裡**所有檔案和資料夾**拖進去（含 `data/`、`assets/`、`.nojekyll`）
   - ⚠️ `.nojekyll` 是隱藏檔，Finder 裡按 `Cmd + Shift + .` 才看得到
3. 下方填 commit 訊息 → **Commit changes**
4. 之後照上面的第 4 步開啟 Pages

缺點是每次改行程都要重新上傳，比較麻煩。
