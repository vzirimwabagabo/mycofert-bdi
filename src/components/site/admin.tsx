'use client';

// Admin area shell — passcode gate + tabbed dashboard:
//   1. Inquiries (requests + visits stats)   2. Products (CRUD)
//   3. News (CRUD)                           4. Site content (settings)

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSite } from './context';
import { authHeaders, type AdminContent } from './admin-ui';
import { InquiriesPanel } from './admin-inquiries';
import { ProductsPanel } from './admin-products';
import { NewsPanel } from './admin-news';
import { SettingsPanel } from './admin-settings';
import { LayoutGrid, Lock, LogOut, Newspaper, Package, Users } from 'lucide-react';

export function AdminPage() {
  const { t } = useSite();
  const [token, setToken] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [content, setContent] = useState<AdminContent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem('mycofert-admin-token');
    if (stored) setToken(stored);
  }, []);

  /**
   * Central reaction to an API response.
   * An expired token is indistinguishable from a wrong one to the server, so
   * the X-Session-Expired header (set by our routes) is what lets us log the
   * user out cleanly instead of showing a generic error forever.
   */
  const handleUnauthorized = useCallback((res: Response) => {
    if (res.status !== 401 && res.status !== 503) return false;
    window.sessionStorage.removeItem('mycofert-admin-token');
    setToken(null);
    setContent(null);
    setAuthError(false);
    setAuthNotice(
      res.status === 503
        ? 'Admin authentication is not configured on the server.'
        : 'Your session has expired. Please sign in again.'
    );
    return true;
  }, []);

  const loadContent = useCallback(
    async (tok: string) => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/content', { headers: { 'x-admin-token': tok } });
        if (handleUnauthorized(res)) return;
        if (!res.ok) throw new Error(String(res.status));
        setContent(await res.json());
      } catch {
        setContent(null);
      } finally {
        setLoading(false);
      }
    },
    [handleUnauthorized]
  );

  useEffect(() => {
    if (token) loadContent(token);
  }, [token, loadContent]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(false);
    setAuthNotice(null);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        const { token: tok } = await res.json();
        window.sessionStorage.setItem('mycofert-admin-token', tok);
        setToken(tok);
        setPasscode('');
      } else if (res.status === 503) {
        setAuthNotice('Admin authentication is not configured on the server.');
      } else if (res.status === 429) {
        setAuthNotice('Too many attempts. Please wait and try again.');
      } else {
        setAuthError(true);
      }
    } catch {
      setAuthError(true);
    }
  }

  function logout() {
    window.sessionStorage.removeItem('mycofert-admin-token');
    setToken(null);
    setContent(null);
    setPasscode('');
  }

  const reload = useCallback(async () => {
    if (token) await loadContent(token);
  }, [token, loadContent]);

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
        <Card className="w-full border-border/70 p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Lock className="h-6 w-6 text-[#2F6B3F]" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-center text-2xl font-bold">{t.admin.title}</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">{t.admin.subtitle}</p>
          <form onSubmit={login} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-pass">{t.admin.passcode}</Label>
              <Input
                id="admin-pass"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder={t.admin.passcodePlaceholder}
                required
              />
              {authError ? <p className="text-xs text-destructive">{t.admin.wrongPasscode}</p> : null}
              {authNotice ? <p className="text-xs text-destructive">{authNotice}</p> : null}
            </div>
            <Button type="submit" className="w-full bg-[#2F6B3F] text-white hover:bg-[#275A34]">
              {t.admin.login}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.admin.title}</h1>
          <p className="text-sm text-muted-foreground">{t.admin.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> {t.admin.logout}
        </Button>
      </div>

      <Tabs defaultValue="inquiries" className="mt-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-secondary/60 p-1.5 sm:grid-cols-4" aria-label={t.cms.tabsLabel}>
          <TabsTrigger value="inquiries" className="gap-1.5 py-2 data-[state=active]:bg-background">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{t.cms.tabInquiries}</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5 py-2 data-[state=active]:bg-background">
            <Package className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{t.cms.tabProducts}</span>
          </TabsTrigger>
          <TabsTrigger value="news" className="gap-1.5 py-2 data-[state=active]:bg-background">
            <Newspaper className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{t.cms.tabNews}</span>
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5 py-2 data-[state=active]:bg-background">
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{t.cms.tabContent}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inquiries" className="mt-6">
          <InquiriesPanel token={token} />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          {content ? (
            <ProductsPanel token={token} content={content} reload={reload} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{t.cms.loading}</p>
          )}
        </TabsContent>

        <TabsContent value="news" className="mt-6">
          {content ? (
            <NewsPanel token={token} content={content} reload={reload} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{t.cms.loading}</p>
          )}
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          {content ? (
            <SettingsPanel token={token} content={content} reload={reload} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{t.cms.loading}</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
