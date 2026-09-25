import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { Lead, Settings } from './db.js';
import { generateFallbackWhatsAppPitch } from './whatsapp.js';

export async function generateColdEmail(lead: Lead, settings: Settings): Promise<string> {
  const provider = settings.aiProvider || 'claude';
  
  const demoLinkText = lead.demoSiteUrl 
    ? `Live Custom Demo Website Built For Them: ${lead.demoSiteUrl}` 
    : 'Live Custom Demo Website Built For Them: N/A';

  const leadContext = `
Business Name: ${lead.name}
Category/Niche: ${lead.category || 'N/A'}
Current Website: ${lead.website || 'N/A'}
Phone: ${lead.phone || 'N/A'}
SEO Score: ${lead.seoScore ? `${lead.seoScore}/100` : 'N/A'}
Google Business Rating: ${lead.gmbRating ? `${lead.gmbRating}/5` : 'N/A'}
Identified SEO/Listing Issues: ${lead.seoIssues && lead.seoIssues.length > 0 ? lead.seoIssues.join(', ') : 'None specified'}
Website Crawled Text: ${lead.crawledText || 'No website content crawled'}
${demoLinkText}
  `.trim();

  const prompt = `
System Prompt: ${settings.systemPrompt}

Here is the lead's business information:
${leadContext}

Here is your (the sender's) contact details and email signature to conclude the email:
${settings.emailSignature || 'N/A'}

Please compose a highly personalized cold email tailored to this business.
CRITICAL: If a live demo website link is provided (${lead.demoSiteUrl || 'N/A'}), enthusiastically present this link in the email! Explain that we went ahead and designed a modern, fast, mobile-responsive preview tailored specifically to their business to show them how their online presence and conversion rate can be transformed.
Reference their specific audit issues (e.g. speed, mobile layout, SEO score, ratings) and show how the demo solves them.
Keep the email under 150 words, conversational, respectful, and close with a low-friction question inviting them to review their live preview link.

Conclude the email using the provided contact details and email signature. Do not output any placeholders or brackets.
  `.trim();

  if (provider === 'gemini') {
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Google Gemini API key is not configured. Please set it in Settings.');
    }

    try {
      const cleanKey = apiKey.trim();
      const genAI = new GoogleGenerativeAI(cleanKey);
      const requestedModel = settings.geminiModel || 'gemini-3.8-flash';
      const candidateModels = Array.from(new Set([
        requestedModel,
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash'
      ]));

      let lastError: any = null;
      for (const mName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({
            model: mName,
            systemInstruction: settings.systemPrompt
          });
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 1500,
              temperature: 0.7
            }
          });
          const text = result?.response?.text();
          if (text) {
            return text.trim();
          }
        } catch (mErr: any) {
          lastError = mErr;
          console.warn(`[Composer] Gemini model ${mName} attempt failed: ${mErr.message}. Trying next candidate...`);
        }
      }

      throw lastError || new Error('Unexpected empty response from Google Gemini API');
    } catch (error: any) {
      console.error('Gemini email generation failed:', error.message);
      throw new Error(`Gemini API Error: ${error.message}`);
    }
  } else if (provider === 'openai') {
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('ChatGPT / OpenAI API key is not configured. Please set it in Settings.');
    }

    try {
      const modelName = settings.openaiModel || 'gpt-4o-mini';
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: modelName,
        messages: [
          { role: 'system', content: settings.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      }
      throw new Error('Unexpected response format from OpenAI API');
    } catch (error: any) {
      console.error('OpenAI email generation failed:', error.message);
      throw new Error(`OpenAI API Error: ${error.response?.data?.error?.message || error.message}`);
    }
  } else if (provider === 'deepseek') {
    const apiKey = settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DeepSeek API key is not configured. Please set it in Settings.');
    }

    try {
      const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        return response.data.choices[0].message.content.trim();
      }
      throw new Error('Unexpected response format from DeepSeek API');
    } catch (error: any) {
      console.error('DeepSeek email generation failed:', error.message);
      throw new Error(`DeepSeek API Error: ${error.response?.data?.error?.message || error.message}`);
    }
  } else {
    // Default to Claude
    const apiKey = settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key is not configured. Please set it in Settings.');
    }

    const anthropic = new Anthropic({ apiKey });

    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        return content.text.trim();
      }
      throw new Error('Unexpected response format from Anthropic API');
    } catch (error: any) {
      console.error('Claude email generation failed:', error.message);
      throw new Error(`AI Generation Error: ${error.message}`);
    }
  }
}

export async function generateWhatsAppPitch(lead: Lead, settings: Settings): Promise<string> {
  const provider = settings.aiProvider || 'gemini';
  const customPrompt = settings.whatsappPromptTemplate || `You are an elite B2B sales outreach copywriter. Compose a short, punchy, conversational WhatsApp pitch to the business owner or manager.
Introduce the bespoke, high-converting live demo website redesign we built for their brand (use {{Demo Website}} or {{demoSiteUrl}}).
Highlight 1-2 core improvements (e.g. mobile responsiveness, ultra-fast load time, modern design) that their current site lacks.
Keep it brief (under 60 words). Use natural WhatsApp formatting (*bold* for emphasis, clean spacing, polite emoji like 👋 or 🚀). Offer direct value and invite a quick look.`;

  const demoLinkText = lead.demoSiteUrl 
    ? `Live Custom Demo Website Built For Them: ${lead.demoSiteUrl}` 
    : 'Live Custom Demo Website Built For Them: N/A';

  const leadContext = `
Business Name: ${lead.name}
Category/Niche: ${lead.category || 'N/A'}
Current Website: ${lead.website || 'N/A'}
Phone / WhatsApp: ${lead.phone || lead.whatsapp || 'N/A'}
SEO Score: ${lead.seoScore ? `${lead.seoScore}/100` : 'N/A'}
Google Business Rating: ${lead.gmbRating ? `${lead.gmbRating}/5` : 'N/A'}
Identified SEO/Listing Issues: ${lead.seoIssues && lead.seoIssues.length > 0 ? lead.seoIssues.join(', ') : 'None specified'}
Website Crawled Text: ${lead.crawledText || 'No website content crawled'}
${demoLinkText}
  `.trim();

  const prompt = `
Instructions: ${customPrompt}

Lead Information:
${leadContext}

CRITICAL RULES:
1. Output ONLY the raw WhatsApp message text ready to send. No quotes, no markdown fences, no extra preamble.
2. If a live preview link is provided (${lead.demoSiteUrl || 'N/A'}), enthusiastically include this link!
3. Keep it brief (under 65 words), conversational, friendly, and close with a low-friction question.
  `.trim();

  try {
    if (provider === 'gemini') {
      const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return generateFallbackWhatsAppPitch(lead.name, lead.demoSiteUrl, lead.category);
      }

      const cleanKey = apiKey.trim();
      const genAI = new GoogleGenerativeAI(cleanKey);
      const requestedModel = settings.geminiModel || 'gemini-3.8-flash';
      const candidateModels = Array.from(new Set([
        requestedModel,
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash'
      ]));

      for (const mName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({ model: mName });
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 600, temperature: 0.7 }
          });
          const text = result?.response?.text();
          if (text) return text.trim();
        } catch (_) {}
      }
      return generateFallbackWhatsAppPitch(lead.name, lead.demoSiteUrl, lead.category);
    } else if (provider === 'openai') {
      const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return generateFallbackWhatsAppPitch(lead.name, lead.demoSiteUrl, lead.category);
      }

      const modelName = settings.openaiModel || 'gpt-4o-mini';
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      }
      return generateFallbackWhatsAppPitch(lead.name, lead.demoSiteUrl, lead.category);
    } else if (provider === 'deepseek') {
      const apiKey = settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        return generateFallbackWhatsAppPitch(lead.name, lead.demoSiteUrl, lead.category);
      }

      const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.7
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 20000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      }
      return generateFallbackWhatsAppPitch(lead.name, lead.demoSiteUrl, lead.category);
    } else {
      // Claude
      const apiKey = settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return generateFallbackWhatsAppPitch(lead.name, lead.demoSiteUrl, lead.category);
      }

      const anthropic = new Anthropic({ apiKey });
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 600,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        return content.text.trim();
      }
      return generateFallbackWhatsAppPitch(lead.name, lead.demoSiteUrl, lead.category);
    }
  } catch (err: any) {
    console.warn('[Composer] WhatsApp AI generation notice:', err.message);
    return generateFallbackWhatsAppPitch(lead.name, lead.demoSiteUrl, lead.category);
  }
}

