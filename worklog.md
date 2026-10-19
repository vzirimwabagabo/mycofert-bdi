# Worklog

---
Task ID: 1
Agent: main (Z.ai)
Task: Build MYCOFERT Burundi bilingual corporate website (Next.js) from user-provided requirements spec + ChatGPT conversation context (shared link about requirements gathering for a mushroom farming client).

Work Log:
- Fetched and analyzed shared ChatGPT conversation (requirements-gathering advice + MYCOFERT Burundi poster analysis: 7 products, Bujumbura, French marketing, solid 50kg / liquid 20L fertilizers, phones +257 79 000 000 / 68 000 000, info@mycofert.bi).
- User provided formal spec: bilingual FR (default) + EN with language URLs, 7 sections (Home, Products, About, Sustainability, Training, News, Contact), 5-subject inquiry forms, staff CMS, basic analytics, no e-commerce/payments, green/leaf/brown identity.
- Initialized fullstack env (init script), loaded skills: fullstack-dev, image-generation, agent-browser.
- Generated 9 brand images via z-ai CLI (hero, fresh, dried, powder, packaged, substrate, fertilizer, sustainability, training) into public/images/ (32-multiple size constraint discovered: 1440x720 rejected, use 1344x768).
- Prisma schema: Inquiry (name/phone/email/type/product/message/lang/status) + PageView (path/lang). Pushed to SQLite (db/custom.db).
- i18n: src/lib/i18n/fr.ts (default, full copy), en.ts (type-checked Dict mirror), index.ts helpers.
- Hash-based router with language URLs (sandbox exposes only "/" route): #/fr, #/en, #/fr/produits|/en/products, #/fr/actualites/<slug>, #/admin. useSyncExternalStore for hash + stored lang (React hooks lint compliant). Per-route document.title, <html lang>, first-party pageview tracking.
- Components: context.tsx (router/lang), bits.tsx (Logo SVG, Wordmark, CtaPair, PageHero), header.tsx (sticky nav, lang dropdown, mobile Sheet), footer.tsx (sticky, 4 cols, WhatsAppFloat), inquiry-form.tsx (5 subjects + product select, zod-like manual validation, use-toast feedback), home/products/about/sustainability/training/news/contact pages, admin.tsx (passcode gate, stats cards, byType, topPages, table, status toggle, CSV export with BOM).
- APIs: POST /api/inquiries (validated create), POST /api/track (pageviews), POST /api/admin/auth (passcode→token, ADMIN_PASSCODE env, default mycofert2026), GET+PATCH /api/admin/data (token-verified stats + status updates).
- Theme: oklch forest green primary, leaf secondary, cream bg, brown accents; rounded-xl; scroll-behavior smooth; selection tint. Favicon.svg mushroom logo. Layout metadata bilingual FR default + OG/Twitter.
- Lint fixes: rewrote context from setState-in-effect to useSyncExternalStore (react-hooks/set-state-in-effect errors); fixed hero outline button white-on-white (restyled as transparent border anchor); replaced emoji step icons with lucide; added SheetDescription (a11y warning).
- Agent-browser E2E verification PASSED: FR home full render, EN switch (#/en), products page, contact form submission (toast "Inquiry sent", DB row verified via Prisma), admin login (mycofert2026), stats/pageviews/top-pages populated, status toggle new→handled (newCount 1→0), news post per-title SEO, mobile 390x844 home + sheet menu, footer sticky, console clean, lint clean.

Stage Summary:
- Deliverable: complete bilingual corporate website for MYCOFERT Burundi, single Next.js app on port 3000.
- Routes: #/fr (default) + #/en with all sections; #/admin team dashboard.
- Key files: src/components/site/* (11 files), src/lib/i18n/* (3), src/lib/site.ts, src/app/api/{inquiries,track,admin/*}, prisma/schema.prisma, public/images/* (9 PNG).
- Admin passcode: mycofert2026 (override via ADMIN_PASSCODE env).
- Contact details are placeholders from the poster — update in src/lib/site.ts when the client confirms real numbers.
- Out of scope per spec (not built): checkout, payments, inventory, customer portals.

---
Task ID: 2
Agent: main (Z.ai)
Task: Fix reported React hydration error ("server rendered Welcome / client rendered Accueil") and re-verify the full bilingual site.

Work Log:
- Diagnosis: "Welcome" exists nowhere in current source — it came from stale English-era server HTML in the user's browser being hydrated by the new bilingual client code (dev.log showed "Fast Refresh had to perform a full reload due to a runtime error" at that moment). Underlying fragility: SiteProvider read localStorage + window.location.hash via useSyncExternalStore during render, so any server/client divergence surfaced as a hydration mismatch.
- Hardened src/components/site/context.tsx: replaced the two render-time stores with one module-level external store whose snapshot is { hash: '', storedLang: null } on BOTH server and first client render (guaranteed match); real hash + localStorage preference are adopted once AFTER hydration from a mount effect (external-store mutation, no setState-in-effect, lint-clean); hashchange listener added post-hydration; removed subscribeNoop store entirely.
- Bonus spec alignment: bare "/" (or any lang-less hash except #/admin) is now promoted via location.replace() to a dedicated language URL (#/fr or #/en per stored preference) — language URLs always explicit after load; setLang on #/admin now applies the new language immediately via the store instead of requiring a reload.
- next.config.ts: added allowedDevOrigins ["*.space-z.ai"] to fix the cross-origin preview warning for /_next/* dev resources.
- Lint: clean (bun run lint, zero errors/warnings). Dev server restarted cleanly after config change.
- agent-browser E2E all PASSED with zero console errors/hydration warnings: (A) fresh "/" renders FR and URL promotes to #/fr; (B) hard reload on #/en renders EN, no mismatch; (C) stored mycofert-lang=en + bare "/" renders EN and promotes URL to #/en — the exact scenario class the user reported, now clean; (D) header language switch FR↔EN updates URL + content; (E) contact form: all 5 Radix subjects selectable, validation OK, POST /api/inquiries 200, DB row written (verified type/lang/message), fields cleared on success; real mouse click after smooth-scroll settles works (mid-animation clicks are a test artifact only); (F) admin login mycofert2026 shows stats + new rows; (G) mobile 390x844 renders with menu, URL promotion works.
- Deleted the 2 test inquiry rows ("Test Hydratation", "Click Test") created during verification to keep the dev DB tidy.

Stage Summary:
- Hydration mismatch eliminated structurally: first client render can never diverge from server HTML; client-only preferences apply post-hydration as normal updates.
- Files changed: src/components/site/context.tsx (external store rewrite), next.config.ts (allowedDevOrigins).
- Admin passcode unchanged: mycofert2026. Contact placeholders unchanged (src/lib/site.ts) pending client confirmation.

---
Task ID: 3
Agent: main (Z.ai)
Task: Act as a consultant and produce a French requirements document (cahier des charges) for the MYCOFERT Burundi website, to serve as a model example of how a website requirements document should look.

Work Log:
- Loaded pdf skill; routed to Report brief (ReportLab). Read the full skill chain: SKILL.md, configs/fonts.md, briefs/report.md, typesetting/{palette,cover,cover-backgrounds,overflow,pagination,typography,fill-engine}.md.
- Palette: design_engine palette-cascade --intent nature --mode minimal --seed 42 (forest-green family matching MYCOFERT brand); colors used exclusively from cascade output (ReportLab + CSS cover aliases).
- Body: scripts/cdc_body.py — TocDocTemplate + multiBuild, FreeSerif family + NotoSerifSC fallback + install_font_fallback, French formal consulting tone. Content: 8 chapters (contexte, objectifs/KPI, périmètre + exclusions contractuelles incl. garde-fou anti-promesse d'export, 25 exigences fonctionnelles numérotées NAV/LIN/PRD/FOR/ADM/ANA/ACT priorisées MoSCoW, exigences non fonctionnelles, direction artistique, contenus/responsabilités, planning/recette en 5 phases) + Annexe A (récits utilisateurs des 6 segments) + Annexe B (matrice de couverture 25 lignes = instrument de recette). 17 tableaux, toutes cellules en Paragraph, colWidths proportionnels, repeatRows=1, hAlign CENTER.
- Numbering plan (Step 3.5): cover/TOC non numérotés, chapitres 1-8 + annexes A/B. Pagination: TOC en romain (i, ii), corps réinitialisé à 1 — implémenté via beforeDocument/afterFlowable + build en deux passages (CDC_FIXED_F découvert puis figé) car la normalisation des numéros masquait la convergence de multiBuild.
- Cover: Template 01 HUD (fond clair, ligne d'ancrage verticale verte, kicker/hero/summary/meta) en HTML avec aliases cascade; corrigé écart texte↔ligne 32px→50px après cover_validate.js; validé par poster_validate.py check-html; rendu via html2poster.js --width 794px.
- Merge pypdf avec normalisation A4 stricte (0.1pt), meta.brand, font.check (0 issue), pdf_qa.py --skip-cover: PASS intégral (20 pages). Correctifs en cours de route: retrait Noto Sans SC (fichier absent), bulletFontName FreeSerif (Helvetica interdite), placeholders '—' → 'Sans objet'.
- Vérifications visuelles par rendu PNG (couverture, chapitre 1, page de tableaux): conformes.

Stage Summary:
- Livrables: download/cahier-des-charges-site-web-mycofert-burundi.pdf (20 pages A4, ~178 Ko, vectoriel, TOC cliquable) + download/cahier-des-charges-couverture.html (source HTML de la couverture, réutilisable).
- Scripts persistés: scripts/cdc_body.py, scripts/cdc_cover.html, scripts/cdc_merge.py (éditables pour itérer).
- Document conçu comme exemple pédagogique de cahier des charges: périmètre inclus/exclus explicites, exigences numérotées + MoSCoW, KPI mesurables, matrice de traçabilité, scénarios de recette.
