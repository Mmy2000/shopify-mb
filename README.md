# MB Gold — Shopify Theme

## Store Info

- **Store**: MB Gold
- **Shopify Admin Domain**: `mbgoldstore.myshopify.com`
- **Public Store URL**: `https://mbgoldshop.com`
- **Theme Name**: Dawn Preview
- **Theme ID**: `186018791729`
- **Working Directory**: `E:\Projects\SHS\mbgold\shopify\Shopify_theme`
- **External Assets Dir**: `E:\Projects\SHS\mbgold\shopify\Shopify_external_assets`

## Shopify CLI Commands

### Pull theme (download from Shopify)

```powershell
shopify theme pull --theme 186018791729
```

Run from `E:\Projects\SHS\mbgold\shopify\Shopify_theme`

### Pre-push checklist (MANDATORY)

Before every `shopify theme push`, run:

```powershell
# 1. JS syntax check — catches brace mismatches, unclosed brackets, etc.
node -c "assets/my-scan.js"

# 2. Liquid syntax check (optional but recommended)
shopify theme check
```

**Never push if `node -c` reports a syntax error.** A single misplaced `}` will crash the entire custom element and silently break the page (e.g. the `?id=` parameter stops working because `connectedCallback` never fires).

### Push theme (upload to Shopify)

```powershell
# Push to unpublished/preview theme
shopify theme push --theme 186018791729

# Push to live theme (requires --allow-live flag)
shopify theme push --theme 186018791729 --allow-live
```

Run from `E:\Projects\SHS\mbgold\shopify\Shopify_theme`

The `--allow-live` flag is required when pushing to a theme that is currently live. Without it, the CLI will prompt for confirmation and fail in non-interactive environments.

### Push Rules

- **Dawn Preview (#186018791729)** — push anytime for testing (use `--allow-live` if it's currently the live theme)
- **Dawn Publish (#185832472881)** — **ONLY push when the user explicitly says so** (e.g. "push to live", "publish", "go live"). Never push to the live theme without explicit user confirmation.

### Publish live theme (requires confirmation)

```powershell
echo y | shopify theme publish --theme 186018791729 --force
```

This makes Dawn Preview the live theme. Only run when explicitly asked.

### Open preview

```powershell
shopify theme open --theme 186018791729
```

### Dev server (live preview with hot reload)

```powershell
shopify theme dev --theme 186018791729
```

## Key Pages

- **My Scan (certificate page)**: `https://mbgoldshop.com/pages/my-scan?id=60003`
- **Theme Editor**: `https://mbgoldstore.myshopify.com/admin/themes/186018791729/editor`
- **Theme Preview**: `https://mbgoldstore.myshopify.com?preview_theme_id=186018791729`

## Architecture

### My Scan / Certificate Section

- **Section**: `sections/my-scan.liquid`
- **Styles**: `snippets/cert-styles.liquid` (certificate CSS)
- **Styles**: `assets/section-my-scan.css` (scan page CSS)
- **JavaScript**: `assets/my-scan.js` — custom element `<my-scan-page>`

### Data Flow

1. URL contains `?id=<code>` (e.g. `?id=60003`)
2. JS reads `id` from URL via `getProductIdFromUrl()`
3. JS calls external API endpoint (configured in section schema `api_endpoint` setting, uses `{id}` placeholder)
4. API response is transformed via `transformBackendResponse()` and wired to DOM via `data-cert-*` attributes
5. Sidebar QR and cert QR are generated client-side using local `QRCode` library (`assets/qrcode.min.js`)

### Certificate QR

- Uses local `QRCode` library (not external API)
- Selector: `[data-cert-qr-mini]` — a `<div class="qr">` that `QRCode` renders into
- QR encodes: `${window.location.origin}/pages/my-scan?id=<code>`
- E.g. for `?id=60003` → `https://mbgoldshop.com/pages/my-scan?id=60003`

### Download / Print

- Download button triggers `window.print()`
- `@media print` rules hide everything except `.cert-wrapper`
- `@page { size: A4 portrait; margin: 0 }` controls output size

## Asset Files

| File | Purpose |
|------|---------|
| `assets/goldbarlogo.png` | Gold bar icon for product detail header |
| `assets/paper-texture.png` | Certificate paper background |
| `assets/iso-badge.png` | ISO 9001:2015 certification badge |
| `assets/mb-gold-logo.png` | MB Gold logo |
| `assets/instagram.svg` | Instagram icon (white) |
| `assets/facebook.svg` | Facebook icon (white) |
| `assets/qrcode.min.js` | QR code generation library |
| `assets/my-scan.js` | Main JS for scan/cert functionality |
| `assets/section-my-scan.css` | Scan page styles |

All certificate images use `<img>` tags with Liquid `{{ 'file' | asset_url }}` — CSS `background-image` with asset_url does NOT resolve reliably on this theme.

## Fonts

Loaded via Google Fonts `<link>` tags in `my-scan.liquid`:

- **Playfair Display** (heading: "CERTIFICATE" title)
- **PT Serif** (English body text)
- **Amiri** (Arabic text)

## Key Decisions

- Certificate lives inside `my-scan.liquid` section (inline, no modal)
- Data wired via JS `data-cert-*` attributes (not Liquid metafields) because `/pages/my-scan?id=X` has no `product` Liquid context
- Paper texture is an absolutely-positioned `<img class="cert-bg">` filling `.cert`, with `.cert-content` (z-index:1) containing visible content
- QR uses local `QRCode` library, NOT `api.qrserver.com` (external API was blocked by CSP / produced blank images)
- QR generation runs immediately on page load (in `connectedCallback`) when ID is present — does NOT wait for API response
- Product detail gold icon uses `goldbarlogo.png` (real image) instead of SVG shape
- API data mapping: `gold_karat` → `24K` / `ذهب عيار 24 قراط`, `gold_weight` → `X gm.` / `X جرام`

## Broken QR Code Rescue (404 fallback)

~2000 QR codes were printed with a mis-generated URL: the `?id=` was mangled into `ID` and
the path uppercased, e.g. `https://mbgoldshop.com/PAGES/MY-SCANID242000000007730`.

Fix lives in `layout/theme.liquid`, first thing inside `<head>`, guarded by
`{% if template.name == '404' %}`. It regex-matches the first run of digits after `my-scan`
(any case, any separator) and client-side redirects to `/pages/my-scan?id=<digits>`.

Covers any serial, so future batches from the same broken generator work with no changes:

- `/PAGES/MY-SCANID242000000007731` → `/pages/my-scan?id=242000000007731`
- `/pages/my-scan/60003` → `/pages/my-scan?id=60003`

No redirect loop: the target path `/pages/my-scan` contains no digits, so it can't re-match.
The URL still returns HTTP 404 — the redirect is client-side, which is fine for phone scans.
Does NOT rescue URLs that lost the `my-scan` segment entirely.

## Server-Side PDF Generation

Located in `E:\Projects\SHS\mbgold\shopify\Shopify_external_assets\`

- `generate-cert.js` — Puppeteer script, targets `[data-cert-inline]` selector
- `package.json` — Puppeteer dependency
- `constants/` — Source design assets (originals before Shopify asset upload)
  - `Background_texture.png` → becomes `assets/paper-texture.png`
  - `ISO-removebg-preview.png` → becomes `assets/iso-badge.png`
  - `Logo-removebg-preview.png` → becomes `assets/mb-gold-logo.png`
  - `goldbarlogo.png` → becomes `assets/goldbarlogo.png`
- Run: `node generate-cert.js <url>`

## Theme Schema Settings (My Scan Section)

Key settings configurable in Shopify Theme Editor:

| Setting | Description |
|---------|-------------|
| `api_endpoint` | External API URL with `{id}` placeholder |
| `show_certificate` | Toggle certificate visibility |
| `cert_logo` | Image picker for certificate logo |
| `landing_title` | Landing page title |
| `product_name` | Default product name |
| `product_weight` | Default weight |
| `product_carat` | Default carat/purity |
| `created_label` | Date of production label |