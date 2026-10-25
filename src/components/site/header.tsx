'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSite, hrefFor, type PageId } from './context';
import { Logo, Wordmark } from './bits';
import { TourButton, useTour } from './tour';
import { Compass, Globe, Menu, Lock } from 'lucide-react';
import type { Lang } from '@/lib/i18n';

const NAV: { page: PageId; key: 'home' | 'products' | 'about' | 'sustainability' | 'training' | 'news' | 'contact' }[] = [
  { page: 'home', key: 'home' },
  { page: 'products', key: 'products' },
  { page: 'about', key: 'about' },
  { page: 'sustainability', key: 'sustainability' },
  { page: 'training', key: 'training' },
  { page: 'news', key: 'news' },
  { page: 'contact', key: 'contact' },
];

export function Header() {
  const { t, lang, route, navigate, setLang } = useSite();
  const { start: startTour } = useTour();
  const [open, setOpen] = useState(false);

  const go = (page: PageId) => {
    setOpen(false);
    navigate(page);
  };

  const isActive = (page: PageId) => route.page === page || (page === 'news' && route.page === 'news-post');

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <button
          onClick={() => go('home')}
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t.nav.home}
        >
          <Logo size={40} />
          <Wordmark />
        </button>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation" data-tour="nav">
          {NAV.map((item) => (
            <button
              key={item.page}
              onClick={() => go(item.page)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive(item.page)
                  ? 'bg-secondary text-primary'
                  : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
              }`}
              aria-current={isActive(item.page) ? 'page' : undefined}
            >
              {t.nav[item.key]}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <TourButton />
          <LangSwitch lang={lang} setLang={setLang} />

          <Button
            onClick={() => go('contact')}
            className="hidden bg-[#2F6B3F] text-white hover:bg-[#275A34] sm:inline-flex"
          >
            {t.common.contactUs}
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                id="mobile-nav-trigger"
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Menu"
                suppressHydrationWarning
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Logo size={28} /> {t.nav.home}
                </SheetTitle>
                <SheetDescription className="sr-only">{t.nav.home}</SheetDescription>
              </SheetHeader>
              <nav className="mt-2 flex flex-col gap-1 px-4" aria-label="Mobile navigation">
                {NAV.map((item) => (
                  <button
                    key={item.page}
                    onClick={() => go(item.page)}
                    className={`rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                      isActive(item.page) ? 'bg-secondary text-primary' : 'hover:bg-secondary/70'
                    }`}
                  >
                    {t.nav[item.key]}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setOpen(false);
                    startTour('public');
                  }}
                  className="mt-2 flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-[#2F6B3F] hover:bg-secondary/70 font-medium"
                >
                  <Compass className="h-4 w-4 text-[#2F6B3F]" aria-hidden="true" /> {t.tour.launch}
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    navigate('admin');
                  }}
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-secondary/70"
                >
                  <Lock className="h-4 w-4" aria-hidden="true" /> {t.footer.adminLink}
                </button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const { t } = useSite();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id="lang-switch-trigger"
          variant="outline"
          size="sm"
          className="gap-2"
          aria-label={t.common.langLabel}
          suppressHydrationWarning
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          <span className="uppercase">{lang}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLang('fr')} className={lang === 'fr' ? 'bg-secondary' : ''}>
          Français {lang === 'fr' ? '✓' : ''}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang('en')} className={lang === 'en' ? 'bg-secondary' : ''}>
          English {lang === 'en' ? '✓' : ''}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { hrefFor };
