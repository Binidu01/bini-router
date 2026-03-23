# bini-router

<div align="center">

[![npm version](https://img.shields.io/npm/v/bini-router?color=00CFFF&labelColor=0a0a0a&style=flat-square)](https://www.npmjs.com/package/bini-router)
[![license](https://img.shields.io/badge/license-MIT-00CFFF?labelColor=0a0a0a&style=flat-square)](./LICENSE)
[![vite](https://img.shields.io/badge/vite-7%2B%20%7C%208%2B-646cff?labelColor=0a0a0a&style=flat-square)](https://vitejs.dev)
[![react](https://img.shields.io/badge/react-18%2B-61dafb?labelColor=0a0a0a&style=flat-square)](https://react.dev)
[![hono](https://img.shields.io/badge/hono-powered-fb923c?labelColor=0a0a0a&style=flat-square)](https://hono.dev)
[![typescript](https://img.shields.io/badge/typescript-ready-3178c6?labelColor=0a0a0a&style=flat-square)](https://www.typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-00CFFF?labelColor=0a0a0a&style=flat-square)](https://github.com/binidu/bini-router/pulls)

**File-based routing, nested layouts, per-route metadata, and Hono-powered API routes for Vite.**  
Like Next.js — but pure SPA, zero server required.

</div>

---

## Features

- 🗂️ **File-based routing** — `page.tsx` / `page.jsx` files map directly to URLs
- 🪆 **Nested layouts** — layouts wrap their segment and all children
- 🏷️ **Per-route metadata** — `export const metadata` in any layout or page
- 🔀 **Dynamic segments** — `[id]/page.tsx` → `/:id`
- 🌐 **API routes** — Hono-powered, pure `Request → Response` handlers
- ✨ **Auto-imports** — `useState`, `useEffect`, `Link`, `useNavigate`, `getEnv` and more available in every page without importing
- 🌿 **Auto env loading** — `.env` loaded automatically for API routes via [bini-env](https://www.npmjs.com/package/bini-env) — no manual dotenv setup
- 🎨 **Custom loading screen** — create `src/app/loading.tsx` to replace the built-in spinner
- 🛡️ **Built-in error boundaries** — per-layout crash isolation
- ⏳ **Lazy loading** — every route is code-split automatically
- 🔄 **HMR** — file watcher with smart debounce, dedup, and live new-folder detection
- 📦 **Zero config** — works out of the box
- 💛 **JavaScript & TypeScript** — full support for both, auto-detected
- 🚀 **Deploy anywhere** — Netlify, Vercel, Cloudflare, Node, Deno, Bun, AWS
- 🐙 **GitHub Pages ready** — `basename` set automatically from `import.meta.env.BASE_URL`

---

## Install

```bash
npm install bini-router hono bini-env
```

> `hono` and `bini-env` are required peer dependencies.

---

## Setup

### `vite.config.ts` / `vite.config.js`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { biniroute } from 'bini-router'
import { biniEnv } from 'bini-env'

export default defineConfig({
  plugins: [react(), biniEnv(), biniroute()],
})
```

### `index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- bini-router injects all meta tags here automatically -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

> You do **not** need to manually add `<title>`, `<meta>`, favicons, or Open Graph tags.  
> bini-router reads your `metadata` export and injects everything at build time.

---

## Auto-imports

bini-router automatically injects imports into every page and layout file in `src/app/`. You never need to write import statements for these:

**From `react`:**
```ts
useState  useEffect  useRef  useMemo  useCallback
useContext  createContext  useReducer  useId  useTransition  useDeferredValue
```

**From `react-router-dom`:**
```ts
Link  NavLink  useNavigate  useParams  useLocation  useSearchParams  Outlet
```

**From `bini-env`:**
```ts
getEnv  requireEnv
```

So your pages look like this — no imports needed:

```tsx
// src/app/profile/page.tsx
export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  return (
    <div>
      <Link to="/">← Home</Link>
      <h1>Profile {id}</h1>
    </div>
  );
}
```

> If you already import from one of these packages manually, bini-router detects it and skips injection — no duplicates ever.

---

## Environment Variables

bini-router uses [bini-env](https://www.npmjs.com/package/bini-env) to handle environment variables automatically:

- **Client code** — use `import.meta.env.BINI_*` (prefix set automatically by bini-env)
- **API routes** — use `getEnv()` or `requireEnv()` — no dotenv import needed
- **Dev server** — `.env` is loaded automatically when the server starts
- **Production** — env vars are read from the host's environment (Netlify dashboard, Vercel settings, etc.)

```env
# .env
BINI_FIREBASE_API_KEY=your_key       # client-side — accessible via import.meta.env.BINI_*
SMTP_USER=user@smtp.example.com      # server-side — accessible via getEnv() in API routes
SMTP_PASS=your_password
FROM_EMAIL=App <noreply@example.com>
```

```ts
// src/app/api/email.ts — getEnv/requireEnv are auto-imported
const SMTP_USER = requireEnv('SMTP_USER'); // throws if missing
const DEBUG     = getEnv('DEBUG_MODE');    // returns undefined if missing
```

---

## JavaScript & TypeScript

bini-router supports both JavaScript and TypeScript projects out of the box — no extra configuration needed.

**Auto-detection:** bini-router checks for `src/main.tsx` or `src/main.ts` to determine project type. Falls back to scanning `src/app/` for `.ts`/`.tsx` files.

| | TypeScript project | JavaScript project |
|---|---|---|
| Auto-generated app entry | `src/App.tsx` | `src/App.jsx` |
| `ErrorBoundary` | Full generic types | Plain JS class |
| `TitleSetter` | Typed props | Plain JS function |
| Your pages / layouts | `.tsx` | `.jsx` |
| API routes | `.ts` | `.js` |

---

## File Structure

```
src/
  main.tsx              ← mounts <App /> as usual
  App.tsx               ← auto-generated by bini-router — do not edit
  app/
    globals.css         ← global styles
    layout.tsx          ← root layout + global metadata
    page.tsx            ← /
    loading.tsx         ← custom loading screen (optional)
    not-found.tsx       ← custom 404 page (optional)

    dashboard/
      layout.tsx        ← nested layout for /dashboard/*
      page.tsx          ← /dashboard
      [id]/
        page.tsx        ← /dashboard/:id

    blog/
      [slug]/
        page.tsx        ← /blog/:slug

    api/
      users.ts          ← /api/users
      posts/
        index.ts        ← /api/posts
        [id].ts         ← /api/posts/:id
      [...catch].ts     ← /api/* catch-all
```

---

## Pages

```tsx
// src/app/dashboard/page.tsx — no imports needed
export default function Dashboard() {
  const [count, setCount] = useState(0);
  return <h1>Dashboard</h1>;
}
```

### Dynamic routes

```tsx
// src/app/blog/[slug]/page.tsx — useParams auto-imported
export default function Post() {
  const { slug } = useParams();
  return <h1>Post: {slug}</h1>;
}
```

---

## Layouts

Layouts wrap all pages in their directory and subdirectories.

```tsx
// src/app/layout.tsx — root layout
export const metadata = {
  title      : 'My App',
  description: 'Built with bini-router',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

```tsx
// src/app/dashboard/layout.tsx — nested layout (Outlet auto-imported)
export const metadata = {
  title: 'Dashboard',
}

export default function DashboardLayout() {
  return (
    <div className="dashboard">
      <aside>Sidebar</aside>
      <main><Outlet /></main>
    </div>
  );
}
```

> **Root layout** uses `{children}` — it wraps `<BrowserRouter>` from outside.  
> **Nested layouts** use `<Outlet />` — they are React Router route wrappers.

---

## Custom Loading Screen

Create `src/app/loading.tsx` with a default export to replace the built-in spinner. bini-router automatically detects and uses it as the Suspense fallback for every lazy-loaded route.

```tsx
// src/app/loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500" />
    </div>
  );
}
```

If the file is empty or has no default export, the built-in spinner is used automatically.

---

## Custom 404

```tsx
// src/app/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h1>404 — Page not found</h1>
      <Link to="/">Go home</Link>
    </div>
  );
}
```

---

## Metadata

Export `metadata` from any `layout.tsx`. Root layout metadata is injected into `index.html` at build time. Nested layout titles update `document.title` at runtime.

```ts
export const metadata = {
  title       : 'Dashboard',
  description : 'Your personal dashboard',
  viewport    : 'width=device-width, initial-scale=1.0',
  themeColor  : '#00CFFF',
  charset     : 'UTF-8',
  robots      : 'index, follow',
  manifest    : '/site.webmanifest',
  keywords    : ['react', 'vite', 'dashboard'],
  authors     : [{ name: 'Your Name', url: 'https://example.com' }],
  metadataBase: new URL('https://myapp.com'),
  openGraph: {
    title      : 'Dashboard',
    description: 'Your personal dashboard',
    url        : 'https://myapp.com/dashboard',
    type       : 'website',
    images     : [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card       : 'summary_large_image',
    title      : 'Dashboard',
    description: 'Your personal dashboard',
    creator    : '@yourhandle',
    images     : ['/og.png'],
  },
  icons: {
    icon    : [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: [{ url: '/favicon.png' }],
    apple   : [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
}
```

All fields are optional. `metadata` is stripped from the browser bundle automatically.

---

## API Routes

Write your API files in `src/app/api/`. Export a Hono app — bini-router serves it in dev and production automatically. No dotenv, no manual env loading.

```ts
// src/app/api/email.ts
import { Hono } from 'hono'
import nodemailer from 'nodemailer'

const app = new Hono().basePath('/api')

// requireEnv is auto-imported — throws at startup if missing
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: requireEnv('SMTP_USER'),
    pass: requireEnv('SMTP_PASS'),
  },
})

app.post('/email', async (c) => {
  const { to, subject, html } = await c.req.json()
  await transporter.sendMail({ from: requireEnv('FROM_EMAIL'), to, subject, html })
  return c.json({ ok: true })
})

export default app
```

### Plain function handlers

```ts
// src/app/api/hello.ts
export default function handler(req: Request) {
  return Response.json({ message: 'hello', method: req.method })
}
```

### Dynamic routes

```ts
// src/app/api/posts/[id].ts
import { Hono } from 'hono'

const app = new Hono().basePath('/api')
app.get('/posts/:id', (c) => c.json({ id: c.req.param('id') }))
export default app
```

---

## GitHub Pages / Subpath Deployments

bini-router sets `basename={import.meta.env.BASE_URL ?? '/'}` on `<BrowserRouter>` automatically.

```ts
// vite.config.ts
export default defineConfig({
  base   : '/my-repo/',
  plugins: [react(), biniEnv(), biniroute()],
})
```

---

## Deployment

Set `platform` once in `vite.config.ts`. bini-router generates the production entry file on every `vite build`.

```ts
biniroute({ platform: 'netlify' })
```

---

### 🟩 Netlify

```ts
biniroute({ platform: 'netlify' })
```

Generates `netlify/edge-functions/api.ts` — uses Deno URL imports, no npm deps needed.

Add `netlify.toml`:

```toml
[build]
  command = "vite build"
  publish = "dist"

[[edge_functions]]
  path     = "/api/*"
  function = "api"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

---

### ▲ Vercel

```ts
biniroute({ platform: 'vercel' })
```

Generates `api/index.ts` using Vercel Edge Functions with native Hono `fetch`.

> ⚠️ **Vercel reads `api/` before the build step.** You must commit the generated file:
> ```bash
> git add api/index.ts
> git commit -m "chore: update vercel api entry"
> git push
> ```

---

### 🟠 Cloudflare Workers

```ts
biniroute({ platform: 'cloudflare' })
```

Generates `worker.ts`. Add `wrangler.toml`:

```toml
name = "my-app"
main = "worker.ts"
compatibility_date = "2024-01-01"

[assets]
directory = "./dist"
```

```bash
vite build && npx wrangler deploy
```

---

### 🚂 Node.js (Railway, Render, Fly.io, VPS)

```ts
biniroute({ platform: 'node' })
```

Generates `server/index.ts`. Requires `@hono/node-server`:

```bash
npm install @hono/node-server
```

Start command:

```bash
vite build && npx tsx server/index.ts
```

---

### 🦕 Deno

```ts
biniroute({ platform: 'deno' })
```

```bash
vite build && deno run --allow-net --allow-read server/index.ts
```

---

### 🥟 Bun

```ts
biniroute({ platform: 'bun' })
```

```bash
vite build && bun run server/index.ts
```

---

### ☁️ AWS Lambda

```ts
biniroute({ platform: 'aws' })
```

Generates `handler.ts`. Deploy with SST, SAM, or Serverless Framework.

---

## Options

```ts
biniroute({
  appDir  : 'src/app',     // Default: src/app
  apiDir  : 'src/app/api', // Default: src/app/api
  cors    : true,          // CORS on dev/preview API. Default: true
  platform: 'netlify',     // 'netlify' | 'vercel' | 'cloudflare' | 'node' | 'deno' | 'bun' | 'aws'
})
```

---

## HMR & File Watcher

bini-router watches `src/app/` during development and regenerates `App.tsx` automatically.

- **New file** → picked up immediately
- **New folder** → watched instantly
- **Deleted file or folder** → removed from routes and reloaded
- Changes are debounced — no redundant reloads

> You never need to restart the dev server when adding new routes.

---

## License

MIT © [Binidu Ranasinghe](https://bini.js.org)