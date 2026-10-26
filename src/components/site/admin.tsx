'use client';

// Admin area shell — passcode gate + tabbed dashboard:
//   1. Inquiries (requests + visits stats)   2. Products (CRUD)
//   3. News (CRUD)                           4. Site content (settings)

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSite } from './context';
import { useTour, notifyAuthChange } from './tour';
import type { AdminTab } from './tour-steps';
import { authHeaders, type AdminContent } from './admin-ui';
import { InquiriesPanel } from './admin-inquiries';
import { ProductsPanel } from './admin-products';
import { NewsPanel } from './admin-news';
import { SettingsPanel } from './admin-settings';
import { Eye, EyeOff, LayoutGrid, Lock, LogOut, Newspaper, Package, Users } from 'lucide-react';

/**
 * Skeleton shaped like the panels below (a title bar plus a stack of card
 * rows), so the layout does not jump when the real data arrives. The label is
 * still announced to screen readers: it is the only thing a pulse animation
 * tells a non-sighted user.
 */
function PanelSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="flex items-center justify-between gap-3" aria-hidden="true">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      <div className="mt-4 space-y-3" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Placeholder for a panel whose data has not arrived yet: a skeleton while the
 * request is in flight, or an explanation plus a retry button when it failed.
 */
function PanelFallback({
  error,
  loadingLabel,
  errorLabel,
  retryLabel,
  onRetry,
}: {
  error: boolean;
  loadingLabel: string;
  errorLabel: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  if (!error) {
    return <PanelSkeleton label={loadingLabel} />;
  }
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <p className="text-center text-sm text-muted-foreground">{errorLabel}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

export function AdminPage() {
  const { t, lang, navigate } = useSite();
  const { active: activeTour, tab: tourTab, start: startTour, stop: stopTour } = useTour();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [content, setContent] = useState<AdminContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Controlled so the guided tour can open the tab a step is about.
  const [activeTab, setActiveTab] = useState<AdminTab>('inquiries');

  // "Forgot my passcode" flow. Anyone who needs this cannot sign in, so it lives
  // on the login screen itself: a recovery code plus a new passcode is enough.
  const [recovering, setRecovering] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmNewPasscode, setConfirmNewPasscode] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.sessionStorage.getItem('mycofert-admin-token');
    if (stored) setToken(stored);
  }, []);

  // A tour step may ask for a tab; the owner's own choice is kept afterwards.
  useEffect(() => {
    if (tourTab) setActiveTab(tourTab);
  }, [tourTab]);

  // Auto-start admin tour strictly once passcode is verified, content is loaded, and admin is let in
  useEffect(() => {
    if (!token || !content) return;
    try {
      const seen = window.localStorage.getItem('mycofert_admin_tour_seen');
      if (!seen) {
        window.localStorage.setItem('mycofert_admin_tour_seen', '1');
        const timer = setTimeout(() => {
          startTour('admin');
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore storage access errors
    }
  }, [token, content, startTour]);

  // Immediately cancel any active admin tour if the user is unauthenticated
  useEffect(() => {
    if ((!token || !content) && activeTour === 'admin') {
      stopTour();
    }
  }, [token, content, activeTour, stopTour]);

  /**
   * Central reaction to an API response.
   * An expired token is indistinguishable from a wrong one to the server, so
   * the X-Session-Expired header (set by our routes) is what lets us log the
   * user out cleanly instead of showing a generic error forever.
   *
   * 503 is used for two unrelated things, so they are told apart by the
   * X-Db-Unavailable header: "authentication is not configured" (sign out, the
   * user cannot do anything) versus "the database hiccuped" (stay signed in,
   * the data is just late).
   */
  const handleUnauthorized = useCallback((res: Response) => {
    if (res.headers.get('X-Db-Unavailable')) return false;
    if (res.status !== 401 && res.status !== 503) return false;
    window.sessionStorage.removeItem('mycofert-admin-token');
    notifyAuthChange();
    setToken(null);
    setContent(null);
    setAuthError(false);
    stopTour();
    setAuthNotice(
      res.status === 503
        ? 'Admin authentication is not configured on the server.'
        : 'Your session has expired. Please sign in again.'
    );
    return true;
  }, [stopTour]);

  const loadContent = useCallback(
    async (tok: string) => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/content', { headers: { 'x-admin-token': tok } });
        if (handleUnauthorized(res)) return;
        if (!res.ok) throw new Error(String(res.status));
        setContent(await res.json());
        setLoadError(false);
      } catch {
        // Without this the panels sat on "Loading…" forever, with no hint that
        // anything had gone wrong.
        setLoadError(true);
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
        notifyAuthChange();
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
    notifyAuthChange();
    setToken(null);
    setContent(null);
    setPasscode('');
    stopTour();
  }

  /**
   * Trade a recovery code for a new passcode. The response carries a fresh
   * recovery code because the one just used is consumed — the owner must never
   * be left without a way back in.
   */
  async function resetWithRecovery(e: React.FormEvent) {
    e.preventDefault();
    setRecoveryError(null);
    if (newPasscode.length < 12) {
      setRecoveryError(t.cms.passcodeTooShort);
      return;
    }
    if (newPasscode !== confirmNewPasscode) {
      setRecoveryError(t.cms.passcodeMismatch);
      return;
    }
    try {
      const res = await fetch('/api/admin/reset-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryCode, newPasscode }),
      });
      const data = (await res.json().catch(() => null)) as { recoveryCode?: string; error?: string } | null;
      if (!res.ok) {
        setRecoveryError(data?.error ?? t.admin.resetFailed);
        return;
      }
      setIssuedCode(data?.recoveryCode ?? null);
      setRecoveryCode('');
      setNewPasscode('');
      setConfirmNewPasscode('');
    } catch {
      setRecoveryError(t.admin.resetFailed);
    }
  }

  function backToLogin() {
    setRecovering(false);
    setIssuedCode(null);
    setRecoveryError(null);
    setCopied(false);
  }

  async function copyIssuedCode() {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(issuedCode);
      setCopied(true);
    } catch {
      /* clipboard unavailable — the code is on screen to be written down */
    }
  }

  const reload = useCallback(async () => {
    if (token) await loadContent(token);
  }, [token, loadContent]);

  if (!mounted) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2F6B3F] border-t-transparent" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-4" suppressHydrationWarning>
        <Card className="w-full border-border/70 p-8" suppressHydrationWarning>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Lock className="h-6 w-6 text-[#2F6B3F]" aria-hidden="true" />
          </div>
          {issuedCode ? (
            <>
              <h1 className="mt-4 text-center text-2xl font-bold" suppressHydrationWarning>{t.admin.newRecoveryCodeTitle}</h1>
              <p className="mt-1 text-center text-sm text-muted-foreground" suppressHydrationWarning>{t.admin.newRecoveryCodeIntro}</p>
              <div className="mt-5 flex items-center gap-2 rounded-md border border-border/70 bg-secondary/40 p-3">
                <code className="flex-1 select-all break-all font-mono text-base tracking-widest">{issuedCode}</code>
                <Button type="button" variant="outline" size="sm" onClick={copyIssuedCode}>
                  {copied ? t.admin.copied : t.admin.copy}
                </Button>
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground" suppressHydrationWarning>{t.admin.recoverySignInPrompt}</p>
              <Button
                type="button"
                className="mt-4 w-full bg-[#2F6B3F] text-white hover:bg-[#275A34]"
                onClick={backToLogin}
                suppressHydrationWarning
              >
                {t.admin.backToLogin}
              </Button>
            </>
          ) : recovering ? (
            <>
              <h1 className="mt-4 text-center text-2xl font-bold" suppressHydrationWarning>{t.admin.recoverTitle}</h1>
              <p className="mt-1 text-center text-sm text-muted-foreground" suppressHydrationWarning>{t.admin.recoverIntro}</p>
              <form onSubmit={resetWithRecovery} className="mt-6 space-y-4" suppressHydrationWarning>
                <div className="space-y-2">
                  <Label htmlFor="recovery-code" suppressHydrationWarning>{t.admin.recoveryCodeLabel}</Label>
                  <Input
                    id="recovery-code"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder={t.admin.recoveryCodePlaceholder}
                    autoComplete="off"
                    className="font-mono uppercase"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recovery-new-pass" suppressHydrationWarning>{t.cms.newPasscodeLabel}</Label>
                  <Input
                    id="recovery-new-pass"
                    type="password"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recovery-confirm-pass" suppressHydrationWarning>{t.cms.confirmPasscodeLabel}</Label>
                  <Input
                    id="recovery-confirm-pass"
                    type="password"
                    value={confirmNewPasscode}
                    onChange={(e) => setConfirmNewPasscode(e.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                  />
                </div>
                {recoveryError ? <p className="text-xs text-destructive">{recoveryError}</p> : null}
                <Button type="submit" className="w-full bg-[#2F6B3F] text-white hover:bg-[#275A34]" suppressHydrationWarning>
                  {t.admin.resetPasscodeBtn}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={backToLogin}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  ← {t.admin.backToLogin}
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-center text-2xl font-bold" suppressHydrationWarning>{t.admin.title}</h1>
              <p className="mt-1 text-center text-sm text-muted-foreground" suppressHydrationWarning>{t.admin.subtitle}</p>
              <form onSubmit={login} className="mt-6 space-y-4" suppressHydrationWarning>
                <div className="space-y-2" data-tour="admin-login">
                  <Label htmlFor="admin-pass" suppressHydrationWarning>{t.admin.passcode}</Label>
                  <div className="relative">
                    <Input
                      id="admin-pass"
                      type={showPasscode ? 'text' : 'password'}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder={t.admin.passcodePlaceholder}
                      autoComplete="current-password"
                      className="pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscode((visible) => !visible)}
                      aria-label={
                        showPasscode
                          ? lang === 'en'
                            ? 'Hide passcode'
                            : 'Masquer le code d’accès'
                          : lang === 'en'
                            ? 'Show passcode'
                            : 'Afficher le code d’accès'
                      }
                      aria-pressed={showPasscode}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showPasscode ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {authError ? <p className="text-xs text-destructive">{t.admin.wrongPasscode}</p> : null}
                  {authNotice ? <p className="text-xs text-destructive">{authNotice}</p> : null}
                </div>
                <Button type="submit" className="w-full bg-[#2F6B3F] text-white hover:bg-[#275A34]" suppressHydrationWarning>
                  {t.admin.login}
                </Button>
              </form>
              <div className="mt-4 text-center" data-tour="admin-forgot">
                <button
                  type="button"
                  onClick={() => setRecovering(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  {t.admin.forgotPasscode}
                </button>
              </div>
              <div className="mt-3 text-center" data-tour="admin-back">
                <button
                  type="button"
                  onClick={() => navigate('home')}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  ← {lang === 'en' ? 'Back to website' : 'Retour au site'}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3" data-tour="admin-header">
        <div>
          <h1 className="text-2xl font-bold">{t.admin.title}</h1>
          <p className="text-sm text-muted-foreground">{t.admin.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('home')}>
            ← {lang === 'en' ? 'Public site' : 'Site public'}
          </Button>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> {t.admin.logout}
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AdminTab)}
        className="mt-6"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-secondary/60 p-1.5 sm:grid-cols-4" aria-label={t.cms.tabsLabel} data-tour="admin-tabs">
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
            <PanelFallback
              error={loadError}
              loadingLabel={t.cms.loading}
              errorLabel={t.cms.loadError}
              retryLabel={t.cms.retry}
              onRetry={reload}
            />
          )}
        </TabsContent>

        <TabsContent value="news" className="mt-6">
          {content ? (
            <NewsPanel token={token} content={content} reload={reload} />
          ) : (
            <PanelFallback
              error={loadError}
              loadingLabel={t.cms.loading}
              errorLabel={t.cms.loadError}
              retryLabel={t.cms.retry}
              onRetry={reload}
            />
          )}
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          {content ? (
            <SettingsPanel token={token} content={content} reload={reload} />
          ) : (
            <PanelFallback
              error={loadError}
              loadingLabel={t.cms.loading}
              errorLabel={t.cms.loadError}
              retryLabel={t.cms.retry}
              onRetry={reload}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
