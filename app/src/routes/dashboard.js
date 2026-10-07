import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { authService } from "../services/authService.js";
import { feedbackService } from "../services/feedbackService.js";
import { telemetryService } from "../services/telemetryService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const dashboardHtmlPath = path.resolve(__dirname, "../views/dashboard.html");

// Strictly restricted admin area
router.get("/dashboard", (req, res) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";

  // Check admin session cookie (SCENARIO75{adm_sess})
  if (!authService.isValidAdminSession(req.cookies)) {
    telemetryService.logSecurityEvent("WARN", `[AUTH] Unauthorized attempt to access restricted area /dashboard from ${clientIp}`);

    return res.status(403).type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><title>403 Forbidden - Restricted Admin Area</title></head>
      <body style="background:#0f172a; color:#f8fafc; font-family:sans-serif; padding:3rem; text-align:center;">
        <h1 style="color:#ef4444;">403 Forbidden: Restricted Admin Area</h1>
        <p>Access to /dashboard is strictly restricted to authenticated administrators.</p>
        <p>Multi-Factor Authentication (MFA) verification required at <code>/api/verify-mfa</code>.</p>
      </body>
      </html>
    `);
  }

  // Vulnerable session replay / MFA bypass path
  telemetryService.logSecurityEvent("CRITICAL", `[AUTH] Authentication bypass anomaly: Session token adm_sess accepted from ${clientIp} without re-verifying MFA`);

  // Render dashboard with feedback messages (intentionally unescaped for XSS demonstration)
  let html = fs.readFileSync(dashboardHtmlPath, "utf-8");
  const feedbacks = feedbackService.getAll();
  
  const itemsHtml = feedbacks.map(item => `
    <div class="feedback-item">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
        <strong style="color:#38bdf8;">[${item.department}]</strong>
        <small style="color:#94a3b8;">${item.createdAt}</small>
      </div>
      <!-- Unsanitized stored input reflected in xss-payload container -->
      <div class="xss-payload">${item.message}</div>
    </div>
  `).join("\n");

  html = html.replace("{{FEEDBACK_ITEMS}}", itemsHtml || "<p>No feedback items submitted yet.</p>");

  return res.status(200).type("text/html").send(html);
});

export default router;
