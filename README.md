# bini-router

[![npm version](https://img.shields.io/npm/v/bini-router?color=00CFFF&labelColor=0a0a0a&style=flat-square)](https://www.npmjs.com/package/bini-router)
[![license](https://img.shields.io/badge/license-MIT-00CFFF?labelColor=0a0a0a&style=flat-square)](./LICENSE)
[![vite](https://img.shields.io/badge/vite-8%2B-646cff?labelColor=0a0a0a&style=flat-square)](https://vitejs.dev)
[![react](https://img.shields.io/badge/react-18%2B-61dafb?labelColor=0a0a0a&style=flat-square)](https://react.dev)
[![mdx](https://img.shields.io/badge/mdx-built--in-f472b6?labelColor=0a0a0a&style=flat-square)](https://mdxjs.com)
[![typescript](https://img.shields.io/badge/typescript-ready-3178c6?labelColor=0a0a0a&style=flat-square)](https://www.typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-00CFFF?labelColor=0a0a0a&style=flat-square)](https://github.com/binidu/bini-router/pulls)

**File-based routing, nested layouts, templates, route groups, parallel routes, intercepting routes, folder-scoped loading/error/404 boundaries, MDX pages, and Web-standard `Request -> Response` API routes for Vite.**

Similar to the Next.js App Router, but a pure SPA with no server required.

---

## Table of Contents

- [Features](#features)
- [Install](#install)
- [Setup](#setup)
- [File Structure](#file-structure)
- [Routing](#routing)
- [Layouts](#layouts)
- [Templates](#templates)
- [Loading, Not Found, and Error Boundaries](#loading-not-found-and-error-boundaries)
- [MDX and Markdown](#mdx-and-markdown)
- [Metadata](#metadata)
- [Document Export](#document-export)
- [Auto-imports](#auto-imports)
- [Environment Variables](#environment-variables)
- [API Routes](#api-routes)
- [Base Path](#base-path)
- [Configuration Reference](#configuration-reference)
- [Route Manifest](#route-manifest)
- [HMR and File Watcher](#hmr-and-file-watcher)
- [Programmatic API](#programmatic-api)
- [Exports](#exports)
- [Route Naming Rules](#route-naming-rules)
- [Differences from Next.js](#differences-from-nextjs)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)
- [License](#license)

---

## Features

- **File-based routing.** `page.tsx` files inside folders and flat files such as `about.tsx` both map directly to URLs. `index.*` files map to their parent route.
- **Dynamic, catch-all, and optional catch-all segments.** `[id]`, `[...slug]`, and `[[...slug]]` are supported for both folders and flat files.
- **Route groups.** Folders wrapped in parentheses, such as `(marketing)`, organize files and share layouts without affecting the URL.
- **Parallel routes.** Folders prefixed with `@`, such as `@sidebar`, define named route slots that resolve independently of the main route tree, with their own `default.tsx` fallback.
- **Intercepting routes.** Folders prefixed with `(.)`, `(..)`, or `(...)` let a route "intercept" navigation to a nearby, sibling, or root-level path — the convention Next.js uses for things like photo-in-a-modal flows.
- **Nested layouts.** Layouts wrap their segment and all children, and receive route `params` as a prop.
- **Templates.** `template.tsx` files wrap individual pages inside the layout chain, using the same nearest-wins resolution as other special files.
- **MDX and Markdown pages.** `.mdx` and `.md` content routes work out of the box. `@mdx-js/rollup` is bundled internally, so no separate install or Vite configuration is required.
- **Folder-scoped boundaries.** `loading`, `not-found`, `error`, and `default` files use nearest-wins resolution. A file in a subfolder affects only that subfolder and shadows, without deleting, the same file in any ancestor.
- **Per-route metadata.** `export const metadata` in layouts and pages sets `document.title` at runtime, with support for title templates. Root layout metadata is injected into `index.html`.
- **Document export.** `export const document` in the root layout customizes attributes on `<html>` and `<body>` and appends markup to `<head>`. The `head` fragment is parsed into a plain data structure at build time, not raw HTML strings, so there is no HTML-injection surface even for handwritten JSX.
- **API routes.** Plain `Request -> Response` handlers in `src/app/api/`, served in dev and preview. Any object exposing a `.fetch(request)` method (such as a Hono app) is supported, as are plain functions.
- **Auto-imports.** Common React, React Router, and environment helpers are available in `.tsx`, `.jsx`, `.ts`, and `.js` source files without explicit imports.
- **Error isolation.** Every layout and page is wrapped in an error boundary that resets on navigation. A folder's own `error.tsx` can supply custom fallback UI.
- **Code splitting.** Pages, layouts, loading files, error files, not-found files, and slot defaults are all loaded through `React.lazy`.
- **AST-based analysis.** Source files are parsed with the Oxc parser rather than regular expressions, so metadata, exports, and auto-import detection are accurate.
- **Hot reloading.** A debounced file watcher regenerates routes as files and folders are added, changed, or removed.
- **Security.** Route segment validation, parameter name validation, path traversal guards, source file size limits, host-header validation for API request URLs, and a configurable API request body size limit.
- **Bounded resource usage.** The preview-mode API module cache is capped and evicts its oldest entry once full, so long-running preview processes don't accumulate handlers indefinitely.
- **Programmatic route manifest and matching.** `generateRouteManifest()`, `matchRoute()`, and `matchManifestRoute()` are exported for SSG generators, dev overlays, sitemap builders, and other tooling.
- **Deployment-base aware.** The router `basename` and every root-relative metadata URL respect Vite's `base` configuration.
- **Zero configuration.** Works out of the box.
- **JavaScript and TypeScript.** Both are supported and auto-detected from your project.

> Production deployment (Netlify, Vercel, Cloudflare, Node, and Deno entry generation) is handled by the companion package [bini-deploy](https://www.npmjs.com/package/bini-deploy). This package focuses on routing, layouts, and local API serving.

---

## Install

```bash
npm install bini-router bini-env
```

`bini-env` powers the `getEnv` and `requireEnv` auto-imports. MDX and Markdown support ships built in. Hono is not a dependency of bini-router; see [API Routes](#api-routes).

### Requirements

| Dependency | Version |
|---|---|
| Vite | 8 or later |
| React | 18 or later |
| react-router-dom | Required in your project; the generated app imports `BrowserRouter`, `Routes`, `Route`, `Outlet`, `useLocation`, and `useParams` from it |

---

## Setup

### vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { biniroute } from 'bini-router'
import { biniEnv } from 'bini-env'

export default defineConfig({
  plugins: [react(), biniEnv(), ...biniroute()],
})
```

`biniroute()` returns an array of plugins (the router plugin plus the bundled MDX compiler). Spread it into `plugins` as shown.

### index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- bini-router injects metadata here automatically -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

You do not need to add `<title>`, `<meta>`, favicon, or Open Graph tags manually. bini-router reads the root layout's `metadata` export and injects them.

### main.tsx

Mount the generated `App` component as usual:

```tsx
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
```

### Generated App file

bini-router generates `src/App.tsx` (or `src/App.jsx` in JavaScript projects) and keeps it in sync with your route tree. The file begins with an auto-generated header and should not be edited.

If a file already exists at that path without the header, bini-router will not overwrite it. In development a warning is logged; during a build the process fails with an error. Delete or move the file to let bini-router manage it.

The generated module exports:

| Export | Description |
|---|---|
| `default` | The `App` component, wrapping `AppRoutes` in a `BrowserRouter` |
| `AppRoutes` | The route tree, for use with a custom router such as `StaticRouter` |
| `basename` | The resolved router basename |

### TypeScript vs JavaScript

Project type is detected in this order:

1. The presence of `src/main.tsx`, `src/main.ts`, `src/main.jsx`, or `src/main.js`
2. A `tsconfig.json` at the project root
3. Any `.ts` or `.tsx` file inside `src/app/` (scanned up to 5 levels deep)

| | TypeScript project | JavaScript project |
|---|---|---|
| Generated app entry | `src/App.tsx` | `src/App.jsx` |
| Error boundary | Fully typed class | Plain JavaScript class |
| Pages and layouts | `.tsx` (or `.mdx`/`.md` for pages) | `.jsx` (or `.mdx`/`.md` for pages) |
| API routes | `.ts` | `.js` |

---

## File Structure

```
src/
  main.tsx                  Mounts <App />
  App.tsx                   Auto-generated by bini-router. Do not edit.
  app/
    layout.tsx              Root layout, global metadata, document export
    template.tsx             Optional template wrapping every page
    page.tsx                 /
    loading.tsx               Default loading UI
    not-found.tsx             Default 404
    error.tsx                 Default error fallback
    about.mdx                 /about, written in MDX

    (marketing)/             Route group: no URL segment
      layout.tsx              Layout shared by the group
      pricing/
        page.tsx               /pricing

    dashboard/
      layout.tsx               Nested layout for /dashboard/*
      page.tsx                 /dashboard
      loading.tsx               Applies only to /dashboard/*
      [id]/
        page.mdx                 /dashboard/:id, written in MDX

    @sidebar/                 Parallel route slot: no URL segment
      default.tsx              Fallback rendered when no slot route matches
      page.tsx                 Slot content for /
      dashboard/
        page.tsx                 Slot content for /dashboard

    photo/
      [id]/
        page.tsx                 /photo/:id
        (.)view/
          page.tsx                 Intercepts navigation to a sibling /photo/[id]/view

    blog/
      index.tsx                 /blog
      [slug].tsx                 /blog/:slug
      not-found.tsx               Applies only to /blog/*

    docs/
      [...path]/
        page.tsx                 /docs/*

    api/
      users.ts                   /api/users
      posts/
        index.ts                   /api/posts
        [id].ts                    /api/posts/:id
      [...catch].ts               /api/* catch-all
```

Rules:

- Files and directories prefixed with `_` or `.` are ignored.
- The `api/` directory is excluded from page route scanning.
- Directory traversal is capped at 100 levels.
- `layout`, `template`, `loading`, `error`, `not-found`, `global-error`, and `default` files must be `.tsx`, `.jsx`, `.ts`, or `.js`. They define structure rather than content, so MDX and Markdown are not supported for them.
- `page` files and flat content routes support `.mdx` and `.md` in addition to the four component extensions.

---

## Routing

### Pages

```tsx
// src/app/dashboard/page.tsx
export default function Dashboard() {
  const [count, setCount] = useState(0)
  return <h1>Dashboard</h1>
}
```

Routes are collected from two forms, which may be used together:

- **Folder pages:** a `page.*` file inside a named subdirectory (`dashboard/page.tsx` maps to `/dashboard`)
- **Flat files:** any supported file directly in a directory (`about.tsx` maps to `/about`)

Files named `index.*` map to the parent route, so `dashboard/index.tsx` maps to `/dashboard`. Reserved names (`page`, `layout`, `template`, `not-found`, `loading`, `error`, `global-error`, `default`) are never treated as flat routes.

### Dynamic routes

```tsx
// src/app/blog/[slug]/page.tsx
export default function Post() {
  const { slug } = useParams()
  return <h1>Post: {slug}</h1>
}
```

Flat files work the same way: `blog/[slug].tsx` maps to `/blog/:slug`.

### Catch-all routes

```tsx
// src/app/docs/[...path]/page.tsx
export default function Docs() {
  // Matches /docs/anything/nested/here
  return <h1>Docs</h1>
}
```

`[...name]` maps to a required wildcard (`*`) segment, and the optional form `[[...name]]` matches even when nothing follows. Required and optional catch-alls are tracked separately internally, so a required catch-all still 404s on an empty tail while an optional one renders.

### Route groups

A folder whose name is wrapped in parentheses groups routes without contributing a URL segment. Groups can carry their own layouts, loading files, and error files.

```
app/
  (marketing)/
    layout.tsx        Applies only to routes inside the group
    about/page.tsx    /about
  (app)/
    layout.tsx
    settings/page.tsx /settings
```

Group names must match `/^[a-zA-Z0-9_-]+$/`. Folders that use the interception syntax (`(.)`, `(..)`, `(...)`, see below) are not treated as route groups even though they also start with a parenthesis.

### Parallel routes

A folder prefixed with `@`, such as `@sidebar` or `@modal`, defines a **slot**: a named subtree of routes that is resolved independently of the folder it lives in and does not add a segment to the URL.

```
app/
  layout.tsx
  page.tsx
  @sidebar/
    default.tsx         Rendered when the current URL matches nothing below
    page.tsx             Slot content for /
    settings/
      page.tsx             Slot content for /settings
```

- Slot names must match `/^[a-zA-Z][a-zA-Z0-9_-]*$/`.
- Every route inside a slot is scanned exactly like a normal route (dynamic segments, catch-alls, nested layouts, and templates all work the same way), it's simply tagged with its slot name instead of being added to the main route tree.
- When nothing inside the slot matches the current URL, its nearest `default.tsx` (nearest-wins, same resolution as `loading`/`error`/`not-found`) is rendered. If no `default.tsx` exists anywhere in the slot's chain, a built-in "No Content" fallback is used.
- Slot content is generated as its own internally-routed block (via a `SlotBoundary` wrapper) and is not injected as a named prop into layouts.

> **Note:** Parallel routes are a newer addition. If you're relying on slot content rendering *simultaneously* with the matched main-tree page (the way Next.js parallel routes render alongside their siblings), verify this against your installed version before depending on it in production — the exact composition behavior between slots and the main route tree is still evolving. Treat it as experimental until you've confirmed it against your specific layout structure.

### Intercepting routes

A folder prefixed with `(.)`, `(..)`, or `(...)` "intercepts" navigation to a nearby route, rendering different content at that same URL depending on where the navigation came from — the same convention Next.js uses for things like opening a photo in a modal while preserving the underlying feed.

| Prefix | Intercepts |
|---|---|
| `(.)name` | A sibling of the current segment (same level) |
| `(..)name` | A route one level up |
| `(...)name` | A route from the root of the app |

```
app/
  feed/
    page.tsx
    photo/
      [id]/
        page.tsx        /feed/photo/:id — full photo page
  photo/
    [id]/
      page.tsx          /photo/:id
      (.)view/
        page.tsx        Intercepts /photo/[id]/view at the same level
```

- The intercepting folder itself does not add a URL segment; the segment that follows it (`view` in the example above) does.
- Only files with a default export inside an intercepting folder are treated as routes; an invalid or empty interception prefix is skipped with a warning rather than crashing the build.
- Intercepting routes are compared for conflicts only against other routes at the same intercept level, so an intercepted path and its non-intercepted target are not reported as a conflict with each other.

### Route priority

Routes are matched in this order: static routes first, then dynamic (`:param`) routes, then required catch-alls (`*`), then optional catch-alls (`**`) last. Within a category, shorter paths are placed first.

### Conflicts and extension priority

When two files resolve to the same URL and the same intercept level (for example `page.tsx` and `page.mdx`, or `about.tsx` and `about/page.tsx`), bini-router reports a route conflict.

- With `strictMode: true` (the default), a conflict fails the build and is logged as an error in development.
- With `strictMode: false`, a warning is logged and one file is chosen: the route with the deeper layout chain wins, and ties are resolved by extension priority:

```
.tsx > .jsx > .ts > .js > .mdx > .md
```

Only files with a default export are treated as routes.

---

## Layouts

Layouts wrap all pages in their directory and subdirectories. bini-router walks up from each page to the app root to build the full layout chain.

Every layout, including the root layout, is rendered as a React Router `<Route element>` wrapper that renders child routes through `<Outlet />`. Layouts also receive the current route `params` as a prop.

```tsx
// src/app/layout.tsx
export const metadata = {
  title: 'My App',
  description: 'Built with bini-router',
}

export default function RootLayout() {
  return <Outlet />
}
```

```tsx
// src/app/dashboard/layout.tsx
export const metadata = {
  title: 'Dashboard',
}

export default function DashboardLayout({ params }) {
  return (
    <div className="dashboard">
      <aside>Sidebar</aside>
      <main><Outlet /></main>
    </div>
  )
}
```

Notes:

- Layouts that contain an `<html>` tag are treated as HTML shell files and excluded from the chain.
- Layouts without a default export are excluded.
- Circular layout chains are detected; a warning is logged and traversal stops at the repeated directory.
- Layouts are bundled eagerly rather than lazily loaded, except for the root layout's slot and boundary dependents, which follow the same lazy-loading rules as pages.

---

## Templates

A `template.tsx` file wraps each page in its scope. Like layouts, templates are resolved by walking up from the page directory. The nearest template with a default export is used.

```tsx
// src/app/dashboard/template.tsx
export default function DashboardTemplate({ children }) {
  return <section className="page-transition">{children}</section>
}
```

Templates render inside the layout chain and directly around the page element. Templates containing an `<html>` tag are ignored.

Templates only apply to routes inside the folder that declares them, and to its descendants. A template in `dashboard/settings/` does not affect `dashboard/page.tsx`. Templates receive `children` but not `params`.

---

## Loading, Not Found, and Error Boundaries

`loading`, `not-found`, `error`, and `default` (parallel-route slots only) files all use nearest-wins resolution. A file in a subfolder affects only routes inside that subfolder and shadows the same file in ancestor folders. Routes with no closer match fall through to the nearest ancestor, and finally to a built-in default.

### Loading

```tsx
// src/app/dashboard/loading.tsx
export default function DashboardLoading() {
  return <p>Loading dashboard...</p>
}
```

The file is used as the Suspense fallback for pages and layouts in its scope. If none exists, a built-in spinner is used. It reads the `dark` class on `document.documentElement`, falls back to `prefers-color-scheme`, and updates live through a `MutationObserver`.

### Not Found

```tsx
// src/app/blog/not-found.tsx
export default function BlogNotFound() {
  return (
    <div>
      <h1>Post not found</h1>
      <Link to="/blog">Back to blog</Link>
    </div>
  )
}
```

Every directory with its own `not-found.tsx` becomes a boundary for unmatched URLs under that subtree. React Router ranks routes by specificity, so deeper boundaries take precedence. Each boundary is wrapped in its folder's layout chain. If no folder defines one, a built-in 404 page is used at the root. Its "back to home" link respects the configured basename.

### Error

```tsx
// src/app/dashboard/error.tsx
export default function DashboardError({ error, reset }) {
  return (
    <div>
      <h2>Something broke in the dashboard</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

The component receives `error` and `reset()`. Error boundaries also reset automatically when the pathname changes, so navigating away from a failed route recovers without a manual reset.

Custom fallbacks render in both development and production. When no `error.tsx` exists in scope, the built-in fallback renders nothing in development (so Vite's error overlay is visible) and a generic "Something went wrong" screen with a retry button in production.

In development, runtime errors are also dispatched as a `__bini_error__` `CustomEvent` on `window`, so external overlays such as `bini-overlay` can display them.

### Default (parallel-route slots)

```tsx
// src/app/@sidebar/default.tsx
export default function SidebarDefault() {
  return <p>Nothing to show here for this page.</p>
}
```

`default.tsx` only applies inside `@slot` folders (see [Parallel routes](#parallel-routes)). It's rendered whenever no route inside the slot matches the current URL. If a slot has no `default.tsx` anywhere in its chain, a built-in "No Content" placeholder is used instead.

---

## MDX and Markdown

`page.mdx`, `about.md`, and any other page or flat route can be written in MDX or Markdown.

```mdx
# About us

This is regular **markdown**, rendered as JSX. You can also use real components:

<button className="rounded bg-cyan-500 px-4 py-2 text-white">
  Click me
</button>
```

- Both `.mdx` and `.md` are compiled through the same MDX pipeline, with full JSX, import, and export support in both.
- `jsxImportSource` defaults to `react`.
- CSS Modules, plain CSS imports, and Tailwind utility classes work as they do in `.tsx` pages.
- Auto-imports and the `metadata` / `document` export handling are applied to script files only. In `.mdx` and `.md` files, import what you need explicitly.

Tailwind's Preflight reset removes default styling from headings, bold text, and inline code. Wrap Markdown regions in a `prose` class from `@tailwindcss/typography` if you want default typographic styling:

```mdx
<div className="prose prose-slate">

# This heading is styled

</div>
```

### Customizing the MDX compiler

Options are passed straight through to `@mdx-js/rollup`:

```ts
biniroute({
  mdx: {
    remarkPlugins: [/* ... */],
    rehypePlugins: [/* ... */],
  },
})
```

---

## Metadata

Export `metadata` from any layout or page (`.tsx`, `.jsx`, `.ts`, `.js`).

- **Root layout metadata** is injected into `index.html`.
- **Layout and page titles** update `document.title` at runtime through a `TitleSetter` component.
- The `metadata` export is stripped from the client bundle and never ships to the browser.

```ts
export const metadata = {
  title: 'Dashboard',
  description: 'Your personal dashboard',
  viewport: 'width=device-width, initial-scale=1.0',
  themeColor: '#00CFFF',
  charset: 'UTF-8',
  robots: 'index, follow',
  manifest: '/site.webmanifest',
  keywords: ['react', 'vite', 'dashboard'],   // array or string
  author: 'Your Name',                        // string, or { name: 'Your Name' }
  canonical: 'https://myapp.com/dashboard',
  openGraph: {
    title: 'Dashboard',
    description: 'Your personal dashboard',
    url: 'https://myapp.com/dashboard',
    type: 'website',
    images: [{ url: '/og.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dashboard',
    description: 'Your personal dashboard',
    creator: '@yourhandle',
    images: ['/og.png'],
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: [{ url: '/favicon.png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
}
```

All fields are optional. Metadata must be statically analyzable: string, number, boolean, array, and object literals (and template literals without expressions) are read; computed values and function calls are ignored.

### Title templates

A layout can define a title template that applies to all descendant pages and layouts:

```ts
// src/app/layout.tsx
export const metadata = {
  title: {
    default: 'My App',
    template: '%s | My App',
  },
}
```

```ts
// src/app/dashboard/page.tsx
export const metadata = { title: 'Dashboard' }
// Resolves to "Dashboard | My App"
```

Title resolution rules:

1. If the page defines a string title and a template exists in its layout chain, the nearest template is applied.
2. Otherwise the page title is used as is.
3. If the page has no title, the nearest layout title (string, or the `default` of a title object) is used.
4. If nothing defines a title, the original `document.title` from `index.html` is restored.

### Notes

- Only the root layout's metadata is injected into `index.html` at build time. Every layout and page title is applied to `document.title` at runtime. All injected values are HTML-escaped.
- `author` is read as a string or as an object with a `name` key. `openGraph.images` and `twitter.images` use only the first entry (a string or an object with `url`); a singular `image` key is also accepted.
- Root-relative asset URLs (`manifest`, all `icons` groups, `canonical`, `openGraph` image, `twitter` image) are automatically prefixed with Vite's `base`. Absolute URLs, protocol-relative URLs, and `data:` URIs are left unchanged. `openGraph.url` is never prefixed.

---

## Document Export

The root layout can export a `document` object to customize the HTML shell in `index.html`. This is enabled by default and can be disabled with the `document: false` option.

```tsx
// src/app/layout.tsx
export const document = {
  html: { lang: 'en', class: 'dark' },
  body: { class: 'antialiased' },
  head: (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <script async src="https://example.com/analytics.js"></script>
    </>
  ),
}

export default function RootLayout() {
  return <Outlet />
}
```

| Key | Behavior |
|---|---|
| `html` | Attributes merged onto the `<html>` tag |
| `body` | Attributes merged onto the `<body>` tag |
| `head` | A JSX element or fragment converted to a static structure and appended before `</head>` |

Attribute merging rules:

- A `class` value is appended to any existing classes rather than replacing them.
- Setting an attribute to `true` renders it as a boolean attribute.
- Setting an attribute to `false`, `null`, or `undefined` removes it.
- Other attributes overwrite existing values.
- Attribute names in `html` and `body` are written as HTML names (`class`, not `className`).

The `head` fragment is converted at build time, so it must be static. Instead of being turned into an HTML string directly, it's parsed into a small typed tree of element, text, and attribute nodes — so no part of it is ever produced as raw, unescaped HTML text at this stage. JSX attribute names are mapped to their HTML equivalents (`className` to `class`, `httpEquiv` to `http-equiv`, and so on), void elements are recognized, and boolean attributes are handled. Dynamic expressions other than plain string literals (and expression-free template literals) are dropped, with a one-time warning per file.

Like `metadata`, the `document` export is stripped from the client bundle.

---

## Auto-imports

bini-router injects imports into script files (`.tsx`, `.jsx`, `.ts`, `.js`) so that common helpers are available without import statements.

**From `react`:**

```
useState  useEffect  useRef  useMemo  useCallback  useContext
createContext  useReducer  useId  useTransition  useDeferredValue
```

**From `react-router-dom`:**

```
Link  NavLink  useNavigate  useParams  useLocation  useSearchParams  Outlet
```

**From `bini-env`:**

```
getEnv  requireEnv
```

```tsx
// src/app/profile/page.tsx
export default function Profile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  return (
    <div>
      <Link to="/">Home</Link>
      <h1>Profile {id}</h1>
    </div>
  )
}
```

Behavior:

- Injection is based on AST analysis. A name is injected only when it is actually referenced and not already declared or imported in the file, so local variables and manual imports are never duplicated or shadowed.
- By default, injection applies to every file under `src/`. Narrow the scope with the `autoImportDir` option (for example `src/app` for a Next.js-style, app-only behavior).
- Files inside the API directory, the generated `App` file, and `.mdx` / `.md` files are excluded.

---

## Environment Variables

bini-router pairs with [bini-env](https://www.npmjs.com/package/bini-env):

- **Client code:** use `import.meta.env.BINI_*` (the prefix is set by bini-env)
- **API routes:** use `getEnv()` or `requireEnv()`
- **Development:** `.env` is loaded automatically by Vite
- **Production:** variables are read from the host environment

```env
# .env
BINI_FIREBASE_API_KEY=your_key        # client-side
SMTP_USER=user@smtp.example.com       # server-side
SMTP_PASS=your_password
```

```ts
// src/app/api/email.ts
const SMTP_USER = requireEnv('SMTP_USER')  // throws if missing
const DEBUG = getEnv('DEBUG_MODE')         // undefined if missing
```

---

## API Routes

Place API files in `src/app/api/`. The same handler code runs in `vite dev` and `vite preview`.

Handlers can be either:

- **A `.fetch(request)` object.** A [Hono](https://hono.dev) app works directly, but any object with a `.fetch` method is handled the same way.
- **A plain function.** `(req: Request) => Response | Promise<Response>`, with no extra dependencies.

Route matching (static segments, `:param` segments, `*` catch-alls) is performed by bini-router's own matcher before your handler runs. This is the same `matchRoute()` function exported for external use.

### Route mapping

| File | Route |
|---|---|
| `api/users.ts` | `/api/users` |
| `api/posts/index.ts` | `/api/posts` |
| `api/posts/[id].ts` | `/api/posts/:id` |
| `api/[...catch].ts` | `/api/*` |
| `api/(internal)/health.ts` | `/api/health` |

Route groups, dynamic directories, and catch-all directories are supported inside the API directory as well. API routes are ordered so that static routes are tried first, then dynamic routes, then catch-alls.

### Plain function handlers

```ts
// src/app/api/hello.ts
export default function handler(req: Request) {
  return Response.json({ message: 'hello', method: req.method })
}
```

Route parameters are passed to plain function handlers as a JSON string in the `x-bini-params` request header:

```ts
// src/app/api/posts/[id].ts
export default function handler(req: Request) {
  const params = JSON.parse(req.headers.get('x-bini-params') ?? '{}')
  return Response.json({ id: params.id })
}
```

### Hono apps

```ts
// src/app/api/hello.ts
import { Hono } from 'hono'

const app = new Hono()

app.all('/hello', (c) => c.json({
  message: 'Hello from Bini.js!',
  method: c.req.method,
}))

export default app
```

Write routes without the `/api` prefix; it is stripped before the handler sees the request. Hono is optional and must be installed separately (`npm install hono`).

### Development and preview behavior

- In development, handlers are loaded through Vite's `ssrLoadModule`, so edits take effect immediately.
- In preview, handlers are imported on demand and cached by file path, modification time, and size, so unchanged files reuse the same module instance. This cache holds at most 500 entries and evicts the oldest one once full, so a long-running preview process won't accumulate handler modules indefinitely.
- Requests are accepted at `/api/*` and, when Vite's `base` is set, at `<base>/api/*`. The prefix is stripped before dispatch.
- The API middleware is always registered, and checks for the API directory at request time, so creating `api/` after startup works without a restart.
- Supported methods are `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, and `HEAD`. Other methods receive `405 Method Not Allowed`.
- Handler load failures and runtime exceptions return a generic `500` JSON response and are logged to the console.
- Multiple `Set-Cookie` headers are preserved.
- The request URL passed to your handler is built from the incoming `Host` header (or a validated `X-Forwarded-Host`/`X-Forwarded-Proto` pair) so `new URL(req.url)` behaves sensibly behind a proxy. An unrecognized or malformed host falls back to `localhost` rather than being trusted verbatim.

### Request body size limit

Request bodies are capped at 1 MB by default. Oversized requests receive `413 Payload Too Large`, based on both the `Content-Length` header and the actual streamed size. Adjust with `bodySizeLimit` (bytes):

```ts
biniroute({ bodySizeLimit: 5 * 1024 * 1024 })
```

### CORS

CORS is disabled by default. Enable permissive defaults with `cors: true`, or configure it precisely:

```ts
biniroute({ cors: true })

biniroute({
  cors: {
    origin: 'https://myapp.com',
    methods: ['GET', 'POST'],
    headers: ['Content-Type', 'Authorization'],
  },
})
```

When enabled, preflight `OPTIONS` requests are answered automatically with `204` and a 24-hour `Access-Control-Max-Age`, and CORS headers are added to handler responses. When a specific (non-`*`) origin is configured, `Access-Control-Allow-Credentials: true` is set.

For production CORS on generated hosting entries, see the [bini-deploy](https://www.npmjs.com/package/bini-deploy) documentation.

---

## Base Path

Deploying under a sub-path (for example `https://example.com/my-app/`) is driven by Vite's own `base` option. bini-router reads the resolved `base` (including values supplied via CLI flags such as `--base`) and derives everything from it.

```ts
// vite.config.ts
export default defineConfig({
  base: '/my-app/',
  plugins: [react(), biniEnv(), ...biniroute()],
})
```

| What | Behavior |
|---|---|
| `BrowserRouter` basename | Exported from the generated `App` as `basename`, derived from Vite's `base` |
| Metadata URLs | Root-relative `manifest`, icons, `canonical`, `og:image`, and `twitter:image` are prefixed with `base` |
| API routes | Served at `/api/*` and `<base>/api/*` |
| Vite's script and asset tags | Handled by Vite itself |

Relative bases (`./` or `.`) resolve to a basename of `/`.

### Overriding the basename

Use the `basename` option to set the router basename independently of Vite's `base`:

```ts
biniroute({ basename: '/docs' })
```

A leading slash is added and trailing slashes are removed automatically.

### StaticRouter and pre-rendering

When using a non-root basename with `StaticRouter` in an SSG or pre-render script, the location passed in must include the basename:

```ts
import { AppRoutes, basename } from './App'

// With base "/my-app/", the location must be "/my-app/about", not "/about"
const fullUrl = url.startsWith(basename)
  ? url
  : `${basename.replace(/\/$/, '')}${url}`
```

Passing a bare route path while the basename is non-root causes `StaticRouter` to render nothing and log a basename-mismatch warning.

---

## Configuration Reference

```ts
biniroute({
  appDir: 'src/app',
  apiDir: 'src/app/api',
  autoImportDir: 'src',
  cors: false,
  strictMode: true,
  bodySizeLimit: 1024 * 1024,
  document: true,
  basename: undefined,
  mdx: {},
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `appDir` | `string` | `'src/app'` | Directory containing file-based routes |
| `apiDir` | `string` | `'src/app/api'` | Directory containing API routes |
| `autoImportDir` | `string` | `'src'` | Directory where auto-imports are injected. Set to `'src/app'` to limit injection to route files |
| `cors` | `boolean \| { origin?, methods?, headers? }` | `false` | CORS handling for dev and preview API routes |
| `strictMode` | `boolean` | `true` | Fail on route conflicts. When `false`, conflicts are logged as warnings and resolved automatically |
| `bodySizeLimit` | `number` | `1048576` | Maximum API request body size in bytes |
| `document` | `boolean` | `true` | Process `export const document` from the root layout |
| `basename` | `string` | derived from Vite `base` | Override the `BrowserRouter` basename |
| `mdx` | `object` | `{}` | Options passed to the bundled `@mdx-js/rollup` plugin |

There is no separate `basePath` option. Sub-path deployments are controlled by Vite's `base` (see [Base Path](#base-path)).

---

## Route Manifest

Route data is available in two ways depending on where you need it.

### Inside app code: virtual:bini-routes

```ts
import routes, {
  staticRoutes,
  dynamicRoutes,
  allRoutes,
  routeMetadata,
} from 'virtual:bini-routes'

console.log(routes.static)    // ['/', '/about', '/dashboard']
console.log(routes.dynamic)   // ['/blog/:slug']
console.log(routes.metadata)  // { '/dashboard': { title, dynamic }, ... }
```

The virtual module resolves only within Vite's build and transform pipeline. It is not a real file and cannot be imported from plain Node scripts or from inside another plugin's own build hooks. For security, the client-facing metadata contains only `title`, `dynamic`, and (when present) `catchallParamName`; file paths, layout paths, and slot names are not exposed.

TypeScript projects need an ambient module declaration for `virtual:bini-routes`, for example in `vite-env.d.ts`.

The module is invalidated whenever the generated route tree changes, so consumers never see stale data during development.

### From other tools: generateRouteManifest()

```ts
import { generateRouteManifest } from 'bini-router'

const manifest = generateRouteManifest('src/app')
// Optional second argument: API directory (defaults to <appDir>/api)

console.log(manifest.static)    // ['/', '/about']
console.log(manifest.dynamic)   // ['/blog/:slug']
console.log(manifest.all)       // static and dynamic combined
console.log(manifest.metadata)  // per-route title, layouts, filePath, dynamic, slotName
```

This is a plain synchronous function with no Vite dependency at call time. It reads the filesystem using the same scanning, deduplication, and title-resolution logic as the router, so results match what is actually rendered. Returned paths are raw scanned paths and are not prefixed by Vite's `base`. Use it from SSG generators, CLIs, sitemap builders, and companion plugins.

Each manifest entry's `slotName` field identifies routes that live inside a `@slot` folder, so external tooling can distinguish main-tree routes from parallel-route slot content.

### Matching URLs: matchManifestRoute() and matchRoute()

```ts
import { generateRouteManifest, matchManifestRoute } from 'bini-router'

const manifest = generateRouteManifest('src/app')
const result = matchManifestRoute(manifest, '/blog/hello-world')

// { type: 'dynamic', routePath: '/blog/:slug', params: { slug: 'hello-world' } }
```

`result.type` is `'static'`, `'dynamic'`, or `'not_found'`. Catch-all matches expose the remainder under `params['*']`.

For lower-level matching without a manifest:

```ts
import { matchRoute } from 'bini-router'

matchRoute('/blog/:slug', '/blog/hello-world')  // { slug: 'hello-world' }
matchRoute('/docs/*', '/docs/guide/setup')      // { '*': 'guide/setup' }
matchRoute('/about', '/contact')                // null
```

Parameter values are URI-decoded, and any value containing `..` or `//` causes the match to fail. This is the same function used to dispatch API requests.

---

## HMR and File Watcher

bini-router watches the app directory during development and regenerates `App.tsx` automatically. No dev server restart is needed when adding or removing routes.

| Event | Behavior |
|---|---|
| New page or special file | Regenerates after a 300 ms debounce |
| Changed page or special file | Regenerates after a 60 ms debounce |
| Deleted file or folder | Regenerates and reloads |
| New folder | Watched immediately; regenerates if a `page.*` file appears within 300 ms |
| Root layout change | Invalidates the full module graph and triggers a full reload |
| Route regeneration | Invalidates `virtual:bini-routes` and triggers a full reload when the generated output changed |
| API file added or removed | Clears route and module caches, then triggers a full reload |
| API file changed | Clears the relevant cache entries; the next request uses the updated handler |
| API directory created after startup | Detected and watched automatically |

Regeneration is guarded by an `isGenerating` flag, so overlapping regenerations are dropped rather than queued. The generated file is only written when its content actually changes.

---

## Programmatic API

bini-router exports a small, stable API for tooling that integrates with the router. [bini-ssg](https://www.npmjs.com/package/bini-ssg) and [bini-overlay](https://www.npmjs.com/package/bini-overlay) are the two in-tree consumers.

### biniroute(options?): Plugin[]

The Vite plugin factory. Spread the returned array into your `plugins` config.

### generateRouteManifest(appDir, apiDir?): RouteManifest

Scans `appDir` for the same files the router does and returns the route tree. See [Route Manifest](#route-manifest) for the shape.

Contract:

- Dynamic segments use `:name` syntax (`/users/:id`).
- Catch-all segments use `*` (`/docs/*`).
- Static segments are bare (`/about`).
- Returned paths are never prefixed with Vite's `base`. Consumers that match against browser URLs must strip `base` first.
- `apiDir` defaults to `<appDir>/api`.

This contract is covered by unit tests. Changing it is a breaking change.

### matchManifestRoute(manifest, pathname): RouteMatchResult

Matches a base-stripped pathname against a manifest. Returns `{ type, routePath?, params? }`.

### matchRoute(pattern, pathname): Record<string, string> | null

Low-level matcher. Uses the same `:name` and `*` syntax as the manifest.

### Types

`BiniPluginOptions`, `RouteManifest`, `RouteMatchResult`, `RouteManifestEntry`, `HeadNode`, `MetaTags`, `IconEntry`, `TitleTemplate`, and `DocumentExport`.

### Stability

The exports listed above are stable and covered by tests. Internal helpers (route scanning, metadata parsing, the transform pipeline) are not exported and may change between minor versions without notice. If you need access to one, open an issue describing your use case.

---

## Exports

| Export | Kind | Purpose |
|---|---|---|
| `biniroute(options?)` | function | Vite plugin array (routing and MDX) |
| `generateRouteManifest(appDir, apiDir?)` | function | Scan the filesystem and return the route manifest |
| `matchRoute(pattern, pathname)` | function | Match one pattern against a pathname; returns params or `null` |
| `matchManifestRoute(manifest, pathname)` | function | Resolve a pathname against a manifest |
| `BiniPluginOptions` | type | Options accepted by `biniroute()` |
| `RouteManifest` | type | Shape returned by `generateRouteManifest()` |
| `RouteManifestEntry` | type | Shape of a single manifest entry, including `slotName` and catch-all kind |
| `RouteMatchResult` | type | Shape returned by `matchManifestRoute()` |
| `HeadNode` | type | Shape of the parsed `document.head` structure (element / text / raw nodes) |
| `MetaTags` | type | Shape of the `metadata` export |
| `TitleTemplate` | type | Shape of `{ default, template }` titles |
| `IconEntry` | type | Shape of icon entries in `metadata.icons` |
| `DocumentExport` | type | Shape of the `document` export |
| `Plugin` / `ViteDevServer` | type | Re-exported from `vite` |

---

## Route Naming Rules

Route segments and parameters are validated at scan time:

- Static segment names must match `/^[a-zA-Z0-9_-]+$/` and be at most 100 characters
- Parameter names inside brackets must match `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- Route group names must match `/^[a-zA-Z0-9_-]+$/`
- Parallel-route slot names (after the `@`) must match `/^[a-zA-Z][a-zA-Z0-9_-]*$/`
- Intercepting-route folders must use exactly one of the `(.)`, `(..)`, or `(...)` prefixes, followed by a valid segment name
- Names containing `..` or `//` are rejected
- Invalid names are skipped with a warning and never cause a crash
- Source files larger than 10 MB are ignored
- Decoded URL parameter values are checked for `..` and `//` at request time

---

## Differences from Next.js

bini-router borrows the App Router's conventions, but is a pure SPA with no server. The main differences:

| | Next.js App Router | bini-router |
|---|---|---|
| Server components | Yes | No. Client only |
| Data fetching in layouts | Server-side | Client-side only |
| `middleware.ts` | Yes | No |
| SSR / SSG | Built in | Client-side only; use a separate pre-rendering tool together with `generateRouteManifest()` |
| API routes | Production (Node or edge) | Dev and preview; use [bini-deploy](https://www.npmjs.com/package/bini-deploy) for production |
| Optional catch-all `[[...slug]]` | Yes | Yes |
| Route groups `(name)` | Yes | Yes |
| Parallel routes `@slot` | Yes, injected into layouts as named props | Slot resolution and a `default.tsx` fallback are supported; slot content is not currently injected into layouts as named props the way Next.js does |
| Intercepting routes `(.)`, `(..)`, `(...)` | Yes | Yes |
| File-based routing | Folders with `page.tsx` only | Both `page.tsx` folders and flat files (`about.tsx`, `[id].tsx`) |
| `template.tsx` | Remounts on navigation | Wrapper between the layout chain and the page |
| `loading.tsx` / `error.tsx` / `not-found.tsx` / `default.tsx` | Nearest-wins | Nearest-wins |

---

## Troubleshooting

**`virtual:bini-routes` is not resolving in TypeScript.**
Add an ambient module declaration, for example in `vite-env.d.ts`:

```ts
declare module 'virtual:bini-routes' {
  type RouteInfo = { title?: string; dynamic: boolean; catchallParamName?: string }
  export const staticRoutes: string[]
  export const dynamicRoutes: string[]
  export const allRoutes: string[]
  export const routeMetadata: Record<string, RouteInfo>
  const manifest: {
    static: string[]
    dynamic: string[]
    all: string[]
    metadata: Record<string, RouteInfo>
  }
  export default manifest
}
```

**A route is not being generated.**
Check that the file has a default export, is not inside a `_` or `.` prefixed path, and is not inside the API directory. Run `generateRouteManifest('src/app')` in a Node script to see what the router sees.

**A route conflict is failing my build.**
Delete one of the conflicting files, or set `strictMode: false` to log a warning and let bini-router pick a winner (the route with the deeper layout chain, then extension priority).

**A slot's content isn't rendering where I expect.**
Parallel-route (`@slot`) resolution is newer than the rest of the router. Confirm your slot has at least one matching route or a `default.tsx`, and check the generated `src/App.tsx` to see how the slot's routes were wired in for your specific layout — the composition model may not yet match what you'd expect from Next.js parallel routes.

**The tab title is stale after navigation.**
Add a `metadata.title` export to the page or a parent layout. If nothing in the chain defines a title, the original `document.title` from `index.html` is restored.

**`src/App.tsx` exists but is not being updated.**
bini-router only manages files that begin with its auto-generated header. Delete or move the existing file to let it take over.

**Auto-imports are not working in an `.mdx` file.**
Auto-imports apply to `.tsx`, `.jsx`, `.ts`, and `.js` files only. This is intentional: MDX and Markdown files are compiled by a separate pipeline. Import what you need explicitly in `.mdx` and `.md` files.

---

## Deployment

bini-router is deployment-agnostic. It builds the routing tree, layouts, and dev/preview API serving. Platform-specific configuration and production API entry files (Netlify, Vercel, Cloudflare, Node.js, Deno) are generated by the companion CLI [bini-deploy](https://www.npmjs.com/package/bini-deploy):

```bash
npm install --save-dev bini-deploy
npx bini-deploy
```

See the bini-deploy documentation for platform-specific setup.

---

## License

MIT (c) [Binidu Ranasinghe](https://bini.js.org)