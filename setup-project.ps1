# ==============================================================================
# CLOUD CONSOLE PROJECT AUTO-INITIALIZER (WINDOWS POWERSHELL)
# ------------------------------------------------------------------------------
# This script automates the technical setup of the project after you have
# installed Node.js and PostgreSQL manually.
# ==============================================================================

Write-Host "--- Starting Cloud Console Project Initialization ---" -ForegroundColor Cyan

# 1. Check for Node.js
try {
    $nodeVersion = node -v
    Write-Host "[OK] Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed. Please install it from https://nodejs.org/" -ForegroundColor Red
    exit
}

# 2. Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "[!] .env file not found. Creating default .env..." -ForegroundColor Yellow
    $envContent = @"
DATABASE_URL="postgresql://postgres:itrsud2021@localhost:5432/cloud_console2?schema=public"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
"@
    Set-Content -Path ".env" -Value $envContent
    Write-Host "[OK] Default .env created." -ForegroundColor Green
} else {
    Write-Host "[OK] .env file exists." -ForegroundColor Green
}

# 3. Install Dependencies
Write-Host "`n[1/3] Installing npm dependencies... (This may take a while)" -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] npm install failed!" -ForegroundColor Red
    exit
}

# 4. Prisma Setup
Write-Host "`n[2/3] Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Prisma generate failed!" -ForegroundColor Red
    exit
}

# 5. Database Push
Write-Host "`n[3/3] Pushing schema to PostgreSQL database..." -ForegroundColor Yellow
Write-Host "Make sure your PostgreSQL server is running and the database 'cloud_console2' exists." -ForegroundColor Gray
npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Database push failed! Check your DATABASE_URL in .env" -ForegroundColor Red
    exit
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "SUCCESS: Project is ready to run!" -ForegroundColor Green
Write-Host "Run the following command to start the app:" -ForegroundColor Cyan
Write-Host "npm run dev" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green
