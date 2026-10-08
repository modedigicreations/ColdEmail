import { Anthropic } from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { Lead, Settings } from "./db.js";

/**
 * Validates that an HTML document is complete and will render visibly in a browser.
 * Rejects truncated output, unclosed <style> blocks that consume the DOM, and missing bodies.
 */
export function isValidWebsiteHtml(html?: string | null): boolean {
  if (!html || typeof html !== "string") return false;
  const trimmed = html.trim();
  if (trimmed.length < 500) return false;

  const lower = trimmed.toLowerCase();

  // Must be an HTML document with body
  if (!lower.includes("<html") || !lower.includes("<body") || !lower.includes("</body>")) {
    return false;
  }

  // Must have balanced <style> tags
  const styleOpens = (lower.match(/<style\b[^>]*>/g) || []).length;
  const styleCloses = (lower.match(/<\/style>/g) || []).length;
  if (styleOpens > styleCloses) {
    return false;
  }

  // Must have visible content inside <body>...</body>
  const bodyMatch = trimmed.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return false;

  const bodyContent = bodyMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  if (bodyContent.length < 250) return false;

  // Must have real website structural elements (sections/main + header/nav/footer + headings)
  const hasStructural = lower.includes("<section") || lower.includes("<main") || lower.includes("<header") || lower.includes("<nav");
  const hasHeadings = lower.includes("<h1") || lower.includes("<h2") || lower.includes("<h3");
  if (!hasStructural || !hasHeadings) {
    return false;
  }

  // Verify that the body content is not trapped inside an unclosed style
  if (bodyContent.toLowerCase().includes("<style") && !bodyContent.toLowerCase().includes("</style>")) {
    return false;
  }

  return true;
}

/**
 * Extracts a sensible business name if the lead name is a generic placeholder or CSV header.
 */
export function getLeadDisplayName(lead: Lead): string {
  let name = (lead.name || "").trim();
  const isCategoryOrPlaceholder = 
    !name || 
    name.includes(";") || 
    name.toLowerCase().includes("category (as listed)") || 
    name.toLowerCase().includes("trade / category") ||
    name.toLowerCase().includes("doors; double glazing");

  if (isCategoryOrPlaceholder) {
    const prevTitle = lead.demoSiteHtml?.match(/<title>([^|<]+)/i)?.[1]?.trim();
    if (prevTitle && !prevTitle.toLowerCase().includes("category") && !prevTitle.includes(";")) {
      return prevTitle;
    }
    if (lead.website && !lead.website.toLowerCase().includes("category")) {
      const cleanWeb = lead.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      const domainPart = cleanWeb.split(".")[0];
      if (domainPart && domainPart.length > 2) {
        return domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
      }
    }
    if (lead.email && !lead.email.toLowerCase().includes("category")) {
      const domainPart = lead.email.split("@")[1]?.split(".")[0];
      if (domainPart && domainPart.length > 2) {
        return domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
      }
    }
    if (name.includes(";")) {
      const parts = name.split(/[;,]/).map(p => p.trim()).filter(Boolean);
      const mainPart = parts.find(p => p.toLowerCase().includes("glazing") || p.toLowerCase().includes("double")) || parts[0];
      return `${mainPart} Specialists`;
    }
    return "Best of Brain";
  }
  return name;
}

/**
 * Injects a top 48-hour review ribbon, a guaranteed footer (if missing), and a floating
 * adjustment request button + modal into any preview HTML document.
 * This ensures the client ALWAYS has access to the review/adjustment portal from anywhere on the page,
 * even if the AI stopped before generating its own footer.
 */
export function injectClientReviewPortal(html: string, lead: Lead): string {
  if (!html || typeof html !== "string") return html;

  const businessName = getLeadDisplayName(lead);
  let processed = html;

  // 1. Clean dangling unclosed tags at the end of the body (e.g. `<section id="`)
  const bodyEndIdx = processed.lastIndexOf("</body>");
  if (bodyEndIdx !== -1) {
    let beforeBody = processed.substring(0, bodyEndIdx).trim();
    // Strip trailing incomplete tags like `<section id="` or `<div class="`
    beforeBody = beforeBody.replace(/<[a-z0-9_-]+[^>]*$/i, "").trim();
    // Strip trailing incomplete comments
    beforeBody = beforeBody.replace(/<!--[^\r\n]*-->\s*$/i, "").trim();

    // 2. If no footer exists in the body, append a clean guaranteed footer
    if (!beforeBody.toLowerCase().includes("<footer")) {
      const footerHtml = `
  <!-- Mode Guaranteed Complete Footer -->
  <footer style="background: #020617; border-top: 1px solid rgba(255,255,255,0.1); padding: 50px 20px; text-align: center; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <div style="max-width: 720px; margin: 0 auto;">
      <h3 style="color: #ffffff; font-size: 22px; font-weight: 800; margin-bottom: 8px;">${businessName}</h3>
      <p style="font-size: 13px; color: #64748b; margin-bottom: 24px;">48-Hour Demonstration Concept Redesign by Mode Webhost & Digital Creations.</p>
      <button type="button" onclick="window.modeOpenAdjustmentModal()" style="cursor: pointer; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; border: none; padding: 14px 28px; border-radius: 14px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 16px rgba(147, 51, 234, 0.4); display: inline-flex; align-items: center; gap: 8px; transition: transform 0.2s;">
        <span>✏️</span> Request Adjustments For Final Production Site
      </button>
    </div>
  </footer>`;
      beforeBody += "\n" + footerHtml;
    }

    // 3. Inject Floating Button, Modal, and JavaScript before </body>
    const modalHtml = `
  <!-- Mode Floating Adjustment Button (Always visible on mobile & desktop) -->
  <div id="mode-floating-review-btn" style="position: fixed; bottom: 20px; right: 20px; z-index: 999991; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <button type="button" onclick="window.modeOpenAdjustmentModal()" style="cursor: pointer; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; border: 1px solid rgba(255,255,255,0.25); padding: 12px 20px; border-radius: 999px; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 8px 24px rgba(147, 51, 234, 0.5); transition: transform 0.2s, box-shadow 0.2s;">
      <span style="font-size: 16px;">✏️</span> Request Adjustments (48h Review)
    </button>
  </div>

  <!-- Mode Interactive Adjustment Modal -->
  <div id="mode-adjustment-modal" style="display: none; position: fixed; inset: 0; z-index: 999999; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); align-items: center; justify-content: center; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <div style="background: #0f172a; border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 24px; max-width: 520px; width: 100%; padding: 28px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8); position: relative; color: #f8fafc; box-sizing: border-box;">
      
      <button type="button" onclick="window.modeCloseAdjustmentModal()" style="position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.1); border: none; color: #94a3b8; width: 32px; height: 32px; border-radius: 999px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
        ✕
      </button>

      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #c084fc; background: rgba(192, 132, 252, 0.1); border: 1px solid rgba(192, 132, 252, 0.2); padding: 4px 12px; border-radius: 999px;">
          ⏱ 48-Hour Review Active
        </span>
        <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin-top: 10px; margin-bottom: 6px;">
          Request Adjustments
        </h2>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0;">
          Reviewing for <strong style="color: #ffffff;">${businessName}</strong>? Describe any adjustments (text, colors, phone, services, images) before your official website is finalized.
        </p>
      </div>

      <form id="mode-adjustment-form" onsubmit="window.modeSubmitAdjustment(event)">
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #cbd5e1; margin-bottom: 6px;">Your Name / Title</label>
          <input type="text" id="mode-adj-name" required placeholder="e.g. John Doe, Owner" style="width: 100%; box-sizing: border-box; background: #020617; border: 1px solid #334155; border-radius: 12px; padding: 12px 14px; color: #ffffff; font-size: 13px; outline: none;">
        </div>

        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #cbd5e1; margin-bottom: 6px;">Your Contact Phone or Email</label>
          <input type="text" id="mode-adj-contact" placeholder="e.g. 07911 123456 / owner@business.co.uk" style="width: 100%; box-sizing: border-box; background: #020617; border: 1px solid #334155; border-radius: 12px; padding: 12px 14px; color: #ffffff; font-size: 13px; outline: none;">
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #cbd5e1; margin-bottom: 6px;">Requested Adjustments & Notes</label>
          <textarea id="mode-adj-notes" rows="4" required placeholder="Describe any updates you want (e.g. change phone number to..., add our 24/7 emergency service, update brand colors to navy blue)..." style="width: 100%; box-sizing: border-box; background: #020617; border: 1px solid #334155; border-radius: 12px; padding: 12px 14px; color: #ffffff; font-size: 13px; outline: none; line-height: 1.5;"></textarea>
        </div>

        <button type="submit" id="mode-adj-submit-btn" style="width: 100%; box-sizing: border-box; cursor: pointer; background: linear-gradient(135deg, #9333ea, #6366f1); border: none; color: #ffffff; font-weight: 700; font-size: 14px; padding: 14px; border-radius: 14px; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.4);">
          Submit Adjustments to Web Team
        </button>

        <div id="mode-adj-status" style="display: none; margin-top: 12px; padding: 10px; border-radius: 10px; font-size: 12px; text-align: center; font-weight: 600;"></div>
      </form>
    </div>
  </div>

  <script>
    window.modeOpenAdjustmentModal = function() {
      var modal = document.getElementById('mode-adjustment-modal');
      if (modal) {
        modal.style.display = 'flex';
        var input = document.getElementById('mode-adj-name');
        if (input) input.focus();
      }
    };

    window.modeCloseAdjustmentModal = function() {
      var modal = document.getElementById('mode-adjustment-modal');
      if (modal) modal.style.display = 'none';
    };

    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') window.modeCloseAdjustmentModal();
    });

    document.addEventListener('click', function(e) {
      var modal = document.getElementById('mode-adjustment-modal');
      if (e.target === modal) window.modeCloseAdjustmentModal();
    });

    window.modeSubmitAdjustment = async function(e) {
      e.preventDefault();
      var btn = document.getElementById('mode-adj-submit-btn');
      var status = document.getElementById('mode-adj-status');
      var name = document.getElementById('mode-adj-name').value;
      var contact = document.getElementById('mode-adj-contact').value;
      var notes = document.getElementById('mode-adj-notes').value;

      btn.disabled = true;
      btn.innerText = 'Submitting Adjustments...';

      var fullNotes = notes;
      if (contact && contact.trim()) {
        fullNotes = notes + ' (Contact: ' + contact.trim() + ')';
      }

      try {
        var res = await fetch('/api/leads/${lead.id}/demo-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, notes: fullNotes })
        });
        var data = await res.json();
        if (data.success) {
          status.style.display = 'block';
          status.style.background = 'rgba(16, 185, 129, 0.15)';
          status.style.border = '1px solid rgba(16, 185, 129, 0.3)';
          status.style.color = '#34d399';
          status.innerText = '✓ Thank you! Your adjustments have been submitted to our design team. We will apply them to your final production website.';
          document.getElementById('mode-adjustment-form').reset();
          setTimeout(function() {
            window.modeCloseAdjustmentModal();
          }, 3500);
        } else {
          throw new Error(data.error || 'Submission failed');
        }
      } catch (err) {
        status.style.display = 'block';
        status.style.background = 'rgba(239, 68, 68, 0.15)';
        status.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        status.style.color = '#f87171';
        status.innerText = 'Error: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.innerText = 'Submit Adjustments to Web Team';
      }
    };
  </script>`;

    processed = beforeBody + "\n" + modalHtml + "\n" + processed.substring(bodyEndIdx);
  }

  // 4. Inject Sticky Top Ribbon directly after <body...>
  const bodyOpenMatch = processed.match(/<body\b[^>]*>/i);
  if (bodyOpenMatch && !processed.includes("id=\"mode-demo-top-banner\"")) {
    const insertIdx = (bodyOpenMatch.index || 0) + bodyOpenMatch[0].length;
    const topRibbonHtml = `
  <!-- Mode Sticky 48h Review Top Ribbon -->
  <div id="mode-demo-top-banner" style="position: sticky; top: 0; left: 0; right: 0; width: 100%; z-index: 999990; background: linear-gradient(90deg, #3b0764 0%, #1e1b4b 50%, #0f172a 100%); border-bottom: 1px solid rgba(168, 85, 247, 0.4); padding: 10px 16px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
    <span style="display: inline-flex; align-items: center; gap: 6px;">
      <span>⚡</span> <strong>Concept Redesign Preview</strong> for <strong style="color: #d8b4fe;">${businessName}</strong> • Active for <strong>48 Hours</strong>
    </span>
    <button type="button" onclick="window.modeOpenAdjustmentModal()" style="cursor: pointer; background: #9333ea; color: #ffffff; border: none; padding: 6px 16px; border-radius: 999px; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(147, 51, 234, 0.5); transition: all 0.2s;">
      <span>✏️</span> Request Adjustments
    </button>
  </div>`;
    processed = processed.substring(0, insertIdx) + "\n" + topRibbonHtml + "\n" + processed.substring(insertIdx);
  }

  return processed;
}


export function sanitizeHtmlOutput(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let cleaned = raw.trim();

  // 1. Try to extract inside markdown code blocks first
  const codeBlockMatch = cleaned.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    // Strip leading/trailing code fences if present
    cleaned = cleaned.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "");
  }

  cleaned = cleaned.trim();

  // Check for unclosed <style> tag
  const lastStyleOpen = cleaned.lastIndexOf("<style");
  const lastStyleClose = cleaned.lastIndexOf("</style>");
  if (lastStyleOpen !== -1 && lastStyleOpen > lastStyleClose) {
    // Style tag was never closed!
    // If it never even reached <body>, this HTML is truncated in head and unrenderable
    if (!cleaned.toLowerCase().includes("<body")) {
      return null;
    }
    // If it reached body but style was somehow unclosed, close style cleanly
    cleaned += "\n</style>";
  }

  // 2. Try to extract complete HTML document
  const docMatch = cleaned.match(/(<!DOCTYPE\s+html[\s\S]*?<\/html>)/i) ||
                   cleaned.match(/(<html[\s\S]*?<\/html>)/i);
  if (docMatch) {
    const candidate = docMatch[1].trim();
    if (isValidWebsiteHtml(candidate)) {
      return candidate;
    }
  }

  // 3. If it has <html> and <body>, ensure closing tags if slightly truncated at end
  if (cleaned.toLowerCase().includes("<body") && cleaned.toLowerCase().includes("<html")) {
    let repaired = cleaned;
    if (!repaired.toLowerCase().includes("</body>")) repaired += "\n</body>";
    if (!repaired.toLowerCase().includes("</html>")) repaired += "\n</html>";
    if (isValidWebsiteHtml(repaired)) {
      return repaired;
    }
  }

  // Under NO circumstances wrap a raw text fragment or plugin list in a fake HTML shell
  return null;
}

// Curated presets for industry-tailored imagery, services, and conversion copy

export function cleanCategoryTitle(rawCategory?: string): string {
  if (!rawCategory) return "Professional Services";
  if (rawCategory.includes(";")) {
    const parts = rawCategory.split(/[;,]/).map(p => p.trim()).filter(Boolean);
    const main = parts.find(p => p.toLowerCase().includes("glazing") || p.toLowerCase().includes("double")) || parts[0];
    return main ? `${main} & Specialist Services` : "Professional Services";
  }
  return rawCategory.trim();
}

export function getNichePreset(category?: string) {
  const cat = (category || "").toLowerCase();

  if (cat.includes("glaz") || cat.includes("window") || cat.includes("door") || cat.includes("conservator")) {
    return {
      heroImage: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
      heroBadge: "Bespoke Windows, Doors & Double Glazing Specialists",
      services: [
        {
          title: "Energy-Efficient Double & Triple Glazing",
          desc: "A-rated thermal insulation windows, acoustic noise reduction glass, and bespoke UPVC or aluminium frames.",
          points: ["A+ Energy Rated Glass", "Up to 70% Noise Reduction", "10-Year Insurance-Backed Guarantee"]
        },
        {
          title: "Custom Composite & Bifold Doors",
          desc: "High-security composite entrance doors, aluminium bifold patio doors, and French doors with multi-point locking.",
          points: ["Ultion High-Security Locks", "Weather-Sealed Precision Fit", "Vast Range of Contemporary Colors"]
        },
        {
          title: "Emergency Glazing Repairs & Misted Units",
          desc: "Fast glass replacement, cloudy/misted double glazing seal repairs, hinge adjustments, and broken pane replacements.",
          points: ["Same-Day Emergency Boarding & Repair", "Zero Callout Fee Estimates", "Direct Factory Replacement Glass"]
        }
      ]
    };
  }

  if (cat.includes("aerial") || cat.includes("satellite") || cat.includes("audio") || cat.includes("cinema") || cat.includes("av") || cat.includes("tv")) {
    return {
      heroImage: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=80",
      heroBadge: "Digital TV Aerial & Satellite Specialists",
      services: [
        {
          title: "Digital TV Aerials & 4K Reception",
          desc: "High-gain benchmark digital aerial installations, repairs, signal amplifiers, and multi-room distribution for crystal-clear 4K and Freeview reception.",
          points: ["4K & HD Freeview Optimization", "High-Gain Benchmark Antennas", "Same-Day Signal Diagnostics"]
        },
        {
          title: "Satellite & Sky / Freesat Realignment",
          desc: "Precision dish alignment, LNB replacements, multi-satellite systems, and European satellite reception with zero weather dropouts.",
          points: ["Freesat & Sky Q Compatible", "Storm Damage & Realignment", "Clean Concealed Cabling"]
        },
        {
          title: "Custom TV Wall Mounting & AV Setup",
          desc: "Flush, tilt, and articulated heavy-duty wall mounting on stud or masonry walls with hidden in-wall cable concealment and soundbar integration.",
          points: ["VESA Certified Heavy-Duty Mounts", "Clean In-Wall Cable Trunking", "Soundbar & Receiver Integration"]
        }
      ]
    };
  }

  if (cat.includes("roof") || cat.includes("gutter") || cat.includes("fascia") || cat.includes("chimney")) {
    return {
      heroImage: "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1200&q=80",
      heroBadge: "Certified Roofing, Chimney & Gutter Specialists",
      services: [
        {
          title: "Complete Roof Replacements & Tiling",
          desc: "Full slate, tile, and pitched roof installations using premium weather-resistant underlays and breathable high-performance membranes.",
          points: ["25-Year Manufacturer Warranties", "Slate, Tile & Modern Flat Roofs", "Full Structural Inspections"]
        },
        {
          title: "Emergency Leak Repairs & Storm Damage",
          desc: "Rapid-response emergency callouts to locate, seal, and repair active leaks, slipped tiles, and storm-damaged lead valleys.",
          points: ["24/7 Rapid Emergency Response", "Zero Callout Fee Estimates", "Water-Tight Weatherproof Sealing"]
        },
        {
          title: "Fascias, Soffits & High-Flow Guttering",
          desc: "Durable UPVC fascia boards, vented soffits, and high-capacity guttering systems designed to prevent costly foundation damp.",
          points: ["Seamless Low-Maintenance UPVC", "Clog-Resistant Leaf Protection", "Complete Drainage Testing"]
        }
      ]
    };
  }

  if (cat.includes("electric") || cat.includes("ev") || cat.includes("rewir")) {
    return {
      heroImage: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80",
      heroBadge: "Licensed & Insured Electrical Specialists",
      services: [
        {
          title: "Smart EV Charger Installation",
          desc: "Certified home and commercial EV charging stations installed with dynamic load management and smartphone app control.",
          points: ["OZEV Approved Installers", "Universal Fast Type 2 Charging", "Smart Energy App Integration"]
        },
        {
          title: "Consumer Unit & Fuse Box Upgrades",
          desc: "Modern surge-protected 18th Edition metal consumer units with RCBO protection to safeguard your home against electrical shocks.",
          points: ["Full BS7671 Compliance", "Surge Protection (SPD) Included", "Safety Certification Supplied"]
        },
        {
          title: "Emergency Fault Finding & Full Rewiring",
          desc: "Precision electrical diagnostics, partial or full home rewiring, architectural LED lighting, and socket additions.",
          points: ["Thermal Diagnostic Testing", "Minimal Wall Disruption", "Written Safety Guarantee"]
        }
      ]
    };
  }

  if (cat.includes("plumb") || cat.includes("heat") || cat.includes("boiler") || cat.includes("gas")) {
    return {
      heroImage: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
      heroBadge: "Gas Safe Registered Plumbing & Heating",
      services: [
        {
          title: "Boiler Installation & Annual Servicing",
          desc: "A-rated energy efficient combi and system boiler replacements with extended up to 10-year manufacturer warranties.",
          points: ["Gas Safe Certified Engineers", "Up to 10-Year Warranty", "Same-Day Emergency Replacements"]
        },
        {
          title: "Emergency Leak Detection & Pipework",
          desc: "Precision acoustic and thermal leak detection with immediate repairs to stop water damage in its tracks.",
          points: ["24/7 Rapid Response", "Burst Pipe & Radiator Repairs", "No Hidden Callout Fees"]
        },
        {
          title: "Bathroom Renovations & Heating Upgrades",
          desc: "Turnkey luxury bathroom plumbing, power flushing, underfloor heating, and smart thermostat integration.",
          points: ["Power Flushing & Filter Fitting", "Smart Thermostat Control", "Turnkey Luxury Installations"]
        }
      ]
    };
  }

  if (cat.includes("dental") || cat.includes("dentist") || cat.includes("orthodont") || cat.includes("smile")) {
    return {
      heroImage: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80",
      heroBadge: "Advanced Cosmetic & General Dentistry",
      services: [
        {
          title: "Invisalign & Clear Aligners",
          desc: "Discreet orthodontic alignment with 3D digital smile scans, tailored treatment plans, and comfortable wear.",
          points: ["Complimentary 3D Scans", "Virtually Invisible Aligners", "Flexible 0% Finance Options"]
        },
        {
          title: "Teeth Whitening & Porcelain Veneers",
          desc: "Professional in-clinic whitening and handcrafted porcelain veneers designed for bright, natural smile transformations.",
          points: ["Up to 8 Shades Whiter", "Custom Handcrafted Veneers", "Enamel-Safe Treatments"]
        },
        {
          title: "Gentle General Care & Dental Implants",
          desc: "Anxiety-free hygiene checkups, restorative crowns, and permanent titanium dental implants with lifelong stability.",
          points: ["Pain-Free Sedation Options", "Lifelong Implant Guarantees", "Emergency Appointments"]
        }
      ]
    };
  }

  // Default / Professional Services Preset
  return {
    heroImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    heroBadge: "Top-Rated Local Specialists • Free Fast Estimates",
    services: [
      {
        title: "Comprehensive Consultations & Diagnostics",
        desc: "Thorough on-site evaluation, transparent upfront quotation, and expert recommendations tailored to your goals.",
        points: ["Zero Obligation Estimates", "Same-Day Scheduling Available", "Clear Written Proposals"]
      },
      {
        title: "Precision Execution & Quality Delivery",
        desc: "Industry-standard workmanship carried out by vetted specialists using state-of-the-art tools and materials.",
        points: ["Fully Insured & Vetted Team", "Strict Timelines & Clean Sites", "Premium Grade Materials"]
      },
      {
        title: "Guaranteed Results & Ongoing Support",
        desc: "Dedicated post-service warranties, proactive maintenance, and responsive customer care whenever you need it.",
        points: ["100% Satisfaction Guarantee", "Written Workmanship Warranty", "Direct Line Support"]
      }
    ]
  };
}

// High quality fallback landing page generator in case AI keys are not yet configured or rate limited
export function generateFallbackTemplate(lead: Lead, baseDomain: string): string {
  const businessName = getLeadDisplayName(lead);
  const preset = getNichePreset(lead.category);
  const categoryTitle = cleanCategoryTitle(lead.category);
  const phoneFormatted = lead.phone && !lead.phone.toLowerCase().includes("category") ? lead.phone.trim() : "";
  const emailFormatted = lead.email && !lead.email.toLowerCase().includes("category") ? lead.email.trim() : "";
  const ratingFormatted = lead.gmbRating ? `${lead.gmbRating}/5.0` : "5.0/5.0";

  return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName} | ${categoryTitle} Specialists</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
          }
        }
      }
    }
  </script>
</head>
<body class="bg-[#0B0F19] text-slate-100 font-sans antialiased selection:bg-purple-600 selection:text-white min-h-screen">
  <!-- Top 48-Hour Preview Ribbon -->
  <div class="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 text-xs py-2.5 px-4 text-center font-medium border-b border-purple-500/30 text-white flex flex-wrap items-center justify-center gap-3">
    <span>⚡ <strong>Concept Redesign Preview</strong> for <strong class="text-purple-300">${businessName}</strong> • Active for <strong>48 Hours</strong> to review & request adjustments</span>
    <a href="#client-adjustments" class="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-3.5 py-1 rounded-full text-xs shadow-lg shadow-purple-600/30 transition">
      <span>✏️</span> Request Adjustments
    </a>
  </div>

  <!-- Sticky Header -->
  <header class="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20 text-lg">
          ${businessName.substring(0, 1)}
        </div>
        <div>
          <span class="font-bold text-xl tracking-tight text-white block leading-tight">${businessName}</span>
          <span class="text-xs text-purple-400 font-medium">${categoryTitle}</span>
        </div>
      </div>
      <nav class="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
        <a href="#services" class="hover:text-purple-400 transition">Services</a>
        <a href="#why-us" class="hover:text-purple-400 transition">Why Choose Us</a>
        <a href="#reviews" class="hover:text-purple-400 transition">Reviews</a>
        <a href="#contact" class="hover:text-purple-400 transition">Contact</a>
      </nav>
      <div class="flex items-center space-x-4">
        ${phoneFormatted ? `<a href="tel:${phoneFormatted}" class="text-sm font-semibold text-slate-300 hover:text-white hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl"><svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>${phoneFormatted}</a>` : ""}
        <a href="#contact" class="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-600/30 transition transform hover:-translate-y-0.5">
          Get Free Quote
        </a>
      </div>
    </div>
  </header>

  <!-- Hero Section (Split Layout with High-Resolution Visual) -->
  <section class="relative pt-16 pb-24 overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.18),rgba(255,255,255,0))]"></div>
    <div class="max-w-7xl mx-auto px-6 relative z-10">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <!-- Left: Headline & Actions -->
        <div class="lg:col-span-7 text-left">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-6">
            ★ ${preset.heroBadge}
          </div>
          <h1 class="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Premier <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">${categoryTitle}</span> For ${businessName}
          </h1>
          <p class="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl leading-relaxed">
            Delivering precision craftsmanship, transparent upfront pricing, and guaranteed 5-star customer satisfaction across the entire local area.
          </p>

          <div class="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <a href="#contact" class="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-xl shadow-xl shadow-purple-600/30 transition transform hover:-translate-y-0.5 text-center">
              Request Free Instant Quote
            </a>
            ${phoneFormatted ? `<a href="tel:${phoneFormatted}" class="bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold px-6 py-4 rounded-xl transition text-center flex items-center justify-center gap-2">
              <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              Call ${phoneFormatted}
            </a>` : `<a href="#services" class="bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold px-6 py-4 rounded-xl transition text-center">
              Explore Our Services
            </a>`}
          </div>

          <!-- Trust Badges Row -->
          <div class="mt-8 pt-8 border-t border-slate-800/80 flex flex-wrap items-center gap-6 text-xs text-slate-400 font-medium">
            <div class="flex items-center gap-1.5">
              <span class="flex text-amber-400">★★★★★</span>
              <strong class="text-white">${ratingFormatted}</strong> Google Rating
            </div>
            <div class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              <span>Fully Licensed & Insured</span>
            </div>
            <div class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              <span>Written Workmanship Warranty</span>
            </div>
          </div>
        </div>

        <!-- Right: High-Res Hero Showcase Visual -->
        <div class="lg:col-span-5">
          <div class="relative mx-auto max-w-md lg:max-w-none">
            <div class="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-600 to-indigo-600 opacity-30 blur-xl"></div>
            <div class="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
              <img src="${preset.heroImage}" alt="${businessName}" class="w-full h-80 sm:h-96 object-cover object-center transform hover:scale-105 transition duration-500">
              
              <!-- Floating Overlays -->
              <div class="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl px-3.5 py-2 shadow-xl flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span class="text-xs font-semibold text-white">Same-Day Service Available</span>
              </div>

              <div class="absolute bottom-4 right-4 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-2.5 shadow-xl text-right">
                <div class="text-xs text-purple-400 font-semibold uppercase tracking-wider">Peace of Mind</div>
                <div class="text-sm font-bold text-white">100% Guaranteed Work</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Proof Strip -->
      <div class="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 border border-slate-800/80 rounded-2xl bg-slate-900/40 p-6 backdrop-blur">
        <div>
          <div class="text-3xl font-extrabold text-white">15<span class="text-purple-400">+</span></div>
          <div class="text-xs text-slate-400 mt-1 uppercase font-medium">Years Serving Locals</div>
        </div>
        <div>
          <div class="text-3xl font-extrabold text-white">100<span class="text-purple-400">%</span></div>
          <div class="text-xs text-slate-400 mt-1 uppercase font-medium">Guaranteed Workmanship</div>
        </div>
        <div>
          <div class="text-3xl font-extrabold text-white">&lt;1hr</div>
          <div class="text-xs text-slate-400 mt-1 uppercase font-medium">Rapid Response Time</div>
        </div>
        <div>
          <div class="text-3xl font-extrabold text-white">5.0★</div>
          <div class="text-xs text-slate-400 mt-1 uppercase font-medium">Verified Client Rating</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Featured Services Grid -->
  <section id="services" class="py-24 max-w-7xl mx-auto px-6 border-t border-slate-900">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <span class="text-purple-400 font-semibold text-xs tracking-wider uppercase bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">Core Specialisms</span>
      <h2 class="text-3xl sm:text-4xl font-bold text-white mt-4">Comprehensive Solutions For Your Needs</h2>
      <p class="text-slate-400 mt-3 text-sm sm:text-base">Every project is handled with exacting standards, modern tooling, and full manufacturer-backed warranties.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      ${preset.services.map((svc, i) => `
      <div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 transition duration-300 flex flex-col justify-between group ${i === 1 ? 'relative ring-1 ring-purple-500/40' : ''}">
        ${i === 1 ? '<span class="absolute -top-3 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-lg">Most Requested</span>' : ''}
        <div>
          <div class="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xl mb-6 group-hover:scale-110 transition duration-300">
            ${i === 0 ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' : (i === 1 ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>' : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>')}
          </div>
          <h3 class="text-xl font-bold text-white mb-3">${svc.title}</h3>
          <p class="text-slate-400 text-sm leading-relaxed mb-6">${svc.desc}</p>
          <ul class="space-y-2.5 mb-8">
            ${svc.points.map(pt => `
            <li class="flex items-center gap-2.5 text-xs text-slate-300">
              <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              <span>${pt}</span>
            </li>`).join("")}
          </ul>
        </div>
        <a href="#contact" class="inline-flex items-center gap-2 text-sm font-semibold text-purple-400 group-hover:text-purple-300 transition">
          Inquire About This Service <span>&rarr;</span>
        </a>
      </div>`).join("")}
    </div>
  </section>

  <!-- Why Choose Us Section -->
  <section id="why-us" class="py-20 bg-slate-900/40 border-t border-slate-800">
    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <span class="text-purple-400 font-semibold text-xs tracking-wider uppercase bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">The ${businessName} Standard</span>
        <h2 class="text-3xl sm:text-4xl font-bold text-white mt-4">Why Local Clients Trust Our Team</h2>
        <p class="text-slate-400 mt-3 text-sm sm:text-base">We combine responsive communication with certified mastery to ensure your project is completed flawlessly.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="p-8 rounded-2xl bg-slate-950 border border-slate-800">
          <div class="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xl mb-6">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">Transparent Upfront Pricing</h3>
          <p class="text-slate-400 text-sm leading-relaxed">No surprise invoices or hidden callout charges. You receive a clear, fixed estimate before any work commences.</p>
        </div>

        <div class="p-8 rounded-2xl bg-slate-950 border border-slate-800">
          <div class="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xl mb-6">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">Vetted & Qualified Specialists</h3>
          <p class="text-slate-400 text-sm leading-relaxed">Every installation is carried out by vetted professionals equipped with precision diagnostic instrumentation.</p>
        </div>

        <div class="p-8 rounded-2xl bg-slate-950 border border-slate-800">
          <div class="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center font-bold text-xl mb-6">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z"/></svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">Written Workmanship Guarantee</h3>
          <p class="text-slate-400 text-sm leading-relaxed">Full peace of mind backed by comprehensive warranties on all parts and labour. If anything isn't right, we fix it.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Verified 5-Star Customer Reviews -->
  <section id="reviews" class="py-24 max-w-7xl mx-auto px-6">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <span class="text-purple-400 font-semibold text-xs tracking-wider uppercase bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">Client Testimonials</span>
      <h2 class="text-3xl sm:text-4xl font-bold text-white mt-4">Verified 5-Star Customer Feedback</h2>
      <p class="text-slate-400 mt-3 text-sm sm:text-base">Real experiences from local homeowners and businesses who rely on our services.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div class="flex items-center gap-1 text-amber-400 mb-4">
          ★★★★★
        </div>
        <p class="text-slate-300 text-sm leading-relaxed mb-6">"Arrived exactly on schedule, diagnosed the issue within 10 minutes, and completed the job cleanly. Outstanding workmanship and honest pricing."</p>
        <div class="flex items-center justify-between pt-4 border-t border-slate-800">
          <div>
            <div class="text-sm font-bold text-white">Mark H.</div>
            <div class="text-xs text-slate-500">Verified Local Customer</div>
          </div>
          <span class="text-[11px] text-emerald-400 font-medium">✓ Google Review</span>
        </div>
      </div>

      <div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div class="flex items-center gap-1 text-amber-400 mb-4">
          ★★★★★
        </div>
        <p class="text-slate-300 text-sm leading-relaxed mb-6">"Fast, courteous, and incredibly knowledgeable. The difference in quality was immediate. Would not hesitate to recommend to friends and family."</p>
        <div class="flex items-center justify-between pt-4 border-t border-slate-800">
          <div>
            <div class="text-sm font-bold text-white">David & Sarah T.</div>
            <div class="text-xs text-slate-500">Verified Local Customer</div>
          </div>
          <span class="text-[11px] text-emerald-400 font-medium">✓ Google Review</span>
        </div>
      </div>

      <div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div class="flex items-center gap-1 text-amber-400 mb-4">
          ★★★★★
        </div>
        <p class="text-slate-300 text-sm leading-relaxed mb-6">"Professional from initial phone call to finished install. Cleaned up thoroughly after the work and explained everything in detail. 10/10."</p>
        <div class="flex items-center justify-between pt-4 border-t border-slate-800">
          <div>
            <div class="text-sm font-bold text-white">James R.</div>
            <div class="text-xs text-slate-500">Verified Local Customer</div>
          </div>
          <span class="text-[11px] text-emerald-400 font-medium">✓ Google Review</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Contact & Action Section -->
  <section id="contact" class="py-20 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800">
    <div class="max-w-4xl mx-auto px-6 text-center">
      <h2 class="text-3xl sm:text-5xl font-extrabold text-white">Connect With ${businessName} Today</h2>
      <p class="text-slate-400 mt-4 text-base sm:text-lg">Contact our friendly team today for prompt scheduling and no-obligation estimates.</p>
      
      <div class="mt-8 flex flex-wrap justify-center gap-6 text-slate-300 text-sm">
        ${phoneFormatted ? `<div><strong>Phone:</strong> <a href="tel:${phoneFormatted}" class="text-purple-400 hover:underline font-semibold">${phoneFormatted}</a></div>` : ""}
        ${emailFormatted ? `<div><strong>Email:</strong> <a href="mailto:${emailFormatted}" class="text-purple-400 hover:underline font-semibold">${emailFormatted}</a></div>` : ""}
        <div><strong>Hours:</strong> Mon - Sat: 8:00 AM - 6:00 PM</div>
      </div>

      <div class="mt-12 p-8 rounded-2xl bg-slate-900/80 border border-slate-800 text-left max-w-lg mx-auto shadow-2xl">
        <form onsubmit="event.preventDefault(); alert('Inquiry received! This is a live demonstration preview.');">
          <div class="mb-4">
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Your Name</label>
            <input type="text" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="Jane Doe">
          </div>
          <div class="mb-4">
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone or Email Address</label>
            <input type="text" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="jane@example.com / 07123456789">
          </div>
          <div class="mb-6">
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Service Needed</label>
            <input type="text" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="e.g. ${preset.services[0].title}">
          </div>
          <button type="submit" class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold py-3.5 rounded-xl text-white text-sm transition shadow-lg shadow-purple-600/30">
            Submit Free Quote Request
          </button>
        </form>
      </div>
    </div>
  </section>

  <!-- Client Review Period & Adjustment Request Section -->
  <section id="client-adjustments" class="py-20 bg-slate-900/90 border-t border-purple-500/30 relative">
    <div class="max-w-3xl mx-auto px-6 text-center">
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-4">
        ⏱ 48-Hour Client Review Period Active
      </div>
      <h2 class="text-3xl sm:text-4xl font-extrabold text-white">Request Adjustments For Your Final Website</h2>
      <p class="text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
        We built this interactive demonstration to show the speed, layout, and conversion potential for <strong>${businessName}</strong>. 
        Have adjustments to text, services, colors, or images before we build your official live site? Submit your notes below.
      </p>

      <div class="mt-10 p-6 sm:p-8 rounded-2xl bg-slate-950 border border-slate-800 text-left shadow-2xl">
        <form id="adjustment-form" onsubmit="handleAdjustmentSubmit(event)">
          <div class="mb-5">
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Your Name & Role</label>
            <input type="text" id="adj-name" required class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="e.g. Sarah Mitchell, Director">
          </div>
          <div class="mb-5">
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Requested Adjustments & Notes</label>
            <textarea id="adj-notes" rows="4" required class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="e.g. Please update our phone number, add an emergency callout section, feature our warranty guarantee, tweak colors to our brand blue..."></textarea>
          </div>
          <button type="submit" id="adj-btn" class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold py-3.5 rounded-xl text-white text-sm shadow-lg shadow-purple-600/30 transition">
            Send Adjustments to Design Team
          </button>
          <div id="adj-alert" class="mt-4 p-4 rounded-xl text-xs font-medium text-center hidden"></div>
        </form>
      </div>
    </div>
  </section>

  <script>
    async function handleAdjustmentSubmit(e) {
      e.preventDefault();
      var btn = document.getElementById('adj-btn');
      var alertBox = document.getElementById('adj-alert');
      var name = document.getElementById('adj-name').value;
      var notes = document.getElementById('adj-notes').value;

      btn.disabled = true;
      btn.innerText = 'Submitting Adjustments...';

      try {
        var res = await fetch('/api/leads/${lead.id}/demo-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, notes: notes })
        });
        var data = await res.json();
        if (data.success) {
          alertBox.className = 'mt-4 p-4 rounded-xl text-xs font-medium text-center bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 block';
          alertBox.innerText = '✓ Thank you! Your adjustments have been submitted directly to our design team. We will apply them to your final production website.';
          document.getElementById('adjustment-form').reset();
        } else {
          throw new Error(data.error || 'Submission failed');
        }
      } catch (err) {
        alertBox.className = 'mt-4 p-4 rounded-xl text-xs font-medium text-center bg-red-500/10 border border-red-500/30 text-red-300 block';
        alertBox.innerText = 'Error: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.innerText = 'Send Adjustments to Design Team';
      }
    }
  </script>

  <!-- Footer -->
  <footer class="border-t border-slate-900 py-10 text-center text-slate-500 text-xs">
    <div class="max-w-7xl mx-auto px-6">
      <p>&copy; ${new Date().getFullYear()} ${businessName}. Concept Redesign Preview by Mode Webhost & Digital Creations.</p>
    </div>
  </footer>
</body>
</html>`;
}

export async function generateWebsiteHtml(lead: Lead, settings: Settings): Promise<string> {
  const provider = settings.aiProvider || "claude";
  const baseDomain = (settings.baseDomain || "demo.modedigicreations.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^(\**\.?)*\//, "")
    .replace(/[*]/g, "")
    .trim();

  const businessName = getLeadDisplayName(lead);
  const preset = getNichePreset(lead.category);
  const nicheCategory = cleanCategoryTitle(lead.category);
  const phoneFormatted = lead.phone && !lead.phone.toLowerCase().includes("category") ? lead.phone.trim() : "N/A";
  const emailFormatted = lead.email && !lead.email.toLowerCase().includes("category") ? lead.email.trim() : "N/A";

  const leadContext = `
Business Name: ${businessName}
Category / Niche: ${nicheCategory}
Current Website: ${lead.website || "None"}
Phone Number: ${phoneFormatted}
Email Address: ${emailFormatted}
Customer Rating: ${lead.gmbRating ? `${lead.gmbRating}/5.0` : "4.9/5.0"}
Crawled Business Details / Offerings:
${lead.crawledText ? lead.crawledText.slice(0, 1500) : "Tailor specifically to this trade and business name."}

High-Resolution Unsplash Image Suggestions For This Niche:
- Hero Showcase Image: ${preset.heroImage}
- Industry Niche Theme: ${preset.heroBadge}
`.trim();

  const defaultSystemPrompt = `You are an award-winning senior creative director and conversion rate optimization (CRO) web architect.
Your mission is to generate a breathtaking, ultra-modern, high-converting, mobile-responsive single-page website for the specified business.

CRITICAL DESIGN & VISUAL AESTHETIC DIRECTIVES:
1. LUXURY MODERN AESTHETIC (The "WOW" Factor):
   - Use Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>) with Google Fonts "Plus Jakarta Sans" or "Outfit".
   - Use a sleek, high-contrast palette: deep slate/zinc background (e.g. bg-[#0B0F19] or bg-slate-950), crisp white headings, subtle borders (border-slate-800 or border-white/10), and vibrant brand accents (e.g. indigo/purple, electric blue, amber/gold for trades, or emerald/cyan).
   - Use modern glassmorphism (backdrop-blur-md bg-slate-900/60) and subtle hover elevations (hover:-translate-y-1 transition duration-300).
   - Use crisp inline SVGs (heroicons/lucide style for checkmarks, stars, phone, shield, clock, location, and services) instead of plain emojis or character symbols.
   - Avoid generic, plain flat Bootstrap-style layouts or washed-out gray boxes.

2. AUTHENTIC BUSINESS COPYWRITING (NOT AN AUDIT REPORT):
   - The website MUST be written directly to the business's real prospective customers (homeowners, clients, patients).
   - Headline MUST be compelling and niche-specific (e.g., "Premier TV Aerial & Satellite Installations In [Area]" or "Trusted Local Roofing Specialists").
   - NEVER create sections talking about "SEO audit weaknesses", "PageSpeed fixes", or "bugs resolved". The website proves its superiority naturally through blazing speed, clean design, and effortless UX.

3. REALISTIC HIGH-RESOLUTION IMAGERY:
   - Include 2 to 4 high-resolution, industry-relevant Unsplash photos (using the provided Unsplash URLs or https://images.unsplash.com/... with auto=format&fit=crop&w=800&q=80 or w=1200&q=80) for:
     a) Hero visual (e.g. split-screen hero showcase card with subtle glow, or hero background with dark gradient overlay)
     b) Featured services or showcase gallery cards
   - Select photos that authentically represent their trade or industry.

4. CORE SECTION ARCHITECTURE (Strictly 7-8 focused, high-impact sections):
   1. Sticky Header: Brand initial badge, Business name, navigation links (Services, Why Us, Reviews, Contact), click-to-call phone button, and high-visibility "Get Free Quote" CTA button.
   2. High-Impact Hero:
      - Category trust pill (e.g. "★ Top-Rated Local Specialists • Free Fast Estimates").
      - Clear, benefit-driven headline & 2-sentence value proposition.
      - Dual CTAs: Primary [Request Free Quote] + Secondary [Call Now or Browse Services].
      - Split visual with high-res niche photo & floating trust badge (e.g. "✓ Same-Day Service Available").
      - Quick Proof Row: 4 key metrics (e.g. 5.0 Google Rating with 5 gold stars, 15+ Years Experience, 100% Guaranteed Workmanship, Fast Local Response).
   3. Featured Services Grid (3-4 focused cards):
      - Clean modern SVG icon or image thumbnail for each service.
      - Specific, realistic service titles (tailored to their actual business).
      - 3 bullet points with checkmark SVGs and a "Get Quote" link.
      - Highlight one card as "Most Popular" or "Featured".
   4. Why Choose Us / Advantage (3 Pillars):
      - Upfront transparent pricing, certified & vetted technicians, written guarantee.
   5. Verified 5-Star Reviews (2-3 realistic testimonials):
      - Real reviewer names, verified customer badges, 5 gold star icons, and authentic glowing feedback.
   6. Fast Quote & Contact Section:
      - Direct contact details: Phone (clickable tel:), Email (clickable mailto:), opening hours, and service area.
      - Interactive modern quote inquiry form (Name, Phone, Service, Message, Submit button).
   7. Client 48-Hour Review Period Section (#client-adjustments):
      - Dedicated block explaining this is an interactive 48-hour live preview concept for the client to review, with an adjustment submission form so they can request changes to text, services, or imagery before the final build.
   8. Footer:
      - Clean brand signature, copyright, and subtle concept watermark.

5. OUTPUT INTEGRITY:
   - Output ONLY raw, complete HTML5 starting with <!DOCTYPE html> and ending with </html>.
   - Do NOT wrap in markdown code blocks (\`\`\`html). No introductory or concluding conversational text.
   - All elements and tags MUST be properly closed. Ensure the document finishes completely before </body></html>.`;

  let systemPrompt = defaultSystemPrompt;
  if (settings.websitePromptTemplate && settings.websitePromptTemplate.trim()) {
    const rawTemplate = settings.websitePromptTemplate.trim();
    const isLegacyOldPrompt = rawTemplate.includes("fixes their previous website issues") || 
                              rawTemplate.includes("audit fixes proof section") ||
                              rawTemplate.includes("4. \"Modern Web & Mobile Experience\" badge/section");
    if (!isLegacyOldPrompt) {
      systemPrompt = rawTemplate;
    }
  }

  const userPrompt = `
CRITICAL DIRECTIVE: You MUST generate a COMPLETE, FULLY FUNCTIONAL, MULTI-SECTION HTML5 LANDING PAGE for this business.
DO NOT output a summary, DO NOT output recommendations, DO NOT output a list of WordPress plugins, and DO NOT output conversational text.
Your entire response must be RAW, RENDERABLE HTML5 starting immediately with <!DOCTYPE html> and ending with </html>.

Business Details:
Business Name: ${businessName}
Industry / Niche: ${nicheCategory}
Phone Number: ${phoneFormatted}
Email Address: ${emailFormatted}
Customer Rating: ${lead.gmbRating ? `${lead.gmbRating}/5.0` : "4.9/5.0"}
Hero Image: ${preset.heroImage}

MANDATORY SECTIONS (All 8 sections must be fully written in HTML using Tailwind CSS):
1. STICKY HEADER: Logo mark, business name (${businessName}), navigation links (Services, Why Us, Reviews, Contact), click-to-call phone pill (${phoneFormatted}), and "Get Free Quote" CTA button.
2. HERO SECTION: Split layout. Left: niche badge pill, bold headline, 2-sentence value proposition, dual CTA buttons (Get Free Quote & Call Now), and 4 trust indicators. Right: Hero showcase card with <img src="${preset.heroImage}" alt="${businessName}" class="rounded-2xl shadow-2xl ..."> and floating trust badges.
3. STATS BAR: 4 verified metrics (15+ Years Experience, 100% Guaranteed Workmanship, 5.0★ Rating, <1hr Rapid Response).
4. FEATURED SERVICES: 3-4 rich cards tailored to ${nicheCategory} with titles, descriptions, checkmark bullet points, and "Inquire" links.
5. WHY CHOOSE US: 3 value pillars (Transparent Upfront Pricing, Certified Specialists, Written Warranty).
6. 5-STAR REVIEWS: 3 verified customer feedback cards with 5 gold stars and reviewer names.
7. CONTACT & ESTIMATE FORM: Direct phone (${phoneFormatted}), email (${emailFormatted}), hours, and an interactive quote request form.
8. CLIENT 48-HOUR REVIEW SECTION: <section id="client-adjustments"> with notes form for client adjustments.
9. FOOTER: Clean brand footer with copyright ${new Date().getFullYear()} ${businessName}.

Output ONLY valid, complete HTML starting with <!DOCTYPE html> and ending with </html>.
  `.trim();

  // Try AI generation
  if (provider === "gemini") {
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[Website Builder] Gemini API key not provided. Using responsive fallback template.");
      return generateFallbackTemplate(lead, baseDomain);
    }

    try {
      const cleanKey = apiKey.trim();
      const genAI = new GoogleGenerativeAI(cleanKey);
      const requestedModel = settings.geminiModel || "gemini-2.5-flash";
      const candidateModels = Array.from(new Set([
        requestedModel,
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-3.8-flash",
        "gemini-3.6-flash"
      ]));

      for (const mName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({
            model: mName,
            systemInstruction: systemPrompt
          });
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              maxOutputTokens: 8192,
              temperature: 0.7
            }
          });
          const text = result?.response?.text();
          if (text) {
            const sanitized = sanitizeHtmlOutput(text);
            if (sanitized && isValidWebsiteHtml(sanitized)) {
              return sanitized;
            }
          }
        } catch (mErr: any) {
          console.warn(`[Website Builder] Model ${mName} attempt failed: ${mErr.message}. Trying next candidate...`);
        }
      }

      return generateFallbackTemplate(lead, baseDomain);
    } catch (err: any) {
      console.error("[Website Builder] Gemini generation error:", err.message);
      return generateFallbackTemplate(lead, baseDomain);
    }
  } else if (provider === "openai") {
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[Website Builder] OpenAI API key not provided. Using responsive fallback template.");
      return generateFallbackTemplate(lead, baseDomain);
    }

    try {
      const modelName = settings.openaiModel || "gpt-4o";
      const isReasoning = modelName.startsWith("o1") || modelName.startsWith("o3");

      const messages: any[] = isReasoning
        ? [{ role: "user", content: `${systemPrompt}\n\n${userPrompt}` }]
        : [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ];

      const payload: any = {
        model: modelName,
        messages
      };

      if (isReasoning) {
        payload.max_completion_tokens = 8192;
      } else {
        payload.max_tokens = 8192;
        payload.temperature = 0.7;
      }

      const response = await axios.post("https://api.openai.com/v1/chat/completions", payload, {
        headers: {
          "Authorization": `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        timeout: 60000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        const sanitized = sanitizeHtmlOutput(response.data.choices[0].message.content);
        if (sanitized && isValidWebsiteHtml(sanitized)) {
          return sanitized;
        }
      }
      return generateFallbackTemplate(lead, baseDomain);
    } catch (err: any) {
      console.error("[Website Builder] OpenAI generation error:", err.response?.data?.error?.message || err.message);
      return generateFallbackTemplate(lead, baseDomain);
    }
  } else if (provider === "deepseek") {
    const apiKey = settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.warn("[Website Builder] DeepSeek API key not provided. Using responsive fallback template.");
      return generateFallbackTemplate(lead, baseDomain);
    }

    try {
      const modelName = settings.deepseekModel || "deepseek-chat";
      const isReasoner = modelName === "deepseek-reasoner";

      const response = await axios.post("https://api.deepseek.com/chat/completions", {
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 8000,
        ...(isReasoner ? {} : { temperature: 0.7 })
      }, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 60000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        const sanitized = sanitizeHtmlOutput(response.data.choices[0].message.content);
        if (sanitized && isValidWebsiteHtml(sanitized)) {
          return sanitized;
        }
      }
      return generateFallbackTemplate(lead, baseDomain);
    } catch (err: any) {
      console.error("[Website Builder] DeepSeek generation error:", err.message);
      return generateFallbackTemplate(lead, baseDomain);
    }
  } else {
    // Claude
    const apiKey = settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[Website Builder] Anthropic API key not provided. Using responsive fallback template.");
      return generateFallbackTemplate(lead, baseDomain);
    }

    try {
      const workspaceId = settings.anthropicWorkspaceId?.trim();
      const anthropic = new Anthropic({ 
        apiKey,
        defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined
      });
      const requestOptions = workspaceId ? { headers: { "anthropic-workspace-id": workspaceId } } : undefined;
      const requestedModel = settings.anthropicModel || "claude-haiku-4-5-20251001";
      const candidateModels = Array.from(new Set([
        requestedModel,
        "claude-haiku-4-5-20251001",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-haiku-20240307",
        "claude-3-7-sonnet-20250219"
      ]));

      for (const mName of candidateModels) {
        try {
          const message = await anthropic.messages.create({
            model: mName,
            max_tokens: 8192,
            temperature: 0.7,
            system: systemPrompt,
            messages: [
              { role: "user", content: userPrompt }
            ]
          }, requestOptions);

          const content = message.content[0];
          if (content.type === "text") {
            const sanitized = sanitizeHtmlOutput(content.text);
            if (sanitized && isValidWebsiteHtml(sanitized)) {
              return sanitized;
            }
          }
        } catch (mErr: any) {
          console.warn(`[Website Builder] Claude model ${mName} attempt failed: ${mErr.message}. Trying next candidate...`);
        }
      }
      return generateFallbackTemplate(lead, baseDomain);
    } catch (err: any) {
      console.error("[Website Builder] Claude generation error:", err.message);
      return generateFallbackTemplate(lead, baseDomain);
    }
  }
}
