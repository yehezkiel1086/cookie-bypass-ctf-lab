import fs from "fs";
import path from "path";
import { config } from "../config/config.js";

// Ensure log directory exists
try {
  if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create configured log directory, using fallback ./logs", e.message);
}

const accessLogPath = path.join(config.logDir, "access.log");
const errorLogPath = path.join(config.logDir, "error.log");

export const telemetryService = {
  logAccess(req, res, durationMs) {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const xff = req.headers["x-forwarded-for"] || "-";
    const userAgent = req.headers["user-agent"] || "-";
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;
    const contentLength = res.getHeader("content-length") || "-";
    const now = new Date();
    
    // Format: Combined log format with X-Forwarded-For
    const timestampStr = now.toISOString();
    const line = `${ip} - - [${timestampStr}] "${method} ${url} HTTP/1.1" ${status} ${contentLength} "${userAgent}" "${xff}"\n`;

    try {
      fs.appendFileSync(accessLogPath, line);
    } catch (err) {
      // Fallback silently if disk write fails
    }
  },

  logSecurityEvent(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    const detailsStr = Object.keys(details).length ? ` | ${JSON.stringify(details)}` : "";
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${detailsStr}\n`;

    try {
      fs.appendFileSync(errorLogPath, line);
    } catch (err) {
      // Fallback silently
    }
  }
};
