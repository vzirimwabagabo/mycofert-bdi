'use client';

// Guided tours — a spotlight over a real element plus a card explaining it.
//
// A step may move the app itself: `page` navigates, `tab` selects a dashboard
// tab, and the overlay then WAITS for the anchor to appear, because a
// client-side navigation renders asynchronously and the target is not in the
// DOM on the next tick. If an anchor never shows up — a stale admin token
// leaves the dashboard on the passcode screen, for instance — the step degrades
// to a centred card instead of breaking.
//
// Everything is driven by `data-tour` attributes so the panels do not need
// refs threaded through them, and so the tour can point at elements it does not
// own.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSite } from './context';
import { TOURS, type AdminTab, type TourId } from './tour-steps';
import { Compass, X } from 'lucide-react';

/** Same key admin.tsx uses to keep its session token. */
const TOKEN_KEY = 'mycofert-admin-token';

interface TourCtx {
  active: TourId | null;
  /** Dashboard tab requested by the current step, or null. */
  tab: AdminTab | null;
  start: (id: TourId) => void;
  stop: () => void;
}

const Ctx = createContext<TourCtx | null>(null);

export function useTour(): TourCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Breathing room between the spotlight and the element it surrounds. */
const SPOT_PAD = 6;
const CARD_WIDTH = 340;
const CARD_GAP = 12;
const EDGE = 12;
/** How long to keep waiting for an anchor after a navigation. */
const ANCHOR_TIMEOUT_MS = 2000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Track the viewport rectangle of `[data-tour="<anchor>"]`.
 *
 * Polled per animation frame rather than measured once: the element may not
 * exist yet (we just navigated), may be revealed by a tab switch, and may move
 * while the page is being scrolled. Polling also means one implementation
 * covers all three. Returns null when there is nothing to point at.
 */
function useAnchorBox(anchor: string | null): Box | null {
  // The anchor is remembered next to the measurement so a box measured for the
  // previous step is never drawn around the current one while we look for it.
  const [measured, setMeasured] = useState<{ anchor: string; box: Box } | null>(null);

  useEffect(() => {
    if (!anchor) return;

    let frame = 0;
    let disposed = false;
    const deadline = Date.now() + ANCHOR_TIMEOUT_MS;
    let scrolled = false;

    const tick = () => {
      if (disposed) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          if (!scrolled) {
            scrolled = true;
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
          setMeasured((prev) =>
            prev &&
            prev.anchor === anchor &&
            prev.box.top === r.top &&
            prev.box.left === r.left &&
            prev.box.width === r.width &&
            prev.box.height === r.height
              ? prev
              : { anchor, box: { top: r.top, left: r.left, width: r.width, height: r.height } }
          );
          frame = requestAnimationFrame(tick);
          return;
        }
      }
      // Keep polling until the anchor shows up, then give up silently: the
      // returned value stays null for this anchor, so the step degrades to a
      // centred card rather than pointing at nothing.
      if (Date.now() < deadline) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, [anchor]);

  return anchor && measured?.anchor === anchor ? measured.box : null;
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

function TourOverlay({
  id,
  index,
  onIndexChange,
  onStop,
}: {
  id: TourId;
  index: number;
  onIndexChange: (next: number) => void;
  onStop: () => void;
}) {
  const { t, route, navigate } = useSite();
  const steps = TOURS[id];
  const step = steps[index];
  const total = steps.length;

  const anchor = step && (!step.page || route.page === step.page) ? step.anchor ?? null : null;
  const box = useAnchorBox(anchor);

  // Send the visitor to the page this step belongs to. Guarded by the route
  // page, so this settles after one hop instead of looping.
  useEffect(() => {
    if (step?.page && route.page !== step.page) navigate(step.page);
  }, [step, route.page, navigate]);

  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(200);

  // Whether the card fits below the spotlight depends on its own height, which
  // varies with the text (and with the language), so it is measured rather than
  // guessed. A ResizeObserver delivers the size before paint, so the card is
  // never briefly drawn in the wrong place.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setCardHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A rotation or a window resize moves the spotlight without moving the box.
  const [, forceLayout] = useState(0);
  useEffect(() => {
    const onResize = () => forceLayout((n) => n + 1);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Focus lands on the card each time, so the keyboard follows the tour and a
  // screen reader announces the new step.
  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  const stop = useCallback(() => onStop(), [onStop]);
  const next = useCallback(() => {
    if (index + 1 >= total) onStop();
    else onIndexChange(index + 1);
  }, [index, total, onIndexChange, onStop]);
  const prev = useCallback(() => onIndexChange(Math.max(0, index - 1)), [index, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stop]);

  if (!step) return null;

  const copy = t.tour.steps[step.key];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const titleId = `tour-step-${id}-${index}`;

  let cardStyle: React.CSSProperties = {
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: CARD_WIDTH,
  };
  let spotStyle: React.CSSProperties | null = null;

  if (box) {
    const spot = {
      top: box.top - SPOT_PAD,
      left: box.left - SPOT_PAD,
      width: box.width + SPOT_PAD * 2,
      height: box.height + SPOT_PAD * 2,
    };
    spotStyle = { top: spot.top, left: spot.left, width: spot.width, height: spot.height };

    const fitsBelow = spot.top + spot.height + CARD_GAP + cardHeight <= vh;
    const fitsAbove = spot.top - CARD_GAP - cardHeight >= 0;
    // Honour the step's preference when there is room, otherwise fall back to
    // whichever side has space — a full-height anchor leaves only one option.
    const placeAbove = step.placement === 'top' ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
    const top = placeAbove ? spot.top - CARD_GAP - cardHeight : spot.top + spot.height + CARD_GAP;

    cardStyle = {
      top: clamp(top, EDGE, Math.max(EDGE, vh - cardHeight - EDGE)),
      left: clamp(spot.left + spot.width / 2 - CARD_WIDTH / 2, EDGE, Math.max(EDGE, vw - CARD_WIDTH - EDGE)),
      width: CARD_WIDTH,
    };
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
      return;
    }
    if (e.key !== 'Tab') return;
    // Keep focus inside the card — the page behind it is deliberately
    // unreachable while the tour runs.
    const nodes = Array.from(
      cardRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return;
    const active = document.activeElement as HTMLElement | null;
    const inside = cardRef.current?.contains(active) ?? false;
    if (e.shiftKey && (!inside || active === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (!inside || active === last)) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    // The wrapper takes the clicks: with the box-shadow spotlight below, the
    // dimmed area is not an element, so nothing else would swallow them.
    <div className="fixed inset-0 z-[70]" role="presentation">
      {spotStyle ? (
        <div
          className="absolute rounded-xl ring-2 ring-white/80"
          style={{ ...spotStyle, boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' }}
          aria-hidden="true"
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={cardStyle}
        onKeyDown={onKeyDown}
        className="fixed max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.tour.counter.replace('{n}', String(index + 1)).replace('{total}', String(total))}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-1 -mt-1 h-7 w-7 shrink-0"
            onClick={stop}
            aria-label={t.tour.close}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <h2 id={titleId} className="mt-1 text-base font-semibold">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={stop}>
            {t.tour.skip}
          </Button>
          <div className="flex items-center gap-2">
            {index > 0 ? (
              <Button variant="outline" size="sm" onClick={prev}>
                {t.tour.prev}
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={next}
              className="bg-[#2F6B3F] text-white hover:bg-[#275A34]"
            >
              {index + 1 >= total ? t.tour.finish : t.tour.next}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider + launcher
// ---------------------------------------------------------------------------

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<TourId | null>(null);
  const [index, setIndex] = useState(0);

  const step = active ? TOURS[active][index] ?? null : null;
  const tab = step?.tab ?? null;

  const start = useCallback((id: TourId) => {
    setIndex(0);
    setActive(id);
  }, []);
  const stop = useCallback(() => setActive(null), []);

  const value = useMemo<TourCtx>(() => ({ active, tab, start, stop }), [active, tab, start, stop]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {active ? (
        <TourOverlay
          id={active}
          index={index}
          onIndexChange={setIndex}
          onStop={stop}
        />
      ) : null}
    </Ctx.Provider>
  );
}

function subscribeToSession(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSessionSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.sessionStorage.getItem(TOKEN_KEY));
}

function getServerSnapshot(): boolean {
  return false;
}

/** Header "Guide" button that opens tour options or starts public tour. */
export function TourButton() {
  const { t, route, navigate } = useSite();
  const { start } = useTour();
  const signedIn = useSyncExternalStore(subscribeToSession, getSessionSnapshot, getServerSnapshot);

  const startAdmin = () => {
    if (route.page !== 'admin') navigate('admin');
    start('admin');
  };

  const startPublic = () => {
    start('public');
  };

  if (signedIn) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id="tour-header-trigger"
            variant="outline"
            size="sm"
            className="gap-1.5"
            aria-label={t.tour.launch}
            suppressHydrationWarning
          >
            <Compass className="h-4 w-4 text-[#2F6B3F]" aria-hidden="true" />
            <span className="hidden sm:inline font-medium">{t.tour.launch}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={startPublic}>
            {t.tour.menuPublic}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={startAdmin}>
            {t.tour.menuAdmin}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      id="tour-header-trigger"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={startPublic}
      aria-label={t.tour.launch}
      suppressHydrationWarning
    >
      <Compass className="h-4 w-4 text-[#2F6B3F]" aria-hidden="true" />
      <span className="hidden sm:inline font-medium">{t.tour.launch}</span>
    </Button>
  );
}

/** Floating "Guide" button listing the tours available from where you are. */
export function TourLauncher() {
  const { t, route, navigate } = useSite();
  const { start } = useTour();

  const startAdmin = () => {
    // Two different admin tours: the passcode screen and the signed-in
    // dashboard share no anchors, so the choice is made at click time.
    const signedIn = Boolean(window.sessionStorage.getItem(TOKEN_KEY));
    if (route.page !== 'admin') navigate('admin');
    start(signedIn ? 'admin' : 'admin-login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="fixed bottom-5 left-5 z-40 h-12 gap-2 rounded-full bg-background/95 px-4 shadow-lg"
          aria-label={t.tour.launch}
        >
          <Compass className="h-5 w-5 text-[#2F6B3F]" aria-hidden="true" />
          <span className="text-sm font-semibold">{t.tour.launch}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64">
        <DropdownMenuItem onClick={() => start('public')}>{t.tour.menuPublic}</DropdownMenuItem>
        <DropdownMenuItem onClick={startAdmin}>{t.tour.menuAdmin}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
