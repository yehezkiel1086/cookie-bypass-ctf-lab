import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { feedbackService } from "../services/feedbackService.js";
import { naiveWaf } from "../middleware/waf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const indexHtmlPath = path.resolve(__dirname, "../views/index.html");

// Root path - renders feedback page
router.get("/", (req, res) => {
  res.sendFile(indexHtmlPath);
});

// Reject non-POST requests to ensure endpoint exclusively uses POST (SCENARIO75{POST})
router.all("/api/feedback", (req, res, next) => {
  res.setHeader("Allow", "POST");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed. The feedback submission endpoint exclusively uses the POST method.",
      allowedMethod: "POST"
    });
  }
  next();
});

// Feedback submission endpoint
router.post("/api/feedback", naiveWaf, (req, res) => {
  res.setHeader("Allow", "POST");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  const { department, message } = req.body;

  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Message content cannot be empty." });
  }

  feedbackService.addFeedback(department, message);

  if (req.headers.accept && req.headers.accept.includes("application/json")) {
    return res.status(200).json({
      success: true,
      message: "Feedback received and queued for admin review."
    });
  }

  // Support plain text for standard curl requests
  return res.status(200).send("Feedback received and queued for admin review.\n");
});

export default router;
