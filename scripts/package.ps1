# scripts/package.ps1
# Prism Tabs v2 - Release ZIP Packaging & Audit (PowerShell)
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "`n=================================================" -ForegroundColor DarkGray
Write-Host ">>> Prism Tabs v2 - Release Packaging Pipeline" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor DarkGray

# 1. Run full verification first
& (Join-Path $PSScriptRoot 'verify.ps1')
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Verification failed; aborting packaging." -ForegroundColor Red
    exit 1
}

# 2. Verify Single Source of Truth across package.json, package-lock.json, and dist/manifest.json
$pkg = Get-Content (Join-Path $rootDir 'package.json') -Raw | ConvertFrom-Json
$distDir = Join-Path $rootDir 'dist'
$manifest = Get-Content (Join-Path $distDir 'manifest.json') -Raw | ConvertFrom-Json

$version = [string]$pkg.version
$expectedNumericVersion = ($version -split '[-+]')[0]

$lockCheckOutput = node -e "const l=require('./package-lock.json'); console.log(l.version + '|' + (l.packages && l.packages[''] ? l.packages[''].version : ''));"
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to parse package-lock.json.'
}
$lockParts = ([string]$lockCheckOutput).Trim().Split('|')
if ($lockParts[0] -ne $version -or $lockParts[1] -ne $version) {
    throw "package-lock.json version mismatch (expected $version, got root=$($lockParts[0]) pkg=$($lockParts[1]))."
}
if ([string]$manifest.version -ne $expectedNumericVersion) {
    throw "dist/manifest.json version mismatch (expected $expectedNumericVersion, got $($manifest.version))."
}
if ($version -ne $expectedNumericVersion -and [string]$manifest.version_name -ne $version) {
    throw "dist/manifest.json version_name mismatch (expected $version, got $($manifest.version_name))."
}

# 3. Clean & create release ZIP from dist/
$releaseDir = Join-Path $rootDir 'release'
if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir | Out-Null
}

$zipName = "prism-tabs-v$version.zip"
$zipPath = Join-Path $releaseDir $zipName
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}

Compress-Archive -Path (Join-Path $distDir '*') -DestinationPath $zipPath -CompressionLevel Optimal -Force

# 4. Audit ZIP archive contents (required files, no .env/secrets)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $entryNames = @($archive.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })

    $requiredExact = @('manifest.json', 'popup.html', 'background.js', 'theme-boot.js')
    foreach ($req in $requiredExact) {
        if (-not ($entryNames -contains $req)) {
            throw "Release ZIP missing required entry: $req"
        }
    }

    if (-not ($entryNames | Where-Object { $_ -like 'icons/*' })) {
        throw 'Release ZIP missing icons/ directory.'
    }
    if (-not ($entryNames | Where-Object { $_ -like 'assets/*' })) {
        throw 'Release ZIP missing assets/ directory.'
    }
    if ($entryNames | Where-Object { $_ -match '(^|/)\.env' }) {
        throw 'Release ZIP contains an .env file!'
    }

    $secretPatterns = @(
        'gsk_[A-Za-z0-9]{20,}',
        'AIzaSy[A-Za-z0-9_-]{25,}',
        'sk-proj-[A-Za-z0-9_-]{20,}',
        'VITE_GROQ_API_KEY'
    )

    foreach ($entry in $archive.Entries) {
        if ($entry.Length -eq 0) { continue }
        $normalized = $entry.FullName -replace '\\', '/'
        if ($normalized -match '\.(js|html|json|css)$') {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            try {
                $content = $reader.ReadToEnd()
                foreach ($pattern in $secretPatterns) {
                    if ($content -match $pattern) {
                        throw "Potential API key or secret ($pattern) found in ZIP entry $normalized!"
                    }
                }
            }
            finally {
                $reader.Dispose()
                $stream.Dispose()
            }
        }
    }
}
finally {
    $archive.Dispose()
}

$zipSizeKb = [Math]::Round((Get-Item $zipPath).Length / 1KB, 2)
Write-Host "`n[OK] Packaged & audited release archive: $zipPath ($zipSizeKb KB)" -ForegroundColor Green
