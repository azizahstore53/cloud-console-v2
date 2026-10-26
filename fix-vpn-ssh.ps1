# ==============================================================================
# VPN SSH CONFIGURATOR FOR 'serverwg' (NO ROOT LOGIN REQUIRED)
# ------------------------------------------------------------------------------
# This script connects directly to the 'serverwg' user on your VPS,
# registers your local SSH key to ~/.ssh/authorized_keys,
# and configures passwordless sudo for WireGuard and iptables.
# ==============================================================================

Write-Host "--- Configuring serverwg on VPS (No root needed) ---" -ForegroundColor Cyan

# 1. Configuration (Reads from .env if present, otherwise uses default)
$vpsIp = "103.117.56.59"
if (Test-Path ".env") {
    $envIp = (Get-Content .env | Select-String "^VPS_IP=(.*)").Matches.Groups[1].Value
    if ($envIp) { $vpsIp = $envIp.Trim() }
}

$sshUser = "serverwg"
$pubKeyPath = "$HOME\.ssh\id_rsa.pub"
if (-not (Test-Path $pubKeyPath)) {
    $pubKeyPath = "C:\Users\Prakom\.ssh\id_rsa.pub"
}

if (-not (Test-Path $pubKeyPath)) {
    Write-Host "[ERROR] Public key not found at $pubKeyPath" -ForegroundColor Red
    Write-Host "Please ensure your id_rsa.pub exists in your .ssh folder." -ForegroundColor Gray
    exit 1
}

$pubKey = (Get-Content $pubKeyPath -Raw).Trim()
Write-Host "[*] Target VPS: $vpsIp" -ForegroundColor Gray
Write-Host "[*] SSH User  : $sshUser" -ForegroundColor Gray
Write-Host "[*] Public Key: $pubKeyPath" -ForegroundColor Gray

# 2. Sync SSH Key directly to serverwg user
Write-Host "`n[1/3] Syncing SSH public key to $sshUser@$vpsIp..." -ForegroundColor Yellow
Write-Host "Catatan: Jika diminta password, masukkan password akun '$sshUser'." -ForegroundColor Gray

$syncCmd = @"
mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
if ! grep -q -F '$pubKey' ~/.ssh/authorized_keys; then
    echo '$pubKey' >> ~/.ssh/authorized_keys
    echo "Public key successfully added."
else
    echo "Public key already exists in authorized_keys."
fi
"@

ssh -o StrictHostKeyChecking=accept-new ${sshUser}@${vpsIp} "$syncCmd"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Gagal terkoneksi ke $sshUser@$vpsIp. Pastikan IP dan password akun $sshUser sudah benar." -ForegroundColor Red
    exit 1
}

# 3. Configure sudoers for WireGuard & iptables (interactive terminal if password needed)
Write-Host "`n[2/3] Configuring passwordless sudo for WireGuard & iptables..." -ForegroundColor Yellow
Write-Host "Catatan: Jika sudo meminta password, ketik password '$sshUser' Anda." -ForegroundColor Gray

$sudoRule = "${sshUser} ALL=(ALL) NOPASSWD: /usr/bin/wg, /usr/sbin/iptables, /sbin/iptables, /usr/sbin/wg, /usr/bin/systemctl, /bin/systemctl, /usr/bin/ip, /bin/ip"
$sudoCmd = "echo '$sudoRule' | sudo tee /etc/sudoers.d/${sshUser} > /dev/null && sudo chmod 440 /etc/sudoers.d/${sshUser}"

ssh -t -o StrictHostKeyChecking=accept-new ${sshUser}@${vpsIp} "$sudoCmd"

# 4. Test connection & passwordless sudo
Write-Host "`n[3/3] Testing passwordless execution as $sshUser..." -ForegroundColor Yellow
$testResult = ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=10 ${sshUser}@${vpsIp} "sudo wg --version 2>&1"

if ($LASTEXITCODE -eq 0 -or $testResult -match "wireguard-tools") {
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host "BERHASIL! VPS sudah siap dan terhubung sebagai $sshUser." -ForegroundColor Green
    Write-Host "Cloud Console sekarang bisa mengeksekusi WireGuard tanpa password prompt." -ForegroundColor White
    Write-Host "==================================================" -ForegroundColor Green
} else {
    Write-Host "`n[INFO] Respon dari VPS: $testResult" -ForegroundColor Gray
    Write-Host "Silakan coba tes manual: ssh ${sshUser}@${vpsIp}" -ForegroundColor White
}
