/**
 * WhatsApp Direct Outreach Helper for Frontend Client
 */

export function sanitizePhoneNumberForWhatsApp(phone?: string | null): string | null {
  if (!phone) return null;

  let cleaned = phone.replace(/[^\d+]/g, '').trim();

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Local Nigerian numbers starting with 0
  if (cleaned.startsWith('0') && cleaned.length >= 10 && cleaned.length <= 11) {
    cleaned = '234' + cleaned.slice(1);
  }

  // Local UK numbers starting with 0
  if (cleaned.startsWith('0') && (cleaned.startsWith('07') || cleaned.startsWith('02') || cleaned.startsWith('01')) && cleaned.length === 11) {
    cleaned = '44' + cleaned.slice(1);
  }

  // 10-digit North American numbers
  if (cleaned.length === 10 && !cleaned.startsWith('0') && !cleaned.startsWith('1')) {
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
