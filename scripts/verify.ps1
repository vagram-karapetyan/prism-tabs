# scripts/verify.ps1
# Prism Tabs - Full Verification Loop (PowerShell)
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "`n=================================================" -ForegroundColor DarkGray
Write-Host ">>> Prism Tabs - Full Verification Loop (PowerShell)" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor DarkGray

# 1. Run unit tests
Write-Host "`n[1/4] Running Vitest Unit Tests..." -ForegroundColor Yellow
npx vitest run
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Unit tests failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] All unit tests passed!" -ForegroundColor Green

# 2. TypeScript strict check
Write-Host "`n[2/4] Checking TypeScript Types..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] TypeScript check failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] TypeScript check passed (0 errors)!" -ForegroundColor Green

# 3. Development/Local bundle build
Write-Host "`n[3/4] Compiling Extension Bundle (dist/)..." -ForegroundColor Yellow
npx vite build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Bundle build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Bundle build succeeded!" -ForegroundColor Green

# 4. Packaging and security audit
Write-Host "`n[4/4] Packaging Clean Release & Security Audit..." -ForegroundColor Yellow
& "$PSScriptRoot\package-release.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Packaging & security audit failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=================================================" -ForegroundColor DarkGray
Write-Host "[SUCCESS] All Verification Loop gates passed successfully!" -ForegroundColor Green
Write-Host "=================================================`n" -ForegroundColor DarkGray
