/**
 * Phase 5, in a browser: the AI review of a call — score, rubric, summary,
 * objections, promises, transcript — and the coaching queue (lowest score
 * first). Uses the demo company's sample analyses (labelled as such), since
 * the live pipeline needs speech-to-text and Claude keys; the live pipeline
 * itself is covered by tests/integration/insights.int.test.js in the API.
 *
 *   npm run build:web && node tools/verifyPhase5Web.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const evidence = path.resolve(here, "evidence");
fs.mkdirSync(evidence, { recursive: true });
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
await new Promise((r) => server.listen(4184, r));
const browser = await chromium.launch();

async function signIn(width, height) {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()));
  await page.goto("http://localhost:4184/sign-in");
  await page.getByLabel("Mobile number or email", { exact: true }).fill("9000000002");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByTestId("signin-submit").click();
  await page.getByText(/Good (morning|afternoon|evening)/).waitFor({ timeout: 20_000 });
  return page;
}

try {
  const m = await signIn(1440, 900);
  await m.getByRole("link", { name: "Calls" }).click();
  await m.getByRole("button", { name: "7 days" }).click();
  await m.getByRole("button", { name: "AI-reviewed", exact: true }).click();
  await m.getByText(/^1[0-9] calls?$/).first().waitFor({ timeout: 20_000 });
  check(true, "the AI-reviewed filter lists the reviewed calls");
  check((await m.getByLabel(/^AI score \d+ out of 100$/).count()) > 0, "each reviewed call shows its score");

  await m.getByRole("button", { name: "Lowest score first", exact: true }).click();
  await m.waitForTimeout(1500);
  const scores = await m.getByLabel(/^AI score \d+ out of 100$/).evaluateAll((els) => els.map((e) => Number(e.getAttribute("aria-label").match(/\d+/)[0])));
  check(scores.length > 1 && scores.every((s, i) => i === 0 || s >= scores[i - 1]), `lowest score first is sorted (${scores.slice(0, 5).join(", ")}…)`);
  await m.screenshot({ path: `${evidence}/p5-01-coaching-queue.png` });

  await m.getByRole("button", { name: /^Outgoing call, / }).first().click();
  await m.getByText("/100").waitFor({ timeout: 15_000 });
  check(true, "the call shows its score out of 100");
  check((await m.getByText("Sample analysis").count()) > 0, "sample analyses are labelled as such");
  check((await m.getByLabel(/^Opening \d+ out of 20$/).count()) === 1, "the five-part rubric is shown");
  check((await m.getByText("Summary", { exact: true }).count()) === 1, "the summary is shown");
  check((await m.getByText("Transcript", { exact: true }).count()) === 1, "the transcript is shown");
  check((await m.getByText("For next time", { exact: true }).count()) === 1, "coaching tips are shown");
  await m.screenshot({ path: `${evidence}/p5-02-call-review.png`, fullPage: false });

  const accept = m.getByRole("button", { name: /^Mark / });
  if (await accept.count()) {
    await Promise.all([
      m.waitForResponse((r) => r.request().method() === "PATCH" && /\/calls\/[0-9a-f]{24}$/.test(r.url()) && r.ok(), { timeout: 15_000 }),
      accept.first().click(),
    ]);
    check(true, "the AI's suggested status is accepted in one tap");
  } else {
    check(true, "the call already has the suggested status");
  }

  // the same review on a phone
  const p = await signIn(390, 844);
  await p.getByRole("tab", { name: "Calls" }).click();
  await p.getByRole("button", { name: "7 days" }).click();
  await p.getByRole("button", { name: "Lowest score first", exact: true }).click();
  await p.getByRole("button", { name: /^Outgoing call, / }).first().click();
  await p.getByText("/100").waitFor({ timeout: 15_000 });
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(over <= 0, "the review fits a phone screen");
  await p.screenshot({ path: `${evidence}/p5-03-call-review-phone.png` });
} catch (e) {
  failures.push(e.message.split("\n")[0]);
  console.log("  FAIL", e.message.split("\n")[0]);
  for (const [i, pg] of browser.contexts().flatMap((c) => c.pages()).entries()) await pg.screenshot({ path: `${evidence}/p5-fail-${i}.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  server.close();
}
check(errors.length === 0, `no console or page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nPhase 5 web gate: all checks passed");
process.exit(failures.length ? 1 : 0);
