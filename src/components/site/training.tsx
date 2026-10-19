'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, GraduationCap } from 'lucide-react';
import { useSite } from './context';
import { PageHero, SectionHeading } from './bits';
import { InquiryForm } from './inquiry-form';

export function TrainingPage() {
  const { t } = useSite();

  return (
    <div>
      <PageHero title={t.training.title} subtitle={t.training.subtitle} />

      {/* Intro */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl">
            <img
              src="/images/training.png"
              alt={t.training.title}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div>
            <Badge variant="secondary" className="mb-4 gap-1 bg-[#6FA84C]/15 text-[#2F6B3F]">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> {t.nav.training}
            </Badge>
            <p className="leading-relaxed text-muted-foreground">{t.training.intro}</p>
          </div>
        </div>
      </section>

      {/* Program */}
      <section className="bg-secondary/60 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={t.training.programTitle} />
          <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
            {t.training.program.map((p) => (
              <li key={p}>
                <Card className="flex h-full items-start gap-3 border-border/70 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2F6B3F]" aria-hidden="true" />
                  <span className="text-sm font-medium">{p}</span>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Audience */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <SectionHeading title={t.training.audienceTitle} />
        <div className="grid gap-5 md:grid-cols-3">
          {t.training.audience.map((a) => (
            <Card key={a.title} className="border-border/70 p-6 transition-shadow hover:shadow-md">
              <h3 className="font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA + form */}
      <section className="bg-secondary/60 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeading title={t.training.ctaTitle} subtitle={t.training.ctaText} />
          <Card className="border-border/70 p-6 sm:p-8">
            <InquiryForm defaultType="training" compact />
          </Card>
        </div>
      </section>
    </div>
  );
}
