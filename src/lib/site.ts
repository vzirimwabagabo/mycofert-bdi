// Central site configuration — edit here to update contact details everywhere.
export const SITE = {
  phones: [
    { label: '+257 79 00 00 00', tel: '+25779000000' },
    { label: '+257 68 00 00 00', tel: '+25768000000' },
  ],
  whatsappNumber: '25779000000',
  email: 'info@mycofert.bi',
  city: 'Bujumbura',
  country: 'Burundi',
} as const;

export const WHATSAPP_MESSAGES: Record<string, string> = {
  fr: 'Bonjour MYCOFERT Burundi, je souhaite passer une commande.',
  en: 'Hello MYCOFERT Burundi, I would like to place an order.',
};

/** Build a wa.me link with an optional product name appended. */
export function waLink(lang: string, product?: string, quote = false): string {
  const base =
    lang === 'en'
      ? quote
        ? 'Hello MYCOFERT Burundi, I would like to request a quote for: '
        : 'Hello MYCOFERT Burundi, I would like to order: '
      : quote
        ? 'Bonjour MYCOFERT Burundi, je souhaite demander un devis pour : '
        : 'Bonjour MYCOFERT Burundi, je souhaite commander : ';
  const text = product ? `${base}${product}` : WHATSAPP_MESSAGES[lang] ?? WHATSAPP_MESSAGES.fr;
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

export function telLink(tel: string): string {
  return `tel:${tel}`;
}
