'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSite } from './context';
import { useCms } from './cms';
import { waLink } from '@/lib/site';
import { MessageCircle, Phone } from 'lucide-react';
import { SITE } from '@/lib/site';

/** MYCOFERT-style logo: green circle, brown mushroom cap, leaves. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="24" cy="24" r="22" fill="#2F6B3F" />
      <path
        d="M24 10c-7.5 0-13 4.6-13 10.2 0 .9.7 1.6 1.6 1.6h22.8c.9 0 1.6-.7 1.6-1.6C37 14.6 31.5 10 24 10z"
        fill="#8B5A2B"
      />
      <path d="M20 23h8v6.5a4 4 0 0 1-8 0V23z" fill="#F5EFE3" />
      <path
        d="M33 30.5c2.6 1.3 4.5 3.3 4.5 5.5 0 .8-.6 1.5-1.4 1.5-1.6 0-3.3-1.7-3.1-7z"
        fill="#6FA84C"
      />
      <path d="M15 30.5c-2.6 1.3-4.5 3.3-4.5 5.5 0 .8.6 1.5 1.4 1.5 1.6 0 3.3-1.7 3.1-7z" fill="#6FA84C" />
      <ellipse cx="19" cy="16.5" rx="1.6" ry="1" fill="#F5EFE3" opacity=".85" />
      <ellipse cx="26" cy="15" rx="1.8" ry="1.1" fill="#F5EFE3" opacity=".85" />
      <ellipse cx="30.5" cy="18" rx="1.3" ry=".9" fill="#F5EFE3" opacity=".85" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="leading-none">
      <span className="block text-lg font-extrabold tracking-tight text-[#2F6B3F]">MYCOFERT</span>
      <span className="block text-[11px] font-semibold tracking-[0.28em] text-[#8B5A2B]">BURUNDI</span>
    </span>
  );
}

export function SectionHeading({
  title,
  subtitle,
  align = 'center',
}: {
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={`mb-10 max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-3 text-base text-muted-foreground sm:text-lg">{subtitle}</p> : null}
    </div>
  );
}

/** Primary pair of CTAs: WhatsApp order + contact link. */
export function CtaPair({
  product,
  quote = false,
  size = 'default',
}: {
  product?: string;
  quote?: boolean;
  size?: 'default' | 'lg';
}) {
  const { t, lang, navigate } = useSite();
  const { settings } = useCms();
  const contact = settings.contact;
  const firstPhone = contact.phones[0]?.tel || SITE.phones[0].tel;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild size={size} className="bg-[#2F6B3F] hover:bg-[#275A34] text-white">
        <a href={waLink(lang, product, quote, contact.whatsappNumber)} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
          {quote ? t.common.requestQuote : t.common.orderWhatsapp}
        </a>
      </Button>
      <Button asChild size={size} variant="outline" className="border-[#2F6B3F]/40 text-[#2F6B3F] hover:bg-[#2F6B3F]/10">
        <a href={`tel:${firstPhone}`}>
          <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
          {t.common.call}
        </a>
      </Button>
    </div>
  );
}

// Kept for reference: resolves the owner-editable first phone.
export function useFirstPhone(): string {
  const { settings } = useCms();
  return settings.contact.phones[0]?.tel || SITE.phones[0].tel;
}

/** Slim hero band used at the top of inner pages. */
export function PageHero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b bg-[#2F6B3F] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <Badge variant="secondary" className="mb-4 bg-white/15 text-white hover:bg-white/20">
          MYCOFERT Burundi
        </Badge>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-3 max-w-2xl text-white/85 sm:text-lg">{subtitle}</p> : null}
      </div>
    </div>
  );
}
