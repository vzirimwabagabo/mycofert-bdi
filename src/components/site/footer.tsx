'use client';

import { Separator } from '@/components/ui/separator';
import { useSite, hrefFor, type PageId } from './context';
import { useCms, pick } from './cms';
import { Logo, Wordmark } from './bits';
import { Mail, MapPin, Phone, MessageCircle, Lock } from 'lucide-react';
import { telLink } from '@/lib/site';

const LINKS: { page: PageId; key: 'home' | 'products' | 'about' | 'sustainability' | 'training' | 'news' | 'contact' }[] = [
  { page: 'home', key: 'home' },
  { page: 'products', key: 'products' },
  { page: 'about', key: 'about' },
  { page: 'sustainability', key: 'sustainability' },
  { page: 'training', key: 'training' },
  { page: 'news', key: 'news' },
  { page: 'contact', key: 'contact' },
];

export function Footer() {
  const { t, lang, navigate } = useSite();
  const { settings, products } = useCms();
  const contact = settings.contact;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-[#234D30] text-white/85">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <span className="leading-none">
              <span className="block text-lg font-extrabold tracking-tight text-white">MYCOFERT</span>
              <span className="block text-[11px] font-semibold tracking-[0.28em] text-white/70">BURUNDI</span>
            </span>
          </div>
          <p className="mt-4 text-sm italic text-white/75">“{t.brand.motto}”</p>
          <p className="mt-2 text-sm text-white/60">{t.brand.tagline}</p>
        </div>

        <nav aria-label={t.footer.explore}>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{t.footer.explore}</h3>
          <ul className="space-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.page}>
                <a
                  href={hrefFor(lang, l.page)}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(l.page);
                  }}
                  className="text-white/75 transition-colors hover:text-white"
                >
                  {t.nav[l.key]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t.footer.productsCol}>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{t.footer.productsCol}</h3>
          <ul className="space-y-2 text-sm">
            {products.slice(0, 6).map((p) => (
              <li key={p.id}>
                <a
                  href={hrefFor(lang, 'products')}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('products');
                  }}
                  className="text-white/75 transition-colors hover:text-white"
                >
                  {pick(p.name, lang)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{t.footer.contactCol}</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
              <span className="flex flex-col">
                {contact.phones.map((p) => (
                  <a key={p.tel} href={telLink(p.tel)} className="text-white/75 hover:text-white">
                    {p.label}
                  </a>
                ))}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
              <a
                href={`https://wa.me/${contact.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/75 hover:text-white"
              >
                WhatsApp
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
              <a href={`mailto:${contact.email}`} className="text-white/75 hover:text-white">
                {contact.email}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
              <span className="text-white/75">
                {contact.city} — {contact.country}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <Separator className="bg-white/10" />

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-white/60 sm:flex-row sm:px-6">
        <p>© {year} MYCOFERT Burundi. {t.footer.rights}</p>
        <a
          href="#/admin"
          onClick={(e) => {
            e.preventDefault();
            navigate('admin');
          }}
          className="inline-flex items-center gap-1 text-white/50 hover:text-white"
        >
          <Lock className="h-3 w-3" aria-hidden="true" /> {t.footer.adminLink}
        </a>
      </div>
    </footer>
  );
}

/** Floating WhatsApp quick-order button, hidden on the admin page. */
export function WhatsAppFloat() {
  const { lang, t, route } = useSite();
  const { settings } = useCms();
  const number = settings.contact.whatsappNumber;
  if (route.isAdmin) return null;
  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent(
        lang === 'en' ? 'Hello MYCOFERT Burundi, I would like to place an order.' : 'Bonjour MYCOFERT Burundi, je souhaite passer une commande.'
      )}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-[#2F6B3F] px-4 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#275A34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t.common.orderWhatsapp}
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
