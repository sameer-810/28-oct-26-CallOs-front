/**
 * Phase 6, the browser side that can be checked without a live Twilio number:
 * the Voice SDK bundle loads cleanly; while cloud calling isn't configured no
 * "Call" button appears on the web (a button that can't work is worse than
 * none) and Settings says what's missing. The call flow itself — webhooks,
 * recording, timing, inbound routing, signatures — is covered by
 * tests/integration/telephony.int.test.js in the API.
 *
 *   npm run build:web && node tools/verifyPhase6Web.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const evidence = path.resolve(here, "evidence");
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-pass-1234";
const failures = [];
const errors = [];
const check = (c, m) => {
  console.log(`${c ? "  ok  " : "  FAIL"} ${m}`);
  if (!c) failures.push(m);
};
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".ttf": "font/ttf", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let f = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(4185, r));
const browser = await chromium.launch();

try {
  const status = await fetch("http://localhost:5020/health").then((r) => r.json());
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()));
  await page.goto("http://localhost:4185/sign-in");
  await page.getByLabel("Mobile number or email", { exact: true }).fill("9000000001");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByTestId("signin-submit").click();
  await page.getByText(/Good (morning|afternoon|evening)/).waitFor({ timeout: 20_000 });
  check(true, "the app loads and signs in");

  // the Voice SDK is served as a static file, loaded on demand: prove it loads and works
  const sdk = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = "/vendor/twilio-voice.min.js";
        s.onload = () => resolve({ device: typeof globalThis.Twilio?.Device, supported: globalThis.Twilio?.Device?.isSupported });
        s.onerror = () => resolve({ device: "failed" });
        document.head.appendChild(s);
      }),
  );
  check(sdk.device === "function" && sdk.supported === true, `the Voice SDK loads on demand and this browser supports it (${JSON.stringify(sdk)})`);

  await page.getByRole("link", { name: "Calls" }).click();
  await page.getByRole("button", { name: "7 days" }).click();
  await page.getByRole("button", { name: /^Outgoing call, / }).first().click();
  await page.getByText("How did it go?").waitFor();
  const callButtons = await page.getByRole("button", { name: /^Call / }).count();
  if (status.data.telephony === "ready") check(callButtons > 0, "with cloud calling set up, the call has a Call button");
  else check(callButtons === 0, `with cloud calling not set up (telephony: ${status.data.telephony}), no Call button is shown`);
  await page.getByRole("button", { name: "Close" }).last().click();

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Cloud calling" }).click();
  await page.getByText(/Not set up yet|Calling from the browser is on/).waitFor({ timeout: 10_000 });
  check(true, "Settings shows whether cloud calling is on, and why not");
  await page.getByLabel("Company’s Twilio number", { exact: true }).fill("415");
  check((await page.getByText("Use + and the country code, digits only").count()) === 1, "a malformed number is caught before saving");
  await page.screenshot({ path: `${evidence}/p6-01-settings-cloud-calling.png`, fullPage: true });
} catch (e) {
  failures.push(e.message.split("\n")[0]);
  console.log("  FAIL", e.message.split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}
check(errors.length === 0, `no console or page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nPhase 6 web gate: all checks passed");
process.exit(failures.length ? 1 : 0);
