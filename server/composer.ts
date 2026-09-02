import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { Lead, Settings } from './db.js';

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
      let modelName = settings.geminiModel || 'gemini-1.5-flash';
      if (modelName === 'gemini-2.0-flash' || modelName === 'gemini-2.5-flash') {
        modelName = 'gemini-1.5-flash';
      }

      let result: any;
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: settings.systemPrompt
        });
        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1500,
            temperature: 0.7
          }
        });
      } catch (firstErr: any) {
        console.warn(`[Composer] Gemini model ${modelName} failed (${firstErr.message}), trying gemini-1.5-flash-latest...`);
        const fallbackModel = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash-latest',
          systemInstruction: settings.systemPrompt
        });
        result = await fallbackModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1500,
            temperature: 0.7
          }
        });
      }

      const text = result?.response?.text();
      if (text) {
        return text.trim();
      }
      throw new Error('Unexpected empty response from Google Gemini API');
    } catch (error: any) {
      console.error('Gemini email generation failed:', error.message);
      throw new Error(`Gemini API Error: ${error.message}`);
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
