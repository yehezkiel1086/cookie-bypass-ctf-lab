#!/usr/bin/env python3
"""
Cyber Range CTF Interactive Scoreboard & Flag Submission System
Scenario Brief: Cookies Reuse & MFA Bypass (Red vs. Blue)
Allows students and instructors to submit flags, track solved challenges,
and view their real-time score.
"""

import sys
import os
import json
import time

CHALLENGES = [
  # Red Team - Phase 1: Reconnaissance
  {
    "id": "red-01",
    "team": "RED",
    "phase": "Phase 1: Reconnaissance",
    "name": "Backend Technology Exposure",
    "points": 100,
    "flag": "SCENARIO75{Node.js}"
  },
  {
    "id": "red-02",
    "team": "RED",
    "phase": "Phase 1: Reconnaissance",
    "name": "Hidden Disallowed Crawler Path",
    "points": 100,
    "flag": "SCENARIO75{/api/verify-mfa}"
  },
  {
    "id": "red-03",
    "team": "RED",
    "phase": "Phase 1: Reconnaissance",
    "name": "Restricted Admin Area",
    "points": 100,
    "flag": "SCENARIO75{/dashboard}"
  },
  {
    "id": "red-04",
    "team": "RED",
    "phase": "Phase 1: Reconnaissance",
    "name": "Source Code Robots Clue",
    "points": 100,
    "flag": "SCENARIO75{robots.txt}"
  },
  {
    "id": "red-05",
    "team": "RED",
    "phase": "Phase 1: Reconnaissance",
    "name": "Pre-Auth Session Cookie Name",
    "points": 100,
    "flag": "SCENARIO75{pre_mfa_session}"
  },
  {
    "id": "red-06",
    "team": "RED",
    "phase": "Phase 1: Reconnaissance",
    "name": "Pre-Auth Session Cookie Value",
    "points": 100,
    "flag": "SCENARIO75{pending_mfa_verification}"
  },
  {
    "id": "red-07",
    "team": "RED",
    "phase": "Phase 1: Reconnaissance",
    "name": "Insecure Cookie HttpOnly State",
    "points": 100,
    "flag": "SCENARIO75{False}"
  },

  # Red Team - Phase 2: Defense Evasion (WAF & XSS)
  {
    "id": "red-08",
    "team": "RED",
    "phase": "Phase 2: Defense Evasion",
    "name": "Feedback Submission HTTP Method",
    "points": 150,
    "flag": "SCENARIO75{POST}"
  },
  {
    "id": "red-09",
    "team": "RED",
    "phase": "Phase 2: Defense Evasion",
    "name": "WAF Block HTTP Status Code",
    "points": 150,
    "flag": "SCENARIO75{403}"
  },
  {
    "id": "red-10",
    "team": "RED",
    "phase": "Phase 2: Defense Evasion",
    "name": "HTML5 WAF Evasion Element",
    "points": 200,
    "flag": "SCENARIO75{<svg>}"
  },
  {
    "id": "red-11",
    "team": "RED",
    "phase": "Phase 2: Defense Evasion",
    "name": "JavaScript Bracket Obfuscation",
    "points": 200,
    "flag": "SCENARIO75{window['docu'+'ment']['coo'+'kie']}"
  },
  {
    "id": "red-12",
    "team": "RED",
    "phase": "Phase 2: Defense Evasion",
    "name": "Browser Exfiltration API",
    "points": 150,
    "flag": "SCENARIO75{fetch}"
  },

  # Red Team - Phase 3: Initial Access (Session Replay & MFA Bypass)
  {
    "id": "red-13",
    "team": "RED",
    "phase": "Phase 3: Initial Access",
    "name": "Admin Session Token Prefix",
    "points": 200,
    "flag": "SCENARIO75{adm_sess}"
  },
  {
    "id": "red-14",
    "team": "RED",
    "phase": "Phase 3: Initial Access",
    "name": "Reflected Payload CSS Container",
    "points": 200,
    "flag": "SCENARIO75{xss-payload}"
  },
  {
    "id": "red-15",
    "team": "RED",
    "phase": "Phase 3: Initial Access",
    "name": "Final Red Team Victory Flag",
    "points": 500,
    "flag": "SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}"
  },

  # Blue Team - Phase 1: Log Forensics
  {
    "id": "blue-01",
    "team": "BLUE",
    "phase": "Phase 1: Log Forensics",
    "name": "Log Repository Directory",
    "points": 100,
    "flag": "SCENARIO75{/opt/admin/logs}"
  },
  {
    "id": "blue-02",
    "team": "BLUE",
    "phase": "Phase 1: Log Forensics",
    "name": "Attacker Source IP Address",
    "points": 100,
    "flag": "SCENARIO75{10.10.14.50}"
  },
  {
    "id": "blue-03",
    "team": "BLUE",
    "phase": "Phase 1: Log Forensics",
    "name": "Attacker User-Agent",
    "points": 100,
    "flag": "SCENARIO75{Mozilla/5.0}"
  },
  {
    "id": "blue-04",
    "team": "BLUE",
    "phase": "Phase 1: Log Forensics",
    "name": "Breach HTTP Status Code",
    "points": 100,
    "flag": "SCENARIO75{200}"
  },
  {
    "id": "blue-05",
    "team": "BLUE",
    "phase": "Phase 1: Log Forensics",
    "name": "Breach Exact Timestamp",
    "points": 100,
    "flag": "SCENARIO75{18:51:55}"
  },
  {
    "id": "blue-06",
    "team": "BLUE",
    "phase": "Phase 1: Log Forensics",
    "name": "Raw Base64 Exfiltration Header",
    "points": 200,
    "flag": "SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=}"
  },

  # Blue Team - Phase 2: Threat Hunting
  {
    "id": "blue-07",
    "team": "BLUE",
    "phase": "Phase 2: Threat Hunting",
    "name": "Legitimate Baseline Admin IP",
    "points": 100,
    "flag": "SCENARIO75{192.168.1.100}"
  },
  {
    "id": "blue-08",
    "team": "BLUE",
    "phase": "Phase 2: Threat Hunting",
    "name": "Attacker Subnet CIDR",
    "points": 150,
    "flag": "SCENARIO75{10.10.14.0/24}"
  },
  {
    "id": "blue-09",
    "team": "BLUE",
    "phase": "Phase 2: Threat Hunting",
    "name": "Security Alert Log File Path",
    "points": 100,
    "flag": "SCENARIO75{/opt/admin/logs/error.log}"
  },
  {
    "id": "blue-10",
    "team": "BLUE",
    "phase": "Phase 2: Threat Hunting",
    "name": "Blocked Probe Payload",
    "points": 150,
    "flag": "SCENARIO75{<script>}"
  },
  {
    "id": "blue-11",
    "team": "BLUE",
    "phase": "Phase 2: Threat Hunting",
    "name": "Blocked Probe Timestamp",
    "points": 150,
    "flag": "SCENARIO75{18:50:15}"
  },
  {
    "id": "blue-12",
    "team": "BLUE",
    "phase": "Phase 2: Threat Hunting",
    "name": "Attacker MFA Interaction State",
    "points": 150,
    "flag": "SCENARIO75{No}"
  },

  # Blue Team - Phase 3: Incident Response
  {
    "id": "blue-13",
    "team": "BLUE",
    "phase": "Phase 3: Incident Response",
    "name": "Exfiltration Encoding Scheme",
    "points": 150,
    "flag": "SCENARIO75{Base64}"
  },
  {
    "id": "blue-14",
    "team": "BLUE",
    "phase": "Phase 3: Incident Response",
    "name": "Exfiltration String Length",
    "points": 150,
    "flag": "SCENARIO75{44}"
  },
  {
    "id": "blue-15",
    "team": "BLUE",
    "phase": "Phase 3: Incident Response",
    "name": "Critical Anomaly Severity Level",
    "points": 150,
    "flag": "SCENARIO75{CRITICAL}"
  },
  {
    "id": "blue-16",
    "team": "BLUE",
    "phase": "Phase 3: Incident Response",
    "name": "Anomaly Alert Timestamp",
    "points": 150,
    "flag": "SCENARIO75{18:53:10}"
  },
  {
    "id": "blue-17",
    "team": "BLUE",
    "phase": "Phase 3: Incident Response",
    "name": "Security Warning Log Signature",
    "points": 200,
    "flag": "SCENARIO75{Authentication bypass anomaly}"
  },
  {
    "id": "blue-18",
    "team": "BLUE",
    "phase": "Phase 3: Incident Response",
    "name": "Final Blue Team Victory Flag",
    "points": 500,
    "flag": "SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}"
  }
]

def resolve_progress_file():
    candidates = [
        os.path.join(os.environ.get("LOG_DIR", ""), "ctf_progress.json") if os.environ.get("LOG_DIR") else None,
        "/opt/admin/logs/ctf_progress.json",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "logs", "ctf_progress.json")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ctf_progress.json")),
        os.path.expanduser("~/.ctf_progress.json")
    ]
    for c in filter(None, candidates):
        if os.path.exists(c):
            return c
    # Return first writable path
    for c in filter(None, candidates):
        try:
            d = os.path.dirname(c)
            if os.path.exists(d) and os.access(d, os.W_OK):
                return c
        except Exception:
            pass
    return os.path.expanduser("~/.ctf_progress.json")

PROGRESS_FILE = resolve_progress_file()

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"solved": {}, "total_score": 0}

def save_progress(data):
    try:
        with open(PROGRESS_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"[-] Warning: Failed to save progress: {e}")

def render_board(progress, filter_team=None):
    os.system("cls" if os.name == "nt" else "clear")
    print("=" * 80)
    print("      CYBER RANGE CTF SCOREBOARD & CHALLENGE TRACKER")
    print("      Scenario: Cookies Reuse & MFA Bypass (Red vs. Blue)")
    print("=" * 80)

    total_possible = sum(c["points"] for c in CHALLENGES)
    solved_ids = set(progress.get("solved", {}).keys())
    current_score = sum(c["points"] for c in CHALLENGES if c["id"] in solved_ids)
    solved_count = len(solved_ids)
    total_count = len(CHALLENGES)
    pct = (solved_count / total_count) * 100 if total_count else 0

    bar_len = 30
    filled = int(bar_len * (solved_count / total_count)) if total_count else 0
    bar = "#" * filled + "-" * (bar_len - filled)

    red_score = sum(c["points"] for c in CHALLENGES if c["team"] == "RED" and c["id"] in solved_ids)
    red_total = sum(c["points"] for c in CHALLENGES if c["team"] == "RED")
    blue_score = sum(c["points"] for c in CHALLENGES if c["team"] == "BLUE" and c["id"] in solved_ids)
    blue_total = sum(c["points"] for c in CHALLENGES if c["team"] == "BLUE")

    print(f"\n  Overall Progress: [{bar}] {pct:5.1f}% ({solved_count}/{total_count} Solved)")
    print(f"  Total Score:      {current_score} / {total_possible} pts")
    print(f"  Red Team Score:   {red_score} / {red_total} pts  |  Blue Team Score: {blue_score} / {blue_total} pts\n")
    print("-" * 80)
    print(f"{'STATUS':^10} | {'ID':^7} | {'TEAM':^5} | {'POINTS':^6} | {'CHALLENGE DESCRIPTION':<44}")
    print("-" * 80)

    curr_phase = ""
    for c in CHALLENGES:
        if filter_team and c["team"] != filter_team.upper():
            continue
        
        phase_header = f"[{c['team']} TEAM] {c['phase']}"
        if phase_header != curr_phase:
            curr_phase = phase_header
            print(f"--- {curr_phase} " + "-" * (75 - len(curr_phase)))

        is_solved = c["id"] in solved_ids
        status_tag = "[ SOLVED ]" if is_solved else "[   ..   ]"
        print(f"{status_tag:^10} | {c['id']:^7} | {c['team']:^5} | {c['points']:^6} | {c['name']:<44}")

    print("=" * 80)

def match_flag(user_input, challenge_flag):
    u = user_input.strip()
    c = challenge_flag.strip()
    if u == c:
        return True
    
    # Also support submitting just the content inside SCENARIO75{...}
    if c.startswith("SCENARIO75{") and c.endswith("}"):
        inner = c[11:-1]
        if u == inner or u.lower() == inner.lower():
            return True

    # Case insensitive match for outer format
    if u.lower() == c.lower():
        return True

    return False

def submit_flag(flag_input, progress):
    flag_clean = flag_input.strip()
    if not flag_clean:
        return False, "Empty flag input."

    solved_ids = set(progress.get("solved", {}).keys())

    for c in CHALLENGES:
        if match_flag(flag_clean, c["flag"]):
            if c["id"] in solved_ids:
                return False, f"Challenge already solved: '{c['name']}' ({c['id']})!"
            else:
                progress["solved"][c["id"]] = {
                    "name": c["name"],
                    "points": c["points"],
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
                }
                progress["total_score"] = sum(x["points"] for x in progress["solved"].values())
                save_progress(progress)
                return True, f"CORRECT! '{c['name']}' solved! (+{c['points']} pts)"

    return False, "Incorrect flag. Review your finding and try again!"

def main():
    progress = load_progress()

    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        if arg in ["--submit", "-s"] and len(sys.argv) > 2:
            flag = sys.argv[2]
            ok, msg = submit_flag(flag, progress)
            if ok:
                print(f"[+] {msg}")
                sys.exit(0)
            else:
                print(f"[-] {msg}")
                sys.exit(1)
        elif arg in ["--status", "-l"]:
            team = sys.argv[2] if len(sys.argv) > 2 else None
            render_board(progress, filter_team=team)
            sys.exit(0)
        elif arg in ["--reset", "-r"]:
            if os.path.exists(PROGRESS_FILE):
                os.remove(PROGRESS_FILE)
            print("[+] Progress reset to 0.")
            sys.exit(0)
        elif arg in ["--help", "-h"]:
            print("Usage:")
            print("  python3 scoreboard.py                  # Interactive Scoreboard UI")
            print("  python3 scoreboard.py --submit <flag>   # Submit a flag directly")
            print("  python3 scoreboard.py --status         # Display current challenge status")
            print("  python3 scoreboard.py --status RED     # View Red Team challenges only")
            print("  python3 scoreboard.py --status BLUE    # View Blue Team challenges only")
            print("  python3 scoreboard.py --reset          # Reset all solved progress")
            sys.exit(0)

    # Interactive Loop
    while True:
        render_board(progress)
        print("\nCommands: Type flag (e.g. SCENARIO75{...}), or 'r' to refresh, 'q' to quit.")
        try:
            user_in = input("Submit Flag > ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting scoreboard.")
            break

        if not user_in:
            continue
        if user_in.lower() == 'q':
            print("Exiting scoreboard. Good luck on the cyber range!")
            break
        if user_in.lower() == 'r':
            continue

        ok, msg = submit_flag(user_in, progress)
        print("\n" + ("=" * 50))
        if ok:
            print(f"[+] {msg}")
        else:
            print(f"[-] {msg}")
        print("=" * 50)
        time.sleep(1.5)

if __name__ == "__main__":
    main()
