'use client';

// Client shell of the site: providers + header/footer around the routed page.
// The server page (src/app/[[...slug]]/page.tsx) supplies the initial route
// and the server-fetched public content, so the first paint is complete,
// crawlable HTML — navigation afterwards is client-side (no reloads).

import { SiteProvider, useSite } from '@/components/site/context';
import { CmsProvider, type PublicContent } from '@/components/site/cms';
import { Header } from '@/components/site/header';
import { Footer, WhatsAppFloat } from '@/components/site/footer';
import { HomePage } from '@/components/site/home';
import { ProductsPage } from '@/components/site/products';
import { AboutPage } from '@/components/site/about';
import { SustainabilityPage } from '@/components/site/sustainability';
import { TrainingPage } from '@/components/site/training';
import { NewsPage, NewsPostPage } from '@/components/site/news';
import { ContactPage } from '@/components/site/contact';
import { AdminPage } from '@/components/site/admin';
import { TourProvider, TourLauncher } from '@/components/site/tour';
import type { Route } from '@/lib/route';

function Router() {
  const { route } = useSite();
  switch (route.page) {
    case 'admin':
      return <AdminPage />;
    case 'products':
      return <ProductsPage />;
    case 'about':
      return <AboutPage />;
    case 'sustainability':
      return <SustainabilityPage />;
    case 'training':
      return <TrainingPage />;
    case 'news':
      return <NewsPage />;
    case 'news-post':
      return <NewsPostPage slug={route.slug} />;
    case 'contact':
      return <ContactPage />;
    default:
      return <HomePage />;
  }
}

export function SiteShell({
  initialRoute,
  initialContent,
}: {
  initialRoute: Route;
  initialContent?: PublicContent;
}) {
  return (
    <SiteProvider initialRoute={initialRoute}>
      <CmsProvider initialContent={initialContent}>
        {/* Inside CmsProvider so tour steps can read the CMS content the page
            is showing, and inside SiteProvider so the overlay can navigate. */}
        <TourProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">
              <Router />
            </main>
            <Footer />
            <WhatsAppFloat />
            <TourLauncher />
          </div>
        </TourProvider>
      </CmsProvider>
    </SiteProvider>
  );
}
