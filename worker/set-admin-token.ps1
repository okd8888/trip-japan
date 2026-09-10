$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Token 只由本機密碼欄位傳入 Wrangler 的標準輸入，不放進命令列或檔案。
$dialog = New-Object System.Windows.Forms.Form
$dialog.Text = '日本旅遊手冊 — 設定管理員 Token'
$dialog.ClientSize = New-Object System.Drawing.Size(470, 175)
$dialog.StartPosition = 'CenterScreen'
$dialog.FormBorderStyle = 'FixedDialog'
$dialog.MaximizeBox = $false
$dialog.MinimizeBox = $false
$dialog.TopMost = $true

$label = New-Object System.Windows.Forms.Label
$label.Text = '輸入你自訂的 Token，將直接儲存至 Cloudflare Secret。'
$label.SetBounds(20, 18, 435, 35)
$inputBox = New-Object System.Windows.Forms.TextBox
$inputBox.UseSystemPasswordChar = $true
$inputBox.MaxLength = 4096
$inputBox.SetBounds(20, 60, 430, 28)
$save = New-Object System.Windows.Forms.Button
$save.Text = '儲存 Token'
$save.SetBounds(230, 115, 105, 32)
$save.Add_Click({
  if ($inputBox.Text.Length -gt 0) { $dialog.DialogResult = 'OK'; $dialog.Close() }
})
$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = '取消'
$cancel.DialogResult = 'Cancel'
$cancel.SetBounds(345, 115, 105, 32)
$dialog.Controls.AddRange(@($label, $inputBox, $save, $cancel))
$dialog.AcceptButton = $save
$dialog.CancelButton = $cancel
if ($dialog.ShowDialog() -ne 'OK') { $dialog.Dispose(); Write-Output 'TOKEN_SETUP_CANCELLED'; exit 2 }

$process = New-Object System.Diagnostics.Process
$process.StartInfo.FileName = (Get-Command node.exe).Source
$wranglerFile = Join-Path $PSScriptRoot 'node_modules\wrangler\bin\wrangler.js'
$configFile = Join-Path $PSScriptRoot 'wrangler.json'
$process.StartInfo.Arguments = '"' + $wranglerFile + '" secret put ADMIN_TOKEN --config "' + $configFile + '"'
$process.StartInfo.WorkingDirectory = $PSScriptRoot
$process.StartInfo.UseShellExecute = $false
$process.StartInfo.CreateNoWindow = $true
$process.StartInfo.RedirectStandardInput = $true
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true
try {
  [void]$process.Start()
  $outputTask = $process.StandardOutput.ReadToEndAsync()
  $errorTask = $process.StandardError.ReadToEndAsync()
  $process.StandardInput.WriteLine($inputBox.Text)
  $process.StandardInput.Close()
  $inputBox.Clear()
  $dialog.Dispose()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { Write-Output 'TOKEN_SETUP_FAILED'; exit 1 }
  Write-Output 'TOKEN_SETUP_SUCCESS'
} finally { $inputBox.Clear(); $dialog.Dispose(); $process.Dispose() }
