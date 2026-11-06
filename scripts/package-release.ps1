# scripts/package-release.ps1
# Prism Tabs - Clean BYOK Release Packager (PowerShell)
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "`n>>> Starting Clean Release Packaging for Prism Tabs..." -ForegroundColor Cyan

# 1. Read version from package.json
$pkgPath = Join-Path $rootDir "package.json"
if (-not (Test-Path $pkgPath)) {
    Write-Error "package.json not found at $pkgPath"
    exit 1
}

$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$version = $pkg.version
if (-not $version) { $version = "1.0.0" }
Write-Host "[INFO] Packaging version: v$version" -ForegroundColor Green

# 2. TypeScript typecheck
Write-Host "`n[CHECK] Running TypeScript typecheck..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript typecheck failed!"
    exit 1
}

# 3. Clean previous build if any
$distReleaseDir = Join-Path $rootDir "dist-release"
if (Test-Path $distReleaseDir) {
    Remove-Item -Path $distReleaseDir -Recurse -Force
}

# 4. Build extension in release mode (zero API keys injected)
Write-Host "`n[BUILD] Compiling clean release bundle (mode: release)..." -ForegroundColor Yellow
npx vite build --mode release
if ($LASTEXITCODE -ne 0) {
    Write-Error "Vite build failed!"
    exit 1
}

if (-not (Test-Path $distReleaseDir)) {
    Write-Error "Build failed: $distReleaseDir does not exist!"
    exit 1
}

# 5. Automated Security & Secret Leak Audit
Write-Host "`n[SECURITY] Running security audit for sensitive credentials..." -ForegroundColor Yellow
$leaksFound = $false
$scanExtensions = @("*.js", "*.html", "*.css", "*.json", "*.txt")
$filesToScan = Get-ChildItem -Path $distReleaseDir -Recurse -Include $scanExtensions

foreach ($file in $filesToScan) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    # Check for Groq API keys (gsk_...)
    if ($content -match 'gsk_[A-Za-z0-9_-]{20,}') {
        Write-Host "[FAIL] CRITICAL SECURITY FAILURE: Found leaked Groq key in $($file.Name)!" -ForegroundColor Red
        $leaksFound = $true
    }
    # Check for Gemini API keys (AIza...)
    if ($content -match 'AIza[0-9A-Za-z-_]{35}') {
        Write-Host "[FAIL] CRITICAL SECURITY FAILURE: Found leaked Gemini key in $($file.Name)!" -ForegroundColor Red
        $leaksFound = $true
    }
}

if ($leaksFound) {
    Write-Error "Security audit failed! Secrets detected in release bundle."
    exit 1
}
Write-Host "[OK] Security audit passed: ZERO personal keys or secrets found in bundle." -ForegroundColor Green

# 6. Prepare releases directory
$releasesDir = Join-Path $rootDir "releases"
if (-not (Test-Path $releasesDir)) {
    New-Item -ItemType Directory -Path $releasesDir -Force | Out-Null
}

$unpackedDest = Join-Path $releasesDir "prism-tabs-v$version"
$zipDest = Join-Path $releasesDir "prism-tabs-v$version.zip"

if (Test-Path $unpackedDest) {
    Remove-Item -Path $unpackedDest -Recurse -Force
}
if (Test-Path $zipDest) {
    Remove-Item -Path $zipDest -Force
}

Copy-Item -Path $distReleaseDir -Destination $unpackedDest -Recurse
Write-Host "`n[FOLDER] Created clean unpacked folder: releases/prism-tabs-v$version" -ForegroundColor Cyan

# 7. Compress into .zip
Write-Host "[ARCHIVE] Creating distribution ZIP archive..." -ForegroundColor Yellow
Compress-Archive -Path "$unpackedDest\*" -DestinationPath $zipDest -Force

$zipSizeKb = [math]::Round(((Get-Item $zipDest).Length / 1KB), 1)
Write-Host "`n[SUCCESS] Release successfully packaged!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor DarkGray
Write-Host " Version:         v$version"
Write-Host " Security:        Clean BYOK (Zero Hardcoded Secrets)"
Write-Host " Unpacked Folder: releases/prism-tabs-v$version/"
Write-Host " ZIP Archive:     releases/prism-tabs-v$version.zip ($zipSizeKb KB)"
Write-Host "=================================================`n" -ForegroundColor DarkGray
