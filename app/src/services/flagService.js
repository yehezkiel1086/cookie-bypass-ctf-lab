import fs from "fs";
import path from "path";
import os from "os";

export const CHALLENGES = [
  // Red Team - Phase 1: Reconnaissance
  {
    id: "red-01",
    team: "RED",
    phase: "Phase 1: Reconnaissance",
    name: "Backend Technology Exposure",
    points: 100,
    flag: "SCENARIO75{Node.js}"
  },
  {
    id: "red-02",
    team: "RED",
    phase: "Phase 1: Reconnaissance",
    name: "Hidden Disallowed Crawler Path",
    points: 100,
    flag: "SCENARIO75{/api/verify-mfa}"
  },
  {
    id: "red-03",
    team: "RED",
    phase: "Phase 1: Reconnaissance",
    name: "Restricted Admin Area",
    points: 100,
    flag: "SCENARIO75{/dashboard}"
  },
  {
    id: "red-04",
    team: "RED",
    phase: "Phase 1: Reconnaissance",
    name: "Source Code Robots Clue",
    points: 100,
    flag: "SCENARIO75{robots.txt}"
  },
  {
    id: "red-05",
    team: "RED",
    phase: "Phase 1: Reconnaissance",
    name: "Pre-Auth Session Cookie Name",
    points: 100,
    flag: "SCENARIO75{pre_mfa_session}"
  },
  {
    id: "red-06",
    team: "RED",
    phase: "Phase 1: Reconnaissance",
    name: "Pre-Auth Session Cookie Value",
    points: 100,
    flag: "SCENARIO75{pending_mfa_verification}"
  },
  {
    id: "red-07",
    team: "RED",
    phase: "Phase 1: Reconnaissance",
    name: "Insecure Cookie HttpOnly State",
    points: 100,
    flag: "SCENARIO75{False}"
  },

  // Red Team - Phase 2: Defense Evasion (WAF & XSS)
  {
    id: "red-08",
    team: "RED",
    phase: "Phase 2: Defense Evasion",
    name: "Feedback Submission HTTP Method",
    points: 150,
    flag: "SCENARIO75{POST}"
  },
  {
    id: "red-09",
    team: "RED",
    phase: "Phase 2: Defense Evasion",
    name: "WAF Block HTTP Status Code",
    points: 150,
    flag: "SCENARIO75{403}"
  },
  {
    id: "red-10",
    team: "RED",
    phase: "Phase 2: Defense Evasion",
    name: "HTML5 WAF Evasion Element",
    points: 200,
    flag: "SCENARIO75{<svg>}"
  },
  {
    id: "red-11",
    team: "RED",
    phase: "Phase 2: Defense Evasion",
    name: "JavaScript Bracket Obfuscation",
    points: 200,
    flag: "SCENARIO75{window['docu'+'ment']['coo'+'kie']}"
  },
  {
    id: "red-12",
    team: "RED",
    phase: "Phase 2: Defense Evasion",
    name: "Browser Exfiltration API",
    points: 150,
    flag: "SCENARIO75{fetch}"
  },

  // Red Team - Phase 3: Initial Access (Session Replay & MFA Bypass)
  {
    id: "red-13",
    team: "RED",
    phase: "Phase 3: Initial Access",
    name: "Admin Session Token Prefix",
    points: 200,
    flag: "SCENARIO75{adm_sess}"
  },
  {
    id: "red-14",
    team: "RED",
    phase: "Phase 3: Initial Access",
    name: "Reflected Payload CSS Container",
    points: 200,
    flag: "SCENARIO75{xss-payload}"
  },
  {
    id: "red-15",
    team: "RED",
    phase: "Phase 3: Initial Access",
    name: "Final Red Team Victory Flag",
    points: 500,
    flag: "SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}"
  },

  // Blue Team - Phase 1: Log Forensics
  {
    id: "blue-01",
    team: "BLUE",
    phase: "Phase 1: Log Forensics",
    name: "Log Repository Directory",
    points: 100,
    flag: "SCENARIO75{/opt/admin/logs}"
  },
  {
    id: "blue-02",
    team: "BLUE",
    phase: "Phase 1: Log Forensics",
    name: "Attacker Source IP Address",
    points: 100,
    flag: "SCENARIO75{10.10.14.50}"
  },
  {
    id: "blue-03",
    team: "BLUE",
    phase: "Phase 1: Log Forensics",
    name: "Attacker User-Agent",
    points: 100,
    flag: "SCENARIO75{Mozilla/5.0}"
  },
  {
    id: "blue-04",
    team: "BLUE",
    phase: "Phase 1: Log Forensics",
    name: "Breach HTTP Status Code",
    points: 100,
    flag: "SCENARIO75{200}"
  },
  {
    id: "blue-05",
    team: "BLUE",
    phase: "Phase 1: Log Forensics",
    name: "Breach Exact Timestamp",
    points: 100,
    flag: "SCENARIO75{18:51:55}"
  },
  {
    id: "blue-06",
    team: "BLUE",
    phase: "Phase 1: Log Forensics",
    name: "Raw Base64 Exfiltration Header",
    points: 200,
    flag: "SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0=}"
  },

  // Blue Team - Phase 2: Threat Hunting
  {
    id: "blue-07",
    team: "BLUE",
    phase: "Phase 2: Threat Hunting",
    name: "Legitimate Baseline Admin IP",
    points: 100,
    flag: "SCENARIO75{192.168.1.100}"
  },
  {
    id: "blue-08",
    team: "BLUE",
    phase: "Phase 2: Threat Hunting",
    name: "Attacker Subnet CIDR",
    points: 150,
    flag: "SCENARIO75{10.10.14.0/24}"
  },
  {
    id: "blue-09",
    team: "BLUE",
    phase: "Phase 2: Threat Hunting",
    name: "Security Alert Log File Path",
    points: 100,
    flag: "SCENARIO75{/opt/admin/logs/error.log}"
  },
  {
    id: "blue-10",
    team: "BLUE",
    phase: "Phase 2: Threat Hunting",
    name: "Blocked Probe Payload",
    points: 150,
    flag: "SCENARIO75{<script>}"
  },
  {
    id: "blue-11",
    team: "BLUE",
    phase: "Phase 2: Threat Hunting",
    name: "Blocked Probe Timestamp",
    points: 150,
    flag: "SCENARIO75{18:50:15}"
  },
  {
    id: "blue-12",
    team: "BLUE",
    phase: "Phase 2: Threat Hunting",
    name: "Attacker MFA Interaction State",
    points: 150,
    flag: "SCENARIO75{No}"
  },

  // Blue Team - Phase 3: Incident Response
  {
    id: "blue-13",
    team: "BLUE",
    phase: "Phase 3: Incident Response",
    name: "Exfiltration Encoding Scheme",
    points: 150,
    flag: "SCENARIO75{Base64}"
  },
  {
    id: "blue-14",
    team: "BLUE",
    phase: "Phase 3: Incident Response",
    name: "Exfiltration String Length",
    points: 150,
    flag: "SCENARIO75{44}"
  },
  {
    id: "blue-15",
    team: "BLUE",
    phase: "Phase 3: Incident Response",
    name: "Critical Anomaly Severity Level",
    points: 150,
    flag: "SCENARIO75{CRITICAL}"
  },
  {
    id: "blue-16",
    team: "BLUE",
    phase: "Phase 3: Incident Response",
    name: "Anomaly Alert Timestamp",
    points: 150,
    flag: "SCENARIO75{18:53:10}"
  },
  {
    id: "blue-17",
    team: "BLUE",
    phase: "Phase 3: Incident Response",
    name: "Security Warning Log Signature",
    points: 200,
    flag: "SCENARIO75{Authentication bypass anomaly}"
  },
  {
    id: "blue-18",
    team: "BLUE",
    phase: "Phase 3: Incident Response",
    name: "Final Blue Team Victory Flag",
    points: 500,
    flag: "SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}"
  }
];

function resolveProgressFile() {
  const possiblePaths = [
    process.env.LOG_DIR ? path.join(process.env.LOG_DIR, "ctf_progress.json") : null,
    path.resolve(process.cwd(), "logs", "ctf_progress.json"),
    path.resolve(process.cwd(), "ctf_progress.json"),
    path.join(os.homedir(), ".ctf_progress.json")
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Priority to writable directory
  for (const p of possiblePaths) {
    try {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) {
        return p;
      }
    } catch {
      // ignore
    }
  }

  return path.resolve(process.cwd(), "ctf_progress.json");
}

export function loadProgress() {
  const file = resolveProgressFile();
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      return data && typeof data === "object" ? data : { solved: {} };
    } catch {
      return { solved: {} };
    }
  }
  return { solved: {} };
}

export function saveProgress(progress) {
  const file = resolveProgressFile();
  try {
    fs.writeFileSync(file, JSON.stringify(progress, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save CTF progress:", err.message);
  }
}

export function resetProgress() {
  const file = resolveProgressFile();
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (err) {
    console.error("Failed to reset CTF progress:", err.message);
  }
  return { solved: {}, totalScore: 0 };
}

export function matchFlag(userInput, challengeFlag) {
  const u = userInput ? userInput.trim() : "";
  const c = challengeFlag ? challengeFlag.trim() : "";
  if (!u || !c) return false;

  // Exact match
  if (u === c) return true;

  // Inner flag match (e.g. "Node.js" for "SCENARIO75{Node.js}")
  if (c.startsWith("SCENARIO75{") && c.endsWith("}")) {
    const inner = c.substring(11, c.length - 1);
    if (u === inner || u.toLowerCase() === inner.toLowerCase()) {
      return true;
    }
  }

  // Case-insensitive match on full flag
  if (u.toLowerCase() === c.toLowerCase()) {
    return true;
  }

  return false;
}

export function getChallengeStatus() {
  const progress = loadProgress();
  const solvedMap = progress.solved || {};

  const challenges = CHALLENGES.map((ch) => {
    const isSolved = Boolean(solvedMap[ch.id]);
    return {
      id: ch.id,
      team: ch.team,
      phase: ch.phase,
      name: ch.name,
      points: ch.points,
      isSubmitted: isSolved,
      submittedAt: isSolved ? solvedMap[ch.id].timestamp : null
    };
  });

  const totalChallenges = challenges.length;
  const submittedChallenges = challenges.filter((c) => c.isSubmitted).length;
  const unsubmittedChallenges = totalChallenges - submittedChallenges;

  const totalPoints = challenges.reduce((sum, c) => sum + c.points, 0);
  const earnedPoints = challenges
    .filter((c) => c.isSubmitted)
    .reduce((sum, c) => sum + c.points, 0);

  const redTotal = challenges.filter((c) => c.team === "RED").reduce((sum, c) => sum + c.points, 0);
  const redEarned = challenges
    .filter((c) => c.team === "RED" && c.isSubmitted)
    .reduce((sum, c) => sum + c.points, 0);

  const blueTotal = challenges.filter((c) => c.team === "BLUE").reduce((sum, c) => sum + c.points, 0);
  const blueEarned = challenges
    .filter((c) => c.team === "BLUE" && c.isSubmitted)
    .reduce((sum, c) => sum + c.points, 0);

  return {
    challenges,
    summary: {
      totalChallenges,
      submittedChallenges,
      unsubmittedChallenges,
      completionPercentage: totalChallenges > 0 ? ((submittedChallenges / totalChallenges) * 100).toFixed(1) : "0.0",
      totalPoints,
      earnedPoints,
      redEarned,
      redTotal,
      blueEarned,
      blueTotal
    }
  };
}

export function submitFlag(flagInput) {
  if (!flagInput || typeof flagInput !== "string" || !flagInput.trim()) {
    return {
      success: false,
      message: "Please enter a valid flag string."
    };
  }

  const cleanFlag = flagInput.trim();
  const progress = loadProgress();
  const solvedMap = progress.solved || {};

  for (const ch of CHALLENGES) {
    if (matchFlag(cleanFlag, ch.flag)) {
      if (solvedMap[ch.id]) {
        return {
          success: false,
          alreadySubmitted: true,
          challenge: {
            id: ch.id,
            name: ch.name,
            team: ch.team,
            points: ch.points
          },
          message: `Challenge already submitted: '${ch.name}' (${ch.id})!`
        };
      }

      // Record solution
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      solvedMap[ch.id] = {
        name: ch.name,
        team: ch.team,
        points: ch.points,
        timestamp: now
      };

      progress.solved = solvedMap;
      saveProgress(progress);

      const status = getChallengeStatus();
      return {
        success: true,
        alreadySubmitted: false,
        challenge: {
          id: ch.id,
          name: ch.name,
          team: ch.team,
          points: ch.points
        },
        message: `Success! Challenge '${ch.name}' submitted! (+${ch.points} pts)`,
        summary: status.summary
      };
    }
  }

  return {
    success: false,
    alreadySubmitted: false,
    message: "Invalid or unrecognized flag. Review your finding and try again."
  };
}
