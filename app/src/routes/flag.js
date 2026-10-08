import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getChallengeStatus, submitFlag, resetProgress } from "../services/flagService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * GET /flag
 * Serves the Flag Submission & Challenge Tracking Dashboard UI,
 * or JSON if requested with ?format=json or Accept: application/json.
 */
router.get("/flag", (req, res) => {
  if (req.query.format === "json" || req.headers.accept?.includes("application/json")) {
    const data = getChallengeStatus();
    return res.json(data);
  }

  const htmlPath = path.resolve(__dirname, "../views/flag.html");
  res.sendFile(htmlPath);
});

/**
 * GET /api/flag/status
 * Dedicated JSON status endpoint for automated checks or frontend polling.
 */
router.get("/api/flag/status", (req, res) => {
  const data = getChallengeStatus();
  res.json(data);
});

/**
 * POST /flag
 * Submits a candidate flag, validates against all CTF challenges,
 * and updates persistent progress.
 */
router.post("/flag", (req, res) => {
  const flagInput = req.body?.flag || req.query?.flag;
  const result = submitFlag(flagInput);

  if (req.headers.accept?.includes("application/json") || req.is("json") || req.xhr) {
    const status = result.success ? 200 : (result.alreadySubmitted ? 409 : 400);
    return res.status(status).json(result);
  }

  // Fallback for native form submission
  const data = getChallengeStatus();
  return res.redirect(`/flag?msg=${encodeURIComponent(result.message)}&ok=${result.success ? 1 : 0}`);
});

/**
 * POST /flag/reset
 * Resets all submitted challenges to 0.
 */
router.post("/flag/reset", (req, res) => {
  resetProgress();
  if (req.headers.accept?.includes("application/json") || req.is("json") || req.xhr) {
    return res.json({ success: true, message: "Progress reset successfully." });
  }
  res.redirect("/flag?msg=Progress%20reset%20successfully.&ok=1");
});

export default router;
