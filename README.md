# Flow Mama 🤱

A single-page Hebrew (RTL) e-commerce website for **Flow Mama** — a premium nursing bra designed by Odeya Tsur.

**Live site:** [flow-mama.co.il](https://flow-mama.co.il)

---

## Product

- **Name:** חזיית הנקה Flow Mama
- **Price:** ₪250 + delivery
- **Colors:** Gray, White, Yellow (banana) — size L not available in White
- **Sizes:** M, L, XL
- **Delivery:** Collection point ₪20 (total ₪270) | Home delivery ₪45 (total ₪295)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Pure HTML / CSS / JS — single `index.html` file |
| Styling | Tailwind CSS (CDN, configured inline) |
| Database | Supabase (orders table) |
| Analytics | Google Analytics 4 (G-7K20Z2MYWE) |
| Ads | Meta Pixel (replace placeholder ID in `index.html`) |
| Deployment | Vercel (auto-deploy on push to `main`) |
| Dev server | Node.js (`serve.mjs`) |

---

## Project Structure

```
Flow-Mama/
├── index.html          # Entire website — HTML, CSS, and JS in one file
├── vercel.json         # Vercel deployment config + security headers
├── package.json        # Dev tooling (local server + screenshot script)
├── robots.txt          # SEO crawl rules
├── sitemap.xml         # SEO sitemap
├── CNAME               # Custom domain: flow-mama.co.il
├── favicon.png         # Site icon
├── scripts/            # Dev tooling
│   ├── serve.mjs       # Local dev server (port 3000)
│   └── screenshot.mjs  # Puppeteer screenshot utility
├── picture/            # Product + lifestyle images and demo video
│   ├── gray.JPG        # Product photo — gray color
│   ├── white.JPG       # Product photo — white color
│   ├── yallow.JPG      # Product photo — yellow color
│   ├── pic_1–18.JPG    # Lifestyle photos (hero gallery)
│   ├── movie.mp4       # Product demo video
│   └── bit.jpeg        # BIT payment QR code
├── recomends/          # Customer recommendation screenshots
│   └── recomend1–3.jpeg
└── brand_assets/       # Logo
    └── Flow Mama Logo.jpeg
```

> `orders.json` is generated on first run of the dev server and is gitignored (dev-only, not used in production).

---

## Running Locally

```bash
npm install
npm start
# → http://localhost:3000
```

---

## Deployment

Every push to `main` automatically deploys to Vercel.

```bash
git add .
git commit -m "your message"
git push origin main
# → live at flow-mama.co.il in ~30 seconds
```

---

## Order Flow

1. Customer selects color + size + delivery option on the page
2. Clicks **הזמיני עכשיו** → checkout modal opens, or **הזמיני דרך WhatsApp** → pre-filled WhatsApp message
3. Fills in name, phone, email (+ address for home delivery)
4. Pays via BIT QR code directly to Odeya
5. Submits form → order saved to Supabase `orders` table with `status: 'pending'`
6. Odeya follows up manually via WhatsApp

---

## Supabase

- **Project URL:** `https://rhypwmsqwwtnnaavmsgj.supabase.co`
- **Key type:** Publishable (safe to expose in client-side code)
- **RLS:** Enabled — anon users can `INSERT` only; `SELECT` requires authentication
- **Orders table columns:** `name`, `phone`, `email`, `delivery_type`, `address`, `city`, `postal`, `pickup_location`, `color`, `size`, `total_price`, `status`, `created_at`
- **`delivery_type` values:** `נקודת איסוף` or `משלוח לבית`

---

## Security

- HTTP headers via `vercel.json`: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- Honeypot field on order form to silently block bots
- `rel="noopener noreferrer"` on all external links
- `maxlength` on all form inputs
- Supabase RLS blocks public read access to orders

---

## Meta Pixel Setup

The Meta Pixel base code is installed in `index.html`. To activate it:

1. Go to [Meta Business Manager → Events Manager](https://business.facebook.com/events_manager)
2. Create a Pixel and copy the ID
3. In `index.html`, replace both occurrences of `XXXXXXXXXXXXXXXX` with your Pixel ID

---

## Contact

- **Email:** odeya265@gmail.com
- **WhatsApp:** 050-477-7045
- **Instagram:** [@flowmama_youvegotheflow](https://www.instagram.com/flowmama_youvegotheflow)
