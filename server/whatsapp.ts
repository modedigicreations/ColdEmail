/**
 * WhatsApp Direct Outreach Helper
 * Normalizes phone numbers into E.164 wa.me format and generates conversational WhatsApp pitches.
 */

export function sanitizePhoneNumberForWhatsApp(phone?: string | null): string | null {
  if (!phone) return null;

  // Remove whitespace, dashes, parens, brackets, and any non-numeric chars except leading +
  let cleaned = phone.replace(/[^\d+]/g, '').trim();

  // If starts with +, strip it
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Handle local Nigerian numbers starting with 0 (e.g. 080, 081, 070, 090, 091, 084)
  if (cleaned.startsWith('0') && cleaned.length >= 10 && cleaned.length <= 11) {
    cleaned = '234' + cleaned.slice(1);
  }

  // Handle UK numbers starting with 0 (e.g. 07, 020, 01)
  if (cleaned.startsWith('0') && (cleaned.startsWith('07') || cleaned.startsWith('02') || cleaned.startsWith('01')) && cleaned.length === 11) {
    cleaned = '44' + cleaned.slice(1);
  }

  // Handle 10-digit North American numbers without country code
  if (cleaned.length === 10 && !cleaned.startsWith('0') && !cleaned.startsWith('1')) {
    cleaned = '1' + cleaned;
  }

  // Validate standard length for international numbers (8 to 15 digits)
  if (cleaned.length < 8 || cleaned.length > 15) {
    return null;
  }

  return cleaned;
}

export function generateFallbackWhatsAppPitch(
  businessName: string,
  demoSiteUrl?: string | null,
  category?: string | null
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
