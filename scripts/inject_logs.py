#!/usr/bin/env python3
"""
Simulates realistic forensic telemetry for the Blue Team training path.
Generates access.log and error.log matching the exact scenario timeline and flags.
"""

import base64
import os
import sys

# Exact base64 exfiltration artifact specified in the PDF assessment document (Page 4)
# Decodes to: PHANTOMGRID{BLUE_L0g_Hunt3r_M4st3r}
EXACT_B64_STRING = "UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0="

def generate_logs(target_dir):
    os.makedirs(target_dir, exist_ok=True)
    access_log_file = os.path.join(target_dir, "access.log")
    error_log_file = os.path.join(target_dir, "error.log")

    b64_flag = EXACT_B64_STRING

    date_str = "07/Oct/2026"
    date_iso = "2026-10-07"

    # Simulated access log entries
    access_lines = [
        # Normal baseline traffic from 192.168.1.100
        f'192.168.1.100 - - [{date_str}:18:30:12 +0000] "GET / HTTP/1.1" 200 4171 "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "-"',
        f'192.168.1.100 - - [{date_str}:18:30:25 +0000] "GET /robots.txt HTTP/1.1" 200 40 "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "-"',
        f'192.168.1.100 - - [{date_str}:18:31:02 +0000] "GET /api/verify-mfa HTTP/1.1" 403 165 "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "-"',
        f'192.168.1.100 - - [{date_str}:18:32:10 +0000] "GET /dashboard HTTP/1.1" 200 2034 "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "-"',
        f'192.168.1.100 - - [{date_str}:18:40:00 +0000] "POST /api/feedback HTTP/1.1" 200 47 "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "-"',

        # Attacker reconnaissance from 10.10.14.50
        f'10.10.14.50 - - [{date_str}:18:48:10 +0000] "GET / HTTP/1.1" 200 4171 "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0" "-"',
        f'10.10.14.50 - - [{date_str}:18:48:45 +0000] "GET /robots.txt HTTP/1.1" 200 40 "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0" "-"',
        f'10.10.14.50 - - [{date_str}:18:49:20 +0000] "GET /dashboard HTTP/1.1" 403 526 "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0" "-"',

        # Attacker WAF probing (POST <script>)
        f'10.10.14.50 - - [{date_str}:18:50:15 +0000] "POST /api/feedback HTTP/1.1" 403 14 "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0" "-"',

        # Attacker WAF bypass (<svg> with stolen cookie exfil)
        f'10.10.14.50 - - [{date_str}:18:51:02 +0000] "POST /api/feedback HTTP/1.1" 200 47 "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0" "-"',

        # Attacker session replay / MFA bypass at 18:51:55 carrying base64 exfil artifact in X-Forwarded-For
        f'10.10.14.50 - - [{date_str}:18:51:55 +0000] "GET /dashboard HTTP/1.1" 200 2510 "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0" "{b64_flag}"'
    ]

    error_lines = [
        f'[{date_iso} 18:31:02] [WARN] [MFA] MFA challenge prompted for user secadmin_01 from 192.168.1.100',
        f'[{date_iso} 18:32:08] [INFO] [AUTH] MFA verification successful for user secadmin_01, session adm_sess issued',
        f'[{date_iso} 18:49:20] [WARN] [AUTH] Unauthorized attempt to access restricted area /dashboard from 10.10.14.50',
        f'[{date_iso} 18:50:15] [WARN] [WAF] Blocked suspicious payload containing \'<script>\' from 10.10.14.50',
        f'[{date_iso} 18:53:10] [CRITICAL] [AUTH] Authentication bypass anomaly: Session token adm_sess accepted from 10.10.14.50 without re-verifying MFA'
    ]

    with open(access_log_file, "w", encoding="utf-8") as f:
        f.write("\n".join(access_lines) + "\n")

    with open(error_log_file, "w", encoding="utf-8") as f:
        f.write("\n".join(error_lines) + "\n")

    print(f"[+] Successfully wrote simulated forensics telemetry to {target_dir}")
    print(f"    - access.log ({len(access_lines)} entries)")
    print(f"    - error.log ({len(error_lines)} entries)")
    print(f"    - Exfil artifact: {b64_flag} ({len(b64_flag)} chars)")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else (os.environ.get("LOG_DIR") or "./logs")
    generate_logs(target)
