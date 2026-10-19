'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BadgeCheck, Sprout, Users, Leaf, Quote, Package, Recycle, GraduationCap } from 'lucide-react';
import { useSite } from './context';
import { useCms, pick } from './cms';
import { PageHero, SectionHeading } from './bits';

const ACTIVITY_ICONS = [Package, Sprout, Recycle, GraduationCap];

export function AboutPage() {
  const { t, lang } = useSite();
  const { settings } = useCms();
  const about = settings.about;

  return (
    <div>
      <PageHero title={t.about.title} subtitle={t.brand.tagline} />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            {t.about.intro.map((p, i) => (
              <p key={i} className="leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl">
            <img
              src="/images/hero.png"
              alt={t.about.title}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Mission & vision */}
      <section className="bg-secondary/60 py-14 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-2">
          <Card className="border-border/70 p-8">
            <Badge variant="secondary" className="mb-4 bg-[#6FA84C]/15 text-[#2F6B3F]">
              {t.about.missionTitle}
            </Badge>
            <p className="leading-relaxed text-foreground/90">{pick(about.missionText, lang)}</p>
          </Card>
          <Card className="border-border/70 p-8">
            <Badge variant="secondary" className="mb-4 bg-[#6FA84C]/15 text-[#2F6B3F]">
              {t.about.visionTitle}
            </Badge>
            <p className="leading-relaxed text-foreground/90">{pick(about.visionText, lang)}</p>
          </Card>
        </div>
      </section>

      {/* Activities */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <SectionHeading title={t.about.activitiesTitle} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.about.activities.map((a, i) => {
            const Icon = ACTIVITY_ICONS[i] ?? Sprout;
            return (
              <Card key={a.title} className="border-border/70 p-6 transition-shadow hover:shadow-md">
                <Icon className="h-8 w-8 text-[#2F6B3F]" aria-hidden="true" />
                <h3 className="mt-4 font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Values + quote */}
      <section className="bg-secondary/60 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={t.about.valuesTitle} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.values.map((v, i) => {
              const icons = [BadgeCheck, Sprout, Users, Leaf];
              const Icon = icons[i] ?? BadgeCheck;
              return (
                <Card key={v.title} className="border-border/70 p-6">
                  <Icon className="h-7 w-7 text-[#6FA84C]" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
                </Card>
              );
            })}
          </div>
          <blockquote className="mx-auto mt-12 flex max-w-3xl items-start gap-4 rounded-2xl border border-border bg-background p-8">
            <Quote className="h-8 w-8 shrink-0 text-[#6FA84C]" aria-hidden="true" />
            <div>
              <p className="text-lg font-medium leading-relaxed">“{t.brand.motto}”</p>
              <cite className="mt-2 block text-sm not-italic text-muted-foreground">— MYCOFERT Burundi</cite>
            </div>
          </blockquote>
        </div>
      </section>
    </div>
  );
}
