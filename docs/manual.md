# MYCOFERT Burundi — Operator's Manual

MYCOFERT Burundi is a bilingual (French default, English available) marketing and product
website with a self-hosted admin CMS behind a passcode. The public site presents the company's
six product lines, its about/sustainability/training/contact pages and its news, and it captures
customer inquiries through a contact form. The admin area at `/admin` lets a non-technical owner
manage the products, the news, the page texts and the inquiries — no rebuild or redeploy needed.
The stack is Next.js 16 (App Router), React 19, Prisma 6 + PostgreSQL, Tailwind CSS v4 and
Radix UI.

The interface is bilingual throughout. Where a label matters, this manual quotes the real
string in both languages as `Français / English`.

## UI labels used in this manual

| Concept | French | English |
|---|---|---|
| Products (nav + admin tab) | `Produits` | `Products` |
| News (nav + admin tab) | `Actualités` | `News` |
| Admin link (footer / mobile menu) | `Espace équipe` | `Team area` |
| Admin dashboard title | `Espace équipe` | `Team area` |
| Save | `Enregistrer` | `Save` |
| Delete | `Supprimer` | `Delete` |
| Add | `Ajouter` | `Add` |
| Edit | `Modifier` | `Edit` |
| Cancel | `Annuler` | `Cancel` |
| Published / Hidden (badges) | `Publié` / `Masqué` | `Published` / `Hidden` |
| Visible on the site (switch) | `Visible sur le site` | `Visible on the website` |
| Sign in / Sign out | `Se connecter` / `Se déconnecter` | `Sign in` / `Sign out` |
| Inquiries tab | `Demandes` | `Inquiries` |
| Site content tab | `Contenu du site` | `Site content` |

---

## Part 1 — The public website

### URL model

Every public page is a real indexable path with a language prefix (`fr` or `en`). A bare `/`
renders French and is canonicalised client-side to `/{lang}`. The canonical segment the app
builds is the one shown below; the French segment aliases also parse (e.g. `/fr/produits` and
`/fr/products` reach the same page).

| Page | Canonical URL (FR / EN) | Aliases accepted |
|---|---|---|
| Home | `/fr`, `/en` | — |
| Products | `/fr/products`, `/en/products` | `produits` |
| About | `/fr/about`, `/en/about` | `a-propos` |
| Sustainability | `/fr/sustainability`, `/en/sustainability` | `durabilite` |
| Training | `/fr/training`, `/en/training` | `formation` |
| News | `/fr/news`, `/en/news` | `actualites` |
| News article | `/fr/news/{slug}`, `/en/news/{slug}` | — |
| Contact | `/fr/contact`, `/en/contact` | — |
| Admin | `/admin` (no language segment) | — |

The admin dashboard is not indexed: its server metadata sets `robots: { index: false, follow: false }`.
An unknown path returns a 404, and a news URL whose slug does not exist is also a 404 (not the
news listing).

### Header and footer (every public page)

The header shows the MYCOFERT logo, the seven navigation links and, on desktop, a green
`Nous contacter` / `Contact us` button. The navigation labels are: `Accueil` / `Home`,
`Produits` / `Products`, `À propos` / `About Us`, `Durabilité` / `Sustainability`,
`Formation` / `Training`, `Actualités` / `News`, `Contact` / `Contact`.

- **Language switch**: an outlined button with a globe icon showing the current code (`FR` or
  `EN`). Its menu offers `Français` and `English`; the active language is ticked. Switching
  changes the language prefix in the URL and remembers the choice in the browser
  (`localStorage`).
- **Mobile menu**: on small screens the seven links collapse into a slide-in panel, which also
  contains a link to the admin area (lock icon, labelled `Espace équipe` / `Team area`).

The footer (dark green) shows the logo, the motto, the tagline, then three columns:
`Explorer` / `Explore` (the same seven links), `Produits` / `Products` (the first six products,
each linking to the products page) and `Contact` / `Contact` (phone numbers, a WhatsApp link, the
e-mail address and the city — country). The bottom line shows `© {year} MYCOFERT Burundi.` plus
`Tous droits réservés.` / `All rights reserved.` and a small `Espace équipe` / `Team area` link
to the admin area.

A floating green **WhatsApp** button (bottom-right) opens a chat with a pre-filled order
message; it is hidden on the admin page. Phone links use `tel:` and WhatsApp links use `wa.me`.

### Home — `/{lang}`

- **Hero band**: an editable badge, main title and subtitle, an image, and two buttons —
  `Voir nos produits` / `Explore our products` (goes to Products) and
  `Commander via WhatsApp` / `Order via WhatsApp` (opens WhatsApp). Below them are three
  statistics whose numbers are fixed (`6+`, `6`, `100%`) and whose captions are editable.
- **Product lines**: a card grid of all published products (image, name, tagline).
- **Who our products serve**: six segment cards (e.g. `Ménages` / `Households`,
  `Restaurants`, `Hôtels` / `Hotels`, `Supermarchés` / `Supermarkets`, `Commerces` / `Retailers`,
  `Industries agroalimentaires` / `Food-processing industries`).
- **Sustainability teaser** and **training teaser**: image + text + a link to the respective page.
- **News teaser**: the three most recent news posts, each with a `Lire la suite` / `Read more`
  link that opens the article.
- **Order band**: an editable title/text with the WhatsApp and call buttons.

### Products — `/{lang}/products` (alias `/{lang}/produits`)

A two-column grid of every published product. Each card shows the image, the product name, the
tagline, the description, the list of key points, the packaging formats (labelled
`Conditionnements` / `Packaging`) and a WhatsApp + call button pair. Below the grid is the note
`Les prix et disponibilités varient selon la saison et les quantités...` /
`Prices and availability vary by season and quantity...`.

A separate highlighted section promotes the bio-organic fertilizer (`Engrais bio-organiques` /
`Bio-organic fertilizers`), followed by a wholesale band with a WhatsApp button and a phone
button.

### About — `/{lang}/about` (alias `/{lang}/a-propos`)

An introductory text (three paragraphs), a hero image, two cards for `Notre mission` / `Our
mission` and `Notre vision` / `Our vision` (editable text), a `Nos activités` / `Our activities`
grid of four cards, a `Nos engagements` / `Our commitments` grid of four values, and a
blockquote with the brand motto.

### Sustainability — `/{lang}/sustainability` (alias `/{lang}/durabilite`)

An editable page title and subtitle, then the four-step process (`Substrat préparé` /
`Substrate prepared`, `Culture des champignons` / `Mushrooms cultivated`, `Récolte et
transformation` / `Harvest and processing`, `Substrat valorisé` / `Substrate valorized`), an
editable "circular agriculture" text (`Agriculture circulaire` / `A circular agriculture`) with
an image, and a `Notre impact` / `Our impact` grid of three impact cards.

### Training — `/{lang}/training` (alias `/{lang}/formation`)

An editable title, subtitle and introduction, a hero image, a `Ce que vous apprendrez` /
`What you will learn` list of six programme points, a `Pour qui ?` / `Who is it for?` group of
three audience cards, and a call-to-action section that embeds the inquiry form pre-set to the
training subject (see below). The button in the header/hero area is `Demander une formation` /
`Request training`.

### News — `/{lang}/news` (alias `/{lang}/actualites`)

A three-column grid of every published news post (image, displayed date, title, excerpt, and a
`Lire la suite` / `Read more` button). If there are no posts, the page shows
`Aucune demande pour le moment.` / `No inquiries yet.`

### News article — `/{lang}/news/{slug}`

The article image, its title and date in the hero band, the body paragraphs, a
`Retour aux actualités` / `Back to news` button and a `Nous contacter` / `Contact us` button.
The article's own title is used as the browser tab title and as the page description.

### Contact — `/{lang}/contact`

Four contact cards — phone (`Téléphone` / `Phone`), WhatsApp, e-mail (`E-mail` / `Email`) and
location (`Bujumbura, Burundi`) with the opening hours — followed by the inquiry form.

**Inquiry form fields** (also embedded on the Training page):

| Field | French | English | Required |
|---|---|---|---|
| Name | `Nom complet` | `Full name` | Yes |
| Phone / WhatsApp | `Téléphone / WhatsApp` | `Phone / WhatsApp` | Yes (≥ 7 digits) |
| Email | `E-mail (facultatif)` | `Email (optional)` | No |
| Subject | `Objet de la demande` | `Subject of inquiry` | Yes |
| Product concerned | `Produit concerné` | `Product concerned` | No (default `—`) |
| Message | `Message` | `Message` | Yes |

The **Subject** choices are `Renseignements produits` / `Product information`,
`Fourniture en gros` / `Bulk supply`, `Engrais bio-organique` / `Bio-organic fertilizer`,
`Formation` / `Training` and `Partenariat` / `Partnership`. The **Product concerned** dropdown
lists the current published products plus a blank `—` option.

Submitting shows a toast: `Demande envoyée !` / `Inquiry sent!` on success, or
`Échec de l'envoi` / `Submission failed` on failure. A hidden "website" field (a honeypot)
silently discards automated submissions.

---

## Part 2 — The admin area

This part is written for the site owner. No technical knowledge is needed.

### How to reach it and sign in

1. Open the site and click `Espace équipe` / `Team area` in the footer (or the lock link in the
   mobile menu), or go directly to `/admin`.
2. Type the passcode in the `Code d'accès` / `Passcode` field and click
   `Se connecter` / `Sign in`.
3. On success you land on the dashboard titled `Espace équipe` / `Team area`. The top-right has
   a `← Site public` / `← Public site` button and a `Se déconnecter` / `Sign out` button.

If the passcode is wrong you see `Code incorrect.` / `Incorrect passcode.`. If you try too many
times you see `Too many attempts. Please wait and try again.` and must wait for the rate-limit
window to reset (see Part 4).

Your sign-in lasts 12 hours, and it also ends if you close the browser tab (the session is kept
only for the current tab). See "Sessions expiring after 12 hours" in Part 4.

### The four tabs

| Tab | French | English | What it manages |
|---|---|---|---|
| Requests | `Demandes` | `Inquiries` | Statistics, the inquiry table, CSV export |
| Products | `Produits` | `Products` | Products shown on the public site |
| News | `Actualités` | `News` | News articles |
| Site content | `Contenu du site` | `Site content` | Page texts, contact details, passcode, recovery code |

### Reading and exporting the customer inquiries

The `Demandes` / `Inquiries` tab opens by default and shows:

- **Three statistic cards**: `Demandes totales` / `Total inquiries`,
  `Nouvelles demandes` / `New inquiries` and `Visites de pages` / `Page views`.
- **Two breakdown lists**: `Demandes par objet` / `Inquiries by subject` (a count for each of the
  five subjects) and `Pages les plus vues` / `Most viewed pages` (the eight most visited paths).
- **Filter**: a dropdown (`Objet` / `Subject`) with `Tous` / `All` plus the five subjects; it
  filters the table below.
- A **refresh** button (circular arrow icon) that reloads the data, and an
  `Exporter CSV` / `Export CSV` button.

The table has these columns: `Date`, `Nom` / `Name`, `Téléphone` / `Phone`,
`Objet` / `Subject`, `Message`, `Langue` / `Language`, `Statut` / `Status`.

**To mark an inquiry as handled** (or reopen it): click the button in the `Statut` / `Status`
column. For a new inquiry it reads `Marquer traitée` / `Mark handled`; once handled it reads
`Rouvrir` / `Reopen`. Clicking it toggles the state and updates the "new" count immediately.

**To export the table**: click `Exporter CSV` / `Export CSV`. A file named
`mycofert-inquiries-YYYY-MM-DD.csv` is downloaded. Its columns are:
`id, date, name, phone, email, subject, product, language, status, message`. The file is UTF-8
with a byte-order mark (so accents open correctly in Excel) and values that look like
spreadsheet formulas are defused with a leading apostrophe.

### Adding a product

1. Open the `Produits` / `Products` tab.
2. Click the green `Ajouter` / `Add` button (top-right).
3. In the dialog fill in:
   - `Image du produit` / `Product image` — pick a library image or upload one (see below).
   - `Visible sur le site` / `Visible on the website` — the publish switch.
   - `Identifiant (slug)` / `Identifier (slug)` — the URL identifier. If you leave it blank it is
     generated from the French name. The hint is
     `Lettres minuscules et tirets, ex. champignons-frais` /
     `Lowercase letters and dashes, e.g. fresh-mushrooms`.
   - `Nom du produit` / `Product name` (required — the French value must not be empty).
   - `Accroche` / `Tagline`.
   - `Description` / `Description`.
   - `Points forts — Un point par ligne.` / `Key points — One point per line.`
   - `Conditionnements` / `Packaging formats`.
4. Click `Enregistrer` / `Save`. A `Modifications enregistrées.` / `Changes saved.` message
   appears and the new product shows in the list and on the public site.

Each bilingual field has two boxes side by side, marked with a green `FR` chip and a brown `EN`
chip.

### Changing a product photo

1. On the `Produits` / `Products` tab, click `Modifier` / `Edit` on the product.
2. Under `Image du produit` / `Product image`:
   - **Use a built-in image**: click one of the nine thumbnails. The available library keys are
     `fresh`, `dried`, `powder`, `packaged`, `substrate`, `fertilizer`, `sustainability`,
     `training`, `hero`.
   - **Upload your own**: click the `Upload image` button, choose a file (image formats only,
     maximum 5 MB). The file uploads straight to Cloudinary and its address is stored with the
     product. To go back to a library image, click `Use library image instead`.
3. Click `Enregistrer` / `Save`.

An uploaded image always takes precedence over the selected library image. If image uploads are
not enabled on the server, the `Upload image` button returns an explanatory error — the library
images keep working.

### Editing, hiding, reordering and deleting products

- **Hide / show**: use the `Visible sur le site` / `Visible on the website` switch on the
  product's card. Hidden products still appear in the dashboard but not on the public site.
- **Reorder**: use the up and down arrow buttons (`Monter` / `Move up`,
  `Descendre` / `Move down`) to change the display order.
- **Edit**: `Modifier` / `Edit`.
- **Delete**: `Supprimer` / `Delete`, then confirm in the dialog
  (`Confirmer la suppression` / `Confirm deletion` — `Cette action est définitive et ne peut pas
  être annulée.` / `This action is permanent and cannot be undone.`). Deletion is permanent.

### Publishing a news item

1. Open the `Actualités` / `News` tab and click `Ajouter` / `Add`.
2. Fill in: image, the `Visible sur le site` / `Visible on the website` switch,
   `Identifiant (slug)` / `Identifier (slug)`, `Date affichée` / `Displayed date` (separate FR
   and EN boxes — the date is free text, e.g. a month and year), `Titre` / `Title` (required — the
   French value must not be empty), `Résumé` / `Summary`, and `Contenu de l'article` / `Article
   content` (leave an empty line between paragraphs).
3. Click `Enregistrer` / `Save`. The article appears on the News page, in the homepage teaser and
   on its own page at `/{lang}/news/{slug}`.

News articles can be edited, hidden/shown, and deleted the same way as products. If two items
would share the same identifier, the save is refused with
`Cet identifiant est déjà utilisé. Choisissez-en un autre.` /
`This identifier is already in use. Choose another one.`

### Changing the text on the home page (and other page texts)

1. Open the `Contenu du site` / `Site content` tab. Each group is saved separately with its own
   `Enregistrer` / `Save` button.
2. **`Page d'accueil` / `Homepage`** holds the hero badge, main title, subtitle, the hero image,
   the three statistic captions and the "order now" band title and text.
3. The other groups are:
   - **`Coordonnées` / `Contact details`** — phone numbers (up to four, each with a
     `Libellé affiché` / `Displayed label` and a `Numéro` / `Number`; use `Ajouter un numéro` /
     `Add a number` and `Retirer` / `Remove`), `Numéro WhatsApp`, `Adresse e-mail` / `Email
     address`, `Ville` / `City`, `Pays` / `Country`, and `Horaires d'ouverture` / `Opening hours`
     (FR + EN).
   - **`Page Formation` / `Training page`** — title, subtitle, introduction.
   - **`Mission et vision` / `Mission and vision`** — mission text and vision text.
   - **`Page Durabilité` / `Sustainability page`** — title, subtitle and the "circular
     agriculture" text.
4. Edit the fields and click `Enregistrer` / `Save`. Every field has an FR box and an EN box, so
   you can supply both languages.

### Changing my passcode

1. On the `Contenu du site` / `Site content` tab, scroll to `Sécurité et code d'accès` /
   `Security & Passcode`.
2. Enter the `Code d'accès actuel` / `Current passcode`, then the
   `Nouveau code d'accès (min. 12 caractères)` / `New passcode (min. 12 characters)` and the
   `Confirmer le nouveau code d'accès` / `Confirm new passcode`.
3. Click `Mettre à jour le code d'accès` / `Update passcode`. On success you see
   `Code d'accès administrateur mis à jour avec succès.` /
   `Admin passcode updated successfully.`

The new passcode must be **at least 12 characters** and must match its confirmation. If the
current passcode is wrong the update is refused.

> **Before you change the passcode, generate a recovery code.** While you are still signed in,
> go to `Code de secours` / `Recovery code`, enter your current passcode and click
> `Générer un code de secours` / `Generate a recovery code`. The code is shown **once** —
> `Il n'est affiché qu'une seule fois et remplace tout code de secours précédent.` /
> `It is shown only once, and it replaces any previous recovery code.` Copy it
> (`Copier` / `Copy`) and keep it off this computer (on paper or in your phone), then click
> `Je l'ai conservé` / `I have saved it`.

### I forgot my passcode

1. On the `/admin` sign-in screen click `Code d'accès oublié ?` / `Forgot your passcode?`.
2. On the `Récupérer l'accès` / `Recover access` screen, enter the
   `Code de secours` / `Recovery code` you saved, plus a new passcode and its confirmation.
3. Click `Réinitialiser le code d'accès` / `Reset passcode`.

If it succeeds, the dashboard shows your **new** recovery code —
`Voici votre nouveau code de secours... il remplace l'ancien et ne sera plus affiché.` /
`Here is your new recovery code... it replaces the old one and will not be shown again.` Write it
down. The old recovery code is consumed and cannot be reused, and you can then sign in with the
new passcode.

> **WARNING — editing the environment file does NOT recover a forgotten passcode.** Once the
> passcode has been changed in the dashboard (or reset with a recovery code), the passcode hash
> stored in the database wins and the `ADMIN_PASSCODE` environment variable is ignored. Changing
> `ADMIN_PASSCODE` in the server environment file and restarting will **not** get you back in.
> The supported way back is the recovery code above. The last resort is for whoever hosts the
> site to delete the `admin_passcode_hash` row from the database (e.g. with `npm run db:studio`),
> after which `ADMIN_PASSCODE` is used again.

If no recovery code was ever generated, the reset screen cannot help — the dashboard says that
whoever hosts the site can reset the passcode from the server.

---

## Part 3 — Running and deploying the app

This part is for whoever operates the server.

### Install and run locally

Prerequisites: Node.js 20+, and Docker (for the bundled local PostgreSQL) or your own PostgreSQL.

```bash
npm install                 # install dependencies
docker compose up -d        # start the local PostgreSQL (docker-compose.yml)
cp .env.example .env        # then edit .env and set the required variables
npm run db:migrate          # create the tables and apply migrations (development)
npm run db:seed             # optional: seed initial CMS content
npm run dev                 # start the dev server on http://localhost:3000
```

Open http://localhost:3000; the admin dashboard is at `/admin`.

The app never needs a database during `next build` — Prisma generates its client from the schema
file, not from a live connection.

### npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server on port **3000** |
| `npm run build` | `next build`, then `node scripts/prepare-standalone.mjs`; produces the standalone server at `.next/standalone/server.js` |
| `npm run start` | Runs the built standalone server: `node .next/standalone/server.js` |
| `npm run lint` | ESLint over the project |
| `npm run typecheck` | TypeScript type-check (`tsc --noEmit`) |
| `npm test` | Vitest unit tests (`vitest run`) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run images:manifest` | Regenerate `src/lib/image-manifest.json` from `public/images` |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Seed initial CMS content |
| `npm run db:studio` | Open Prisma Studio (inspect/edit rows) |
| `npm run db:reset` | Reset the database and re-apply migrations |

`dev` and `build` are each preceded by an automatic step (`predev` / `prebuild`) that runs
`node scripts/gen-image-manifest.mjs`.

### The image-manifest build step

`scripts/gen-image-manifest.mjs` scans `public/images`, matches each file's basename to a library
slot and writes `src/lib/image-manifest.json` mapping the slot to its real public URL. This is
why the library keys work regardless of the file extension: `.png`, `.jpg`, `.jpeg`, `.webp`,
`.avif`, `.gif` and `.svg` are all accepted, and if the same slot exists in several formats the
highest-priority format wins (priority order: `avif`, `webp`, `jpg`, `jpeg`, `png`, `gif`,
`svg`). The manifest is regenerated automatically before `dev` and `build`; if you add or replace
a file in `public/images` on a running deployment, run `npm run images:manifest` (or rebuild) so
the change is picked up.

### Environment variables

Set these as deployment secrets; never commit a populated `.env`. See `.env.example` for the
annotated template.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (use the pooled URL on Neon/Supabase). A file-based database is not supported: the app runs on multiple instances. |
| `DIRECT_URL` | **Yes** | Direct (unpooled) connection used by Prisma migrations; for Neon remove `-pooler` from the host. |
| `ADMIN_SESSION_SECRET` | **Yes** | HMAC key that signs admin sessions. Must be **at least 32 characters** and identical across all instances. Without it the dashboard is unreachable (logins return 503). |
| `ADMIN_PASSCODE` | **Yes (initial)** | The starting admin passphrase; must be **at least 12 characters**. Used only until the passcode is first changed in the dashboard or reset with a recovery code. |
| `DATABASE_CONNECTION_LIMIT` | Optional | Prisma pool size per instance (default 10). Keep `instances × limit` below the database's max connections. |
| `RATE_LIMIT_REDIS_URL` / `RATE_LIMIT_REDIS_TOKEN` | Recommended | Upstash-compatible Redis for cross-instance rate limiting. Without it, each instance keeps its own in-memory counters (only correct for a single instance). `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are accepted as fallbacks. |
| `TRUST_PROXY` | Optional | Set to `1` only when a proxy you fully control overwrites `X-Forwarded-For`; otherwise leave unset (safe against IP spoofing). |
| `PAGEVIEW_RETENTION_DAYS` | Optional | Days of page-view rows to keep (default 365; `0` disables pruning). |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Optional | Enable image uploads from the dashboard. Leave all three empty to disable uploads; the built-in image library keeps working. |
| `SITE_URL` | Optional | Canonical public origin used in page metadata and the sitemap (defaults to `https://mycofert.bi`). |

### Migrations

- Development: `npm run db:migrate` creates and applies migrations.
- Production: `npm run db:deploy` applies pending migrations (reads `DIRECT_URL`). The Neon setup
  guide is at `docs/neon-setup-guide.md` — follow that for the database connection strings and
  the deploy/seed commands rather than duplicating it here.

### Health-check endpoints

Point a monitor at:

- `GET /api/health` — liveness. Cheap, no dependencies; returns
  `{ status: "ok", uptime, timestamp }`.
- `GET /api/health?deep=1` — readiness. Also runs `SELECT 1` against the database and returns
  `database: { status, latencyMs }`, plus `content: { degraded, lastFallbackAt }` (informational:
  whether public pages are currently being served from built-in fallback content). If the
  database check fails, the whole response is HTTP **503** with `status: "degraded"`.

Use the cheap probe for liveness and the deep probe for readiness.

---

## Part 4 — Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Cannot sign in, even though `ADMIN_PASSCODE` was changed on the server. | The passcode was previously changed in the dashboard (or reset with a recovery code), so the database hash now overrides the environment variable. | Sign in is only possible with the current passcode. If it is forgotten, use a recovery code at `Code d'accès oublié ?` / `Forgot your passcode?`. Last resort: delete the `admin_passcode_hash` row (`npm run db:studio`), then `ADMIN_PASSCODE` applies again. |
| The admin panels show `Impossible de charger les données. La base de données est peut-être momentanément indisponible.` / `Could not load the data. The database may be temporarily unavailable.` | The database read failed (transient connection or pool error, or an outage). The content API answers HTTP 503 with the `X-Db-Unavailable` header, or HTTP 500. | The session is deliberately kept alive (a database blip must not sign you out). Wait a moment and click `Réessayer` / `Retry`, or use the refresh button on the Inquiries tab. Check that the database is reachable and that `DATABASE_URL` is correct. |
| Sessions expire "by themselves" after 12 hours. | Tokens are stateless and signed, with a fixed **12-hour** lifetime — there is no way to refresh or revoke an individual token. | Sign in again. Note that the token also lives only in the current browser tab, so closing the tab ends the session earlier. To sign everything out at once, rotate `ADMIN_SESSION_SECRET` (this invalidates all sessions). |
| Login shows `Too many attempts. Please wait and try again.` (HTTP 429). | The login rate limiter is doing its job: in production the limit is 8 attempts per 15-minute window (60 in development). It also fires if the shared rate-limit store is misconfigured, because the login endpoint **fails closed**. | Wait for the window to reset and try again. If it keeps happening without any login attempts, check that `RATE_LIMIT_REDIS_URL` / `RATE_LIMIT_REDIS_TOKEN` are correct (a wrong Redis token makes the login endpoint return 429). |
| Images do not appear after replacing the local files in `public/images`. | The preset library resolves through `src/lib/image-manifest.json`, which is generated from the files on disk; it is only regenerated before `dev`/`build`. | Run `npm run images:manifest` (or restart/rebuild) so the manifest is regenerated. Make sure the file's basename is one of the nine library keys (`fresh`, `dried`, `powder`, `packaged`, `substrate`, `fertilizer`, `sustainability`, `training`, `hero`) and that its extension is supported. |
| An admin action keeps failing in a way that suggests credentials were used by someone else, or you know a secret has leaked. | A secret (`DATABASE_URL` password, `ADMIN_SESSION_SECRET`, `ADMIN_PASSCODE`, Cloudinary keys, Redis token) was exposed. | Rotate the affected secret in the deployment secret store. Rotating `DATABASE_URL`/`DIRECT_URL` requires rotating the database password in the provider too. Rotating `ADMIN_SESSION_SECRET` signs out every existing session and must still be identical across instances. Rotating the Redis token matters because the admin login **fails closed**: a wrong token makes it return 429 and block logins. Change the admin passcode from the dashboard and generate a fresh recovery code. |

---

## Where things live

| What | File |
|---|---|
| Site text defaults (settings groups, default products/news, image library keys, image resolution) | `src/lib/cms-defaults.ts` |
| Translations (every UI string, French and English) | `src/lib/i18n/fr.ts` and `src/lib/i18n/en.ts` (aggregated in `src/lib/i18n/index.ts`) |
| Image library keys and the generated slot → file map | `src/lib/cms-defaults.ts` (`IMAGE_LIBRARY`) and `src/lib/image-manifest.json` (generated from `public/images` by `scripts/gen-image-manifest.mjs`) |

Related documentation: `README.md` (quick start and scripts),
`.env.example` (environment template), `docs/neon-setup-guide.md` (Neon PostgreSQL setup) and
`docs/supabase-setup-guide.md`.
