import cookieParser from "cookie-parser";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config/config.js";
import { loggingMiddleware } from "./middleware/logger.js";
import { sessionMiddleware } from "./middleware/session.js";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import feedbackRoutes from "./routes/feedback.js";
import flagRoutes from "./routes/flag.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Disable Express default x-powered-by so our sessionMiddleware sets 'Node.js' explicitly
app.disable("x-powered-by");

// CORS headers to ensure browser fetch works properly while respecting endpoint method restrictions
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, X-Requested-With");

  // The feedback submission endpoint must exclusively use the POST method (SCENARIO75{POST})
  const isFeedbackEndpoint = req.path === "/api/feedback" || req.originalUrl?.split("?")[0] === "/api/feedback";

  if (isFeedbackEndpoint) {
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.setHeader("Allow", "POST");
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method Not Allowed. The feedback submission endpoint exclusively uses the POST method.",
        allowedMethod: "POST"
      });
    }
  } else {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
  }

  next();
});

// Request parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Telemetry logging
app.use(loggingMiddleware);

// Header exposure (X-Powered-By: Node.js) and pre-MFA session cookie initialization
app.use(sessionMiddleware);

// static assets
app.use(express.static(path.resolve(__dirname, "public")));

// routes
app.use(authRoutes);
app.use(feedbackRoutes);
app.use(dashboardRoutes);
app.use(flagRoutes);

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  app.listen(config.port, config.host, () => {
    console.log(`Admin Feedback System listening on ${config.host}:${config.port}`);
  });
}

export default app;