# bini-router

<div align="center">

[![npm version](https://img.shields.io/npm/v/bini-router?color=00CFFF&labelColor=0a0a0a&style=flat-square)](https://www.npmjs.com/package/bini-router)
[![license](https://img.shields.io/badge/license-MIT-00CFFF?labelColor=0a0a0a&style=flat-square)](./LICENSE)
[![vite](https://img.shields.io/badge/vite-8%2B-646cff?labelColor=0a0a0a&style=flat-square)](https://vitejs.dev)
[![react](https://img.shields.io/badge/react-18%2B-61dafb?labelColor=0a0a0a&style=flat-square)](https://react.dev)
[![mdx](https://img.shields.io/badge/mdx-built--in-f472b6?labelColor=0a0a0a&style=flat-square)](https://mdxjs.com)
[![typescript](https://img.shields.io/badge/typescript-ready-3178c6?labelColor=0a0a0a&style=flat-square)](https://www.typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-00CFFF?labelColor=0a0a0a&style=flat-square)](https://github.com/binidu/bini-router/pulls)

**File-based routing, nested layouts, folder-scoped loading/error/404 boundaries, MDX pages, and Web-standard `Request → Response` API routes for Vite.**
Like Next.js App Router — but pure SPA, zero server required.

</div>

---

## Features

- 🗂️ **File-based routing** — `page.tsx` / `page.jsx` files map directly to URLs, flat files (`about.tsx` → `/about`) work the same way
- 📄 **MDX & Markdown pages** — `.mdx` and `.md` content routes work out of the box (`page.mdx`, `about.md`, etc.) — `@mdx-js/rollup` is bundled internally, no separate install or Vite config needed
- 🪆 **Nested layouts** — layouts wrap their segment and all children automatically
- 🎯 **Folder-scoped boundaries** — `loading.tsx`, `not-found.tsx`, and `error.tsx` all use "nearest wins" resolution: a file in a subfolder only affects that subfolder, shadowing (but not deleting) the same file in any ancestor folder — same mental model as layouts
- 🏷️ **Per-route metadata** — `export const metadata` in any layout sets `document.title` at runtime; root layout metadata is injected into `index.html` at build time
- 🔀 **Dynamic segments** — `[id]/page.tsx` → `/:id`, `[...slug]` → catch-all
- 🌐 **API routes** — plain `Request → Response` handlers in `src/app/api/`, served in dev/preview. Export a Hono app (or anything with a `.fetch(request)` method) and it's handled automatically, or export a plain function — no framework required either way
- ✨ **Auto-imports** — `useState`, `useEffect`, `Link`, `useNavigate`, `getEnv` and more available in every page (including `.mdx`/`.md`) without importing
- 🌿 **Auto env loading** — `.env` loaded automatically by Vite; `getEnv`/`requireEnv` auto-imported from [bini-env](https://www.npmjs.com/package/bini-env) wherever used
- 🛡️ **Error boundaries with custom overrides** — every layout/page is crash-isolated by default, and a folder's own `error.tsx` can supply custom fallback UI with a `reset()` callback
- ⏳ **Lazy loading** — every route, layout, loading file, and error file is code-split automatically via `React.lazy`
- 🔄 **HMR** — file watcher with smart debounce (60ms), event deduplication, and live new-folder detection
- 🔒 **Security** — route segment validation, param name validation, path traversal guards, 10MB source file size limits, and a configurable API request body size limit (1MB default)
- 🧩 **Programmatic route manifest & matching** — `generateRouteManifest()`, `matchRoute()`, and `matchManifestRoute()` are all exported for other build tools (SSG generators, dev overlays, sitemap builders, etc.) to reuse bini-router's own route-scanning and matching logic directly, without going through Vite's virtual module system or re-implementing pattern matching themselves
- 📦 **Zero config** — works out of the box
- 💛 **JavaScript & TypeScript** — full support for both, auto-detected from your project

> Production deployment (Netlify/Vercel/Cloudflare/Node/Deno entry generation) is handled by the companion package **[bini-deploy](https://www.npmjs.com/package/bini-deploy)**, not by bini-router itself. This package focuses purely on routing, layouts, and local API serving.

---

## Install

```bash
npm install bini-router bini-env
```

> `bini-env` powers the `getEnv`/`requireEnv` auto-imports. MDX/Markdown support ships built in with no extra install — `@mdx-js/rollup` is bundled inside bini-router itself. Hono is **not** a dependency of bini-router — see [API Routes](#api-routes) below.

---

## Setup

### `vite.config.ts` / `vite.config.js`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { biniroute } from 'bini-router'
import { biniEnv } from 'bini-env'

export default defineConfig({
  plugins: [react(), biniEnv(), ...biniroute()],
})
```

> `biniroute()` returns an array of plugins (the router plugin plus the bundled MDX compiler) — spread it into `plugins` as shown above.

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
> bini-router reads your root layout's `metadata` export and injects everything at build time.

---

## Auto-imports

bini-router automatically injects imports into every page and layout file under `src/app/` (excluding `src/app/api/`) — this applies to `.tsx`/`.jsx`/`.ts`/`.js` **and** `.mdx`/`.md` files. You never need to write import statements for these:

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

bini-router pairs with [bini-env](https://www.npmjs.com/package/bini-env) to handle environment variables:

- **Client code** — use `import.meta.env.BINI_*` (prefix set automatically by bini-env)
- **API routes** — use `getEnv()` or `requireEnv()` — no dotenv import needed
- **Dev server** — `.env` is loaded automatically by Vite itself when the server starts
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
| Your pages / layouts | `.tsx` (or `.mdx`/`.md` for pages) | `.jsx` (or `.mdx`/`.md` for pages) |
| API routes | `.ts` | `.js` |

---

## File Structure

```
src/
  main.tsx              ← mounts <App /> as usual
  App.tsx               ← auto-generated by bini-router — do not edit
  app/
    layout.tsx           ← root layout + global metadata (tsx/jsx/ts/js only)
    page.tsx             ← /
    loading.tsx          ← default loading UI, applies wherever no closer one exists
    not-found.tsx        ← default 404, applies wherever no closer one exists
    error.tsx             ← default error fallback, applies wherever no closer one exists
    about.mdx            ← /about — plain content route written in MDX

    dashboard/
      layout.tsx          ← nested layout for /dashboard/*
      page.tsx            ← /dashboard
      loading.tsx         ← ONLY affects /dashboard/* — nearest wins over the root one
      [id]/
        page.mdx          ← /dashboard/:id — a dynamic route written in MDX

    blog/
      [slug]/
        page.tsx           ← /blog/:slug

    api/
      users.ts             ← /api/users
      posts/
        index.ts           ← /api/posts
        [id].ts            ← /api/posts/:id
      [...catch].ts        ← /api/* catch-all
```

> Files and directories prefixed with `_` or `.` are ignored by the router.
> The `api/` directory is excluded from page route scanning.
> Directory traversal is capped at 100 levels deep.
> `layout`, `not-found`, `loading`, and `error` files must be `.tsx`/`.jsx`/`.ts`/`.js` — they define structural boundaries, not content, so MDX/Markdown isn't supported for these. `page` files and flat content routes (`about.*`, `login.*`, etc.) support `.mdx`/`.md` in addition to the four component extensions.

---

## Pages

```tsx
// src/app/dashboard/page.tsx — no imports needed
export default function Dashboard() {
  const [count, setCount] = useState(0)
  return <h1>Dashboard</h1>
}
```

Pages are scanned from flat files in a directory (e.g. `about.tsx` → `/about`) **and** from `page.*` files inside named subdirectories. Both forms are supported simultaneously, and both support `.mdx`/`.md` alongside the usual component extensions.

**Extension priority**, used whenever multiple files share the same base name (e.g. both `page.tsx` and `page.mdx` exist in the same folder):

```
.tsx > .jsx > .ts > .js > .mdx > .md
```

The higher-priority file wins; the lower-priority one is simply ignored for that route. This applies identically to flat-file collisions (`about.tsx` + `about.mdx` in the same folder).

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

## MDX & Markdown

`page.mdx`, `about.md`, and any other flat/content route can be written in MDX or plain Markdown instead of a React component — no setup required, `@mdx-js/rollup` is bundled inside bini-router.

```mdx
{/* src/app/about.mdx */}
export const metadata = {
  title: 'About',
}

# About us

This is regular **markdown**, rendered as JSX under the hood. You can also
drop in real components:

<button className="rounded bg-cyan-500 px-4 py-2 text-white">
  Click me
</button>
```

- Both `.mdx` and `.md` are compiled through the same MDX pipeline (full JSX/import/export support in both — there's no plain-markdown-only mode)
- `jsxImportSource` defaults to `react`
- CSS Modules, plain CSS imports, and Tailwind utility classes all work directly in `.mdx`/`.md` files exactly like they would in a `.tsx` page
- Auto-imports (`useState`, `Link`, `getEnv`, etc.) apply to `.mdx`/`.md` files the same as any other page

**Not supported in MDX/Markdown:** `layout`, `not-found`, `loading`, and `error` files — these must stay `.tsx`/`.jsx`/`.ts`/`.js`, since they define app structure rather than content.

**Tailwind + Markdown note:** Tailwind's Preflight reset strips default styling from headings, bold text, and inline code — this is standard Tailwind behavior in *any* framework, not specific to bini-router. Wrap plain-markdown regions in a `prose` class (from `@tailwindcss/typography`) if you want them to look styled by default:

```mdx
<div className="prose prose-slate">

# This heading is now styled

</div>
```

### Customizing the MDX compiler

Pass options straight through to the bundled `@mdx-js/rollup` plugin — useful for adding remark/rehype plugins:

```ts
biniroute({
  mdx: {
    remarkPlugins: [/* ... */],
    rehypePlugins: [/* ... */],
  },
})
```

---

## Layouts

Layouts wrap all pages in their directory and subdirectories. bini-router walks up the directory tree from each page to collect the full layout chain, stopping at the `appDir` root. Layouts must be `.tsx`/`.jsx`/`.ts`/`.js` — MDX is not supported for layouts.

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

## Folder-scoped Loading, Not Found, and Error boundaries

`loading.tsx`, `not-found.tsx`, and `error.tsx` all use the same **nearest-wins** resolution as layouts: a file in a subfolder only affects routes/layouts inside that subfolder, and shadows (without deleting) the same file in any ancestor folder. Anything without a closer match falls through to the nearest ancestor that has one, all the way up to the root — and to a sensible built-in default if nothing exists anywhere.

### Custom Loading Screen

```tsx
// src/app/loading.tsx — applies everywhere by default
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500" />
    </div>
  )
}
```

```tsx
// src/app/dashboard/loading.tsx — ONLY affects /dashboard/* Suspense boundaries
export default function DashboardLoading() {
  return <p>Loading dashboard…</p>
}
```

If no `loading.tsx` exists in a route's own folder or any ancestor, the built-in dark-mode-aware spinner is used automatically (it reads `document.documentElement.classList` for a `dark` class, falls back to `prefers-color-scheme`, and updates live via a `MutationObserver`).

### Custom 404 (Not Found)

```tsx
// src/app/blog/not-found.tsx — catches any unmatched /blog/* URL
export default function BlogNotFound() {
  return (
    <div>
      <h1>Post not found</h1>
      <Link to="/blog">← Back to blog</Link>
    </div>
  )
}
```

Every directory that defines its own `not-found.tsx` becomes a boundary — React Router ranks routes by specificity automatically, so a deeper boundary always wins over a shallower one for URLs under its subtree, with no manual ordering needed. Each boundary is wrapped in its own folder's layout chain, so layout metadata (page titles, etc.) still applies correctly when a scoped not-found renders. If no folder anywhere defines `not-found.tsx`, the built-in 404 page is used at the root.

### Custom Error Boundaries

```tsx
// src/app/dashboard/error.tsx — catches errors thrown anywhere in /dashboard/*
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something broke in the dashboard</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

Your component receives `error` (the thrown `Error`) and `reset()` (clears the boundary's error state, re-rendering `children`). Custom error fallbacks render in **both** dev and production. If no `error.tsx` exists anywhere up the chain, the built-in fallback is used — it renders `null` in dev (so Vite's error overlay takes over) and a generic "Something went wrong" UI with a "Try again" button in production.

In development, runtime errors are also dispatched as a `__bini_error__` `CustomEvent` on `window` regardless of whether a custom fallback exists, so external dev overlays (e.g. `bini-overlay`) can display them.

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
  authors     : [{ name: 'Your Name' }],
  canonical   : 'https://myapp.com/dashboard',
  openGraph: {
    title      : 'Dashboard',
    description: 'Your personal dashboard',
    url        : 'https://myapp.com/dashboard',
    type       : 'website',
    images     : [{ url: '/og.png' }],
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

> For `authors`, only the first entry's `name` is read into the `<meta name="author">` tag — extra keys (like a per-author `url`) and additional array entries aren't rendered. For `openGraph.images` / `twitter.images`, only the first entry's `url` is used — `width`/`height` and other keys are accepted but not emitted into HTML.

---

## API Routes

Write your API files in `src/app/api/`. The same handler code runs in both `vite dev` and `vite preview`.

Handlers can be either:
- **A `.fetch(request)`-style app** — a [Hono](https://hono.dev) app works directly, since Hono apps expose a `.fetch` method, but this isn't Hono-specific: anything exporting an object with a `.fetch(request)` method is handled the same way.
- **A plain function handler** — `(req: Request) => Response`, with zero extra dependencies.

Route matching itself (static segments, `:param` segments, `*` catch-alls) is done by bini-router's own matcher before your handler is invoked — Hono (or any other framework) is optional and only used for whatever you build inside your own handler. This is the same `matchRoute()` function [exported for external use](#matching-a-concrete-url-against-the-manifest--matchroute--matchmanifestroute) below — API request dispatch and the public matching API share one implementation.

API handlers are loaded on-demand and cached by `mtime` — touching a file in dev busts the cache immediately without a server restart.

### Local testing

Both `vite dev` and `vite preview` serve API routes identically. The dev server mounts a middleware at `/api` that strips the prefix before passing the request to your handler, so there is no difference in behavior between the two.

```bash
vite dev      # API routes live at http://localhost:3000/api/*
vite preview  # same behaviour, served from the dist build
```

### Hono app (optional, recommended for larger APIs)

```ts
// src/app/api/hello.ts
import { Hono } from 'hono'

const app = new Hono()

app.all('/hello', (c) => {
  return c.json({
    message  : 'Hello from Bini.js!',
    timestamp: new Date().toISOString(),
    method   : c.req.method,
  })
})

export default app
```

Write routes **without** the `/api` prefix — bini-router strips it before your handler sees the request in dev/preview. Requires `npm install hono` if you choose this style — it is not bundled with bini-router.

### Plain function handlers (no extra dependencies)

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

### Request body size limit

Incoming request bodies to `/api/*` routes in dev/preview are capped at **1MB by default** to prevent unbounded memory buffering. Requests exceeding the limit receive a `413 Payload Too Large` response before the body is fully read. Adjust it with `bodySizeLimit` (in bytes):

```ts
biniroute({ bodySizeLimit: 5 * 1024 * 1024 }) // 5MB
```

### CORS

CORS is **disabled by default** for `/api/*` routes in dev and preview. Enable it with `cors: true` for permissive defaults (`origin: '*'`, all standard methods, common headers), or pass an object to configure it precisely:

```ts
// Permissive — origin: '*', all standard methods
biniroute({ cors: true })

// Scoped — specific origin, methods, and headers
biniroute({
  cors: {
    origin : 'https://myapp.com',
    methods: ['GET', 'POST'],
    headers: ['Content-Type', 'Authorization'],
  },
})
```

Allowed methods checked against incoming requests regardless of CORS config: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`. When CORS is enabled, preflight `OPTIONS` requests are handled automatically with a `204` response and a 24-hour `Access-Control-Max-Age`. When a specific (non-`*`) `origin` is configured, `Access-Control-Allow-Credentials: true` is set automatically.

> For production deployments, CORS on the generated hosting entry (Netlify/Vercel/Cloudflare/etc.) is configured separately by **bini-deploy** — check its docs for that target's default.

---

## Base Path

Use `basePath` when your app is deployed under a subpath (e.g. `/app`, `/v2`). bini-router prepends it to every page route and the `BrowserRouter` basename automatically.

```ts
// vite.config.ts
biniroute({ basePath: '/app' })
```

With `basePath: '/app'`:

- `src/app/page.tsx` → `/app`
- `src/app/dashboard/page.tsx` → `/app/dashboard`
- `BrowserRouter basename` is set to `"/app"` at build time

> Dev and preview always serve API routes at `/api/*` regardless of `basePath` — the middleware is mounted directly at `/api`.
> Without `basePath` set, `basename` falls back to Vite's `import.meta.env.BASE_URL` if it's set, or `"/"` otherwise.

---

## Full options

```ts
biniroute({
  appDir       : 'src/app',      // Default: src/app
  apiDir       : 'src/app/api',  // Default: src/app/api
  cors         : false,          // Enable CORS on dev/preview API. Pass `true` for
                                  //   permissive defaults, or an object
                                  //   ({ origin?, methods?, headers? }) to scope it.
                                  //   Default: false
  strictMode   : true,           // Throw on route conflicts. Default: true
  basePath     : '',             // Subpath prefix for all routes. Default: ''
                                  //   e.g. '/app' → all routes prefixed with /app
  bodySizeLimit: 1024 * 1024,    // Max request body size (bytes) for dev/preview
                                  //   API routes. Default: 1MB
  mdx          : {},             // Passed through to the bundled @mdx-js/rollup
                                  //   plugin — e.g. remarkPlugins, rehypePlugins.
                                  //   Optional; sensible defaults are applied
                                  //   without this.
})
```

---

## Deployment

bini-router itself is deployment-agnostic — it only builds your routing tree, layouts, and dev/preview API serving. Generating platform-specific hosting config and production API entry files (Netlify, Vercel, Cloudflare, Node.js, Deno) is handled by the companion CLI, **[bini-deploy](https://www.npmjs.com/package/bini-deploy)**:

```bash
npm install --save-dev bini-deploy
npx bini-deploy
```

See the [bini-deploy README](https://www.npmjs.com/package/bini-deploy) for platform-specific setup, generated file locations, and CORS/dependency behavior for each target.

---

## HMR & File Watcher

bini-router watches `src/app/` during development and regenerates `App.tsx` automatically. This applies to `.tsx`/`.jsx`/`.ts`/`.js` **and** `.mdx`/`.md` page files alike.

- **New file** → regenerates after 300ms debounce
- **New folder** → watched instantly; regenerates after 300ms if a `page.*` file appears within 300ms
- **Changed file** → regenerates after 60ms debounce
- **Deleted file or folder** → removed from routes and triggers reload
- **Root layout change** → full module graph invalidation + full reload
- **API file change** → clears module cache entry and route cache, triggers full reload
- **Route manifest** (`virtual:bini-routes`) → invalidated alongside every route regeneration, so consumers of the virtual module never see stale route data mid-session
- Events are deduplicated within a 500ms window per `file:event` key (TTL: 2s) to prevent redundant reloads
- Code generation is guarded by an `isGenerating` flag — concurrent regenerations are dropped, not queued

> You never need to restart the dev server when adding or removing routes.

---

## Route Manifest

Route metadata (static routes, dynamic routes, per-route titles/layouts) is available two ways, depending on where you need it from.

### Inside app code — `virtual:bini-routes`

Import the virtual module from anywhere Vite bundles — components, layouts, client code:

```ts
import routes, { staticRoutes, dynamicRoutes, allRoutes, routeMetadata } from 'virtual:bini-routes'

console.log(routes.static)    // ['/', '/about', '/dashboard', ...]
console.log(routes.dynamic)   // ['/blog/:slug', ...]
console.log(routes.metadata)  // { '/dashboard': { title, layouts, filePath, dynamic }, ... }
```

This only resolves inside Vite's own build/transform pipeline (app source, or another Vite plugin's bundled code) — it is **not** a real file and can't be `import()`-ed from plain Node scripts or from inside another plugin's own `buildStart`/`closeBundle` hooks, since those run in the plugin container itself, outside Vite's module graph.

> TypeScript projects need an ambient module declaration for `virtual:bini-routes` (e.g. in a `vite-env.d.ts`) since it isn't a real file on disk.

### From other build tools — `generateRouteManifest()`

For anything that needs route data from **outside** Vite's transform pipeline — a companion plugin's own plugin-container code, a standalone Node script, a CLI, an SSG generator — import the function directly from the package:

```ts
import { generateRouteManifest } from 'bini-router'

const manifest = generateRouteManifest('src/app' /* appDir */, '' /* basePath, optional */)

console.log(manifest.static)    // ['/', '/about', ...]
console.log(manifest.dynamic)   // ['/blog/:slug', ...]
console.log(manifest.all)       // static + dynamic combined
console.log(manifest.metadata)  // per-route title/layouts/filePath/dynamic
```

This is a plain synchronous function with no Vite dependency at call time — it reads the filesystem directly using the same scanning, extension-priority, and deduplication logic that powers the router itself, so results are always consistent with what actually gets rendered. Wrap the import in a `try/catch` if bini-router might not be installed, or might be an older version that predates this export.

### Matching a concrete URL against the manifest — `matchRoute()` / `matchManifestRoute()`

`generateRouteManifest()` returns route *patterns* (e.g. `/blog/:slug`), not concrete URLs. To find out which pattern a real pathname like `/blog/hello-world` corresponds to — and whether it's static or dynamic — use `matchManifestRoute()`:

```ts
import { generateRouteManifest, matchManifestRoute } from 'bini-router'

const manifest = generateRouteManifest('src/app')
const result = matchManifestRoute(manifest, '/blog/hello-world')

console.log(result)
// { type: 'dynamic', routePath: '/blog/:slug', params: { slug: 'hello-world' } }
```

`result.type` is one of `'static'`, `'dynamic'`, or `'not_found'`. For dynamic matches, `result.params` contains the extracted segment values (and `result.params['*']` for catch-all routes). This checks exact static matches first, then falls back to scanning `manifest.dynamic` patterns — the same matcher bini-router's own API route handler uses internally to dispatch requests in `src/app/api/`.

For lower-level use — matching a single pattern against a single path without a full manifest — call `matchRoute()` directly:

```ts
import { matchRoute } from 'bini-router'

matchRoute('/blog/:slug', '/blog/hello-world')
// { slug: 'hello-world' }

matchRoute('/docs/*', '/docs/guide/setup')
// { '*': 'guide/setup' }

matchRoute('/about', '/contact')
// null — no match
```

This is the exact function used to route incoming requests to the correct API handler, so results are always consistent with how bini-router's own dev/preview server behaves.

**Typical use case:** dev tools that need to answer "is the page the user is currently viewing static or dynamic?" — for example, a dev overlay reading `window.location.pathname` and reporting route type without re-implementing bini-router's segment/param/catch-all matching itself.

---

## Exports

| Export | Type | Purpose |
|---|---|---|
| `biniroute(options?)` | function | Main Vite plugin array (routing + MDX) |
| `generateRouteManifest(appDir, basePath?)` | function | Scan the filesystem and return the route manifest |
| `matchRoute(pattern, pathname)` | function | Match a single route pattern against a concrete pathname, returning extracted params or `null` |
| `matchManifestRoute(manifest, pathname)` | function | Resolve a concrete pathname against a full manifest — returns `{ type, routePath?, params? }` |
| `RouteManifest` | type | Shape returned by `generateRouteManifest()` |
| `RouteMatchResult` | type | Shape returned by `matchManifestRoute()` |
| `BiniPluginOptions` | type | Options accepted by `biniroute()` |
| `IconEntry` / `MetaTags` | type | Shapes used by the `metadata` export in layouts |

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