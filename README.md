# bini-router

[![npm version](https://img.shields.io/npm/v/bini-router?color=00CFFF&labelColor=0a0a0a&style=flat-square)](https://www.npmjs.com/package/bini-router)
[![license](https://img.shields.io/badge/license-MIT-00CFFF?labelColor=0a0a0a&style=flat-square)](./LICENSE)
[![vite](https://img.shields.io/badge/vite-8%2B-646cff?labelColor=0a0a0a&style=flat-square)](https://vitejs.dev)
[![react](https://img.shields.io/badge/react-18%2B-61dafb?labelColor=0a0a0a&style=flat-square)](https://react.dev)
[![mdx](https://img.shields.io/badge/mdx-built--in-f472b6?labelColor=0a0a0a&style=flat-square)](https://mdxjs.com)
[![typescript](https://img.shields.io/badge/typescript-ready-3178c6?labelColor=0a0a0a&style=flat-square)](https://www.typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-00CFFF?labelColor=0a0a0a&style=flat-square)](https://github.com/binidu/bini-router/pulls)

**File-based routing for Vite + React: nested layouts, templates, route groups, parallel routes, intercepting routes, React Router data exports, folder-scoped loading/error/404 boundaries, MDX pages, and Web-standard `Request -> Response` API routes.**

Similar to the Next.js App Router, but a pure client-side SPA built on React Router's data router. No server is required.

---

## Table of Contents

- [Features](#features)
- [Install](#install)
- [Setup](#setup)
- [File Structure](#file-structure)
- [Routing](#routing)
- [Layouts](#layouts)
- [Templates](#templates)
- [Route Data Exports](#route-data-exports)
- [Loading, Not Found, and Error Boundaries](#loading-not-found-and-error-boundaries)
- [MDX and Markdown](#mdx-and-markdown)
- [Metadata](#metadata)
- [Document Export](#document-export)
- [Prerender Export](#prerender-export)
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

- **File-based routing.** `page.tsx` files inside folders and flat files such as `about.tsx` both map to URLs. `index.*` files map to their parent route.
- **Dynamic, catch-all, and optional catch-all segments.** `[id]`, `[...slug]`, and `[[...slug]]` work for both folders and flat files.
- **Route groups.** Folders wrapped in parentheses, such as `(marketing)`, share layouts without affecting the URL.
- **Parallel routes.** `@slot` folders define named slots that are matched against the current URL and passed to the sibling `layout.*` as named props, with an optional per-slot `default.*` fallback.
- **Intercepting routes.** `(.)`, `(..)`, and `(...)` folders and flat files render alternative content at a URL when the previous location matches the interceptor's source route.
- **Nested layouts and templates.** Layouts wrap their segment and all children and receive `params`. Templates wrap each page inside the layout chain.
- **React Router data exports.** `loader`, `action`, `shouldRevalidate`, `ErrorBoundary`, `HydrateFallback` / `hydrateFallbackElement`, and `handle` exported from pages and layouts are wired into the generated data router.
- **MDX and Markdown pages.** `.mdx` and `.md` pages are compiled through `@mdx-js/rollup`, loaded on demand.
- **Folder-scoped boundaries.** `loading`, `not-found`, and `error` use nearest-wins resolution. A root `global-error` file catches anything the route tree does not.
- **Per-route metadata.** `export const metadata` in layouts and pages drives `document.title` at runtime (with title templates) and is extracted into the route manifest, where [bini-ssg](https://www.npmjs.com/package/bini-ssg) turns it into head tags at build time.
- **Document and prerender exports.** `export const document` and `export const prerender` are statically extracted into the route manifest. bini-ssg applies `document` to pre-rendered HTML and skips routes with `prerender = false`.
- **API routes.** `Request -> Response` handlers in `src/app/api/`, served in dev and preview. Supports per-method exports (`GET`, `POST`, ...), `.fetch(request)` objects (such as Hono apps), and plain functions.
- **Auto-imports.** Common React, React Router, and `bini-env` helpers are available in `.tsx`, `.jsx`, `.ts`, and `.js` files under `src/` without explicit imports.
- **Error isolation.** Every layout and page sits inside an error boundary that resets on navigation, plus a last-resort boundary around the whole app.
- **Code splitting.** Pages, non-root layouts, loading, error, not-found, global-error, and slot default files are loaded through `React.lazy` (or route `lazy`).
- **AST-based analysis.** Source files are parsed with Oxc rather than regular expressions.
- **Hot reloading.** A debounced file watcher regenerates the route tree as files and folders change.
- **Security and limits.** Route and parameter name validation, path traversal guards, a 10 MB source file limit, host-header validation for API request URLs, an API body size limit, and a 10 second body read timeout.
- **Bounded resource usage.** Parse, file, module, and warning caches are capped.
- **Programmatic manifest and matching.** `generateRouteManifest()`, `generateBuildManifest()`, `getMetadataForRoute()`, `getCssForRoute()`, `matchRoute()`, and `matchManifestRoute()` are exported for tooling.
- **Deployment-base aware.** The router `basename` is derived from Vite's `base`, and API routes are served under it.
- **JavaScript and TypeScript.** Both are supported and auto-detected.

> Production deployment (Netlify, Vercel, Cloudflare, Node, and Deno entry generation) is handled by the companion package [bini-deploy](https://www.npmjs.com/package/bini-deploy). This package covers routing, layouts, and local API serving.

---

## Install

```bash
npm install bini-router bini-env
```

`bini-env` powers the `getEnv` and `requireEnv` auto-imports. Hono is not a dependency; see [API Routes](#api-routes).

### Requirements

| Dependency | Version |
|---|---|
| Vite | 8 or later |
| React | 18 or later |
| react-router-dom | Required in your project. The generated app uses the data-router APIs (`createBrowserRouter`, `createRoutesFromElements`, `RouterProvider`, `useRoutes`, `matchPath`, `useRouteError`, `useRevalidator`, `isRouteErrorResponse`) |

The installed `react-router-dom` (or `react-router`) version is read from `node_modules` and decides which names are auto-imported (see [Auto-imports](#auto-imports)).

---

## Setup

### vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { biniroute } from 'bini-router'
import { biniEnv } from 'bini-env'

export default defineConfig({
  plugins: [react(), biniEnv(), biniroute()],
})
```

`biniroute()` returns an array of two plugins: the router plugin (`bini-router`) and the MDX compiler (`bini-router:mdx`). Spread it into `plugins`.

### index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

bini-router itself does not rewrite `index.html`. It sets `document.title` at runtime from `metadata`, and falls back to the title in `index.html` when no route defines one. The full `metadata` and `document` exports are available in the [route manifest](#route-manifest); during `vite build`, [bini-ssg](https://www.npmjs.com/package/bini-ssg) merges them into the `<head>` of each pre-rendered page. In development, only the runtime title is applied.

### main.tsx

```tsx
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
```

### Generated App file

bini-router generates `src/App.tsx` (or `src/App.jsx`) and keeps it in sync with your route tree. An existing `src/App.tsx` is used first, then `src/App.jsx`; otherwise the extension follows the detected project type. The file starts with an auto-generated header and must not be edited.

If a file already exists at that path without the header, bini-router will not overwrite it. In development a warning is logged; during a build the process fails with an error. Delete or move the file to let bini-router manage it. The file is only rewritten when its content changes.

The generated module exports:

| Export | Description |
|---|---|
| `default` | The `App` component: a last-resort error boundary around a `RouterProvider` |
| `routes` | The route objects created with `createRoutesFromElements` |
| `AppRoutes` | A component that renders `useRoutes(routes)`, for custom routers such as `StaticRouter` |
| `getRouter()` | Lazily creates and returns the `createBrowserRouter` instance. On a pre-rendered page it picks up the hydration data written by `StaticRouterProvider`, so loaders don't re-run |
| `basename` | The resolved router basename |

### TypeScript vs JavaScript

Project type is detected in this order:

1. The presence of `src/main.tsx`, `src/main.ts`, `src/main.jsx`, or `src/main.js` (the first one found decides)
2. A `tsconfig.json` at the project root
3. Any `.ts` or `.tsx` file inside `src/app/` (scanned up to 5 levels deep)

| | TypeScript project | JavaScript project |
|---|---|---|
| Generated app entry | `src/App.tsx` | `src/App.jsx` |
| Error boundary | Typed class | Plain JavaScript class |
| Pages and layouts | `.tsx` (or `.mdx`/`.md` for pages) | `.jsx` (or `.mdx`/`.md` for pages) |
| API routes | `.ts` | `.js` |

---

## File Structure

The app directory is fixed at `src/app`, the API directory at `src/app/api`.

```
src/
  main.tsx                  Mounts <App />
  App.tsx                   Auto-generated by bini-router. Do not edit.
  app/
    layout.tsx              Root layout, global metadata, document export
    template.tsx            Optional template wrapping every page
    page.tsx                /
    loading.tsx             Default loading UI
    not-found.tsx           Default 404
    error.tsx               Default error fallback
    global-error.tsx        Outermost error fallback
    about.mdx               /about, written in MDX

    (marketing)/            Route group: no URL segment
      layout.tsx            Layout shared by the group
      pricing/
        page.tsx            /pricing

    dashboard/
      layout.tsx            Nested layout for /dashboard/*
      page.tsx              /dashboard
      loading.tsx           Applies only to /dashboard/*
      [id]/
        page.mdx            /dashboard/:id, written in MDX

    inbox/
      layout.tsx            Receives the "sidebar" slot as a prop
      page.tsx              /inbox
      @sidebar/             Parallel route slot: no URL segment
        default.tsx         Rendered when no slot route matches
        page.tsx            Slot content for /inbox
        archive/
          page.tsx          Slot content for /inbox/archive

    photo/
      [id]/
        page.tsx            /photo/:id
        view/
          page.tsx          /photo/:id/view (direct visits)
        (.)view/
          page.tsx          Shown at /photo/:id/view when arriving from /photo/:id

    blog/
      index.tsx             /blog
      [slug].tsx            /blog/:slug
      not-found.tsx         Applies only to /blog/*

    docs/
      [...path]/
        page.tsx            /docs/*

    api/
      users.ts              /api/users
      posts/
        index.ts            /api/posts
        [id].ts             /api/posts/:id
      [...catch].ts         /api/* catch-all
```

Rules:

- Files and directories prefixed with `_` or `.` are ignored. `node_modules` is skipped.
- The `api/` directory is excluded from page route scanning.
- Directory traversal is capped at 100 levels.
- `layout`, `template`, `loading`, `error`, `not-found`, `global-error`, and `default` files must be `.tsx`, `.jsx`, `.ts`, or `.js`. They define structure, so MDX and Markdown are not supported for them.
- `page` files and flat content routes support `.mdx` and `.md` in addition to the four component extensions.
- Empty files and files over 10 MB are ignored (the latter with a warning).

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

Routes are collected from two forms, which can be mixed:

- **Folder pages:** a `page.*` file inside a named subdirectory (`dashboard/page.tsx` maps to `/dashboard`)
- **Flat files:** any supported file directly in a directory (`about.tsx` maps to `/about`)

Files named `index.*` map to the parent route, so `dashboard/index.tsx` maps to `/dashboard`. Reserved names (`page`, `layout`, `template`, `not-found`, `loading`, `error`, `global-error`, `default`) are never treated as flat routes.

Main-route pages do not receive `params` as a prop; read them with `useParams()`.

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

`[...name]` is a required catch-all and `[[...name]]` is an optional one. Both are emitted as a `*` route in the router and tracked separately in the manifest (`catchallKind`). When there is no real page at the parent path (here `/docs`), a required catch-all adds a guard route so that `/docs` renders the root not-found page instead of the catch-all.

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

Group names must match `/^[a-zA-Z0-9_-]+$/`. Folders using the interception syntax are not route groups.

### Parallel routes

A folder prefixed with `@` defines a **slot**: a named subtree resolved against the current URL that adds no URL segment.

```
app/
  inbox/
    layout.tsx
    page.tsx
    @sidebar/
      default.tsx       Rendered when no slot route matches
      page.tsx          Slot content for /inbox
      archive/
        page.tsx        Slot content for /inbox/archive
```

The slot is passed to the `layout.*` in the **same directory as the `@slot` folder**, as a prop named after the slot:

```tsx
// src/app/inbox/layout.tsx
export default function InboxLayout({ params, sidebar }) {
  return (
    <div className="grid">
      <aside>{sidebar}</aside>
      <main><Outlet /></main>
    </div>
  )
}
```

- Slot names must match `/^[a-zA-Z][a-zA-Z0-9_-]*$/`.
- A slot whose owner directory has no usable `layout.*` is skipped with a warning.
- Routes inside a slot are scanned like normal routes (dynamic segments, catch-alls, nested layouts, templates), but only layouts and templates inside the slot folder apply to them.
- Slot pages receive a `params` prop.
- The slot renders the first entry whose path matches the current location. If none matches, it renders the `default.*` file located directly in the slot folder, or nothing when there is none.
- `data` exports (`loader`, `action`, and so on) in slot pages are not executed; a warning is logged. Load data in the component, or from the real page's or a layout's loader via `useRouteLoaderData`.

### Intercepting routes

Folders and flat files prefixed with `(.)`, `(..)`, or `(...)` render different content at a URL depending on where the navigation came from.

| Prefix | Target is resolved relative to |
|---|---|
| `(.)name` | The current route segment level |
| `(..)name` | One URL level up |
| `(...)name` | The app root |

```
app/
  photo/
    [id]/
      page.tsx          /photo/:id
      view/
        page.tsx        /photo/:id/view (full page, direct visits)
      (.)view/
        page.tsx        Shown at /photo/:id/view when the previous location matched /photo/:id
```

- The interceptor adds no URL segment of its own; the segment after the prefix does.
- The intercepting page replaces the real page only when the previous in-app location matches the route that contains the interceptor (its source path). Direct visits and reloads render the real page.
- When no real page exists at the target path, direct visits to it render the root not-found page.
- Intercepting routes are not router routes and are not listed in the route manifest.
- An invalid or empty prefix is skipped with a warning.
- Conflicts are checked on the combination of path, intercept level, and slot, so an interceptor and its target do not conflict.

### Route priority

Routes are ordered static first, then dynamic (`:param`), then required catch-alls, then optional catch-alls. Within a category, shorter paths come first. React Router then ranks them by specificity.

### Conflicts and extension priority

When two files resolve to the same URL, intercept level, and slot (for example `page.tsx` and `page.mdx`, or `about.tsx` and `about/page.tsx`), bini-router reports a route conflict.

- With `strictMode: true` (the default), a conflict throws `RouteConflictError`. During a build this fails the build; in development it is logged as an error.
- With `strictMode: false`, a warning is logged and one file is chosen: the route with the deeper layout chain wins, and ties are resolved by extension priority:

```
.tsx > .jsx > .ts > .js > .mdx > .md
```

### Pages without a default export

A page file must `export default` a component. With `strictMode: true`, pages without one (or that fail to parse) throw `MissingDefaultExportError`. With `strictMode: false` they are skipped with a warning.

---

## Layouts

Layouts wrap all pages in their directory and subdirectories. bini-router walks up from each page to the app root to build the layout chain. Every layout renders its children through `<Outlet />` and receives the route `params` as a prop (plus any parallel-route slots).

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
export const metadata = { title: 'Dashboard' }

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

- Layouts containing an `<html>` JSX element are treated as HTML shells and excluded from the chain.
- Layouts without a default export are excluded.
- Circular layout chains are detected; a warning is logged and traversal stops.
- The root layout is imported eagerly. All other layouts are loaded through `React.lazy`.

---

## Templates

A `template.*` file wraps each page in its scope. Templates are resolved by walking up from the page directory; the nearest one with a default export wins.

```tsx
// src/app/dashboard/template.tsx
export default function DashboardTemplate({ children }) {
  return <section className="page-transition">{children}</section>
}
```

Templates render inside the layout chain, directly around the page element. They receive `children` but not `params`, and are imported eagerly. Templates containing an `<html>` tag, or without a default export, are ignored. A template applies to routes in the folder that declares it and its descendants only.

---

## Route Data Exports

Pages and layouts on the main route tree can export React Router route-module members. bini-router detects them by static analysis and wires them into the generated route.

| Export | Route property |
|---|---|
| `loader` | `loader` |
| `action` | `action` |
| `shouldRevalidate` | `shouldRevalidate` |
| `ErrorBoundary` | `ErrorBoundary` (replaces the generated error element for that route) |
| `HydrateFallback` / `hydrateFallbackElement` | `HydrateFallback` / `hydrateFallbackElement` |
| `handle` | `handle` |

```tsx
// src/app/users/page.tsx
export async function loader() {
  const res = await fetch('/api/users')
  return res.json()
}

export default function Users() {
  const users = useLoaderData()
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>
}
```

- Exports are loaded lazily through the route's `lazy` function. The root layout is imported eagerly, so its data exports are attached directly.
- When any data route exists, a root `hydrateFallbackElement` is rendered using the nearest `loading.*` (or the built-in spinner).
- Hook names for these APIs (`useLoaderData`, `useActionData`, `useNavigation`, `useFetcher`, `useSubmit`, `Form`, `redirect`, and more) are auto-imported.
- Adding or removing a data export on a page triggers regeneration; editing the bodies does not.
- Data exports on parallel-route and intercepting pages are not executed (a warning is logged).

---

## Loading, Not Found, and Error Boundaries

`loading`, `not-found`, and `error` files use nearest-wins resolution. A file in a subfolder affects only routes inside that subfolder and shadows the same file in ancestor folders. Routes with no closer match fall through to the nearest ancestor, and finally to a built-in default. Files without a default export, or that contain an `<html>` element, are ignored.

### Loading

```tsx
// src/app/dashboard/loading.tsx
export default function DashboardLoading() {
  return <p>Loading dashboard...</p>
}
```

Used as the Suspense fallback for the pages and layouts in its scope. The built-in spinner reads the `dark` class on `document.documentElement`, falls back to `prefers-color-scheme`, and updates live through a `MutationObserver`.

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

Every directory with its own `not-found.*` becomes a boundary for unmatched URLs under that subtree (`/blog/*`), wrapped in that folder's layout chain. Deeper boundaries take precedence. Without a root `not-found.*`, a built-in 404 page is used; its "Back to home" link respects the basename. A `404` thrown from a route (for example a `loader` throwing a 404 response) renders the nearest not-found component.

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

The component receives `error` and `reset()`. Boundaries also reset automatically when the pathname changes. For data-router errors (loaders, actions, route error responses), `reset` revalidates the route.

Custom fallbacks render in development and production. With no `error.*` in scope, the built-in fallback renders nothing in development (so Vite's error overlay stays visible) and a generic "Something went wrong" screen with a retry button in production.

In development, runtime errors are also dispatched as a `__bini_error__` `CustomEvent` on `window` with `{ name, message, stack, componentStack?, _type: 'runtime' }`, so overlays such as `bini-overlay` can display them.

### Global error

`global-error.*` in the app root is the outermost fallback, wrapped around the whole route tree and the root route's `errorElement`. Without one, the built-in error screen is used. An additional minimal last-resort boundary wraps `RouterProvider` in case everything else fails.

### Default (parallel-route slots)

```tsx
// src/app/inbox/@sidebar/default.tsx
export default function SidebarDefault() {
  return <p>Nothing to show here for this page.</p>
}
```

`default.*` is read only from the slot folder itself (not from ancestors). If it is missing, the slot renders nothing when no route inside it matches.

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

- Both `.mdx` and `.md` go through the same MDX pipeline with full JSX, import, and export support.
- The compiler is loaded on first use. Its options are fixed: `jsxImportSource: 'react'`, `mdExtensions: []`, `mdxExtensions: ['.mdx', '.md']`. They are not configurable through `biniroute()`.
- CSS Modules, plain CSS imports, and Tailwind utility classes work as in `.tsx` pages.
- Auto-imports are not applied to `.mdx` / `.md` files; import what you need explicitly.
- `metadata`, `document`, `prerender`, and CSS extraction apply to script files only. MDX pages contribute no metadata of their own (layouts above them still do).

Tailwind's Preflight reset removes default heading, bold, and inline-code styling. Wrap Markdown in a `prose` class from `@tailwindcss/typography` for typographic defaults:

```mdx
<div className="prose prose-slate">

# This heading is styled

</div>
```

---

## Metadata

Export `metadata` from any layout or page (`.tsx`, `.jsx`, `.ts`, `.js`).

- **Titles** update `document.title` at runtime through a `TitleSetter` component. In development, titles are resolved through a lazily loaded virtual module so title edits apply without regenerating the route tree; in production builds they are inlined.
- The whole `metadata` object is statically extracted into the [route manifest](#route-manifest) (`meta` and `title`), merged along the layout chain.
- The `metadata` export is stripped from files under `src/app` so it never ships in the client bundle.

```ts
export const metadata = {
  title: 'Dashboard',
  description: 'Your personal dashboard',
  keywords: ['react', 'vite', 'dashboard'],
  openGraph: {
    title: 'Dashboard',
    images: [{ url: '/og.png' }],
  },
}
```

bini-router itself only interprets `title`. Every other key is passed through to the manifest untouched. When you pre-render with [bini-ssg](https://www.npmjs.com/package/bini-ssg), these keys are written into each page's `<head>`:

| Key | Output |
|---|---|
| `title` | `<title>` |
| `description`, `robots`, `author` (string), `keywords` (string or array) | `<meta name="...">` |
| `themeColor` | `<meta name="theme-color">` |
| `canonical`, `manifest` | `<link rel="canonical">`, `<link rel="manifest">` |
| `icons.icon`, `icons.shortcut`, `icons.apple` | `<link rel="icon">`, `<link rel="shortcut icon">`, `<link rel="apple-touch-icon">` (entries are `{ url, type?, sizes? }`) |
| `openGraph` (requires `title`) | `og:title`, `og:type` (default `website`), `og:description`, `og:url`, `og:site_name`, `og:image` (from `images` or `image`) |
| `twitter` (requires `title`) | `twitter:card` (default `summary_large_image`), `twitter:title`, `twitter:description`, `twitter:creator`, `twitter:image` (first of `images` or `image`) |

Other keys are ignored by bini-ssg.

Metadata must be statically analyzable: string, number, boolean, array, and object literals (and template literals without expressions) are read. Computed keys, spreads, identifiers, and function calls are ignored.

### Merging

Metadata from the layout chain and the page is merged from outermost layout to the page. Later values overwrite earlier ones, and plain-object values are shallow-merged one level deep (for example `openGraph`). `title` is resolved separately (below).

### Title templates

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

1. If the page defines a string title and a `template` exists in its layout chain (nearest wins), the template is applied.
2. Otherwise the page's string title is used as is.
3. If the page has no title, the nearest layout title (a string, or the `default` of a title object) is used.
4. If nothing defines a title, the original `document.title` from when the page loaded is restored.

Parallel-route (slot) pages do not set the document title.

---

## Document Export

`export const document` is statically extracted from the page, or from the nearest layout that exports it (nearest wins), and stored in the route manifest as `document`. It is stripped from the client bundle like `metadata`.

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
```

| Key | Extracted as |
|---|---|
| `html` | `Record<string, string>` of literal attributes |
| `body` | `Record<string, string>` of literal attributes |
| `head` | `HeadNode[]`: a typed tree of `element` / `text` nodes |

- `head` is parsed from the JSX into plain data, never into an HTML string, so no raw HTML is produced at this stage.
- JSX attribute names are mapped to HTML names (`className` to `class`, `httpEquiv` to `http-equiv`, `charSet` to `charset`, and so on). `true` becomes an empty-string attribute; `false`, `null`, and `undefined` drop the attribute.
- Dynamic expressions (anything other than string literals and expression-free template literals) are dropped, with a one-time warning per file.
- bini-router does not write these values into `index.html` itself. [bini-ssg](https://www.npmjs.com/package/bini-ssg) applies them at build time: `html` and `body` attributes are set on the pre-rendered `<html>` and `<body>` elements (overwriting existing values, including `class`), and `head` is serialized and appended to `<head>`. In development they have no effect.

---

## Prerender Export

```ts
export const prerender = 'strict'   // or 'fallback' or false
```

A literal `prerender` export (`'strict'`, `'fallback'`, or `false`) on a page is recorded in the manifest as `prerender` (type `PrerenderMode`). bini-router does not act on it itself.

[bini-ssg](https://www.npmjs.com/package/bini-ssg) reads it when pre-rendering:

- `false` skips the route: it is not seeded, not reached by link crawling, and (for dynamic patterns) gets no shell page. The root route `/` is always rendered regardless.
- `'strict'` and `'fallback'` are accepted and currently behave the same as leaving the export out.

---

## Auto-imports

bini-router injects imports into script files (`.tsx`, `.jsx`, `.ts`, `.js`) under `src/` so common helpers work without import statements.

**From `react`:**

```
useState  useEffect  useRef  useMemo  useCallback  useContext
createContext  useReducer  useId  useTransition  useDeferredValue
```

**From `react-router-dom`:**

```
Link  NavLink  useNavigate  useParams  useLocation  useSearchParams  Outlet
useLoaderData  useActionData  useNavigation  useFetcher  useFetchers
useMatches  useRouteLoaderData  useRouteError  useRevalidator  useSubmit
Await  useAsyncValue  useAsyncError  Form  redirect  isRouteErrorResponse
```

Added depending on the installed router version:

| Name | Condition |
|---|---|
| `useBlocker` | 6.7 or later |
| `redirectDocument`, `replace` | 6.12 or later |
| `defer` | before 7.0 |

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

- Injection is AST-based. A name is injected only when it is referenced and not already declared at module scope or imported, so manual imports and local declarations are never duplicated or shadowed.
- Applies to every file under `src/`. This is fixed and not configurable.
- Excluded: files in the API directory, the generated `App` file, `.mdx` / `.md` files, and `.d.ts` files.
- Imports are inserted after any directive prologue (such as `'use client'`) and leading comments.

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

Place API files (`.ts` or `.js`) in `src/app/api/`. The same handlers run in `vite dev` and `vite preview`. A file can use any one of three styles.

### Per-method exports

```ts
// src/app/api/posts/[id].ts
export function GET(req: Request, { params, searchParams }) {
  return Response.json({ id: params.id, q: searchParams.get('q') })
}

export async function POST(req: Request, { params }) {
  const body = await req.json()
  return Response.json({ id: params.id, body }, { status: 201 })
}
```

Supported exports: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. If a file exports any of them, only those methods are allowed; other methods receive a `405` JSON response with an `Allow` header.

### Default function

```ts
// src/app/api/hello.ts
export default function handler(req: Request, { params, searchParams }) {
  return Response.json({ message: 'hello', method: req.method })
}
```

A default-exported function receives `(request, { params, searchParams })`.

### Hono apps and `.fetch` objects

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

Any default export with a `.fetch(request)` method is supported. Write routes without the `/api` prefix; it is stripped before the handler sees the request. Hono is optional and must be installed separately (`npm install hono`).

Method exports take precedence over a default export in the same file.

### Route mapping

| File | Route |
|---|---|
| `api/users.ts` | `/api/users` |
| `api/posts/index.ts` or `api/posts/route.ts` | `/api/posts` |
| `api/posts/[id].ts` | `/api/posts/:id` |
| `api/[...catch].ts` | `/api/*` (non-empty tail required) |
| `api/[[...catch]].ts` | `/api/**` (optional tail) |
| `api/(internal)/health.ts` | `/api/health` |

- Route groups, dynamic directories (`[id]/`), and catch-all directories (`[...x]/`) work inside the API directory.
- A catch-all must be the last segment; nested routes under a catch-all directory are skipped with a warning.
- If both `route.*` and `index.*` exist in a directory, a warning is logged and `route.*` is intended to win.
- API routes are tried static first, then dynamic, then catch-alls.
- Names starting with `_` or `.` are ignored. Invalid names are skipped with a warning.

### Development and preview behavior

- In development, handlers are loaded through Vite's `ssrLoadModule`, so edits apply immediately.
- In preview, handlers are imported on demand and cached by path, modification time, and size. The cache holds at most 500 entries and evicts the oldest first. Files over 10 MB are ignored.
- Requests are accepted at `/api/*` and, when Vite's `base` is set, at `<base>/api/*`. The prefix is stripped before dispatch.
- The middleware is always registered and checks for the API directory at request time (the result is kept up to date by the watcher), so creating `api/` after startup works without a restart.
- Supported methods are `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, and `HEAD`. Anything else receives `405`.
- Paths containing `..` or `//` receive `400`. Unmatched requests receive a `404` JSON response.
- Handler load failures and thrown exceptions return a generic `500` JSON response and are logged.
- Multiple `Set-Cookie` headers are preserved. Hop-by-hop request headers are not forwarded to your handler.
- The request URL given to your handler is built from the `Host` header, or a validated `X-Forwarded-Host` / `X-Forwarded-Proto` pair, so `new URL(req.url)` behaves behind a proxy. An invalid host falls back to `localhost`.
- Route parameters are URI-decoded; values containing `/`, `\`, `..`, or a null byte cause the match to fail. Catch-all tails are checked per segment.

### Request body limits

Bodies are capped at 1 MB by default. Oversized requests receive `413 Payload Too Large`, based on both `Content-Length` and the actual streamed size. Bodies that take longer than 10 seconds to read receive `408 Request Timeout`.

```ts
biniroute({ bodySizeLimit: 5 * 1024 * 1024 })
```

### CORS

CORS is disabled by default.

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

When enabled:

- Preflight requests (`OPTIONS` with an `Access-Control-Request-Method` header) are answered with `204`, `Access-Control-Allow-Headers`, and `Access-Control-Max-Age: 86400`.
- Handler responses get `Access-Control-Allow-Origin` and `Access-Control-Allow-Methods`.
- A specific (non-`*`) origin also sets `Access-Control-Allow-Credentials: true`.
- `cors: true` uses origin `*` and the full method list.

For production CORS on generated hosting entries, see [bini-deploy](https://www.npmjs.com/package/bini-deploy).

---

## Base Path

Sub-path deployments (for example `https://example.com/my-app/`) are driven by Vite's `base` option. bini-router reads the resolved `base` (including values from CLI flags such as `--base`) and derives the router basename from it.

```ts
// vite.config.ts
export default defineConfig({
  base: '/my-app/',
  plugins: [react(), biniEnv(), biniroute()],
})
```

| What | Behavior |
|---|---|
| Router basename | Passed to `createBrowserRouter` and exported from `App` as `basename` |
| API routes | Served at `/api/*` and `<base>/api/*` |
| Vite's script and asset tags | Handled by Vite itself |

Relative bases (`./`, `.`) and invalid values resolve to a basename of `/`. A trailing slash is removed. There is no separate `basename` option.

### Pre-rendering

The generated `App` exports `routes` and `basename`, which is what a server render needs. With React Router's data-router APIs:

```tsx
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router-dom'
import { renderToString } from 'react-dom/server'
import { routes, basename } from './App'

const handler = createStaticHandler(routes, { basename })

export async function render(url: string) {
  // With a non-root basename the request path must include it
  const context = await handler.query(new Request(new URL(url, 'http://localhost')))
  if (context instanceof Response) throw new Error('redirected')
  const router = createStaticRouter(handler.dataRoutes, context)
  return renderToString(<StaticRouterProvider router={router} context={context} />)
}
```

See [bini-ssg](https://www.npmjs.com/package/bini-ssg) for the full entry (streaming render, lazy-route preloading before hydration, shell pages). `createStaticRouter` and `StaticRouterProvider` come from `react-router-dom` in v7 and from `react-router-dom/server` in v6.

For apps with no data exports you can also render `AppRoutes` inside a `StaticRouter`. Pass the `basename` prop, and give it locations that include the basename.

---

## Configuration Reference

```ts
biniroute({
  cors: false,
  strictMode: true,
  bodySizeLimit: 1024 * 1024,
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `cors` | `boolean \| { origin?: string; methods?: string[]; headers?: string[] }` | `false` | CORS handling for dev and preview API routes |
| `strictMode` | `boolean` | `true` | Throw on route conflicts and on pages without a default export. When `false`, they are logged as warnings and resolved or skipped |
| `bodySizeLimit` | `number` | `1048576` | Maximum API request body size in bytes |

Everything else is fixed by convention: the app directory is `src/app`, the API directory is `src/app/api`, auto-imports apply to `src/`, the basename follows Vite's `base`, and MDX options are built in.

---

## Route Manifest

Route data is available in two ways.

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
console.log(routes.metadata)  // { '/dashboard': { title, dynamic, ... }, ... }
```

The virtual module resolves only inside Vite's pipeline; it cannot be imported from plain Node scripts. For safety, the client-facing metadata contains only `title`, `dynamic`, `catchallParamName` (when present), and the boolean flags `loader`, `action`, `shouldRevalidate`, `errorBoundary`, `hydrateFallback`, and `handle` (each present only when `true`). File paths, layout paths, and slot names are not exposed.

TypeScript projects need an ambient declaration (see [Troubleshooting](#troubleshooting)). The module is invalidated whenever the generated route tree changes.

### From other tools: generateRouteManifest()

```ts
import { generateRouteManifest } from 'bini-router'

const manifest = generateRouteManifest('src/app')
// Optional: generateRouteManifest(appDir, apiDir, { strictMode })

console.log(manifest.static)    // ['/', '/about']
console.log(manifest.dynamic)   // ['/blog/:slug']
console.log(manifest.all)       // static and dynamic combined
console.log(manifest.metadata)  // per-route entries
```

A plain synchronous function with no Vite dependency at call time. It uses the same scanning, deduplication, and title resolution as the router. `strictMode` defaults to `true`, so conflicts and missing default exports throw. Returned paths are raw scanned paths, not prefixed with Vite's `base`.

Each `RouteManifestEntry` contains:

| Field | Description |
|---|---|
| `title` | Resolved title, when a string |
| `meta` | Merged `metadata` along the layout chain |
| `document` | Extracted `document` export, or `null` |
| `css` | Absolute paths of CSS-like imports (`.css`, `.scss`, `.sass`, `.less`, `.styl`) from the page and its layouts |
| `layouts` | Absolute layout file paths, outermost first |
| `filePath` | Absolute page file path |
| `dynamic` | Whether the route has dynamic or catch-all segments |
| `catchallKind` | `'required'`, `'optional'`, or `null` |
| `catchallParamName` | Name of the catch-all parameter |
| `slotName` | Set for routes that live in a `@slot` folder |
| `loader`, `action`, `shouldRevalidate`, `errorBoundary`, `hydrateFallback`, `handle` | Whether the page exports each data member |
| `prerender` | The page's `prerender` export |

Only the main route tree is listed. Intercepting routes are omitted, and a slot route appears only when no main route exists at the same path.

### Matching URLs

```ts
import { generateRouteManifest, matchManifestRoute } from 'bini-router'

const manifest = generateRouteManifest('src/app')
const result = matchManifestRoute(manifest, '/blog/hello-world')

// { type: 'dynamic', routePath: '/blog/:slug', params: { slug: 'hello-world' } }
```

`result.type` is `'static'`, `'dynamic'`, or `'not_found'`. Catch-all matches expose the tail under `params['*']` and under the catch-all parameter name. A required catch-all does not match an empty tail.

For lower-level matching:

```ts
import { matchRoute } from 'bini-router'

matchRoute('/blog/:slug', '/blog/hello-world')  // { slug: 'hello-world' }
matchRoute('/docs/*', '/docs/guide/setup')      // { '*': 'guide/setup' }
matchRoute('/docs/**', '/docs')                 // { '*': '' }
matchRoute('/about', '/contact')                // null
```

Pattern syntax: `:name` for dynamic segments, `*` for a catch-all, and `**` for an optional catch-all. Pass `{ enforceNonEmptyCatchAll, catchallParamName }` as a third argument to refine catch-all behavior. This is the same function used to dispatch API requests.

### Other helpers

- `getMetadataForRoute(manifest, pathname)` returns the manifest entry for a pathname (exact match first, then dynamic patterns), or `null`.
- `getCssForRoute(manifest, pathname)` returns that entry's `css` array, or `null`.
- `generateBuildManifest(appDir, apiDir?)` returns `{ routes, appDir, apiDir }`, where each API route is `{ routePath, filePath, allowedMethods, catchallParamName? }`. `allowedMethods` lists all supported methods; handler modules are not inspected. Intended for deployment tooling such as bini-deploy.

---

## HMR and File Watcher

During development bini-router watches the app directory and regenerates `App.tsx` automatically. No restart is needed when adding or removing routes.

| Event | Behavior |
|---|---|
| New page or special file | Regenerates after a 300 ms debounce |
| Deleted page or special file | Regenerates after a 60 ms debounce |
| Changed `layout`, `template`, `loading`, `error`, `not-found`, `global-error`, or `default` file | Regenerates after a 60 ms debounce |
| Changed page file | Regenerates only if its default-export or data-export signature changed |
| Any changed page or layout | Invalidates the lazily loaded title modules |
| New folder | Watched immediately; regenerates if a `page.*` file appears within 300 ms |
| Deleted folder | Regenerates |
| Root layout change | Invalidates the full module graph and triggers a full reload |
| Route regeneration | Invalidates `virtual:bini-routes` and triggers a full reload when the generated output changed |
| API file added or removed | Clears caches and triggers a full reload |
| API file changed | Clears that module's cache entry; the next request uses the new handler |
| API directory created after startup | Detected and watched automatically |

Regeneration is guarded by an `isGenerating` flag, so overlapping regenerations are dropped. In development, generation errors (conflicts, missing default exports) are logged and the previous output is kept; in builds they are thrown.

---

## Programmatic API

[bini-ssg](https://www.npmjs.com/package/bini-ssg) and [bini-overlay](https://www.npmjs.com/package/bini-overlay) are consumers of this API.

### biniroute(options?): Plugin[]

The Vite plugin factory. Spread the returned array into `plugins`.

### generateRouteManifest(appDir, apiDir?, options?): RouteManifest

Scans `appDir` and returns the route tree. See [Route Manifest](#route-manifest).

- Dynamic segments use `:name` (`/users/:id`).
- Catch-all segments use `*` (`/docs/*`); use `catchallKind` to tell required from optional.
- Static segments are bare (`/about`).
- Paths are never prefixed with Vite's `base`. Strip `base` before matching browser URLs.
- `apiDir` defaults to `<appDir>/api`; `options.strictMode` defaults to `true`.

### generateBuildManifest(appDir, apiDir?): BuildManifest

Returns the scanned API routes for deployment tooling.

### matchManifestRoute(manifest, pathname): RouteMatchResult

Matches a base-stripped pathname against a manifest. Returns `{ type, routePath?, params? }`.

### matchRoute(pattern, pathname, options?): Record<string, string> | null

Low-level matcher using `:name`, `*`, and `**`.

### getMetadataForRoute(manifest, pathname) / getCssForRoute(manifest, pathname)

Look up a manifest entry, or just its CSS list, for a pathname.

### Errors

`RouteConflictError` (has `.conflicts`) and `MissingDefaultExportError` (has `.pages`) are exported classes, thrown in strict mode.

### Stability

The exports below are the public surface. Internal helpers (route scanning, metadata parsing, the transform pipeline) are not exported and may change between minor versions.

---

## Exports

| Export | Kind | Purpose |
|---|---|---|
| `biniroute(options?)` | function | Vite plugin array (routing and MDX) |
| `generateRouteManifest(appDir, apiDir?, options?)` | function | Scan the filesystem and return the route manifest |
| `generateBuildManifest(appDir, apiDir?)` | function | Scan API routes and return the build manifest |
| `getMetadataForRoute(manifest, pathname)` | function | Find the manifest entry for a pathname |
| `getCssForRoute(manifest, pathname)` | function | Find the CSS list for a pathname |
| `matchRoute(pattern, pathname, options?)` | function | Match one pattern against a pathname |
| `matchManifestRoute(manifest, pathname)` | function | Resolve a pathname against a manifest |
| `RouteConflictError` | class | Thrown on route conflicts in strict mode |
| `MissingDefaultExportError` | class | Thrown on pages without a default export in strict mode |
| `BiniPluginOptions` | type | Options accepted by `biniroute()` |
| `BuildManifest` | type | Shape returned by `generateBuildManifest()` |
| `RouteManifest` | type | Shape returned by `generateRouteManifest()` |
| `RouteManifestEntry` | type | A single manifest entry |
| `RouteMetadata` | type | Metadata portion of a manifest entry (`meta`, `document`, `title`, `css`) |
| `RouteDocument` | type | Shape of the extracted `document` export |
| `RouteMatchResult` | type | Shape returned by `matchManifestRoute()` |
| `HeadNode` | type | Parsed `document.head` node (`element` / `text` / `raw`) |
| `PrerenderMode` | type | `'fallback' \| 'strict' \| false` |
| `Plugin` / `ViteDevServer` | type | Re-exported from `vite` |

---

## Route Naming Rules

Route segments and parameters are validated at scan time:

- Static segment names (folder names and flat-file base names) must match `/^[a-zA-Z0-9_-]+$/` and be at most 100 characters. A flat file such as `foo.bar.tsx` is therefore skipped with a warning.
- Parameter names inside brackets must match `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- Route group names must match `/^[a-zA-Z0-9_-]+$/`
- Parallel-route slot names (after the `@`) must match `/^[a-zA-Z][a-zA-Z0-9_-]*$/`
- Intercepting prefixes must be exactly `(.)`, `(..)`, or `(...)`, followed by a valid segment name
- Invalid names are skipped with a warning and never crash the scan
- Source files larger than 10 MB are ignored
- Decoded URL parameter values containing `/`, `\`, `..`, or a null byte fail to match at request time

---

## Differences from Next.js

bini-router borrows the App Router's conventions, but it is a client-side SPA on React Router's data router.

| | Next.js App Router | bini-router |
|---|---|---|
| Server components | Yes | No. Client only |
| Data fetching | Server-side | Client-side, through React Router `loader` / `action` exports |
| `middleware.ts` | Yes | No |
| SSR / SSG | Built in | Client-side app; build-time pre-rendering through [bini-ssg](https://www.npmjs.com/package/bini-ssg), which reads the route manifest |
| API routes | Production (Node or edge) | Dev and preview; use [bini-deploy](https://www.npmjs.com/package/bini-deploy) for production |
| Optional catch-all `[[...slug]]` | Yes | Yes |
| Route groups `(name)` | Yes | Yes |
| Parallel routes `@slot` | Yes | Yes. Slots are passed to the sibling layout as named props and matched against the current URL; `default.*` is read from the slot folder only |
| Intercepting routes | Yes | Yes. Based on the previous in-app location, with real-page fallback for direct visits |
| File-based routing | Folders with `page.tsx` only | Both `page.tsx` folders and flat files (`about.tsx`, `[id].tsx`) |
| `template.tsx` | Remounts on navigation | A wrapper between the layout chain and the page |
| `loading` / `error` / `not-found` | Nearest-wins | Nearest-wins |
| `global-error` | Yes | Yes |
| Metadata | Full head management | Title applied at runtime; the rest extracted to the manifest for tooling |

---

## Troubleshooting

**`virtual:bini-routes` is not resolving in TypeScript.**
Add an ambient module declaration, for example in `vite-env.d.ts`:

```ts
declare module 'virtual:bini-routes' {
  type RouteInfo = {
    title?: string
    dynamic: boolean
    catchallParamName?: string
    loader?: boolean
    action?: boolean
    shouldRevalidate?: boolean
    errorBoundary?: boolean
    hydrateFallback?: boolean
    handle?: boolean
  }
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
Check that the file has a default export, parses without errors, is not under a `_` or `.` prefixed path, and is not inside the API directory. Run `generateRouteManifest('src/app')` in a Node script to see what the router sees.

**A route conflict or missing default export is failing my build.**
Delete or fix the offending files, or set `strictMode: false` to downgrade both to warnings (conflicts are resolved by layout depth, then extension priority; broken pages are skipped).

**A slot's content isn't rendering.**
The slot needs a `layout.*` in the same directory as the `@slot` folder, and that layout must read the slot as a prop named after the folder (`@sidebar` becomes `sidebar`). If no slot route matches the URL, only the `default.*` inside the slot folder renders.

**An intercepting route never shows up.**
Interceptors only apply when the previous in-app location matches the route that contains the interceptor. Direct visits, reloads, and links from other pages show the real page. Make sure a real page exists at the target path.

**My `loader` on a slot or intercepting page does nothing.**
Data exports are only wired for main-tree pages and layouts. Move the loader to the real page or a layout and read it with `useRouteLoaderData`.

**The tab title is stale after navigation.**
Add a `metadata.title` export to the page or a parent layout. If nothing in the chain defines a title, the original `document.title` is restored.

**My `metadata` or `document` isn't appearing in the page `<head>`.**
bini-router only applies the title at runtime. Other metadata, `document` attributes, and `document.head` content are written into the HTML by [bini-ssg](https://www.npmjs.com/package/bini-ssg) during `vite build`, so they don't show up in `vite dev`. Inspect the built HTML in `dist/`.

**`src/App.tsx` exists but is not being updated.**
bini-router only manages files that begin with its auto-generated header. Delete or move the existing file.

**Auto-imports are not working in an `.mdx` file.**
Auto-imports apply to `.tsx`, `.jsx`, `.ts`, and `.js` only. Import what you need explicitly in MDX and Markdown files.

**An API route returns 405.**
If the file exports any of `GET`, `POST`, and so on, only those methods are allowed. Add the missing method export, or use a default export to handle every method.

---

## Deployment

bini-router is deployment-agnostic. It builds the routing tree, layouts, and dev/preview API serving. Platform-specific configuration and production API entry files (Netlify, Vercel, Cloudflare, Node.js, Deno) are generated by [bini-deploy](https://www.npmjs.com/package/bini-deploy):

```bash
npm install --save-dev bini-deploy
npx bini-deploy
```

See the bini-deploy documentation for platform-specific setup.

---

## License

MIT (c) [Binidu Ranasinghe](https://bini.js.org)