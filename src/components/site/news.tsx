'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { useSite } from './context';
import { PageHero } from './bits';
import { ArrowLeft, CalendarDays, Newspaper } from 'lucide-react';

const NEWS_IMAGES = ['/images/training.png', '/images/powder.png', '/images/fertilizer.png'];

export function NewsPage() {
  const { t, navigate } = useSite();

  return (
    <div>
      <PageHero title={t.news.title} subtitle={t.news.subtitle} />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {t.news.items.map((post, i) => (
            <Card key={post.slug} className="flex flex-col overflow-hidden border-border/70 transition-shadow hover:shadow-md">
              <div className="aspect-[16/9] bg-secondary">
                <img
                  src={NEWS_IMAGES[i % NEWS_IMAGES.length]}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <CardContent className="flex flex-1 flex-col p-5">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {post.date}
                </p>
                <h2 className="mt-2 text-lg font-semibold leading-snug">{post.title}</h2>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{post.excerpt}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 self-start border-[#2F6B3F]/40 text-[#2F6B3F] hover:bg-[#2F6B3F]/10"
                  onClick={() => navigate('news-post', post.slug)}
                >
                  {t.news.readMore}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

export function NewsPostPage({ slug }: { slug?: string }) {
  const { t, navigate } = useSite();
  const post = t.news.items.find((p) => p.slug === slug) ?? t.news.items[0];
  const img = NEWS_IMAGES[t.news.items.indexOf(post) % NEWS_IMAGES.length] ?? NEWS_IMAGES[0];

  return (
    <div>
      <PageHero title={post.title} subtitle={`${post.date} · MYCOFERT Burundi`} />

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="overflow-hidden rounded-2xl">
          <img src={img} alt="" aria-hidden="true" className="aspect-[16/9] w-full object-cover" />
        </div>
        <div className="mt-8 space-y-5">
          {post.body.map((p, i) => (
            <p key={i} className="leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('news')}
            className="border-[#2F6B3F]/40 text-[#2F6B3F] hover:bg-[#2F6B3F]/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> {t.news.back}
          </Button>
          <Button onClick={() => navigate('contact')} className="bg-[#2F6B3F] text-white hover:bg-[#275A34]">
            <Newspaper className="mr-2 h-4 w-4" aria-hidden="true" /> {t.common.contactUs}
          </Button>
        </div>
      </article>
    </div>
  );
}
