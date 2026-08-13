# Download ScriptHookVDotNet3.dll (nightly) into libs/ for CI / machines without GTA.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$libs = Join-Path $root 'libs'
New-Item -ItemType Directory -Force -Path $libs | Out-Null
$dest = Join-Path $libs 'ScriptHookVDotNet3.dll'
if (Test-Path $dest) {
  Write-Host "Already have $dest"
  exit 0
}

$api = 'https://api.github.com/repos/scripthookvdotnet/scripthookvdotnet-nightly/releases/latest'
$headers = @{ 'User-Agent' = 'GTAMOZA-CI'; 'Accept' = 'application/vnd.github+json' }
$rel = Invoke-RestMethod -Uri $api -Headers $headers
$asset = $rel.assets | Where-Object { $_.name -match '\.zip$' } | Select-Object -First 1
if (-not $asset) { throw 'No zip asset on latest SHVDN nightly release' }

$zip = Join-Path $env:TEMP ("shvdn-" + $rel.tag_name + '.zip')
Write-Host "Downloading $($asset.browser_download_url)"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -Headers $headers
$extract = Join-Path $env:TEMP ("shvdn-extract-" + $rel.tag_name)
if (Test-Path $extract) { Remove-Item -Recurse -Force $extract }
Expand-Archive -Path $zip -DestinationPath $extract -Force
$dll = Get-ChildItem -Path $extract -Recurse -Filter 'ScriptHookVDotNet3.dll' | Select-Object -First 1
if (-not $dll) { throw 'ScriptHookVDotNet3.dll missing from archive' }
Copy-Item -Force $dll.FullName $dest
Write-Host "Installed $dest ($($rel.tag_name))"
