#!/usr/bin/env bash
set -euo pipefail

echo "[*] Configuring Blue Team SSH service on custom port 2275 for Ubuntu VM..."

# Ensure running as root
if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run as root: sudo bash scripts/setup-ssh.sh"
  exit 1
fi

# 1. Create dedicated Blue Team analyst user for SSH service (does not affect VM admin credentials)
if ! id "analyst" &>/dev/null; then
  echo "[+] Creating dedicated 'analyst' service account..."
  useradd -m -s /bin/bash -c "Blue Team Analyst" analyst
fi

# Set the exact Blue Team credentials from assessment: analyst / blue_team_rocks
echo "analyst:blue_team_rocks" | chpasswd
echo "[+] Credentials configured for SSH service: analyst / blue_team_rocks"

# 2. Configure /etc/ssh/sshd_config directly for Ubuntu
SSHD_CONFIG="/etc/ssh/sshd_config"
SSHD_CONFIG_DIR="/etc/ssh/sshd_config.d"

if [ -f "$SSHD_CONFIG" ]; then
  echo "[+] Updating $SSHD_CONFIG directly..."
  # Ensure PasswordAuthentication is enabled for password login
  sed -i -E 's/^#?PasswordAuthentication\s+.*/PasswordAuthentication yes/' "$SSHD_CONFIG"
  sed -i -E 's/^#?KbdInteractiveAuthentication\s+.*/KbdInteractiveAuthentication yes/' "$SSHD_CONFIG" 2>/dev/null || true

  # Configure Port 2275 directly in /etc/ssh/sshd_config
  if ! grep -q "^Port 2275" "$SSHD_CONFIG"; then
    echo "" >> "$SSHD_CONFIG"
    echo "# Blue Team Custom Port (Assessment Requirement)" >> "$SSHD_CONFIG"
    echo "Port 2275" >> "$SSHD_CONFIG"
    # Preserve standard port 22 so VM owner does not get locked out
    if ! grep -q "^Port 22" "$SSHD_CONFIG"; then
      echo "Port 22" >> "$SSHD_CONFIG"
    fi
  fi
fi

# Also maintain drop-in configuration in /etc/ssh/sshd_config.d/lab.conf (Ubuntu 22.04+ convention)
mkdir -p "$SSHD_CONFIG_DIR"
cat << 'EOF' > "$SSHD_CONFIG_DIR/lab.conf"
# Lab Blue Team SSH Configuration
Port 2275
Port 22
PasswordAuthentication yes
KbdInteractiveAuthentication yes
PermitRootLogin no
EOF

# 3. Handle Ubuntu 22.04+ systemd socket activation
# If ssh.socket is active in Ubuntu 22.04+, it forces port 22 unless disabled in favor of ssh.service
if systemctl is-active --quiet ssh.socket 2>/dev/null; then
  echo "[*] Switching Ubuntu systemd from ssh.socket to ssh.service to apply custom port 2275..."
  systemctl disable --now ssh.socket 2>/dev/null || true
  systemctl enable --now ssh.service 2>/dev/null || true
fi

# Reload systemd and restart SSH daemon
systemctl daemon-reload 2>/dev/null || true
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || service ssh restart 2>/dev/null

echo "[+] SSH service configured successfully."
echo "[+] Blue Team SSH access: ssh analyst@<vm-ip> -p 2275 (Password: blue_team_rocks)"
echo "[+] VM Admin port 22 is also preserved."
