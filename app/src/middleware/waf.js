import { telemetryService } from "../services/telemetryService.js";

/**
 * Naive WAF implementation designed for educational range demonstration.
 * Intentionally blocks only '<script' and literal 'document.cookie'.
 * Fails to catch '<svg onload=...>' or bracket notation property access 'window["docu"+"ment"]...'.
 */
export function naiveWaf(req, res, next) {
  if (req.method === "POST" && req.body && req.body.message) {
    const rawPayload = String(req.body.message);
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";

    // Naive rule checks:
    // 1. Block script tags
    const hasScriptTag = /<script\b/i.test(rawPayload);
    // 2. Block unseparated keyword access to document and cookies
    const hasDocumentKeyword = /document/i.test(rawPayload);
    const hasCookieKeyword = /cookie/i.test(rawPayload);

    if (hasScriptTag || hasDocumentKeyword || hasCookieKeyword) {
      const matched = hasScriptTag
        ? "<script>"
        : (hasDocumentKeyword ? "document" : "cookie");

      telemetryService.logSecurityEvent("WARN", `[WAF] Blocked suspicious payload from ${clientIp}`, {
        matchedPattern: matched,
        payload: rawPayload
      });

      return res.status(403).type("text/plain").send("Blocked by WAF");
    }
  }

  next();
}
