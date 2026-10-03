param([string]$WebViewVersion)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$toolRoot = Join-Path $projectRoot '.tools/webdriver'
$driver = Join-Path $toolRoot 'bin/tauri-driver.exe'
if (!(Test-Path -LiteralPath $driver)) {
  & node.exe (Join-Path $projectRoot 'scripts/dev/run-native.mjs') cargo install tauri-driver --version 2.1.0 --locked --root $toolRoot
  if ($LASTEXITCODE -ne 0) { throw 'tauri-driver installation failed' }
}
if (!$WebViewVersion) {
  $webview = Join-Path ${env:ProgramFiles(x86)} 'Microsoft/EdgeWebView/Application'
  $WebViewVersion = Get-ChildItem -LiteralPath $webview -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1 -ExpandProperty Name
}
if ($WebViewVersion -notmatch '^\d+\.\d+\.\d+\.\d+$') { throw 'Cannot determine the installed WebView2 version' }
$edgeRoot = Join-Path $toolRoot 'edge'
$edgeDriver = Join-Path $edgeRoot 'msedgedriver.exe'
$installedVersion = if (Test-Path -LiteralPath $edgeDriver) { [Diagnostics.FileVersionInfo]::GetVersionInfo($edgeDriver).FileVersion } else { '' }
if ($installedVersion -notlike "$WebViewVersion*") {
  New-Item -ItemType Directory -Force -Path $edgeRoot | Out-Null
  $archive = Join-Path $edgeRoot 'edge.zip'
  Invoke-WebRequest -Uri "https://msedgedriver.microsoft.com/$WebViewVersion/edgedriver_win64.zip" -OutFile $archive
  Expand-Archive -LiteralPath $archive -DestinationPath $edgeRoot -Force
}
& $edgeDriver --version
if ($LASTEXITCODE -ne 0) { throw 'Edge WebDriver did not start' }
Write-Output "Tauri driver: $driver"
Write-Output 'Run the external driver in a separate terminal, then test the installed EXE. See tests/e2e/README.md.'
