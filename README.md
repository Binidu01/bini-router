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

bini-router automatically injects imports into every page and layout file under `src/app/` (excluding `src/app/api/`). You never need to write import statements for these:

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

> Auto-imports are only injected into files inside `src/app/` that are not in `src/app/api/`, and not the auto-generated `App.tsx` / `App.jsx` file itself.

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
3. Falls back to scanning `src/app/` recursively (up to 5 levels deep) for any `.ts` / `.tsx` files

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
> Directory traversal is capped at 100 levels deep.

---

## Pages

```tsx
// src/app/dashboard/page.tsx — no imports needed
export default function Dashboard() {
  const [count, setCount] = useState(0)
  return <h1>Dashboard</h1>
}
```

Pages are scanned from flat files in a directory (e.g. `about.tsx` → `/about`) **and** from `page.*` files inside named subdirectories. Both forms are supported simultaneously.

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

> Route priority: static routes are matched before dynamic ones; dynamic routes before catch-alls. Routes are sorted by this priority and then by path length (shortest first).

---

## Layouts

Layouts wrap all pages in their directory and subdirectories. bini-router walks up the directory tree from each page to collect the full layout chain, stopping at the `appDir` root.

All layouts — including the root layout — are rendered as React Router `<Route element>` wrappers using `<Outlet />`. The root layout receives child routes via `<Outlet />` exactly like nested layouts do.

```tsx
// src/app/layout.tsx — root layout
export const metadata = {
  title      : 'My App',
  description: 'Built with bini-router',
}

export default function RootLayout() {
  return <Outlet />
}
```

```tsx
// src/app/dashboard/layout.tsx — nested layout
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

> Layouts that contain an `<html>` tag are automatically excluded from the chain (treated as HTML shell files, not route layouts).  
> Layouts without a default export are also excluded from the chain.  
> Circular layout dependencies are detected and throw a `CircularLayoutError`.

---

## Custom Loading Screen

Create `src/app/loading.tsx` with a default export to replace the built-in spinner. bini-router automatically detects and uses it as the Suspense fallback for **every** lazy-loaded route and layout.

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

If the file exists but has no default export, the built-in spinner is used automatically. The built-in spinner is dark-mode aware — it reads `document.documentElement.classList` for a `dark` class and falls back to `prefers-color-scheme`, with a `MutationObserver` for live theme switching.

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

A built-in 404 page is rendered automatically if `not-found.tsx` is absent or has no default export. If a custom `not-found.tsx` exists, it is wrapped with the root layout chain (same layouts that wrap `/`) before being rendered at `path="*"`.

---

## Metadata

Export `metadata` from any `layout.tsx`. Root layout metadata is injected into `index.html` at build time via `transformIndexHtml`. Nested layout titles update `document.title` at runtime via a `TitleSetter` component rendered inside the layout's Suspense boundary.

> `export const metadata` is automatically stripped from the browser bundle by the `transform` hook — it never ships to the client.

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

All fields are optional. Only the root `layout.tsx` metadata is used for `index.html` injection. All metadata values are HTML-escaped before injection.

---

## API Routes

Write your API files in `src/app/api/`. bini-router serves them automatically in dev (`vite dev`) and preview (`vite preview`), and generates a production entry file on `vite build` when `platform` is set.

API handlers are loaded on-demand and cached by `mtime` — touching a file in dev busts the cache immediately without a server restart.

### Hono app (recommended)

```ts
// src/app/api/email.ts
import { Hono } from 'hono'
import nodemailer from 'nodemailer'

const app = new Hono()

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

> Hono apps are detected by checking for `from 'hono'` in the file source. Do **not** call `.basePath('/api')` — bini-router already mounts the app under `/api` in the production entry. Adding it yourself will result in double-prefixed routes (`/api/api/...`).

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

const app = new Hono()
app.get('/posts/:id', (c) => c.json({ id: c.req.param('id') }))
export default app
```

### CORS

CORS is enabled by default for all `/api/*` routes in dev and preview. The following methods are allowed: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`. Preflight `OPTIONS` requests are handled automatically with a `204` response and a 24-hour `Access-Control-Max-Age`.

Set `cors: false` to disable. In production, CORS headers are added to the generated entry file automatically when `cors: true` (the default).

```ts
biniroute({ cors: false })
```

---

## Deployment

Set `platform` once in `vite.config.ts`. bini-router generates the production entry file automatically during `vite build` in the `closeBundle` hook.

```ts
biniroute({ platform: 'netlify' })
```

---

### 🟩 Netlify

```ts
biniroute({ platform: 'netlify' })
```

Generates `netlify/edge-functions/api.ts` using Deno CDN URL imports (`hono@v4.3.11`) — no npm deps needed in the edge function.

> ⚠️ **Netlify Edge Functions run on the Deno runtime, not Node.js.** Node-specific packages like `nodemailer`, `fs`, `path`, or anything that depends on Node built-ins will not work. Use Deno-compatible or Web API alternatives instead (e.g. `fetch` for HTTP, Deno CDN imports for utilities).

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

Generates `api/index.ts` (or `api/index.js`) as a Vercel Edge Function with `export const config = { runtime: 'edge' }`.

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

Generates `worker.ts` (or `worker.js`) with a built-in SPA fallback — the `ASSETS` binding serves static files first, and all unmatched paths fall through to `index.html` for React Router. Requires a `wrangler.toml` with the `ASSETS` binding.

Add `wrangler.toml`:

```toml
name = "my-app"
main = "worker.ts"
compatibility_date = "2025-04-09"

[assets]
directory = "./dist"
binding = "ASSETS"
```

Run `vite build` — the worker file is generated automatically and picked up by the Cloudflare dashboard on deploy.

---

### 🚂 Node.js (Railway, Render, Fly.io, VPS)

Node.js serving is handled by [bini-server](https://www.npmjs.com/package/bini-server) — no entry file is generated by bini-router. Setting `platform: 'node'` is accepted but produces no output.

```bash
vite build && npm start
```

---

### 🦕 Deno

```ts
biniroute({ platform: 'deno' })
```

Generates `server/index.ts` (or `server/index.js`) using Deno CDN imports (`hono@v4.3.11`) and `Deno.serve`. Port defaults to `3000` or reads from the `PORT` environment variable.

> ⚠️ **Deno Deploy does not run Node.js.** Node-specific packages like `nodemailer`, `fs`, `path`, or anything that depends on Node built-ins will not work. Use Deno-compatible or Web API alternatives instead (e.g. `fetch` for HTTP, Deno CDN imports for utilities).

> ⚠️ **Deno Deploy reads `server/` before the build step runs.** You must commit the generated file:
>
> ```bash
> git add server/index.ts
> git commit -m "chore: update deno server entry"
> git push
> ```

In Deno Console, set:
- **Entrypoint**: `server/index.ts`
- **Build Command**: `vite build`
- **Runtime**: Dynamic App

---

## Base Path

Use `basePath` when your app is deployed under a subpath (e.g. `/app`, `/v2`). bini-router prepends it to every page route, API route, and the `BrowserRouter` basename automatically.

```ts
// vite.config.ts
biniroute({ basePath: '/app' })
```

With `basePath: '/app'`:

- `src/app/page.tsx` → `/app`
- `src/app/dashboard/page.tsx` → `/app/dashboard`
- `src/app/api/users.ts` → `/app/api/users`
- `BrowserRouter basename` is set to `"/app"` at build time

> Without `basePath` set, `basename` falls back to `import.meta.env.BASE_URL` and then `"/"`.

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
  basePath  : '',             // Subpath prefix for all routes. Default: ''
                              //   e.g. '/app' → all routes prefixed with /app
})
```

---

## Error Boundaries

Every layout is wrapped in a built-in `ErrorBoundary`. In development, runtime errors are dispatched as a `__bini_error__` CustomEvent on `window` (consumed by bini-overlay) so dev overlays can display them — the boundary itself renders `null` in dev so the overlay takes over the screen. In production, a fallback UI is rendered with a "Try again" button that resets the boundary state.

---

## HMR & File Watcher

bini-router watches `src/app/` during development and regenerates `App.tsx` automatically.

- **New file** → regenerates after 300ms debounce
- **New folder** → watched instantly; regenerates after 300ms if a `page.*` file appears within 300ms
- **Changed file** → regenerates after 60ms debounce
- **Deleted file or folder** → removed from routes and triggers reload
- **Root layout change** → full module graph invalidation + full reload
- **API file change** → clears module cache entry and route cache, triggers full reload
- Events are deduplicated within a 500ms window per `file:event` key (TTL: 2s) to prevent redundant reloads
- Code generation is guarded by an `isGenerating` flag — concurrent regenerations are dropped, not queued

> You never need to restart the dev server when adding or removing routes.

---

## Route Naming Rules

bini-router validates all route segment names and dynamic parameter names at scan time:

- Segment names must match `/^[a-zA-Z0-9_-]+$/` and be under 100 characters
- Parameter names (inside `[brackets]`) must match `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- Paths containing `..` or `//` are rejected (path traversal guard)
- Invalid names are skipped with a warning — they never cause a crash
- Decoded URL parameter values are also checked for `..` and `//` at request time

---

## License

MIT © [Binidu Ranasinghe](https://bini.js.org)