import { Anthropic } from '@anthropic-ai/sdk';
import axios from 'axios';
import { Lead, Settings } from './db.js';

export function sanitizeHtmlOutput(raw: string): string {
  let cleaned = raw.trim();

  // 1. Try to extract complete HTML document if embedded in text
  const docMatch = cleaned.match(/(<!DOCTYPE\s+html[\s\S]*?<\/html>)/i) ||
                   cleaned.match(/(<html[\s\S]*?<\/html>)/i);
  if (docMatch) {
    return docMatch[1].trim();
  }

  // 2. Try to extract inside markdown code blocks
  const codeBlockMatch = cleaned.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    // Strip leading/trailing code fences if present
    cleaned = cleaned.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');
  }

  cleaned = cleaned.trim();

  // 3. Fallback: Wrap in valid HTML5 structure if fragment
  if (!cleaned.toLowerCase().includes('<!doctype html') && !cleaned.toLowerCase().includes('<html')) {
    cleaned = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Modern Redesign Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen">
  ${cleaned}
</body>
</html>`;
  }

  return cleaned;
}

// High quality fallback landing page generator in case AI keys are not yet configured or rate limited
export function generateFallbackTemplate(lead: Lead, baseDomain: string): string {
  const issuesList = (lead.seoIssues && lead.seoIssues.length > 0)
    ? lead.seoIssues.map(iss => `<span class="inline-block bg-red-500/10 border border-red-500/20 text-red-300 text-xs px-3 py-1 rounded-full mr-2 mb-2 font-medium">✓ Resolved: ${iss}</span>`).join('')
    : '<span class="inline-block bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full mr-2 mb-2 font-medium">✓ 100/100 Mobile Speed & SEO Optimized</span>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${lead.name} | Modern Experience & Services</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Outfit', 'sans-serif'],
          }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans antialiased selection:bg-purple-600 selection:text-white">
  <!-- Top Notification Ribbon -->
  <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 text-xs py-2 px-4 text-center font-medium border-b border-purple-500/20">
    ⚡ Concept Redesign Preview prepared specifically for <strong class="text-purple-300">${lead.name}</strong> • Ultra-Fast, Mobile-First UX
  </div>

  <!-- Header / Navigation -->
  <header class="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
          ${lead.name.substring(0, 1)}
        </div>
        <div>
          <span class="font-bold text-xl tracking-tight text-white block leading-tight">${lead.name}</span>
          <span class="text-xs text-purple-400 font-medium">${lead.category || 'Professional Services'}</span>
        </div>
      </div>
      <nav class="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
        <a href="#services" class="hover:text-purple-400 transition">Services</a>
        <a href="#audit-fixes" class="hover:text-purple-400 transition">Performance Upgrades</a>
        <a href="#reviews" class="hover:text-purple-400 transition">Testimonials</a>
        <a href="#contact" class="hover:text-purple-400 transition">Contact</a>
      </nav>
      <div class="flex items-center space-x-4">
        ${lead.phone ? `<a href="tel:${lead.phone}" class="text-sm font-semibold text-slate-300 hover:text-white hidden sm:block">${lead.phone}</a>` : ''}
        <a href="#contact" class="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-600/30 transition transform hover:-translate-y-0.5">
          Get Started
        </a>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="relative pt-20 pb-24 overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]"></div>
    <div class="max-w-7xl mx-auto px-6 relative z-10 text-center">
      <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-8">
        ★ Premium Client Demo Concept
      </div>
      <h1 class="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
        Elevating Customer Experience For <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">${lead.name}</span>
      </h1>
      <p class="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
        Engineered for rapid loading, seamless mobile booking, and 5-star customer conversions. Built to outrank competitors and drive direct inquiries.
      </p>

      <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href="#contact" class="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 py-4 rounded-xl shadow-xl shadow-purple-600/30 transition transform hover:-translate-y-0.5 text-center">
          Schedule An Appointment
        </a>
        <a href="#audit-fixes" class="w-full sm:w-auto bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold px-8 py-4 rounded-xl transition text-center">
          View Performance Upgrades
        </a>
      </div>

      <!-- Quick Metrics Proof -->
      <div class="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto border border-slate-800/80 rounded-2xl bg-slate-900/40 p-6 backdrop-blur">
        <div>
          <div class="text-3xl font-extrabold text-white">99<span class="text-purple-400">+</span></div>
          <div class="text-xs text-slate-400 mt-1 uppercase font-medium">PageSpeed Score</div>
        </div>
        <div>
          <div class="text-3xl font-extrabold text-white">${lead.gmbRating ? `${lead.gmbRating}/5` : '5.0★'}</div>
          <div class="text-xs text-slate-400 mt-1 uppercase font-medium">Customer Rating</div>
        </div>
        <div>
          <div class="text-3xl font-extrabold text-white">&lt;0.8s</div>
          <div class="text-xs text-slate-400 mt-1 uppercase font-medium">Instant Load Time</div>
        </div>
        <div>
          <div class="text-3xl font-extrabold text-white">100%</div>
          <div class="text-xs text-slate-400 mt-1 uppercase font-medium">Mobile Responsive</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Performance & Issue Fixes Section -->
  <section id="audit-fixes" class="py-20 bg-slate-900/50 border-t border-slate-800">
    <div class="max-w-7xl mx-auto px-6">
      <div class="max-w-3xl mb-12">
        <span class="text-purple-400 font-semibold text-sm tracking-wider uppercase">Key Enhancements</span>
        <h2 class="text-3xl sm:text-4xl font-bold text-white mt-2">Engineered To Outperform Current Standards</h2>
        <p class="text-slate-400 mt-3 text-base">Here are the specific technical bottlenecks this redesign proactively rectifies:</p>
      </div>

      <div class="p-6 rounded-2xl bg-slate-950 border border-slate-800">
        <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Resolved Audit Weaknesses:</h3>
        <div class="flex flex-wrap">
          ${issuesList}
        </div>
      </div>
    </div>
  </section>

  <!-- Services / Features Grid -->
  <section id="services" class="py-24 max-w-7xl mx-auto px-6">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <span class="text-purple-400 font-semibold text-sm tracking-wider uppercase">What We Deliver</span>
      <h2 class="text-3xl sm:text-4xl font-bold text-white mt-2">Comprehensive Solutions For Your Needs</h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 transition">
        <div class="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xl mb-6">
          ✦
        </div>
        <h3 class="text-xl font-bold text-white mb-3">Priority Service & Quality</h3>
        <p class="text-slate-400 text-sm leading-relaxed">Dedicated attention to ensure every client receives personalized care, precise outcomes, and industry-leading standards.</p>
      </div>

      <div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 transition">
        <div class="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xl mb-6">
          ⚡
        </div>
        <h3 class="text-xl font-bold text-white mb-3">Instant Booking & Inquiries</h3>
        <p class="text-slate-400 text-sm leading-relaxed">Frictionless digital touchpoints that make scheduling consultations effortless across all smartphones and tablets.</p>
      </div>

      <div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 transition">
        <div class="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center font-bold text-xl mb-6">
          ★
        </div>
        <h3 class="text-xl font-bold text-white mb-3">Proven Local Trust</h3>
        <p class="text-slate-400 text-sm leading-relaxed">Consistently backed by outstanding verified reviews and community recommendations.</p>
      </div>
    </div>
  </section>

  <!-- Contact & Action Section -->
  <section id="contact" class="py-20 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800">
    <div class="max-w-4xl mx-auto px-6 text-center">
      <h2 class="text-3xl sm:text-5xl font-extrabold text-white">Connect With ${lead.name} Today</h2>
      <p class="text-slate-400 mt-4 text-lg">We are here to provide tailored solutions and exceed your expectations.</p>
      
      <div class="mt-8 flex flex-wrap justify-center gap-6 text-slate-300 text-sm">
        ${lead.phone ? `<div><strong>Phone:</strong> <a href="tel:${lead.phone}" class="text-purple-400 hover:underline">${lead.phone}</a></div>` : ''}
        ${lead.email ? `<div><strong>Email:</strong> <a href="mailto:${lead.email}" class="text-purple-400 hover:underline">${lead.email}</a></div>` : ''}
      </div>

      <div class="mt-12 p-8 rounded-2xl bg-slate-900/80 border border-slate-800 text-left max-w-lg mx-auto shadow-2xl">
        <form onsubmit="event.preventDefault(); alert('Inquiry received! This is a live demonstration preview.');">
          <div class="mb-4">
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Your Name</label>
            <input type="text" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="Jane Doe">
          </div>
          <div class="mb-4">
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <input type="email" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="jane@example.com">
          </div>
          <div class="mb-6">
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Message or Service Request</label>
            <textarea rows="3" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="How can we assist you?"></textarea>
          </div>
          <button type="submit" class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold py-3.5 rounded-xl text-white text-sm transition">
            Send Inquiry
          </button>
        </form>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-slate-900 py-10 text-center text-slate-500 text-xs">
    <div class="max-w-7xl mx-auto px-6">
      <p>&copy; ${new Date().getFullYear()} ${lead.name}. Concept Redesign Preview by Mode Webhost & Digital Creations.</p>
    </div>
  </footer>
</body>
</html>`;
}

export async function generateWebsiteHtml(lead: Lead, settings: Settings): Promise<string> {
  const provider = settings.aiProvider || 'claude';
  const baseDomain = settings.baseDomain || 'demo.modedigicreations.com';

  const leadContext = `
Business Name: ${lead.name}
Category/Niche: ${lead.category || 'Local Business'}
Current Website: ${lead.website || 'None'}
Phone Number: ${lead.phone || 'N/A'}
Google Review Rating: ${lead.gmbRating ? `${lead.gmbRating}/5.0` : '4.9/5.0'}
Known Technical / SEO / Performance Weaknesses to Solve: ${lead.seoIssues && lead.seoIssues.length > 0 ? lead.seoIssues.join(', ') : 'Slow load speed, outdated mobile layout, weak call-to-action'}
Crawled Business Details / Offerings:
${lead.crawledText || 'No existing website crawled. Tailor directly to the business name and niche.'}
  `.trim();

  const systemPrompt = settings.websitePromptTemplate || `You are an elite web designer and conversion optimization engineer.
Build a stunning, modern, high-converting, mobile-responsive single-page website for this business.
Output ONLY raw, complete HTML5 code with Tailwind CSS CDN and Google Fonts. Do not include markdown code fences or conversational text.`;

  const userPrompt = `
Here is the business information:
${leadContext}

Generate a complete, ready-to-render, production-grade landing page HTML for this business. 
Address the specific weaknesses highlighted in their audit. Make it look extremely modern, trustworthy, and conversion-optimized.
Output ONLY valid HTML starting with <!DOCTYPE html> and ending with </html>.
  `.trim();

  // Try AI generation
  if (provider === 'deepseek') {
    const apiKey = settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.warn('[Website Builder] DeepSeek API key not provided. Using responsive fallback template.');
      return generateFallbackTemplate(lead, baseDomain);
    }

    try {
      const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 3500,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return sanitizeHtmlOutput(response.data.choices[0].message.content);
      }
      return generateFallbackTemplate(lead, baseDomain);
    } catch (err: any) {
      console.error('[Website Builder] DeepSeek generation error:', err.message);
      return generateFallbackTemplate(lead, baseDomain);
    }
  } else {
    // Claude
    const apiKey = settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('[Website Builder] Anthropic API key not provided. Using responsive fallback template.');
      return generateFallbackTemplate(lead, baseDomain);
    }

    try {
      const anthropic = new Anthropic({ apiKey });
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3500,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        return sanitizeHtmlOutput(content.text);
      }
      return generateFallbackTemplate(lead, baseDomain);
    } catch (err: any) {
      console.error('[Website Builder] Claude generation error:', err.message);
      return generateFallbackTemplate(lead, baseDomain);
    }
  }
}
