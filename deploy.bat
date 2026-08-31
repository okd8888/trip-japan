@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ==========================================
echo   部署行程手冊到 GitHub Pages
echo ==========================================
echo.

rem ---------- 確認環境 ----------
git --version >nul 2>&1
if errorlevel 1 (
  echo [X] 找不到 git。請先安裝 Git for Windows：
  echo     https://git-scm.com/download/win
  goto :end
)

git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
  echo [X] 這個資料夾不是 git repository。
  echo     請把 deploy.bat 放在專案根目錄再執行。
  goto :end
)

rem ---------- 必須在 main 分支 ----------
for /f "delims=" %%i in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%i"
if not "!BRANCH!"=="main" (
  echo [X] 目前在 "!BRANCH!" 分支，不是 main。
  echo     GitHub Pages 只部署 main，請先切回去：
  echo         git checkout main
  echo         git merge !BRANCH!
  goto :end
)

rem ---------- 從 remote 推算網址 ----------
for /f "delims=" %%i in ('git remote get-url origin 2^>nul') do set "REMOTE=%%i"
if "!REMOTE!"=="" (
  echo [X] 還沒設定 remote。請先執行：
  echo         git remote add origin https://github.com/你的帳號/repo名稱.git
  goto :end
)
set "ACTIONS="
set "SITE="
echo !REMOTE! | findstr /i "github\.com" >nul
if not errorlevel 1 (
  set "REPO=!REMOTE:https://github.com/=!"
  set "REPO=!REPO:git@github.com:=!"
  set "REPO=!REPO:.git=!"
  for /f "tokens=1,2 delims=/" %%a in ("!REPO!") do (
    set "ACTIONS=https://github.com/%%a/%%b/actions"
    set "SITE=https://%%a.github.io/%%b/"
  )
)

rem ---------- 有哪些改動 ----------
set "DIRTY="
for /f "delims=" %%i in ('git status --porcelain') do set "DIRTY=1"

if defined DIRTY (
  echo 這些檔案有改動：
  echo.
  git status --short
  echo.

  rem 訊息可以用參數帶入：deploy.bat "更新沖繩行程"
  set "MSG=%~1"
  if "!MSG!"=="" set /p "MSG=請輸入這次改了什麼（直接按 Enter 用「更新行程」）: "
  if "!MSG!"=="" set "MSG=更新行程"

  echo.
  echo [1/2] 建立 commit...
  git add -A
  git commit -m "!MSG!"
  if errorlevel 1 (
    echo [X] commit 失敗。若是說 "Please tell me who you are"，先執行：
    echo         git config --global user.name "你的名字"
    echo         git config --global user.email "你的email"
    goto :end
  )
) else (
  echo 沒有未提交的改動。
)

rem ---------- 還有沒有東西要推 ----------
set "AHEAD=0"
for /f "delims=" %%i in ('git rev-list --count origin/!BRANCH!..!BRANCH! 2^>nul') do set "AHEAD=%%i"
if "!AHEAD!"=="0" (
  echo.
  echo 本機和 GitHub 一樣新，沒有東西要部署。
  if defined SITE echo 網站： !SITE!
  goto :end
)

echo.
echo [2/2] 推送 !AHEAD! 個 commit 到 GitHub...
echo       （第一次可能跳出視窗要你登入，選 "Sign in with your browser"）
echo.
git push origin !BRANCH!
if errorlevel 1 goto :pushfail

echo.
echo ==========================================
echo   推送成功，GitHub Pages 正在重新部署
echo ==========================================
echo.
if not defined SITE (
  echo   remote 不是 GitHub，請自行確認部署狀態。
  goto :end
)
echo   部署進度： !ACTIONS!
echo   網站網址： !SITE!
echo.
echo   約 1-2 分鐘後完成。打開網站記得按 Ctrl+Shift+R 強制重整。
echo.
echo 正在開啟部署進度頁面...
start "" "!ACTIONS!"
goto :end

rem ---------- push 失敗的處理 ----------
:pushfail
echo.
echo ==========================================
echo   推送失敗
echo ==========================================
echo.
echo 對照上面的錯誤訊息：
echo.
echo  * Invalid username or token / Authentication failed
echo      Windows 存了失效的舊憑證。按 Win 搜尋「認證管理員」→
echo      「Windows 認證」→ 找到 git:https://github.com → 移除，
echo      然後重新執行這個腳本，就會跳出登入視窗。
echo.
echo  * rejected / non-fast-forward
echo      GitHub 上有你本機沒有的 commit。先執行：
echo          git pull --rebase origin main
echo      再重新執行這個腳本。
echo.
echo  * Could not resolve host
echo      沒有網路，或防火牆擋住了。
echo.

:end
echo.
pause
endlocal
