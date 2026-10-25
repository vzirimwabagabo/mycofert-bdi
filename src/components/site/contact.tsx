'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useSite } from './context';
import { useCms, pick } from './cms';
import { PageHero } from './bits';
import { InquiryForm } from './inquiry-form';
import { telLink, waLink } from '@/lib/site';

export function ContactPage() {
  const { t, lang } = useSite();
  const { settings } = useCms();
  const contact = settings.contact;

  return (
    <div>
      <PageHero title={t.contact.title} subtitle={t.contact.subtitle} />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        {/* Contact channels */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/70 p-6">
            <Phone className="h-7 w-7 text-[#2F6B3F]" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">{t.common.phoneLabel}</h2>
            <div className="mt-2 space-y-1 text-sm">
              {contact.phones.map((p) => (
                <a key={p.tel} href={telLink(p.tel)} className="block text-muted-foreground hover:text-foreground">
                  {p.label}
                </a>
              ))}
            </div>
          </Card>

          <Card className="border-border/70 p-6">
            <MessageCircle className="h-7 w-7 text-[#2F6B3F]" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">{t.contact.whatsappTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t.contact.whatsappText}</p>
            <a
              href={waLink(lang, undefined, false, contact.whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-[#2F6B3F] hover:underline"
            >
              WhatsApp →
            </a>
          </Card>

          <Card className="border-border/70 p-6">
            <Mail className="h-7 w-7 text-[#2F6B3F]" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">{t.common.email}</h2>
            <a
              href={`mailto:${contact.email}`}
              className="mt-2 block break-all text-sm text-muted-foreground hover:text-foreground"
            >
              {contact.email}
            </a>
          </Card>

          <Card className="border-border/70 p-6">
            <MapPin className="h-7 w-7 text-[#2F6B3F]" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">{t.contact.locationTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t.contact.locationText}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t.common.hoursLabel}: </span>
              {pick(contact.hours, lang)}
            </p>
          </Card>
        </div>

        {/* Form */}
        <div className="mx-auto mt-14 max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight">{t.contact.formTitle}</h2>
          <p className="mt-2 text-muted-foreground">{t.contact.formSubtitle}</p>
          <Card className="mt-6 border-border/70 p-6 sm:p-8" data-tour="contact-form">
            <InquiryForm />
          </Card>
        </div>
      </section>
    </div>
  );
}
