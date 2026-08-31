# 一鍵部署到 GitHub Pages
# 由 deploy.bat 呼叫，不要直接雙擊這個檔案。

# git 的輸出是 UTF-8，要先告訴 PowerShell 才不會變亂碼
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Set-Location -LiteralPath $PSScriptRoot

function Line { param($t = '') Write-Host $t }
function Head {
  Line ''
  Line '=========================================='
  Line '  部署行程手冊到 GitHub Pages'
  Line '=========================================='
  Line ''
}
function Bye {
  Line ''
  Read-Host '按 Enter 關閉視窗' | Out-Null
  exit
}

Head

# ---------- 環境檢查 ----------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Line '[X] 找不到 git。請先安裝 Git for Windows：'
  Line '    https://git-scm.com/download/win'
  Bye
}

git rev-parse --git-dir > $null
if ($LASTEXITCODE -ne 0) {
  Line '[X] 這個資料夾不是 git repository。'
  Line '    請把 deploy.bat 和 deploy.ps1 放在專案根目錄再執行。'
  Bye
}

# ---------- 分支：一定要在 main ----------
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') {
  Line "目前在 `"$branch`" 分支，但 GitHub Pages 只部署 main。"
  Line ''
  $ans = Read-Host '要切回 main 並把這個分支合併進去嗎？(Y/N)'
  if ($ans -notmatch '^[Yy]') {
    Line ''
    Line '已取消。要自己處理的話：'
    Line '    git checkout main'
    Line "    git merge $branch"
    Bye
  }

  Line ''
  Line "切換到 main 並合併 $branch ..."
  git checkout main
  if ($LASTEXITCODE -ne 0) {
    Line ''
    Line '[X] 切換失敗。通常是有未提交的改動擋住了，請先處理再重跑。'
    Bye
  }
  git merge --ff-only $branch
  if ($LASTEXITCODE -ne 0) {
    Line ''
    Line '[X] 無法快轉合併（兩邊都有新的 commit）。請手動處理：'
    Line "    git merge $branch"
    Bye
  }
  $merged = $branch
  $branch = 'main'
  Line ''
}

# ---------- 從 remote 推算網址 ----------
$remote = (git remote get-url origin)
if ($LASTEXITCODE -ne 0 -or -not $remote) {
  Line '[X] 還沒設定 remote。請先執行：'
  Line '    git remote add origin https://github.com/你的帳號/repo名稱.git'
  Bye
}
$remote = $remote.Trim()
$actions = $null
$site = $null
if ($remote -match 'github\.com[:/](?<owner>[^/]+)/(?<name>[^/]+?)(\.git)?$') {
  $actions = "https://github.com/$($Matches.owner)/$($Matches.name)/actions"
  $site    = "https://$($Matches.owner).github.io/$($Matches.name)/"
}

# ---------- 有改動就 commit ----------
$dirty = git status --porcelain
if ($dirty) {
  Line '這些檔案有改動：'
  Line ''
  git status --short
  Line ''

  # 訊息可以用參數帶入：deploy.bat "更新沖繩行程"
  $msg = if ($args.Count -gt 0) { $args -join ' ' } else { '' }
  if (-not $msg) { $msg = Read-Host '請輸入這次改了什麼（直接按 Enter 用「更新行程」）' }
  if (-not $msg) { $msg = '更新行程' }

  Line ''
  Line '[1/2] 建立 commit ...'
  git add -A
  # 用檔案傳訊息，避免中文在命令列被轉碼弄壞
  $tmp = [IO.Path]::GetTempFileName()
  [IO.File]::WriteAllText($tmp, $msg, (New-Object Text.UTF8Encoding $false))
  git commit -F $tmp
  $code = $LASTEXITCODE
  Remove-Item $tmp -Force
  if ($code -ne 0) {
    Line ''
    Line '[X] commit 失敗。若訊息是 "Please tell me who you are"，先執行：'
    Line '    git config --global user.name "你的名字"'
    Line '    git config --global user.email "你的email"'
    Bye
  }
} else {
  Line '沒有未提交的改動。'
}

# ---------- 還有沒有東西要推 ----------
$ahead = git rev-list --count "origin/$branch..$branch"
if ($LASTEXITCODE -ne 0) { $ahead = '?' }      # 遠端還沒有這個分支，當作要推
if ($ahead -eq '0') {
  Line ''
  Line '本機和 GitHub 一樣新，沒有東西要部署。'
  if ($site) { Line "網站： $site" }
  Bye
}

Line ''
if ($ahead -eq '?') { Line '[2/2] 推送到 GitHub ...' }
else { Line "[2/2] 推送 $ahead 個 commit 到 GitHub ..." }
Line '      （第一次可能跳出視窗要你登入，選 "Sign in with your browser"）'
Line ''
git push origin $branch

if ($LASTEXITCODE -ne 0) {
  Line ''
  Line '=========================================='
  Line '  推送失敗'
  Line '=========================================='
  Line ''
  Line '對照上面的錯誤訊息：'
  Line ''
  Line '  * Invalid username or token / Authentication failed'
  Line '      Windows 存了失效的舊憑證。按 Win 搜尋「認證管理員」，'
  Line '      點「Windows 認證」，找到 git:https://github.com 後移除，'
  Line '      然後重新執行這個腳本，就會跳出登入視窗。'
  Line ''
  Line '  * rejected / non-fast-forward'
  Line '      GitHub 上有你本機沒有的 commit。先執行：'
  Line '          git pull --rebase origin main'
  Line '      再重新執行這個腳本。'
  Line ''
  Line '  * Could not resolve host'
  Line '      沒有網路，或防火牆擋住了。'
  Bye
}

Line ''
Line '=========================================='
Line '  推送成功，GitHub Pages 正在重新部署'
Line '=========================================='
Line ''
if ($merged) {
  Line "已合併的分支 $merged 可以刪掉了："
  Line "    git branch -d $merged"
  Line ''
}
if ($site) {
  Line "  部署進度： $actions"
  Line "  網站網址： $site"
  Line ''
  Line '  約 1-2 分鐘後完成。打開網站記得按 Ctrl+Shift+R 強制重整。'
  Line ''
  Line '正在開啟部署進度頁面 ...'
  Start-Process $actions
} else {
  Line '  remote 不是 GitHub，請自行確認部署狀態。'
}
Bye
