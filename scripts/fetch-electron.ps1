# Download Electron binary via WinHTTP when Node/@electron/get times out (VPN, TLS quirks).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$electronPkg = Join-Path $root 'node_modules\electron\package.json'
if (-not (Test-Path $electronPkg)) {
  throw 'Run npm install --ignore-scripts first (electron package must exist).'
}

$ver = (Get-Content $electronPkg -Raw | ConvertFrom-Json).version
$zipName = "electron-v$ver-win32-x64.zip"
$mirrors = @(
  "https://npmmirror.com/mirrors/electron/v$ver/$zipName",
  "https://github.com/electron/electron/releases/download/v$ver/$zipName"
)

$electronRoot = Join-Path $root 'node_modules\electron'
$dist = Join-Path $electronRoot 'dist'
$pathTxt = Join-Path $electronRoot 'path.txt'
$exe = Join-Path $dist 'electron.exe'

function Set-ElectronPathTxt {
  Set-Content -Path $pathTxt -Value 'electron.exe' -Encoding ascii -NoNewline
}

if (Test-Path $exe) {
  if (-not (Test-Path $pathTxt) -or (Get-Content $pathTxt -Raw).Trim() -ne 'electron.exe') {
    Set-ElectronPathTxt
    Write-Host "Fixed path.txt for Electron $ver"
  } else {
    Write-Host "Electron $ver already ready at $dist"
  }
  exit 0
}

$cache = Join-Path $env:TEMP "gtamoza-electron-$ver"
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$zip = Join-Path $cache $zipName

if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt 1MB) {
  $ok = $false
  foreach ($url in $mirrors) {
    Write-Host "Downloading $url ..."
    try {
      Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 600
      $ok = $true
      break
    } catch {
      Write-Warning $_.Exception.Message
    }
  }
  if (-not $ok) { throw "Could not download $zipName from any mirror." }
}

if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Force -Path $dist | Out-Null
Write-Host "Extracting to $dist ..."
Expand-Archive -LiteralPath $zip -DestinationPath $dist -Force

if (-not (Test-Path $exe)) {
  throw 'electron.exe missing after extract'
}

Set-ElectronPathTxt
Write-Host "Done: Electron $ver -> $dist (path.txt -> electron.exe)"