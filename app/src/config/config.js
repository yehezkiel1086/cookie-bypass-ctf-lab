import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  host: process.env.HOST || "0.0.0.0",
  logDir: process.env.LOG_DIR || (process.platform === "win32" ? path.resolve(__dirname, "../../../logs") : "/opt/admin/logs"),
  cookies: {
    preMfaName: "pre_mfa_session",
    preMfaValue: "pending_mfa_verification",
    adminSessionName: "adm_sess"
  },
  flags: {
    phase1: {
      backendHeader: "SCENARIO75{Node.js}",
      hiddenPath: "SCENARIO75{/api/verify-mfa}",
      restrictedDashboard: "SCENARIO75{/dashboard}",
      sourceHint: "SCENARIO75{robots.txt}",
      cookieName: "SCENARIO75{pre_mfa_session}",
      cookieValue: "SCENARIO75{pending_mfa_verification}"
    },
    redFlag: "SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}",
    blueFlag: "SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}"
  }
};
