/**
 * WhatsApp Direct Outreach Helper for Frontend Client
 */

export function sanitizePhoneNumberForWhatsApp(phone?: string | null): string | null {
  if (!phone) return null;

  let cleaned = phone.replace(/[^\d+]/g, '').trim();

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // 1. Handle UK numbers starting with 0 (07 mobiles, 01/02/03 landlines - 11 digits)
  if (cleaned.startsWith('0') && (cleaned.startsWith('07') || cleaned.startsWith('02') || cleaned.startsWith('01') || cleaned.startsWith('03')) && cleaned.length === 11) {
    cleaned = '44' + cleaned.slice(1);
  }
  // 2. Handle Nigerian mobile numbers starting with 0 (080, 081, 090, 091, 070 - 11 digits)
  else if (cleaned.startsWith('0') && (cleaned.startsWith('08') || cleaned.startsWith('09') || cleaned.startsWith('070')) && cleaned.length === 11) {
    cleaned = '234' + cleaned.slice(1);
  }
  // 3. Fallback for other 11-digit numbers starting with 0 (default to UK)
  else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '44' + cleaned.slice(1);
  }
  // 4. Handle 10-digit North American numbers without country code
  else if (cleaned.length === 10 && !cleaned.startsWith('0') && !cleaned.startsWith('1')) {
    cleaned = '1' + cleaned;
  }

  if (cleaned.length < 8 || cleaned.length > 15) {
    return null;
  }

  return cleaned;
}

export function generateFallbackWhatsAppPitch(
  businessName: string,
  demoSiteUrl?: string | null
): string {
  const name = businessName.trim();
  const demoText = demoSiteUrl 
    ? `\n\nI built a live, mobile-responsive concept preview for your brand here: ${demoSiteUrl}`
    : '';

  return `Hello ${name}! 👋\n\nI came across your business online and was really impressed by your brand.${demoText}\n\nWe specialize in ultra-fast, high-converting website redesigns that bring in more direct clients. Would you be open to taking a quick look this week?`;
}

export function getWhatsAppOutreachUrl(
  phone?: string | null,
  message?: string | null
): string | null {
  const cleanPhone = sanitizePhoneNumberForWhatsApp(phone);
  if (!cleanPhone) return null;

  if (message && message.trim()) {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message.trim())}`;
  }
  return `https://wa.me/${cleanPhone}`;
}
