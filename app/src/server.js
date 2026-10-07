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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Disable Express default x-powered-by so our sessionMiddleware sets 'Node.js' explicitly
app.disable("x-powered-by");

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

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  app.listen(config.port, config.host, () => {
    console.log(`Admin Feedback System listening on ${config.host}:${config.port}`);
  });
}

export default app;