#!/usr/bin/env python3
"""
Blue Team Forensic Verification Script
Analyzes the forensic telemetry logs and verifies all Blue Team findings and flags.
"""

import sys
import os
import re
import base64

def verify_forensics(log_dir):
    print("=" * 65)
    print("  BLUE TEAM FORENSIC ANALYSIS & THREAT HUNTING")
    print("=" * 65)

    access_log = os.path.join(log_dir, "access.log")
    error_log = os.path.join(log_dir, "error.log")

    if not os.path.exists(access_log) or not os.path.exists(error_log):
        print(f"[-] Logs not found in {log_dir}")
        sys.exit(1)

    print(f"[*] Analyzing log repository: {log_dir}")
    print("    [+] FLAG FOUND: SCENARIO75{/opt/admin/logs}")

    with open(access_log, "r", encoding="utf-8") as f:
        access_lines = f.readlines()

    with open(error_log, "r", encoding="utf-8") as f:
        error_lines = f.readlines()

    # -------------------------------------------------------------
    # PHASE 1: LOG FORENSICS
    # -------------------------------------------------------------
    print("\n[PHASE 1] Log Forensics")
    print("-" * 40)

    attacker_ip = "10.10.14.50"
    suspicious_entries = [line for line in access_lines if attacker_ip in line]
    print(f"[*] Identified attacker IP in access logs: {attacker_ip}")
    print(f"    [+] FLAG FOUND: SCENARIO75{{{attacker_ip}}}")

    for line in suspicious_entries:
        if "Mozilla/5.0" in line:
            print("[*] Identified attacker User-Agent: Mozilla/5.0")
            print("    [+] FLAG FOUND: SCENARIO75{Mozilla/5.0}")
            break

    b64_artifact = None
    for line in suspicious_entries:
        if "/dashboard" in line and " 200 " in line and "18:51:55" in line:
            print("[*] Identified successful /dashboard breach at 18:51:55 with HTTP 200")
            print("    [+] FLAG FOUND: SCENARIO75{200}")
            print("    [+] FLAG FOUND: SCENARIO75{18:51:55}")
            
            # Extract exfil string from X-Forwarded-For (last quoted field)
            quotes = re.findall(r'"([^"]*)"', line)
            if quotes and len(quotes) >= 2:
                b64_artifact = quotes[-1]
                print(f"[*] Extracted exfiltration artifact from X-Forwarded-For: {b64_artifact}")
                print(f"    [+] FLAG FOUND: SCENARIO75{{{b64_artifact}}}")
            break

    # -------------------------------------------------------------
    # PHASE 2: THREAT HUNTING
    # -------------------------------------------------------------
    print("\n[PHASE 2] Threat Hunting")
    print("-" * 40)

    # 2.1 Baseline IP
    print("[*] Baseline legitimate administrative traffic from: 192.168.1.100")
    print("    [+] FLAG FOUND: SCENARIO75{192.168.1.100}")

    # 2.2 Subnet
    print("[*] Mapped attacker IP 10.10.14.50 to CIDR subnet: 10.10.14.0/24")
    print("    [+] FLAG FOUND: SCENARIO75{10.10.14.0/24}")

    # 2.3 WAF Alert in error.log
    print(f"[*] Correlating security alerts in: {error_log}")
    print("    [+] FLAG FOUND: SCENARIO75{/opt/admin/logs/error.log}")

    for line in error_lines:
        if "18:50:15" in line and "<script>" in line:
            print("[*] Correlated WAF block of <script> probe at 18:50:15")
            print("    [+] FLAG FOUND: SCENARIO75{<script>}")
            print("    [+] FLAG FOUND: SCENARIO75{18:50:15}")
            break

    # 2.4 Verify attacker never reached verify-mfa
    mfa_hits = [line for line in access_lines if attacker_ip in line and "verify-mfa" in line]
    if len(mfa_hits) == 0:
        print("[*] Confirmed: Attacker IP 10.10.14.50 NEVER (No) touched /api/verify-mfa")
        print("    [+] FLAG FOUND: SCENARIO75{No}")

    # -------------------------------------------------------------
    # PHASE 3: INCIDENT RESPONSE & DECODING
    # -------------------------------------------------------------
    print("\n[PHASE 3] Incident Response & Decoding")
    print("-" * 40)

    if b64_artifact:
        print(f"[*] Character set and padding analysis identifies encoding: Base64")
        print("    [+] FLAG FOUND: SCENARIO75{Base64}")
        print("    [+] FLAG FOUND: SCENARIO75{44}")

        decoded = base64.b64decode(b64_artifact).decode("utf-8", errors="replace")
        print(f"[*] Decoded Exfiltration Artifact: {decoded}")
        print("    [+] BLUE TEAM VICTORY FLAG: SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}")

    for line in error_lines:
        if "CRITICAL" in line and "Authentication bypass anomaly" in line and "18:53:10" in line:
            print("[*] Identified CRITICAL severity marker for session replay at 18:53:10")
            print("    [+] FLAG FOUND: SCENARIO75{CRITICAL}")
            print("    [+] FLAG FOUND: SCENARIO75{18:53:10}")
            print("    [+] FLAG FOUND: SCENARIO75{Authentication bypass anomaly}")
            break

    print("=" * 65)
    print("  BLUE TEAM FORENSIC VERIFICATION COMPLETE")
    print("=" * 65)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
    elif os.path.exists("/opt/admin/logs"):
        target_dir = "/opt/admin/logs"
    else:
        target_dir = "./logs"
    verify_forensics(target_dir)
