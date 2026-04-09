# bini-router

<div align="center">

[![npm version](https://img.shields.io/npm/v/bini-router?color=00CFFF&labelColor=0a0a0a&style=flat-square)](https://www.npmjs.com/package/bini-router)
[![license](https://img.shields.io/badge/license-MIT-00CFFF?labelColor=0a0a0a&style=flat-square)](./LICENSE)
[![vite](https://img.shields.io/badge/vite-8%2B-646cff?labelColor=0a0a0a&style=flat-square)](https://vitejs.dev)
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
- 🪆 **Nested layouts** — layouts wrap their segment and all children automatically
- 🏷️ **Per-route metadata** — `export const metadata` in any layout sets `document.title` at runtime; root layout metadata is injected into `index.html` at build time
- 🔀 **Dynamic segments** — `[id]/page.tsx` → `/:id`, `[...slug]` → catch-all
- 🌐 **API routes** — Hono-powered, pure `Request → Response` handlers in `src/app/api/`
- ✨ **Auto-imports** — `useState`, `useEffect`, `Link`, `useNavigate`, `getEnv` and more available in every page without importing
- 🌿 **Auto env loading** — `.env` loaded automatically for API routes via [bini-env](https://www.npmjs.com/package/bini-env)
- 🎨 **Custom loading screen** — create `src/app/loading.tsx` to replace the built-in spinner
- 🛡️ **Built-in error boundaries** — per-layout crash isolation with a dev-friendly overlay
- ⏳ **Lazy loading** — every route is code-split automatically via `React.lazy`
- 🔄 **HMR** — file watcher with smart debounce (60ms), event deduplication, and live new-folder detection
- 🔒 **Security** — route segment validation, param name validation, path traversal guards, 10MB file size limits
- 📦 **Zero config** — works out of the box
- 💛 **JavaScript & TypeScript** — full support for both, auto-detected from your project
- 🚀 **Deploy anywhere** — Netlify Edge Functions, Vercel Edge, Cloudflare Workers, Node.js, Deno

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

bini-router automatically injects imports into every page and layout file under `src/app/`. You never need to write import statements for these:

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
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  return (
    <div>
      <Link to="/">← Home</Link>
      <h1>Profile {id}</h1>
    </div>
  )
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
BINI_FIREBASE_API_KEY=your_key        # client-side — accessible via import.meta.env.BINI_*
SMTP_USER=user@smtp.example.com       # server-side — accessible via getEnv() in API routes
SMTP_PASS=your_password
FROM_EMAIL=App <noreply@example.com>
```

```ts
// src/app/api/email.ts — getEnv/requireEnv are auto-imported
const SMTP_USER = requireEnv('SMTP_USER')  // throws if missing
const DEBUG     = getEnv('DEBUG_MODE')     // returns undefined if missing
```

---

## JavaScript & TypeScript

bini-router supports both JavaScript and TypeScript projects out of the box — no extra configuration needed.

**Auto-detection order:**
1. Checks for `src/main.tsx` or `src/main.ts` / `src/main.jsx` or `src/main.js`
2. Falls back to checking for a `tsconfig.json` at the project root
3. Falls back to scanning `src/app/` recursively for any `.ts` / `.tsx` files

| | TypeScript project | JavaScript project |
| ------------------------ | ------------------ | ------------------ |
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

> Files and directories prefixed with `_` or `.` are ignored by the router.  
> The `api/` directory is excluded from page route scanning.

---

## Pages

```tsx
// src/app/dashboard/page.tsx — no imports needed
export default function Dashboard() {
  const [count, setCount] = useState(0)
  return <h1>Dashboard</h1>
}
```

### Dynamic routes

```tsx
// src/app/blog/[slug]/page.tsx — useParams auto-imported
export default function Post() {
  const { slug } = useParams()
  return <h1>Post: {slug}</h1>
}
```

### Catch-all routes

```tsx
// src/app/docs/[...path]/page.tsx
export default function Docs() {
  // matches /docs/anything/nested/here
  return <h1>Docs</h1>
}
```

> Route priority: static routes are matched before dynamic ones; dynamic routes before catch-alls.

---

## Layouts

Layouts wrap all pages in their directory and subdirectories. bini-router walks up the directory tree from each page to collect the full layout chain.

```tsx
// src/app/layout.tsx — root layout
export const metadata = {
  title      : 'My App',
  description: 'Built with bini-router',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
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
  )
}
```

> **Root layout** uses `{children}` — it wraps `<BrowserRouter>` from outside.  
> **Nested layouts** use `<Outlet />` — they are React Router route wrappers.  
> Layouts that contain an `<html>` tag are automatically excluded from the chain (treated as HTML shell files, not route layouts).

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
  )
}
```

If the file exists but has no default export, the built-in spinner is used automatically. The built-in spinner is dark-mode aware and adapts to your `<html>` class or `prefers-color-scheme`.

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
  )
}
```

A built-in 404 page is rendered automatically if `not-found.tsx` is absent or has no default export.

---

## Metadata

Export `metadata` from any `layout.tsx`. Root layout metadata is injected into `index.html` at build time. Nested layout titles update `document.title` at runtime via a `TitleSetter` component rendered inside the layout's Suspense boundary.

> `export const metadata` is automatically stripped from the browser bundle — it never ships to the client.

```ts
export const metadata = {
  title       : 'Dashboard',
  description : 'Your personal dashboard',
  viewport    : 'width=device-width, initial-scale=1.0',
  themeColor  : '#00CFFF',
  charset     : 'UTF-8',
  robots      : 'index, follow',
  manifest    : '/site.webmanifest',
  keywords    : ['react', 'vite', 'dashboard'],        // array or string
  authors     : [{ name: 'Your Name', url: 'https://example.com' }],
  canonical   : 'https://myapp.com/dashboard',
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

All fields are optional. Only the root `layout.tsx` metadata is used for `index.html` injection.

---

## API Routes

Write your API files in `src/app/api/`. bini-router serves them automatically in dev (`vite dev`) and preview (`vite preview`), and generates a production entry file on `vite build` when `platform` is set.

### Hono app (recommended)

```ts
// src/app/api/email.ts
import { Hono } from 'hono'
import nodemailer from 'nodemailer'

const app = new Hono().basePath('/api')

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: requireEnv('SMTP_USER'),  // auto-imported — throws at startup if missing
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

Route params are passed via the `x-bini-params` request header as a JSON string when using plain function handlers.

### Dynamic API routes

```ts
// src/app/api/posts/[id].ts
import { Hono } from 'hono'

const app = new Hono().basePath('/api')
app.get('/posts/:id', (c) => c.json({ id: c.req.param('id') }))
export default app
```

### CORS

CORS is enabled by default for all `/api/*` routes in dev and preview. Set `cors: false` to disable. In production, CORS headers are added to the generated entry file automatically when `cors: true` (the default).

```ts
biniroute({ cors: false })
```

---

## Deployment

Set `platform` once in `vite.config.ts`. bini-router generates the production entry file automatically during `vite build` (in the `closeBundle` hook).

```ts
biniroute({ platform: 'netlify' })
```

---

### 🟩 Netlify

```ts
biniroute({ platform: 'netlify' })
```

Generates `netlify/edge-functions/api.ts` using Deno CDN URL imports — no npm deps needed in the edge function.

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

Generates `api/index.ts` as a Vercel Edge Function with `export const config = { runtime: 'edge' }`.

Add `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.ts" },
    { "source": "/(.*)",     "destination": "/index.html" }
  ]
}
```

> ⚠️ **Vercel reads `api/` before the build step runs.** You must commit the generated file:
>
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

Generates `worker.ts` with a built-in SPA fallback — assets are served first, and all unmatched paths fall through to `index.html` for React Router. Requires a `wrangler.toml` with the `ASSETS` binding.

Add `wrangler.toml`:

```toml
name = "my-app"
main = "worker.ts"
compatibility_date = "2025-04-09"

[assets]
directory = "./dist"
binding = "ASSETS"
```

```bash
vite build && npx wrangler deploy
```

---

### 🚂 Node.js (Railway, Render, Fly.io, VPS)

Node.js serving is handled by [bini-server](https://www.npmjs.com/package/bini-server) — no entry file is generated. Setting `platform: 'node'` is accepted but produces no output.

```bash
vite build && npm start
```

---

### 🦕 Deno

```ts
biniroute({ platform: 'deno' })
```

Generates `server/index.ts` (or `server/index.js` for JS projects) using Deno CDN imports and `Deno.serve`. Port defaults to `3000` or reads from the `PORT` environment variable.

```bash
vite build && deno run --allow-net --allow-read --sloppy-imports server/index.ts
```

---

## Options

```ts
biniroute({
  appDir    : 'src/app',      // Default: src/app
  apiDir    : 'src/app/api',  // Default: src/app/api
  cors      : true,           // Enable CORS on dev/preview API. Default: true
  platform  : 'netlify',      // 'netlify' | 'vercel' | 'cloudflare' | 'deno' | 'node'
                              //   generates production entry on build (except 'node')
  strictMode: true,           // Throw on route conflicts. Default: true
})
```

---

## Error Boundaries

Every layout is wrapped in a built-in `ErrorBoundary`. In development, runtime errors are reported via a `__bini_error__` CustomEvent on `window` so dev overlays can display them. In production, a fallback UI is rendered with a "Try again" button that resets the boundary.

---

## HMR & File Watcher

bini-router watches `src/app/` during development and regenerates `App.tsx` automatically.

- **New file** → regenerates after 300ms debounce
- **New folder** → watched instantly, regenerates if a `page.*` file appears
- **Changed file** → regenerates after 60ms debounce
- **Deleted file or folder** → removed from routes and triggers reload
- **Root layout change** → full module graph invalidation
- **API file change** → clears module and route cache, triggers full reload
- Events are deduplicated within a 500ms window (TTL: 2s) to prevent redundant reloads

> You never need to restart the dev server when adding or removing routes.

---

## Route Naming Rules

bini-router validates all route segment names and dynamic parameter names at scan time:

- Segment names must match `[a-zA-Z0-9_-]` and be under 100 characters
- Parameter names (inside `[brackets]`) must match `[a-zA-Z_][a-zA-Z0-9_]*`
- Invalid names are skipped with a warning — they never cause a crash

---

## License

MIT © [Binidu Ranasinghe](https://bini.js.org)