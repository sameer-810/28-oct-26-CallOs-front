import test from "node:test";
import assert from "node:assert/strict";
import { fillTemplate, segments, unfilled, whatsappUrl, whenVars } from "../src/modules/playbook/fill";

const body = "Hi {name}, your site visit is confirmed for {date} at {time}.\n— {rep}, {company}";

test("fills the lead's name and everything known", () => {
  const out = fillTemplate(body, { name: "Rakesh", rep: "Ankit", company: "Sevagiri Realty", date: "Sat 1 Nov", time: "11:00 am" });
  assert.equal(out, "Hi Rakesh, your site visit is confirmed for Sat 1 Nov at 11:00 am.\n— Ankit, Sevagiri Realty");
  assert.deepEqual(unfilled(out), []);
});

test("no name: the greeting closes up instead of saying 'Hi ,'", () => {
  assert.equal(fillTemplate("Hi {name}, thanks.", { name: "" }), "Hi, thanks.");
  assert.equal(fillTemplate("Hello {name}!", {}), "Hello!");
  assert.equal(fillTemplate("{name} ji, namaste", { name: "Sneha" }), "Sneha ji, namaste");
});

test("a missing date or time stays visible, so the rep fills it before sending", () => {
  const out = fillTemplate(body, { name: "Rakesh", rep: "Ankit", company: "X" });
  assert.deepEqual(unfilled(out), ["date", "time"]);
});

test("segments mark placeholders for highlighting and keep all the text", () => {
  const parts = segments("Hi {name}, at {time}.");
  assert.deepEqual(parts, [
    { text: "Hi ", placeholder: false },
    { text: "{name}", placeholder: true },
    { text: ", at ", placeholder: false },
    { text: "{time}", placeholder: true },
    { text: ".", placeholder: false },
  ]);
  assert.equal(parts.map((p) => p.text).join(""), "Hi {name}, at {time}.");
});

test("WhatsApp link: digits only, text encoded", () => {
  assert.equal(whatsappUrl("+91 98200 11111", "Hi Rakesh & family"), "https://wa.me/919820011111?text=Hi%20Rakesh%20%26%20family");
});

test("follow-up time in the company's zone", () => {
  const v = whenVars("2026-10-31T05:30:00.000Z", "Asia/Kolkata");
  assert.equal(v.time, "11:00 am");
  assert.match(v.date ?? "", /^Sat 31 Oct$/);
  assert.deepEqual(whenVars(null, "Asia/Kolkata"), {});
});

test("moments typed as m:ss", async () => {
  const { parseClock } = await import("../src/shared/format");
  assert.equal(parseClock("2:10"), 130);
  assert.equal(parseClock(" 130 "), 130);
  assert.equal(parseClock("1:02:05"), 3725);
  assert.equal(parseClock("2:75"), null);
  assert.equal(parseClock("two"), null);
});
