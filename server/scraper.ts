import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

// Crawl a lead's website to extract context
export async function crawlWebsite(url: string): Promise<string> {
  if (!url) return '';
  let targetUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    targetUrl = 'https://' + url;
  }

  try {
    const response = await axios.get(targetUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Remove scripts, styles, and navigation
    $('script, style, nav, footer, header, noscript').remove();
    
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    
    // Extract main text
    const paragraphs: string[] = [];
    $('h1, h2, h3, p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20 && paragraphs.length < 15) {
        paragraphs.push(text);
      }
    });

    const content = [
      title ? `Title: ${title}` : '',
      metaDescription ? `Description: ${metaDescription}` : '',
      paragraphs.join('\n')
    ].filter(Boolean).join('\n\n');

    // Return truncated content
    return content.substring(0, 1500);
  } catch (error: any) {
    console.error(`Failed to crawl ${targetUrl}:`, error.message);
    return `Failed to crawl website: ${error.message}`;
  }
}

// Parse Leads Gorilla CSV Export
export function parseLeadsGorillaCSV(csvContent: string): any[] {
  const lines = csvContent.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse CSV headers (handle quotes and commas)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(val => val.replace(/^"|"$/g, ''));
  };

  const headers = parseCSVLine(lines[0]);
  
  // Find column indexes (case-insensitive fuzzy matching)
  const getIndex = (keys: string[]): number => {
    return headers.findIndex(h => {
      const headerLower = h.toLowerCase().replace(/[\s_-]/g, '');
      return keys.some(key => {
        const keyLower = key.toLowerCase().replace(/[\s_-]/g, '');
        return headerLower.includes(keyLower) || keyLower.includes(headerLower);
      });
    });
  };

  const nameIdx = getIndex(['businessname', 'name', 'company', 'title']);
  const emailIdx = getIndex(['email', 'mail', 'contactemail']);
  const websiteIdx = getIndex(['website', 'url', 'site', 'web']);
  const phoneIdx = getIndex(['phone', 'tel', 'contactphone']);
  const categoryIdx = getIndex(['category', 'niche', 'industry']);
  const seoScoreIdx = getIndex(['seoscore', 'seo', 'score']);
  const gmbRatingIdx = getIndex(['gmbrating', 'rating', 'googleplacesrating']);
  const seoIssuesIdx = getIndex(['seoissues', 'issues', 'auditdetails', 'problems', 'errors']);

  const leads: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < headers.length * 0.5) continue; // Skip malformed lines

    const name = nameIdx !== -1 ? values[nameIdx] : '';
    if (!name) continue; // Skip leads with no name

    const email = emailIdx !== -1 ? values[emailIdx] : '';
    const website = websiteIdx !== -1 ? values[websiteIdx] : '';
    const phone = phoneIdx !== -1 ? values[phoneIdx] : '';
    const category = categoryIdx !== -1 ? values[categoryIdx] : '';
    
    // Parse numeric fields safely
    let seoScore: number | undefined = undefined;
    if (seoScoreIdx !== -1 && values[seoScoreIdx]) {
      const parsed = parseFloat(values[seoScoreIdx].replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) seoScore = parsed;
    }

    let gmbRating: number | undefined = undefined;
    if (gmbRatingIdx !== -1 && values[gmbRatingIdx]) {
      const parsed = parseFloat(values[gmbRatingIdx].replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) gmbRating = parsed;
    }

    // Parse issues (comma or semicolon separated lists)
    let seoIssues: string[] = [];
    if (seoIssuesIdx !== -1 && values[seoIssuesIdx]) {
      const issuesStr = values[seoIssuesIdx];
      seoIssues = issuesStr
        .split(/[,;|]/)
        .map(s => s.trim())
        .filter(s => s.length > 3);
    }

    leads.push({
      name,
      email: email || undefined,
      website: website || undefined,
      phone: phone || undefined,
      category: category || undefined,
      seoScore,
      gmbRating,
      seoIssues
    });
  }

  return leads;
}

// Automated browser scraper for Leads Gorilla (demonstrative / browser login flow)
export async function scrapeLeadsGorilla(
  credentials: { email: string; pass: string },
  searchParams: { keyword: string; location: string }
): Promise<any[]> {
  console.log(`Starting automated scraper for search: ${searchParams.keyword} in ${searchParams.location}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Go to Leads Gorilla login page
    await page.goto('https://app.leadsgorilla.io/login', { waitUntil: 'networkidle2' });
    
    // Fill credentials using correct selectors
    await page.type('#user-name', credentials.email);
    await page.type('#user-password', credentials.pass);
    await page.click('button[type="submit"]');

    // Wait for dashboard or error
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    // Check if login succeeded
    if (page.url().includes('login')) {
      throw new Error('Login failed. Please check your Leads Gorilla credentials.');
    }

    const leads: any[] = [];
    
    // Simulating lead scrape
    leads.push({
      name: `${searchParams.keyword} Partner ${searchParams.location}`,
      email: `contact@${searchParams.keyword.toLowerCase().replace(/\s+/g, '')}.com`,
      website: `www.${searchParams.keyword.toLowerCase().replace(/\s+/g, '')}.com`,
      phone: '+1 555 123 4567',
      category: searchParams.keyword,
      seoScore: 45,
      gmbRating: 3.5,
      seoIssues: ['Missing SSL', 'Slow Page Speed', 'No OpenGraph tags']
    });

    await browser.close();
    return leads;
  } catch (error: any) {
    await browser.close();
    console.error('Puppeteer scraping failed:', error.message);
    throw error;
  }
}
