import { config } from "../config/config.js";

/**
 * Middleware for response header exposure and pre-MFA session cookie initialization.
 */
export function sessionMiddleware(req, res, next) {
  // PHASE 1 REQUIREMENT:
  // Headers: The HTTP response must explicitly expose the backend technology
  // via the X-Powered-By header (SCENARIO75{Node.js})
  res.setHeader("X-Powered-By", "Node.js");

  // PHASE 1 REQUIREMENT:
  // Session Initialization: The app must issue an initial, pre-authentication session
  // cookie named exactly pre_mfa_session (SCENARIO75{pre_mfa_session}) with the value
  // pending_mfa_verification (SCENARIO75{pending_mfa_verification})
  // HttpOnly is intentionally set to false to allow JavaScript access (for training flaw)
  if (!req.cookies || !req.cookies[config.cookies.preMfaName]) {
    res.cookie(config.cookies.preMfaName, config.cookies.preMfaValue, {
      httpOnly: false,
      path: "/",
      sameSite: "lax"
    });
  }

  next();
}
