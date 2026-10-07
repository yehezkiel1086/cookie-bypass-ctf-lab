import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const robotsPath = path.resolve(__dirname, "../public/robots.txt");

// Serve robots.txt explicitly to ensure consistent content-type
router.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  if (fs.existsSync(robotsPath)) {
    return res.sendFile(robotsPath);
  }
  return res.send("User-agent: *\nDisallow: /api/verify-mfa\n");
});

// PHASE 1 REQUIREMENT:
// Hidden path disallowed in robots.txt
router.all("/api/verify-mfa", (req, res) => {
  res.status(403).json({
    endpoint: "/api/verify-mfa",
    status: "restricted",
    message: "Multi-Factor Authentication (MFA) endpoint. Direct access prohibited without active admin challenge."
  });
});

export default router;
