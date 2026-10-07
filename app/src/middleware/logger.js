import { telemetryService } from "../services/telemetryService.js";

export function loggingMiddleware(req, res, next) {
  const startTime = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    telemetryService.logAccess(req, res, durationMs);
  });

  next();
}
