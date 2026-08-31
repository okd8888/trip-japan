# 部署到 GitHub Pages — 完整步驟（Windows）

> 這個專案是**純靜態網站**（只有 HTML / CSS / JS，沒有後端、不用建置），
> 所以 GitHub Pages 可以直接免費託管，還附 HTTPS。
> 以下步驟在 **Windows 命令提示字元（cmd）或 Git Bash** 執行。

---

## 事前準備：確認有裝 Git

按 `Win + R` → 輸入 `cmd` → Enter，然後：

```
git --version
```

有印出版本號（例如 `git version 2.45.1.windows.1`）就代表有裝。
沒有的話到 <https://git-scm.com/download/win> 下載安裝，一路按「下一步」即可
（安裝時預設就會勾選 **Git Credential Manager**，這是後面免密碼登入的關鍵，別取消勾選）。

### 開啟終端機的兩種方式

| 方式 | 怎麼開 | 路徑寫法 |
|---|---|---|
| **命令提示字元 cmd** | `Win + R` → `cmd` → Enter | `cd /d D:\ClaudeAI\projects\trip-japan` |
| **Git Bash**（推薦） | 在專案資料夾空白處按右鍵 → **Open Git Bash here** | 已經在正確目錄，不用 cd |

> 本文的指令兩種都能跑。差別只在切換目錄的寫法。

---

## 第 0 步：設定 Git 身分（只要做一次）

沒設定的話 commit 會失敗，或是 GitHub 上顯示不出你的頭像。

```
git config --global user.name "你的名字"
```

```
git config --global user.email "你註冊 GitHub 用的 email"
```

> ⚠️ email 必須和你 GitHub 帳號裡的 email 一致，commit 才會算在你的貢獻紀錄上。

確認目前設定：

```
git config --global --list
```

---

## 第 1 步：有 GitHub 帳號

還沒有的話到 <https://github.com/signup> 註冊，記下你的**帳號名稱（username）**，
等一下網址會用到：`https://<username>.github.io/<repo名稱>/`

---

## 第 2 步：在 GitHub 網頁建立一個空的 repository

1. 登入 GitHub，右上角 **＋** → **New repository**
2. **Repository name**：例如 `trip-japan`（只能用英數字、`-`、`_`，不要用中文）
3. **Description**：隨意，可留空
4. 選 **Public**
   - 免費帳號的 GitHub Pages **只支援 Public repo**
   - Public 代表**任何人都看得到你的行程內容**，所以護照號碼、訂房代號、
     信用卡末四碼這類資料不要寫進 `data/trip.js`
5. 下面的 **Add a README file / .gitignore / license 三個都不要勾**
   （本地已經有內容了，勾了反而會衝突）
6. 按 **Create repository**

建好後畫面會出現一段 `…or push an existing repository from the command line`，
裡面就是你的 repo 網址，長這樣：`https://github.com/<username>/trip-japan.git`

---

## 第 3 步：把本機專案推上去

在專案資料夾裡執行（把 `<username>` 和 `<repo名稱>` 換成你的）：

```
cd /d D:\ClaudeAI\projects\trip-japan
```

```
git remote add origin https://github.com/<username>/<repo名稱>.git
```

```
git branch -M main
```

```
git push -u origin main
```

### 認證：會跳出視窗要我登入

第一次 push 時，**Git Credential Manager 會自動跳出一個視窗**，
選 **Sign in with your browser** → 瀏覽器開啟 GitHub → 按 **Authorize** →
回到終端機看到 `main -> main` 就成功了。憑證會存進 Windows 認證管理員，**之後不用再登入**。

<details>
<summary>沒跳視窗，直接報 <code>Invalid username or token</code> 怎麼辦？</summary>

代表 Windows 裡存了一組**已失效的舊憑證**，GCM 拿它去試才被拒絕。清掉就好：

**做法 A：從認證管理員刪（最直覺）**

1. 按 `Win` → 搜尋「**認證管理員**」（Credential Manager）→ 開啟
2. 點上方的「**Windows 認證**」
3. 在「一般認證」清單裡找 `git:https://github.com`
4. 展開它 → 按「**移除**」

**做法 B：用指令刪（等效，比較快 —— 但這行只能在 Git Bash 跑，cmd 沒有 `printf`）**

```
printf "protocol=https\nhost=github.com\n\n" | git credential reject
```

清掉後再 push 一次，這次就會跳出登入視窗了：

```
git push origin main
```

</details>

<details>
<summary>不想用瀏覽器登入？改用 Personal Access Token（PAT）</summary>

1. 開 <https://github.com/settings/tokens> → **Tokens (classic)** → **Generate new token (classic)**
2. **Note** 填 `windows-git`，**Expiration** 選 90 days 或 No expiration
3. **Select scopes** 只勾 **`repo`** 這一整項
4. 按 **Generate token**，複製那串 `ghp_…`
   （⚠️ 只會出現這一次，關掉就看不到了，先貼到記事本）
5. 先照上面的做法 A 或 B 清掉舊憑證，再 push
6. `Username:` → 你的 GitHub 帳號名稱
   `Password:` → 貼上 `ghp_…`（**貼上時畫面不會有任何變化，這是正常的**，直接按 Enter）

</details>

<details>
<summary>不想用 PAT？改用 SSH 金鑰（一次設定，永久免密碼）</summary>

在 **Git Bash** 裡執行（cmd 也可以，`clip` 指令通用）：

```
ssh-keygen -t ed25519 -C "你的email"
```

一路按 Enter 即可。然後把公鑰複製到剪貼簿：

```
clip < %USERPROFILE%\.ssh\id_ed25519.pub
```

Git Bash 的話用這行：

```
clip < ~/.ssh/id_ed25519.pub
```

到 <https://github.com/settings/keys> → **New SSH key** → 貼上 → **Add SSH key**。

然後把 remote 改成 SSH 網址：

```
git remote set-url origin git@github.com:<username>/<repo名稱>.git
```

```
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

> 這個設定**只要做一次**，之後每次 push 都會自動重新部署，不用再進來。

---

## 第 5 步：等它蓋好，然後打開網址

- 到 repo 的 **Actions** 分頁，會看到一個 `pages build and deployment` 的工作在跑
- 黃點＝進行中，綠勾＝完成（約 30 秒 ~ 2 分鐘）
- 完成後回到 **Settings → Pages**，最上面會顯示網址

```
https://<username>.github.io/<repo名稱>/
```

第一次部署偶爾要等 5–10 分鐘才會生效，開起來是 404 的話先泡杯茶再重整。

---

## 之後要改行程怎麼辦？

### 步驟 1：改內容

**方法 A：在網站上改（推薦）**

1. 打開網站 → 底部「**編輯**」分頁 → 用表單改（改動即時存在你的瀏覽器裡，只有你看得到）
2. 捲到最下面「發布到網站」→ 按「**下載 trip.js**」
3. 把下載的 `trip.js` 覆蓋掉 `D:\ClaudeAI\projects\trip-japan\data\trip.js`

**方法 B：直接改檔案**

用編輯器打開 `data\trip.js` 改完存檔。

### 步驟 2：部署

**用腳本（推薦）：在專案資料夾裡雙擊 [`deploy.bat`](deploy.bat)**

它會自動做完：檢查分支 → 顯示改了哪些檔案 → 問你 commit 訊息 → commit → push →
開啟部署進度頁面。失敗時會直接印出對應的解法。
如果當下不在 `main` 分支，它會問你要不要順便切回去併進來。

> `deploy.bat` 只是啟動器，實際邏輯在 [`deploy.ps1`](deploy.ps1)，兩個檔案要放在一起。
> 中文訊息全寫在 `.ps1` 裡是刻意的 —— 批次檔存成 UTF-8 中文會讓 cmd.exe 解析錯亂。

也可以在終端機帶入訊息，跳過詢問：

```
deploy.bat "更新沖繩行程"
```

<details>
<summary>不想用腳本，手動下指令</summary>

```
cd /d D:\ClaudeAI\projects\trip-japan
```

```
git add -A
```

```
git commit -m "更新行程"
```

```
git push
```

</details>

推上去約 1 分鐘後網站自動更新，**不用再碰任何設定**。

---

## 疑難排解

| 症狀 | 原因與解法 |
|---|---|
| push 時 `Invalid username or token` | Windows 存了失效的舊憑證。按 `Win` 搜尋「認證管理員」→ Windows 認證 → 刪掉 `git:https://github.com`，再 push 一次就會跳出登入視窗 |
| push 時 `rejected` / `non-fast-forward` | 遠端有你本機沒有的 commit。先 `git pull --rebase origin main` 再 push |
| push 時 `src refspec main does not match any` | 還沒 commit 過。先 `git add -A` 再 `git commit -m "首次提交"` |
| 網址 404 | ①Pages 還在建，等幾分鐘 ②Settings→Pages 的 Branch 沒選對 ③repo 是 Private（免費帳號不支援） |
| 開起來沒有樣式、一片白 | 通常是路徑被改成 `/app.js` 這種絕對路徑。本專案全部用相對路徑，不要改 |
| **改了 push 了但網站沒變** | 瀏覽器快取。電腦按 `Ctrl + Shift + R` 強制重整；手機關掉分頁重開 |
| 網站顯示的行程跟 `data/trip.js` 不一樣 | 你在「編輯」分頁改過，瀏覽器存了**本機修改版**（右上角會顯示這幾個字）。要看檔案版本，到「發布到網站」按「還原成檔案版本」 |
| 行程圖片顯示不出來 | 圖檔名用英文（`assets/chart.png`），中文檔名容易出編碼問題；也注意大小寫要完全一致 |
| Git Bash 中文變成亂碼 | 在視窗標題列按右鍵 → Options → Text → Character set 選 **UTF-8** |
| 想改成私人的 | 免費帳號做不到（Pages 必為公開）。要不公開就改用 Netlify / Cloudflare Pages 的密碼保護，或乾脆不要放敏感資料 |

---

## 加到手機主畫面（像 App 一樣用）

- **iPhone Safari**：開網址 → 下方分享鍵 → **加入主畫面**
- **Android Chrome**：右上角 ⋮ → **加到主畫面**

專案裡有 Service Worker（[sw.js](sw.js)），採「**網路優先**」策略：
有網路時永遠拿最新版，**沒網路時用上次的快取**，所以在國外飛航模式也打得開
（匯率會用上次抓到的值）。因為是網路優先，**改版後不需要清快取或改版號**。

---

## 選配：換成自己的網域

1. repo 根目錄新增一個檔案 `CNAME`，內容只有一行你的網域（例如 `trip.example.com`）
2. 到你的網域 DNS 新增 `CNAME` 記錄指向 `<username>.github.io`
3. Settings → Pages → Custom domain 填入該網域，勾選 **Enforce HTTPS**

---

## 完全不想碰終端機的替代做法

GitHub 網頁可以直接上傳檔案：

1. 建好 repo 後，在 repo 首頁按 **Add file** → **Upload files**
2. 把專案資料夾裡**所有檔案和資料夾**拖進去（含 `data\`、`assets\`、`.nojekyll`）
   - ⚠️ `.nojekyll` 是隱藏檔。檔案總管上方切到「**檢視**」分頁 →
     勾選「**隱藏的項目**」才看得到
3. 下方填 commit 訊息 → **Commit changes**
4. 之後照上面的第 4 步開啟 Pages

缺點是每次改行程都要重新上傳，比較麻煩。
