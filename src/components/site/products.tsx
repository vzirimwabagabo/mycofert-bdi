'use client';

import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Package } from 'lucide-react';
import { useSite } from './context';
import { useCms, pick } from './cms';
import { PageHero, CtaPair } from './bits';
import { resolveImage } from '@/lib/cms-defaults';
import { SITE, telLink, waLink } from '@/lib/site';
import { MessageCircle } from 'lucide-react';

export function ProductsPage() {
  const { t, lang } = useSite();
  const { settings, products } = useCms();
  const contact = settings.contact;
  const L = (text: { fr: string; en: string }) => pick(text, lang);
  const fertilizer = products.find((p) => p.slug === 'fertilizer') ?? products[products.length - 1];

  return (
    <div>
      <PageHero title={t.products.title} subtitle={t.products.subtitle} />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16" data-tour="products-list">
        <div className="grid gap-8 lg:grid-cols-2">
          {products.map((item) => (
            <Card key={item.id} className="flex flex-col overflow-hidden border-border/70">
              <div className="aspect-[16/9] bg-secondary">
                <img
                  src={resolveImage(item)}
                  alt={L(item.name)}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <CardContent className="flex-1 p-6">
                <h2 className="text-xl font-bold">{L(item.name)}</h2>
                <p className="mt-1 text-sm font-medium text-[#6FA84C]">{L(item.tagline)}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{L(item.description)}</p>
                <ul className="mt-4 space-y-2">
                  {item.points[lang].map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6B3F]" aria-hidden="true" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-medium text-foreground">{t.products.formatsLabel}: </span>
                    {L(item.formats)}
                  </span>
                </p>
              </CardContent>
              <CardFooter className="border-t border-border/60 p-5">
                <CtaPair product={L(item.name)} />
              </CardFooter>
            </Card>
          ))}
        </div>

        <p className="mt-10 rounded-lg border border-border bg-secondary/50 p-4 text-center text-sm text-muted-foreground">
          {t.products.orderNote}
        </p>
      </section>

      {/* Fertilizer highlight */}
      {fertilizer ? (
        <section className="bg-secondary/60 py-14 sm:py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl">
              <img
                src={resolveImage(fertilizer)}
                alt={t.products.fertilizerTitle}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <div>
              <Badge className="mb-4 bg-[#6FA84C] text-white hover:bg-[#6FA84C]">
                {t.products.fertilizerTitle}
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{L(fertilizer.tagline)}</h2>
              <p className="mt-3 text-muted-foreground">{t.products.fertilizerIntro}</p>
              <ul className="mt-5 space-y-2.5">
                {fertilizer.points[lang].map((pt) => (
                  <li key={pt} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#2F6B3F]" aria-hidden="true" />
                    <span className="font-medium">{pt}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 inline-flex rounded-lg bg-background px-4 py-2 text-sm font-semibold">
                <Package className="mr-2 h-4 w-4 text-[#2F6B3F]" aria-hidden="true" />
                {L(fertilizer.formats)}
              </p>
              <div className="mt-6">
                <CtaPair product={L(fertilizer.name)} quote />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Wholesale band */}
      <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.home.ctaBandTitle}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">{t.home.ctaBandText}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={waLink(lang, undefined, false, contact.whatsappNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-md bg-[#2F6B3F] px-6 text-sm font-semibold text-white hover:bg-[#275A34]"
          >
            <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            WhatsApp
          </a>
          <a
            href={`tel:${contact.phones[0]?.tel || SITE.phones[0].tel}`}
            className="inline-flex h-10 items-center rounded-md border border-[#2F6B3F]/40 px-6 text-sm font-semibold text-[#2F6B3F] hover:bg-[#2F6B3F]/10"
          >
            {contact.phones[0]?.label || SITE.phones[0].label}
          </a>
        </div>
      </section>
    </div>
  );
}
