'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { useSite } from './context';
import { SectionHeading, CtaPair } from './bits';
import {
  Bed,
  Factory,
  House,
  UtensilsCrossed,
  ShoppingCart,
  Store,
  Leaf,
  MessageCircle,
  Recycle,
  Sprout,
  GraduationCap,
  BadgeCheck,
  Users,
  Newspaper,
  ArrowRight,
} from 'lucide-react';

const SEGMENT_ICONS = [House, UtensilsCrossed, Bed, ShoppingCart, Store, Factory];

export function HomePage() {
  const { t, navigate } = useSite();

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-[#234D30] text-white">
        <img
          src="/images/hero.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B3A24]/90 via-[#1B3A24]/70 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <Badge className="mb-5 bg-[#6FA84C] text-white hover:bg-[#6FA84C]">
            {t.home.heroBadge}
          </Badge>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {t.home.heroTitle}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">{t.home.heroSubtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="bg-white text-[#2F6B3F] hover:bg-white/90" onClick={() => navigate('products')}>
              {t.common.seeProducts}
            </Button>
            <a
              href="https://wa.me/25779000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center rounded-md border border-white/60 bg-transparent px-8 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              {t.common.orderWhatsapp}
            </a>
          </div>
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
            {[
              { n: '6+', label: t.home.heroStat1 },
              { n: '6', label: t.home.heroStat2 },
              { n: '100%', label: t.home.heroStat3 },
            ].map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-3xl font-extrabold">{s.n}</dd>
                <dd className="mt-1 text-sm text-white/70">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Product categories */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading title={t.home.categoriesTitle} subtitle={t.home.categoriesSubtitle} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {t.products.items.map((item, i) => (
            <Card
              key={item.id}
              className="group overflow-hidden border-border/70 transition-shadow hover:shadow-md"
            >
              <div className="aspect-[16/10] overflow-hidden bg-secondary">
                <img
                  src={`/images/${item.id}.png`}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold">{item.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.tagline}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => navigate('products')} className="border-[#2F6B3F]/40 text-[#2F6B3F] hover:bg-[#2F6B3F]/10">
            {t.common.seeProducts} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </section>

      {/* Segments */}
      <section className="bg-secondary/60 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={t.home.segmentsTitle} subtitle={t.home.segmentsSubtitle} />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {t.segments.map((s, i) => {
              const Icon = SEGMENT_ICONS[i] ?? House;
              return (
                <li key={s.label}>
                  <Card className="h-full border-border/70 bg-background p-5 text-center">
                    <Icon className="mx-auto h-7 w-7 text-[#2F6B3F]" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium leading-snug">{s.label}</p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Sustainability teaser */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl">
            <img
              src="/images/sustainability.png"
              alt={t.home.sustainabilityTitle}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div>
            <Badge variant="secondary" className="mb-4 gap-1 bg-[#6FA84C]/15 text-[#2F6B3F]">
              <Recycle className="h-3.5 w-3.5" aria-hidden="true" /> {t.nav.sustainability}
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.home.sustainabilityTitle}</h2>
            <p className="mt-4 text-muted-foreground">{t.home.sustainabilityText}</p>
            <Button
              onClick={() => navigate('sustainability')}
              className="mt-6 bg-[#2F6B3F] text-white hover:bg-[#275A34]"
            >
              {t.home.sustainabilityCta}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-secondary/60 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={t.home.valuesTitle} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.values.map((v, i) => {
              const icons = [BadgeCheck, Sprout, Users, Leaf];
              const Icon = icons[i] ?? BadgeCheck;
              return (
                <Card key={v.title} className="border-border/70 p-6">
                  <Icon className="h-8 w-8 text-[#6FA84C]" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Training teaser */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <Badge variant="secondary" className="mb-4 gap-1 bg-[#6FA84C]/15 text-[#2F6B3F]">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> {t.nav.training}
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.home.trainingTeaserTitle}</h2>
            <p className="mt-4 text-muted-foreground">{t.home.trainingTeaserText}</p>
            <Button
              onClick={() => navigate('training')}
              className="mt-6 bg-[#2F6B3F] text-white hover:bg-[#275A34]"
            >
              {t.common.requestTraining}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="order-1 overflow-hidden rounded-2xl lg:order-2">
            <img
              src="/images/training.png"
              alt={t.home.trainingTeaserTitle}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* News teaser */}
      <section className="bg-secondary/60 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={t.home.newsTitle} subtitle={t.home.newsSubtitle} />
          <div className="grid gap-5 md:grid-cols-3">
            {t.news.items.map((post, i) => (
              <Card key={post.slug} className="overflow-hidden border-border/70 transition-shadow hover:shadow-md">
                <div className="aspect-[16/9] bg-secondary">
                  <img
                    src={['/images/training.png', '/images/powder.png', '/images/fertilizer.png'][i]}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <CardContent className="p-5">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Newspaper className="h-3.5 w-3.5" aria-hidden="true" /> {post.date}
                  </p>
                  <h3 className="mt-2 line-clamp-2 font-semibold">{post.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
                  <button
                    onClick={() => navigate('news-post', post.slug)}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#2F6B3F] hover:underline"
                  >
                    {t.news.readMore} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-[#2F6B3F] py-14 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center sm:px-6 lg:flex-row lg:justify-between lg:text-left">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">{t.home.ctaBandTitle}</h2>
            <p className="mt-2 text-white/85">{t.home.ctaBandText}</p>
          </div>
          <CtaPair size="lg" />
        </div>
      </section>
    </div>
  );
}
