# scripts/verify.ps1
# Prism Tabs v2 - Full Verification Loop (PowerShell)
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Command
    )
    Write-Host "`n$Label" -ForegroundColor Yellow
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] $Label failed (exit code $LASTEXITCODE)." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] $Label passed." -ForegroundColor Green
}

Write-Host "`n=================================================" -ForegroundColor DarkGray
Write-Host ">>> Prism Tabs v2 - Verification Pipeline (PS1)" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor DarkGray

Invoke-Step '[1/5] TypeScript strict check (tsc --noEmit)' { npm run typecheck }
Invoke-Step '[2/5] ESLint architecture & code check' { npm run lint }
Invoke-Step '[3/5] Vitest unit test suite' { npm test }
Invoke-Step '[4/5] Vite MV3 production build (dist/)' { npm run build }

Write-Host "`n[5/5] Auditing dist/ MV3 manifest, CSP, assets, and BYOK key hygiene..." -ForegroundColor Yellow

$distDir = Join-Path $rootDir 'dist'
$pkg = Get-Content (Join-Path $rootDir 'package.json') -Raw | ConvertFrom-Json
$manifestPath = Join-Path $distDir 'manifest.json'

if (-not (Test-Path $manifestPath)) {
    throw 'dist/manifest.json was not generated.'
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($manifest.manifest_version -ne 3) {
    throw "Expected manifest_version 3, got $($manifest.manifest_version)."
}

$expectedNumericVersion = ($pkg.version -split '[-+]')[0]
if ($manifest.version -ne $expectedNumericVersion) {
    throw "Manifest version ($($manifest.version)) does not match package.json base ($expectedNumericVersion)."
}
if ($pkg.version -ne $expectedNumericVersion -and $manifest.version_name -ne $pkg.version) {
    throw "Manifest version_name ($($manifest.version_name)) does not match package.json ($($pkg.version))."
}

$allowedPermissions = @('tabs', 'tabGroups', 'storage')
$actualPermissions = @($manifest.permissions)
$sortedActual = (@($actualPermissions | Sort-Object)) -join ','
$sortedAllowed = (@($allowedPermissions | Sort-Object)) -join ','
if ($sortedActual -ne $sortedAllowed) {
    throw "Unexpected manifest permissions: $($actualPermissions -join ', ')"
}
if ($null -ne $manifest.host_permissions) {
    throw 'host_permissions must not be present in manifest.json.'
}

$requiredFiles = @(
    'popup.html',
    'background.js',
    'theme-boot.js',
    'icons/icon-16.png',
    'icons/icon-32.png',
    'icons/icon-48.png',
    'icons/icon-128.png'
)
foreach ($rel in $requiredFiles) {
    $full = Join-Path $distDir $rel
    if (-not (Test-Path $full)) {
        throw "Missing required dist asset: $rel"
    }
}

$popupHtml = Get-Content (Join-Path $distDir 'popup.html') -Raw
if ($popupHtml -match '<script(?![^>]*\bsrc=)[^>]*>') {
    throw 'Inline <script> detected in dist/popup.html (violates MV3 CSP).'
}

# Scan build output for accidentally embedded API keys or build-time key env lookups
$secretPatterns = @(
    'gsk_[A-Za-z0-9]{20,}',
    'AIzaSy[A-Za-z0-9_-]{25,}',
    'sk-proj-[A-Za-z0-9_-]{20,}',
    'VITE_GROQ_API_KEY'
)
$scanFiles = Get-ChildItem -Path $distDir -Recurse -File -Include *.js, *.html, *.json, *.css
foreach ($file in $scanFiles) {
    $content = Get-Content $file.FullName -Raw
    foreach ($pattern in $secretPatterns) {
        if ($content -match $pattern) {
            throw "Potential secret/key pattern '$pattern' found in $($file.FullName)"
        }
    }
}

Write-Host '[OK] MV3 manifest, CSP, assets, and BYOK security audit passed.' -ForegroundColor Green
Write-Host "`n=================================================" -ForegroundColor DarkGray
Write-Host "[SUCCESS] All verification gates passed for v$($pkg.version)!" -ForegroundColor Green
Write-Host "=================================================`n" -ForegroundColor DarkGray
