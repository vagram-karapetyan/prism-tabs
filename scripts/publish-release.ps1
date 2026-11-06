# scripts/publish-release.ps1
# Prism Tabs - Automated GitHub Release Publisher (PowerShell)
[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "`n>>> Initiating automated GitHub Release publication (PowerShell)..." -ForegroundColor Cyan

# 1. Read version from package.json
$pkgPath = Join-Path $rootDir "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$version = $pkg.version
$tag = "v$version"
$releasesDir = Join-Path $rootDir "releases"
$zipFile = Join-Path $releasesDir "prism-tabs-v$version.zip"
$notesFile = Join-Path $releasesDir "RELEASE_NOTES_v$version.md"

# 2. Package release if missing
if (-not (Test-Path $zipFile)) {
    Write-Host "[BUILD] ZIP archive not found. Running package-release.ps1..." -ForegroundColor Yellow
    & "$PSScriptRoot\package-release.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Packaging failed!"
        exit 1
    }
}

# 3. Verify gh CLI authentication
try {
    gh auth status 2>$null | Out-Null
} catch {
    Write-Error "[FAIL] GitHub CLI (gh) is not authenticated. Please run 'gh auth login'."
    exit 1
}

# 4. Check if release already exists on GitHub
$releaseExists = $false
try {
    $existing = gh release view $tag 2>$null
    if ($LASTEXITCODE -eq 0 -and $existing -match $tag) {
        $releaseExists = $true
    }
} catch {
    $releaseExists = $false
}

if ($releaseExists -and -not $Force) {
    Write-Host "[INFO] GitHub release $tag already exists." -ForegroundColor Cyan
    exit 0
}

# 5. Create default release notes if missing
if (-not (Test-Path $notesFile)) {
    $defaultNotes = @"
### Prism Tabs v$version

- Automated clean release package for Prism Tabs v$version.
- Clean BYOK build with zero hardcoded credentials.
- Ready for installation via Chrome (Load unpacked) or from ZIP archive.
"@
    Set-Content -Path $notesFile -Value $defaultNotes -Encoding utf8
}

# 6. Publish release to GitHub
Write-Host "[PUBLISH] Publishing release $tag to GitHub..." -ForegroundColor Yellow
if ($releaseExists -and $Force) {
    gh release upload $tag $zipFile --clobber
} else {
    gh release create $tag $zipFile --title "Prism Tabs v$version" --notes-file $notesFile
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] Successfully published $tag to GitHub Releases!" -ForegroundColor Green
} else {
    Write-Error "Failed to publish release $tag to GitHub."
    exit 1
}
