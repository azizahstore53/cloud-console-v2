# ==============================================================================
# VPN GATEWAY REMOTE DEPLOYER (WINDOWS POWERSHELL)
# ------------------------------------------------------------------------------
# This script automates the deployment of the WireGuard setup script to a remote VPS.
# It uses SSH to upload and execute the configuration.
# ==============================================================================

Write-Host "--- VPN Gateway Remote Deployment ---" -ForegroundColor Cyan

# 1. Load Configuration
# We try to load from .env if available, otherwise we ask the user
if (Test-Path ".env") {
    Write-Host "[*] Loading configuration from .env..." -ForegroundColor Gray
    $envVars = Get-Content .env | ConvertFrom-StringData
    $vpsIp = $envVars.VPS_IP # Adjust key name if different in your .env
}

if (-not $vpsIp) {
    $vpsIp = Read-Host "Enter VPS Public IP Address"
}

$sshUser = "serverwg"
$localScript = "setup-vps-wireguard.sh"
$remoteScript = "/tmp/setup-vps-wireguard.sh"

if (-not (Test-Path $localScript)) {
    Write-Host "[ERROR] Local script $localScript not found! Please create it first." -ForegroundColor Red
    exit
}

# 2. Upload script to VPS via SCP
Write-Host "`n[1/3] Uploading setup script to VPS..." -ForegroundColor Yellow
# Note: This assumes you have SSH keys configured.
# If not, Windows will prompt for password.
scp $localScript "${sshUser}@${vpsIp}:${remoteScript}"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to upload script. Check your SSH connection/credentials." -ForegroundColor Red
    exit
}

# 3. Execute script on VPS via SSH
Write-Host "`n[2/3] Executing setup on remote server..." -ForegroundColor Yellow
ssh "${sshUser}@${vpsIp}" "chmod +x ${remoteScript} && sudo ${remoteScript}"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Execution failed on the remote server." -ForegroundColor Red
    exit
}

# 4. Cleanup remote script
Write-Host "`n[3/3] Cleaning up temporary files on VPS..." -ForegroundColor Yellow
ssh "${sshUser}@${vpsIp}" "rm ${remoteScript}"

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "SUCCESS: VPS has been configured automatically!" -ForegroundColor Green
Write-Host "Your VPS is now a WireGuard Gateway." -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green
