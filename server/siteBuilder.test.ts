import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isValidWebsiteHtml, sanitizeHtmlOutput, generateFallbackTemplate, getLeadDisplayName } from "./siteBuilder.js";
import { Lead } from "./db.js";

test("isValidWebsiteHtml rejects null, undefined and short strings", () => {
  assert.strictEqual(isValidWebsiteHtml(null), false);
  assert.strictEqual(isValidWebsiteHtml(undefined), false);
  assert.strictEqual(isValidWebsiteHtml(""), false);
  assert.strictEqual(isValidWebsiteHtml("<html><body>short</body></html>"), false);
});

test("isValidWebsiteHtml rejects truncated HTML with unclosed <style> and missing <body>", () => {
  const brokenTruncated = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; }
    body { font-family: sans-serif; }
    .card { background: #fff;
</body>
</html>`;
  assert.strictEqual(isValidWebsiteHtml(brokenTruncated), false);
});

test("isValidWebsiteHtml rejects the real-world truncated demo site HTML", () => {
  if (fs.existsSync("/tmp/demo_itrphxt.html")) {
    const realBrokenHtml = fs.readFileSync("/tmp/demo_itrphxt.html", "utf-8");
    assert.strictEqual(isValidWebsiteHtml(realBrokenHtml), false);
  }
});

test("isValidWebsiteHtml accepts complete, well-formed HTML documents", () => {
  const validHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Awesome Plumbing</title>
  <style>
    body { margin: 0; background: #000; color: #fff; }
  </style>
</head>
<body class="bg-black text-white">
  <header>
    <h1>Awesome Plumbing</h1>
  </header>
  <main>
    <section>
      <h2>Expert 24/7 Plumbing & Repairs</h2>
      <p>Providing the highest rated plumbing services across London.</p>
    </section>
  </main>
  <footer>
    <p>&copy; 2026 Awesome Plumbing</p>
  </footer>
</body>
</html>`;
  assert.strictEqual(isValidWebsiteHtml(validHtml), true);
});

test("getLeadDisplayName extracts real business name if lead.name is CSV header or placeholder", () => {
  const leadWithHeader: Lead = {
    id: "itrphxt",
    name: "Trade / Category (as listed)",
    demoSiteHtml: "<!DOCTYPE html><html><head><title>Best of Brain | Digital Marketing</title></head></html>",
    status: "site_ready"
  };
  assert.strictEqual(getLeadDisplayName(leadWithHeader), "Best of Brain");

  const normalLead: Lead = {
    id: "normal123",
    name: "Apex Roofing Specialists",
    status: "site_ready"
  };
  assert.strictEqual(getLeadDisplayName(normalLead), "Apex Roofing Specialists");
});

test("generateFallbackTemplate produces valid renderable HTML that passes isValidWebsiteHtml", () => {
  const lead: Lead = {
    id: "test1",
    name: "Apex Roofing",
    category: "Roofing Contractor",
    phone: "07123456789",
    email: "info@apexroofing.co.uk",
    gmbRating: 4.9,
    seoIssues: ["Missing meta descriptions", "Slow mobile load"],
    status: "site_ready"
  };

  const generated = generateFallbackTemplate(lead, "adeolamedia.co.uk");
  assert.strictEqual(isValidWebsiteHtml(generated), true);
  assert.ok(generated.includes("Apex Roofing"));
  assert.ok(generated.includes("07123456789"));
  assert.ok(generated.includes("Roofing Contractor"));
});

test("sanitizeHtmlOutput rejects truncated code that cuts off in <style>", () => {
  const truncatedAiOutput = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; }
    .hero { background: #000;
`;
  const result = sanitizeHtmlOutput(truncatedAiOutput);
  assert.strictEqual(result, null);
});
