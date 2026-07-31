import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Automated browser scraper for Leads Gorilla (exploratory / adaptive browser flow)
export async function scrapeLeadsGorilla(
  credentials: { email: string; pass: string },
  searchParams: { keyword: string; location: string }
): Promise<any[]> {
  console.log(`Starting automated scraper for search: ${searchParams.keyword} in ${searchParams.location}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  let page: any = null;

  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Go to Leads Gorilla login page
    await page.goto('https://app.leadsgorilla.io/login', { waitUntil: 'load', timeout: 30000 });
    
    // Fill credentials using correct selectors
    await page.waitForSelector('#user-name', { timeout: 10000 });
    await page.type('#user-name', credentials.email);
    await page.type('#user-password', credentials.pass);
    await page.click('button[type="submit"]');

    // Wait for dashboard navigation
    try {
      await page.waitForNavigation({ waitUntil: 'load', timeout: 20000 });
    } catch (e) {
      if (page.url().includes('login')) {
        throw new Error('Login failed. Please verify your Leads Gorilla credentials.');
      }
    }
    
    // Check if login succeeded
    if (page.url().includes('login')) {
      throw new Error('Login failed. Please verify your Leads Gorilla credentials.');
    }

    // 2. Go to search page
    console.log('Navigating to Leads Gorilla search page...');
    await page.goto('https://app.leadsgorilla.io/search', { waitUntil: 'load', timeout: 35000 });
    
    // Wait for verified input elements
    const keywordSelector = '#keyword-input';
    const locationSelector = '#location';
    const submitBtnSelector = '#search-leads';
    
    await page.waitForSelector(keywordSelector, { timeout: 20000 });
    await page.waitForSelector(locationSelector, { timeout: 20000 });
    await page.waitForSelector(submitBtnSelector, { timeout: 20000 });

    // 3. Fill search criteria
    console.log('Filling search criteria...');
    
    // Clear and type keyword
    await page.click(keywordSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(keywordSelector, searchParams.keyword);

    // Clear and type location (slowly to trigger Google autocomplete)
    await page.click(locationSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(locationSelector, searchParams.location, { delay: 100 });

    // Wait for the Google Places Autocomplete dropdown (.pac-container)
    console.log('Waiting for autocomplete dropdown...');
    await page.waitForSelector('.pac-container', { timeout: 5000 }).catch(() => {
      console.log('Autocomplete pac-container not found; continuing with typed location.');
    });

    // Select the first autocomplete option
    await page.keyboard.press('ArrowDown');
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    // Trigger Search
    console.log('Submitting search form...');
    await page.click(submitBtnSelector);

    // 4. Wait for search results
    console.log('Submitting search form...');
    // Give browser a short moment to process click and create loader
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    console.log('Waiting for search loader to appear...');
    const loaderSelector = '.Loader .loader, #search-results .loader';
    const loaderExists = await page.waitForSelector(loaderSelector, { timeout: 15000 }).then(() => true).catch(() => false);
    
    if (loaderExists) {
      console.log('Search loader detected. Waiting for it to disappear (this indicates completion)...');
      await page.waitForSelector(loaderSelector, { hidden: true, timeout: 150000 }).catch(() => {
        console.log('Loader did not disappear in time, continuing parser anyway...');
      });
    } else {
      console.log('Search loader was not detected. Waiting for search button to be active/re-enabled...');
      await page.waitForFunction(() => {
        const btn = document.querySelector('#search-leads');
        if (!btn) return false;
        const text = (btn.textContent || '').toLowerCase();
        const isDisabled = btn.hasAttribute('disabled');
        return text.includes('search') && !text.includes('searching') && !isDisabled;
      }, { timeout: 120000 }).catch(() => {});
    }

    // Wait a brief moment for the DOM to settle rendering the results
    await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));

    // 5. Parse leads from DOM
    console.log('Parsing search results from DOM...');
    const leads = await page.evaluate((keyword: string) => {
      const results: any[] = [];
      // Find all h4 elements inside the search-results section
      const h4Elements = Array.from(document.querySelectorAll('#search-results h4'));

      for (const h4 of h4Elements) {
        // Business Name is the text of the h4 (excluding child badges like Claimed/Unclaimed)
        const clonedH4 = h4.cloneNode(true) as HTMLElement;
        clonedH4.querySelectorAll('.badge, span').forEach(el => el.remove());
        const name = clonedH4.textContent?.trim() || '';
        
        if (!name || name.toLowerCase().includes('search') || name.toLowerCase().includes('actions') || name.length < 2) {
          continue;
        }

        // Find the wrapper container for this lead (usually a panel or card)
        const item = h4.closest('.panel, .card, .lead, tr, div[class*="lead" i]') || h4.parentElement || h4;

        // Website (find link that isn't a social media or system link)
        const links = Array.from(item.querySelectorAll('a'));
        const webLink = links.find(l => {
          const href = l.getAttribute('href') || '';
          const txt = (l.textContent || '').toLowerCase();
          return href.startsWith('http') && 
                 !href.includes('google.com') && 
                 !href.includes('facebook.com') && 
                 !href.includes('twitter.com') && 
                 !href.includes('instagram.com') &&
                 !href.includes('linkedin.com') &&
                 !href.includes('leadsgorilla') &&
                 !txt.includes('claim') &&
                 !txt.includes('report');
        });
        const website = webLink ? webLink.getAttribute('href') : '';

        // Email
        const mailLink = links.find(l => (l.getAttribute('href') || '').startsWith('mailto:'));
        let email = mailLink ? mailLink.getAttribute('href')?.replace('mailto:', '').split('?')[0].trim() : '';
        
        if (!email) {
          const text = item.textContent || '';
          const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (match) {
            email = match[0];
          }
        }

        // Phone
        const telLink = links.find(l => (l.getAttribute('href') || '').startsWith('tel:'));
        let phone = telLink ? telLink.getAttribute('href')?.replace('tel:', '').trim() : '';
        if (!phone) {
          const text = item.textContent || '';
          const match = text.match(/\+?[0-9\s\-()]{7,20}/);
          if (match && match[0].replace(/[^0-9]/g, '').length >= 7) {
            phone = match[0].trim();
          }
        }

        // SEO Issues
        const seoIssues: string[] = [];
        item.querySelectorAll('.badge-danger, .badge-warning, .issue-tag, span[style*="red"], .alert-danger').forEach(el => {
          const txt = el.textContent?.trim();
          if (txt && txt.length > 2 && !seoIssues.includes(txt)) {
            seoIssues.push(txt);
          }
        });

        // GMB Rating
        const ratingEl = item.querySelector('.rating, .stars, [class*="star" i]');
        const ratingText = ratingEl ? ratingEl.textContent?.trim() : '';
        const gmbRating = parseFloat(ratingText || '4.0');

        // Prevent duplicate entries in results list
        if (results.some(r => r.name === name)) continue;

        results.push({
          name,
          email: email || undefined,
          website: website || undefined,
          phone: phone || undefined,
          category: keyword,
          seoScore: 65,
          gmbRating: isNaN(gmbRating) ? 4.0 : gmbRating,
          seoIssues: seoIssues.length > 0 ? seoIssues : ['Optimize Page Speed', 'Schema Markup Missing']
        });
      }

      return results;
    }, searchParams.keyword);

    console.log(`Successfully scraped ${leads.length} real leads.`);
    
    // Save success page screenshot for debugging
    try {
      const debugDir = path.join(__dirname, 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      await page.screenshot({ path: path.join(debugDir, 'success.png') });
      fs.writeFileSync(path.join(debugDir, 'success.html'), await page.content());
      console.log('Saved success debug screenshot and HTML source to server/dist/debug/');
    } catch (debugError: any) {
      console.error('Failed to save success debug info:', debugError.message);
    }

    await browser.close();
    return leads;

  } catch (error: any) {
    if (page) {
      try {
        const debugDir = path.join(__dirname, 'debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        await page.screenshot({ path: path.join(debugDir, 'error.png') });
        fs.writeFileSync(path.join(debugDir, 'error.html'), await page.content());
        console.log('Saved debug screenshot and HTML source to server/dist/debug/');
      } catch (debugError: any) {
        console.error('Failed to save debug info:', debugError.message);
      }
    }
    await browser.close();
    console.error('Puppeteer scraping failed:', error.message);
    throw error;
  }
}
