#!/usr/bin/env bash
set -euo pipefail

echo "[+] Starting Cyber Range VM Provisioning..."

# Ensure running as root
if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run as root: sudo bash scripts/provision_vm.sh"
  exit 1
fi

LAB_DIR="/opt/lab"
LOG_DIR="/opt/admin/logs"

# 1. Update and install prerequisites
echo "[+] Updating apt repositories and installing packages..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release python3 python3-pip openssh-server

# 2. Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "[+] Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

# 3. Setup Blue Team SSH Analyst User on Port 2275 (/etc/ssh/sshd_config)
echo "[+] Configuring Blue Team SSH service (/etc/ssh/sshd_config on port 2275)..."
bash "$LAB_DIR/scripts/setup-ssh.sh"

# 4. Prepare logs directory
mkdir -p "$LOG_DIR"
chown -R analyst:analyst "$LOG_DIR"
chmod 755 "$LOG_DIR"

# 5. Build and launch Docker services
echo "[+] Launching cyber range containers..."
cd "$LAB_DIR"
docker compose down -v || true
docker compose up -d --build

# 6. Inject simulated telemetry
echo "[+] Injecting Blue Team forensic telemetry..."
python3 scripts/inject_logs.py "$LOG_DIR"

# Fix permissions on generated logs so analyst can read them
chown -R analyst:analyst "$LOG_DIR"
chmod 644 "$LOG_DIR"/*.log

echo "[+] Cyber Range VM Provisioning complete!"
echo "[+] Web Application: http://localhost:3075"
echo "[+] Blue Team SSH: ssh analyst@<vm-ip> -p 2275"
