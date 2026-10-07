import http from "http";
import app from "./src/server.js";

async function runTests() {
  console.log("=== PHASE 1 RECONNAISSANCE VALIDATION SUITE ===");

  const server = app.listen(3001, "127.0.0.1");

  function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: "127.0.0.1",
        port: 3001,
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
    // Test 1: Header - X-Powered-By: Node.js
    const rootRes = await request("/");
    assert(
      rootRes.headers["x-powered-by"] === "Node.js",
      "Explicit X-Powered-By: Node.js header exposure",
      "SCENARIO75{Node.js}"
    );

    // Test 2: robots.txt explicitly disallows /api/verify-mfa
    const robotsRes = await request("/robots.txt");
    assert(
      robotsRes.body.includes("Disallow: /api/verify-mfa"),
      "robots.txt disallows /api/verify-mfa",
      "SCENARIO75{/api/verify-mfa}"
    );

    // Test 3: Strictly restricted admin area at /dashboard
    const dashRes = await request("/dashboard");
    assert(
      dashRes.status === 403 && dashRes.body.includes("Restricted Admin Area"),
      "Restricted admin dashboard location at /dashboard",
      "SCENARIO75{/dashboard}"
    );

    // Test 4: ASCII art comment inside HTML source code hinting at robots.txt
    const hasAsciiArt = rootRes.body.includes("[ASCII ART]") || rootRes.body.includes("[o_o]");
    const hasRobotsHint = rootRes.body.includes("robots.txt");
    assert(
      hasAsciiArt && hasRobotsHint,
      "ASCII art HTML comment hinting at robots.txt",
      "SCENARIO75{robots.txt}"
    );

    // Test 5: Pre-authentication cookie named pre_mfa_session with value pending_mfa_verification
    const setCookie = rootRes.headers["set-cookie"] || [];
    const cookieHeaderStr = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    const hasCookieName = cookieHeaderStr.includes("pre_mfa_session=");
    const hasCookieValue = cookieHeaderStr.includes("pending_mfa_verification");
    const isNotHttpOnly = !cookieHeaderStr.toLowerCase().includes("httponly");

    assert(
      hasCookieName,
      "Pre-authentication cookie named pre_mfa_session issued",
      "SCENARIO75{pre_mfa_session}"
    );

    assert(
      hasCookieValue,
      "Pre-authentication cookie value is pending_mfa_verification",
      "SCENARIO75{pending_mfa_verification}"
    );

    assert(
      isNotHttpOnly,
      "Pre-authentication cookie does not have HttpOnly flag (accessible to JS for training flaw)"
    );

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    server.close(() => {
      process.exit(failed > 0 ? 1 : 0);
    });
  } catch (err) {
    server.close();
    throw err;
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
