import { Anthropic } from '@anthropic-ai/sdk';
import { Lead, Settings } from './db.js';

export async function generateColdEmail(lead: Lead, settings: Settings): Promise<string> {
  const apiKey = settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured. Please set it in Settings.');
  }

  const anthropic = new Anthropic({ apiKey });

  const leadContext = `
Business Name: ${lead.name}
Category/Niche: ${lead.category || 'N/A'}
Website: ${lead.website || 'N/A'}
Phone: ${lead.phone || 'N/A'}
SEO Score: ${lead.seoScore ? `${lead.seoScore}/100` : 'N/A'}
Google Business Rating: ${lead.gmbRating ? `${lead.gmbRating}/5` : 'N/A'}
Identified SEO/Listing Issues: ${lead.seoIssues && lead.seoIssues.length > 0 ? lead.seoIssues.join(', ') : 'None specified'}
Website Crawled Text: ${lead.crawledText || 'No website content crawled'}
  `.trim();

  const prompt = `
System Prompt: ${settings.systemPrompt}

Here is the lead's business information:
${leadContext}

Please compose a highly personalized cold email tailored to this business. Highlight how we can solve their specific issues (e.g. fix their website, improve their SEO score, help with their Google Business listing). Make it compelling, professional, short, and close with a question or call to action. 

Do not include any placeholders like [Your Name] or [Your Company]. Write it as a ready-to-send draft.
  `.trim();

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
