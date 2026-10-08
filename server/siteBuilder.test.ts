import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isValidWebsiteHtml, sanitizeHtmlOutput, generateFallbackTemplate, getLeadDisplayName, injectClientReviewPortal, getNichePreset } from "./siteBuilder.js";
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

test("generateFallbackTemplate includes 48-hour preview notice and client adjustments form", () => {
  const lead: Lead = {
    id: "lead_48h",
    name: "Vertex Windows",
    category: "Glazing",
    phone: "07987654321",
    status: "site_ready"
  };
  const html = generateFallbackTemplate(lead, "adeolamedia.co.uk");
  assert.ok(html.includes("48 Hours"), "Must mention 48 hours preview");
  assert.ok(html.includes("client-adjustments"), "Must have client adjustments section");
  assert.ok(html.includes("handleAdjustmentSubmit"), "Must have adjustment submission handler");
  assert.strictEqual(isValidWebsiteHtml(html), true);
});

test("injectClientReviewPortal injects top ribbon, floating button, modal, and guaranteed footer on truncated HTML", () => {
  const truncatedHtml = `<!DOCTYPE html>
<html>
<head><title>Aerial Pro</title></head>
<body>
  <header><h1>Aerial Pro</h1></header>
  <main><p>Services</p></main>
  <!-- Incomplete section -->
  <section id="
</body>
</html>`;

  const lead: Lead = {
    id: "lead_aerial_test",
    name: "TV Aerial Pro",
    status: "site_ready"
  };

  const injected = injectClientReviewPortal(truncatedHtml, lead);

  assert.ok(injected.includes("mode-demo-top-banner"), "Must inject sticky top ribbon");
  assert.ok(injected.includes("mode-floating-review-btn"), "Must inject floating review button");
  assert.ok(injected.includes("mode-adjustment-modal"), "Must inject interactive adjustment modal");
  assert.ok(injected.includes("Mode Guaranteed Complete Footer"), "Must inject guaranteed footer when missing");
  assert.ok(!injected.includes("<section id=\"\\n"), "Must strip dangling unclosed section tag");
  assert.ok(injected.includes("TV Aerial Pro"), "Must include business name in banner and modal");
});

test("getNichePreset returns industry-tailored photography and services", () => {
  const aerial = getNichePreset("TV Aerial & Satellite Installation");
  assert.ok(aerial.heroImage.includes("unsplash.com"), "Must return Unsplash hero photo");
  assert.ok(aerial.heroBadge.includes("Aerial"), "Must match aerial niche");
  assert.strictEqual(aerial.services.length, 3, "Must return 3 core services");

  const roofing = getNichePreset("Roofing Contractor");
  assert.ok(roofing.heroBadge.includes("Roofing"));

  const generic = getNichePreset("Miscellaneous Business");
  assert.ok(generic.heroImage.includes("unsplash.com"));
});

test("generateFallbackTemplate produces modern, conversion-focused design with niche imagery and reviews", () => {
  const lead: Lead = {
    id: "lead_modern",
    name: "ClearVision Aerials",
    category: "TV Aerial & Satellite Installation",
    phone: "0800 123 4567",
    email: "info@clearvision.co.uk",
    status: "site_ready"
  };

  const html = generateFallbackTemplate(lead, "adeolamedia.co.uk");
  assert.strictEqual(isValidWebsiteHtml(html), true);
  assert.ok(html.includes("images.unsplash.com"), "Must embed high-res Unsplash photo");
  assert.ok(html.includes("Plus Jakarta Sans"), "Must use modern Google Font");
  assert.ok(html.includes("Verified 5-Star Customer Feedback"), "Must include social proof reviews section");
  assert.ok(html.includes("The ClearVision Aerials Standard"), "Must include why-choose-us section");
  assert.ok(!html.includes("Resolved Audit Weaknesses"), "Must not display awkward audit diagnosis text");
});
