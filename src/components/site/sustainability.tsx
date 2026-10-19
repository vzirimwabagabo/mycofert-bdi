'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Recycle, ArrowDown, Package, Sprout, ShoppingBasket } from 'lucide-react';
import { useSite } from './context';
import { PageHero, SectionHeading } from './bits';

const STEP_ICONS = [Package, Sprout, ShoppingBasket, Recycle];

export function SustainabilityPage() {
  const { t } = useSite();

  return (
    <div>
      <PageHero title={t.sustainability.title} subtitle={t.sustainability.subtitle} />

      {/* Process steps */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.sustainability.steps.map((step, i) => (
            <Card key={step.title} className="relative border-border/70 p-6 text-center">
              <span
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-[#2F6B3F]"
                aria-hidden="true"
              >
                {(() => {
                  const Icon = STEP_ICONS[i] ?? Package;
                  return <Icon className="h-7 w-7" />;
                })()}
              </span>
              <span className="absolute left-4 top-4 text-sm font-bold text-[#6FA84C]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              {i < t.sustainability.steps.length - 1 ? (
                <ArrowDown
                  className="mx-auto mt-4 h-5 w-5 text-[#6FA84C] lg:hidden"
                  aria-hidden="true"
                />
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      {/* Circular cycle */}
      <section className="bg-secondary/60 py-14 sm:py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl">
            <img
              src="/images/sustainability.png"
              alt={t.sustainability.cycleTitle}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div>
            <Badge variant="secondary" className="mb-4 gap-1 bg-[#6FA84C]/15 text-[#2F6B3F]">
              <Recycle className="h-3.5 w-3.5" aria-hidden="true" /> {t.nav.sustainability}
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.sustainability.cycleTitle}</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">{t.sustainability.cycleText}</p>
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <SectionHeading title={t.sustainability.impactTitle} />
        <div className="grid gap-5 md:grid-cols-3">
          {t.sustainability.impact.map((im) => (
            <Card key={im.title} className="border-border/70 p-6 transition-shadow hover:shadow-md">
              <h3 className="font-semibold text-[#2F6B3F]">{im.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{im.desc}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
