#!/usr/bin/env bash
set -e

echo "[*] Configuring Blue Team SSH analyst account on port 2275..."

if ! id "analyst" &>/dev/null; then
  useradd -m -s /bin/bash analyst
fi
echo "analyst:blue_team_rocks" | chpasswd

mkdir -p /etc/ssh/sshd_config.d/
cat << 'EOF' > /etc/ssh/sshd_config.d/lab.conf
Port 2275
PasswordAuthentication yes
PermitRootLogin no
EOF

systemctl restart ssh || systemctl restart sshd
echo "[+] SSH configured successfully on port 2275."
