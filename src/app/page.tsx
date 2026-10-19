'use client';

import { SiteProvider, useSite } from '@/components/site/context';
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

export default function Page() {
  return (
    <SiteProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Router />
        </main>
        <Footer />
        <WhatsAppFloat />
      </div>
    </SiteProvider>
  );
}
