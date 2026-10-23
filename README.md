# bini-router

[![npm version](https://img.shields.io/npm/v/bini-router?color=00CFFF&labelColor=0a0a0a&style=flat-square)](https://www.npmjs.com/package/bini-router)
[![license](https://img.shields.io/badge/license-MIT-00CFFF?labelColor=0a0a0a&style=flat-square)](./LICENSE)
[![vite](https://img.shields.io/badge/vite-8%2B-646cff?labelColor=0a0a0a&style=flat-square)](https://vitejs.dev)
[![react](https://img.shields.io/badge/react-18%2B-61dafb?labelColor=0a0a0a&style=flat-square)](https://react.dev)
[![mdx](https://img.shields.io/badge/mdx-supported-f472b6?labelColor=0a0a0a&style=flat-square)](https://mdxjs.com)
[![typescript](https://img.shields.io/badge/typescript-ready-3178c6?labelColor=0a0a0a&style=flat-square)](https://www.typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-00CFFF?labelColor=0a0a0a&style=flat-square)](https://github.com/binidu/bini-router/pulls)

**File-based routing for Vite + React: nested layouts, templates, route groups, parallel routes, intercepting routes, React Router data exports, folder-scoped loading/error/404 boundaries, MDX pages, server-render-ready route modules, and Web-standard `Request -> Response` API routes.**

Similar to the Next.js App Router, but built on React Router's data router. Pages are server-rendered: the generated route module is built to be rendered on the server (`routes`, `basename`, and route preloading), the dev server renders HTML for every page navigation through your `render(url)` export, and build-time pre-rendering (SSG) is handled by [bini-ssg](https://www.npmjs.com/package/bini-ssg).

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
- [Server Rendering](#server-rendering)
- [Configuration Reference](#configuration-reference)
- [Route Manifest](#route-manifest)
- [HMR and File Watcher](#hmr-and-file-watcher)
- [Diagnostics](#diagnostics)
- [Programmatic API](#programmatic-api)
- [Source Facts API](#source-facts-api)
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
- **Intercepting routes.** `(.)`, `(..)`, and `(...)` folders and flat files render alternative content at a URL when the previous in-app location matches the interceptor's source route.
- **Nested layouts and templates.** Layouts wrap their segment and all children and receive `params`. Templates wrap each page inside the layout chain.
- **React Router data exports.** `loader`, `action`, `shouldRevalidate`, `ErrorBoundary`, `HydrateFallback` / `hydrateFallbackElement`, and `handle` exported from pages (and from the root layout) are wired into the generated data router.
- **MDX and Markdown pages.** `.mdx` and `.md` pages are compiled through `@mdx-js/rollup`, loaded on first use.
- **Folder-scoped boundaries.** `loading`, `not-found`, and `error` use nearest-wins resolution. A root `global-error` file catches anything the route tree does not.
- **Per-route metadata.** `export const metadata` in layouts and pages is statically extracted into the route manifest (with title templates resolved), where [bini-ssg](https://www.npmjs.com/package/bini-ssg) turns it into head tags at build time.
- **Document and prerender exports.** `export const document` and `export const prerender` are statically extracted into the route manifest. `document.head` is applied by both the dev server and bini-ssg, so head tags declared there appear in dev and in the build. bini-ssg additionally applies `metadata` and the `document` `html`/`body` attributes to pre-rendered HTML and skips routes with `prerender = false`.
- **Server-render-ready route module.** The generated `virtual:bini-app` module exports plain `routes` and `basename` for `createStaticHandler`, an `AppRoutes` component for `StaticRouter`, and a `lazy` function on every page route that preloads the route's layouts, boundaries, and page before it renders, so the page component is already loaded when the server render runs.
- **Dev-server rendering.** In development, every HTML navigation is rendered through your `src/main.*` `render(url)` export. The route's `document.head` (or the head tags found in the rendered markup) and the CSS it imports are injected into the page, so the first paint is already styled.
- **Dev crash recovery.** A small script injected into `index.html` in development reloads the page on the next Vite update when a module failed to load or the app crashed before mounting.
- **API routes.** `Request -> Response` handlers in `src/app/api/`, served in dev and preview. Supports per-method exports (`GET`, `POST`, ...), `.fetch(request)` objects (such as Hono apps), and plain functions.
- **Auto-imports.** Common React and React Router helpers are available in script files without explicit imports, powered by `unplugin-auto-import`.
- **Error isolation.** Every layout and page sits inside an error boundary that resets on navigation and on HMR updates. Route-level errors (loaders, actions) are caught by a per-route `errorElement`.
- **Code splitting and preloading.** Pages, non-root layouts, loading, error, not-found, global-error, and slot default files are lazy-loaded, and hovering or focusing a same-origin link preloads its route.
- **AST-based analysis.** Source files are parsed with Oxc rather than regular expressions.
- **Hot reloading.** A debounced file watcher regenerates the route tree as files and folders change.
- **Validation and limits.** Route, parameter, group, and slot name validation, path traversal guards on decoded parameters, and a 10 MB source file limit.
- **Bounded caches.** Parse, file, and API module caches are capped.
- **Programmatic manifest, matching, and source facts.** `generateRouteManifest()`, `generateBuildManifest()`, `getMetadataForRoute()`, `getCssForRoute()`, `matchRoute()`, `matchManifestRoute()`, `getSourceFacts()`, and `scanSourceFacts()` are exported for tooling.
- **Deployment-base aware.** The router `basename` is derived from Vite's `base`, and API routes are served under it.
- **JavaScript and TypeScript.** Both are supported and auto-detected.

> Production deployment (Netlify, Vercel, Cloudflare, Node, and Deno entry generation) is handled by the companion package [bini-deploy](https://www.npmjs.com/package/bini-deploy). This package covers routing, layouts, server-render-ready route modules, and local (dev and preview) API serving.

---

## Install

```bash
npm install bini-router
```

Install the peer pieces your project needs:

```bash
npm install react-router-dom
npm install -D @mdx-js/rollup   # only if you use .mdx / .md pages
npm install bini-env            # optional, see Environment Variables
```

Hono is not a dependency; see [API Routes](#api-routes).

### Requirements

| Dependency | Version |
| --- | --- |
| Vite | 8 or later |
| React | 18 or later |
| react-router-dom | A data-router release with route `lazy` support (6.9 or later). The generated app uses `createBrowserRouter`, `createRoutesFromElements`, `RouterProvider`, `useRoutes`, `matchPath`, `useRouteError`, `useRevalidator`, and `isRouteErrorResponse` |
| @mdx-js/rollup | Only needed for `.mdx` / `.md` pages. A missing install fails with an error telling you to install it |

---

## Setup

### vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { biniroute } from 'bini-router'

export default defineConfig({
  plugins: [react(), biniroute()],
})
```

`biniroute()` returns an array of plugins: the router plugin (`bini-router`), the MDX compiler (`bini-router:mdx`), and the auto-import plugin from `unplugin-auto-import`. Spread or pass it as-is into `plugins`.

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

bini-router does not rewrite `index.html` on disk and does not set `document.title` at runtime. `metadata` and `document` are extracted into the [route manifest](#route-manifest); during `vite build`, [bini-ssg](https://www.npmjs.com/package/bini-ssg) merges them into the `<head>` of each pre-rendered page. In development, the [dev server rendering](#dev-server-rendering) middleware injects `document.head` (not `metadata`) into the served page, so put head tags that must appear in both dev and build in [`document.head`](#document-export). It also looks for `<div id="root">` in `index.html` to place the rendered markup, so keep that element.

### main.tsx

The route tree is exposed through the virtual module `virtual:bini-app`. In development, bini-router also loads your `src/main.*` file on the server (the first of `main.tsx`, `main.ts`, `main.jsx`, `main.js`) and calls its `render(url)` export for every HTML navigation, so the main file should export `render` and guard its client-only code:

```tsx
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from 'react-router-dom'
import App, { routes, basename, rootOptions } from 'virtual:bini-app'

// Client mount (skipped when this module is loaded on the server)
if (typeof document !== 'undefined') {
  createRoot(document.getElementById('root')!, rootOptions).render(<App />)
}

// Server render, used by the dev server and by bini-ssg
export async function render(url: string) {
  const handler = createStaticHandler(routes, { basename })
  const context = await handler.query(new Request(new URL(url, 'http://localhost')))
  if (context instanceof Response) throw new Error('redirected')
  const router = createStaticRouter(handler.dataRoutes, context)
  return renderToString(<StaticRouterProvider router={router} context={context} />)
}
```

`render(url)` receives the request URL as the dev server sees it (path and query string, including Vite's `base` when one is set) and must return the HTML string (or a promise of it) to place inside `<div id="root">`. See [Server Rendering](#server-rendering) for what the dev server does with it, and [bini-ssg](https://www.npmjs.com/package/bini-ssg) for the full pre-render entry.

### The generated app module (`virtual:bini-app`)

bini-router generates the app entry in memory and serves it as the virtual module `virtual:bini-app` (its internal file id is `src/__bini-app.tsx` in TypeScript projects and `src/__bini-app.jsx` in JavaScript projects; nothing is written to disk). The ids `virtual:bini-app.tsx`, `virtual:bini-app.jsx`, and the concrete `/src/__bini-app.*` paths resolve to the same module. The generated code imports its `ErrorBoundary` from `bini-router/client`, so no separate error-boundary package is needed. The generated code starts with an auto-generated header and is regenerated as your route tree changes.

The module exports:

| Export | Description |
| --- | --- |
| `default` | The `App` component: a `RouterProvider` for `getRouter()` |
| `routes` | The route objects created with `createRoutesFromElements`. Safe to import on the server: nothing browser-only runs at import time |
| `AppRoutes` | A component that renders `useRoutes(routes)`, for custom routers such as `StaticRouter` |
| `getRouter()` | Lazily creates and returns the `createBrowserRouter(routes, { basename })` instance. Browser only: do not call it during a server render |
| `basename` | The resolved router basename |
| `rootOptions` | `onCaughtError`, `onUncaughtError`, and `onRecoverableError` handlers for `createRoot` / `hydrateRoot` that forward errors to the dev overlay event |
| `preloadRoute(pathname)` | Preloads the lazy modules for a pathname (the basename is stripped when present) |
| `routerReady()` | Resolves once the browser router has finished initializing |
| `resetNavState()` | Clears the previous-location tracking used by parallel and intercepting routes |
| `reportBiniError(error, componentStack?, kind?)` | Dispatches a runtime error to the dev overlay (development only) |

In `vite preview`, the app entry is not generated and the module resolves to a stub with the same export names: `App` and `AppRoutes` render `null`, `routes` is empty, `getRouter()` returns `null`, `basename` is `"/"`, `rootOptions` is `{}`, and the async helpers resolve immediately.

How the module is shaped for server rendering is described under [Server Rendering](#how-the-route-module-supports-server-rendering).

### TypeScript vs JavaScript

Project type is detected in this order:

1. The presence of `src/main.tsx`, `src/main.ts`, `src/main.jsx`, or `src/main.js` (the first one found decides)
2. A `tsconfig.json` at the project root
3. Any `.ts` or `.tsx` file inside `src/app/` (scanned up to 5 levels deep)

| | TypeScript project | JavaScript project |
| --- | --- | --- |
| Generated `WithParams` helper | Typed | Plain JavaScript |
| Generated app entry id | `src/__bini-app.tsx` | `src/__bini-app.jsx` |
| Auto-import declarations | `src/auto-imports.d.ts` is generated | Not generated |
| Pages and layouts | `.tsx` (or `.mdx`/`.md` for pages) | `.jsx` (or `.mdx`/`.md` for pages) |
| API routes | `.ts` | `.js` |

API files may be `.ts` or `.js` in either kind of project.

The app entry follows Vite's resolved root. The auto-import declaration check runs against `process.cwd()` when `biniroute()` is called, so a custom Vite `root` that differs from the working directory can be misdetected there.

---

## File Structure

The app directory is fixed at `src/app`, the API directory at `src/app/api`.

```text
src/
  main.tsx                  Mounts <App /> and exports render(url)
  auto-imports.d.ts         Generated by unplugin-auto-import (TypeScript projects only)
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
- Empty files are ignored. Files over 10 MB are ignored with a warning (`BINI_R005`).

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

```text
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

```text
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
- A slot whose owner directory has no usable `layout.*` is skipped with a warning (`BINI_R013`).
- Routes inside a slot are scanned like normal routes (dynamic segments, catch-alls, nested layouts, templates), but only layouts and templates inside the slot folder apply to them.
- Slot pages receive a `params` prop.
- The slot renders the first entry whose path matches the current location. If none matches, it renders the `default.*` file located directly in the slot folder, or nothing when there is none.
- Interceptors inside a slot render in that slot, gated by the same previous-location check as regular interceptors.
- `data` exports (`loader`, `action`, and so on) in slot pages are not executed; a warning is logged (`BINI_R012`). Load data in the component, or from the real page's loader via `useRouteLoaderData`.

### Intercepting routes

Folders and flat files prefixed with `(.)`, `(..)`, or `(...)` render different content at a URL depending on where the navigation came from.

| Prefix | Target is resolved relative to |
| --- | --- |
| `(.)name` | The current route segment level |
| `(..)name` | One URL level up |
| `(...)name` | The app root |

```text
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
- The intercepting page replaces the real page only when the previous in-app location matches the route that contains the interceptor (its source path, matched like a route pattern, so dynamic sources work). Direct visits and reloads render the real page.
- When no real page exists at the target path, direct visits to it render the root not-found page.
- Intercepting routes are not separate router routes and do not get their own manifest entries. They are listed on the target route's manifest entry under `intercepts`.
- An invalid or empty prefix is skipped with an error (`BINI_R008`).
- Conflicts are checked on the combination of path, intercept level, and slot, so an interceptor and its target do not conflict.

### Route priority

Routes are ordered static first, then dynamic (`:param`), then required catch-alls, then optional catch-alls. Within a category, shorter paths come first. React Router then ranks them by specificity.

### Conflicts and extension priority

When two files resolve to the same URL, intercept level, and slot (for example `page.tsx` and `page.mdx`, or `about.tsx` and `about/page.tsx`), bini-router reports a route conflict (`BINI_R007`, severity `error`) and then keeps one file: the route with the deeper layout chain wins, and ties are resolved by extension priority:

```text
.tsx > .jsx > .ts > .js > .mdx > .md
```

In `vite build` the conflict fails the build; in development it is logged as an error and the resolved route is still used.

### Pages without a default export

A `page.*` file must `export default` a component. Without one, the build fails with `BINI_R001` ("Missing default export"); in development the error is logged. Flat route files without a default export, files that fail to parse, and empty files are skipped silently.

---

## Layouts

Layouts wrap all pages in their directory and subdirectories. bini-router walks up from each page to the app root to build the layout chain. Every layout receives the route `params` as a prop (plus any parallel-route slots) and `children`, which is an `<Outlet />`. Render either `<Outlet />` or `{children}`.

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
- Circular layout chains are detected; a warning is logged (`BINI_R010`) and traversal stops.
- The root layout is imported eagerly. All other layouts are lazy-loaded.

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

Pages on the main route tree, and the **root layout**, can export React Router route-module members. bini-router detects them by static analysis and wires them into the generated route.

| Export | Route property |
| --- | --- |
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

- Page exports are loaded lazily through the route's `lazy` function. The root layout is imported eagerly, so its data exports are attached directly.
- Data exports on non-root layouts are not supported. Those layouts are lazy-loaded, so keep loaders on pages or on the root layout.
- Hook names for these APIs (`useLoaderData`, `useActionData`, `useNavigation`, `useFetcher`, `useSubmit`, `Form`, `redirect`, and more) are auto-imported.
- Adding or removing a data export on a page triggers regeneration; editing the bodies does not.
- Data exports on parallel-route and intercepting pages are not executed (a warning is logged).
- Without a custom `ErrorBoundary` export, each data route gets an `errorElement` that renders the nearest `error.*` (or the built-in fallback), and the nearest `not-found.*` for 404 responses.
- Pages without data exports still get a `lazy` function. It only preloads the route's modules (see [Server Rendering](#how-the-route-module-supports-server-rendering)).

---

## Loading, Not Found, and Error Boundaries

`loading`, `not-found`, and `error` files use nearest-wins resolution. A file in a subfolder affects only routes inside that subfolder and shadows the same file in ancestor folders. Routes with no closer match fall through to the nearest ancestor, and finally to a built-in default. Files without a default export, or that contain an `<html>` element, are ignored by `loading` and `error` resolution.

### Loading

```tsx
// src/app/dashboard/loading.tsx
export default function DashboardLoading() {
  return <p>Loading dashboard...</p>
}
```

Used as the Suspense fallback for the pages and layouts in its scope. The built-in spinner appears after a 200 ms delay and follows `prefers-color-scheme` for its colors.

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

- **Render errors** are caught by the `ErrorBoundary` from `bini-router/client` around each layout and page, and the fallback component receives `error` and `reset`.
- **Route errors** (loaders, actions, thrown route error responses) receive `error` and `reset()`, where `reset` revalidates the route. Route error responses are normalized to an `Error` with `status` and `data` fields.
- Boundaries also reset automatically when the pathname changes, and on HMR updates in development.

Custom fallbacks render in development and production. With no `error.*` in scope, the built-in fallback renders nothing in development (so Vite's error overlay stays visible) and a generic "Something went wrong" screen in production.

In development, runtime errors are also dispatched as a `__bini_error__` `CustomEvent` on `window` with `{ name, message, stack, componentStack, _type: 'runtime', _kind: 'caught' | 'uncaught' }`, which [bini-overlay](https://www.npmjs.com/package/bini-overlay) listens for and shows in its error overlay (it works out the file and line from `stack` when the event carries none). Each error object is reported once, and caught route errors with a `404` status are not reported.

### Global error

`global-error.*` in the app root is used as the fallback of the root route's `errorElement`, which catches route errors the nested boundaries do not. Without one, the built-in error screen is used.

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
- `@mdx-js/rollup` is loaded on first use and must be installed in your project (`npm i -D @mdx-js/rollup`).
- The compiler options are fixed: `jsxImportSource: 'react'`, `mdExtensions: []`, `mdxExtensions: ['.mdx', '.md']`. They are not configurable through `biniroute()`.
- The MDX transform applies to any `.md` / `.mdx` module Vite processes, not only pages. Imports with `?raw`, `?url`, `?inline`, `?worker`, or `?sharedworker` are left alone.
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

- The whole `metadata` object is statically extracted into the [route manifest](#route-manifest) (`meta` and `title`), merged along the layout chain.
- The `export const metadata` declaration is stripped from files under `src/app` so it never ships in the client bundle.
- bini-router does not apply `metadata` at runtime (it does not update `document.title`), and the dev server renderer does not apply it either. Applying it is the job of [bini-ssg](https://www.npmjs.com/package/bini-ssg) at build time. For head tags (title, meta, link, JSON-LD) that appear in both dev and build, use the [`document` export](#document-export) instead.

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

> **Prefer `document.head` for head tags.** The [`document` export](#document-export) is applied by both the dev server and bini-ssg, so a title, meta tags, icons, and JSON-LD declared there appear in `vite dev` and in the pre-rendered build. The `metadata` export is applied only by bini-ssg at build time. See [the dev vs bini-ssg table](#build-time-pre-rendering-bini-ssg) for the small serialization differences.

bini-router itself only resolves `title`; every other key is passed through to the manifest untouched. When you pre-render with bini-ssg, it writes these keys into each page's `<head>`: `title`; `description`, `robots`, `author`, and `keywords` as `<meta name>` tags; `themeColor`; `canonical` and `manifest` as `<link>` tags; `icons.icon`, `icons.shortcut`, and `icons.apple`; and `openGraph` and `twitter` (each requires `title`). `og:image` entries also emit `width`, `height`, and `alt` when given. An existing tag with the same name or rel in the template is updated instead of duplicated. Other keys are ignored by bini-ssg.

### Static analysis

Metadata must be statically analyzable. Supported values:

- string, number, boolean, array, and object literals
- template literals whose expressions are themselves static
- references to top-level `const` bindings in the same file
- `JSON.stringify(<static value>)`
- TypeScript wrappers (`as`, `satisfies`, `!`, type assertions) and parentheses
- `export { name }` of a local `const` object

Computed keys, spreads, function calls other than `JSON.stringify`, and the keys `__proto__`, `constructor`, and `prototype` are not evaluable. If any value inside the `metadata` object cannot be evaluated, the **entire** export is ignored for the manifest.

### Merging

Metadata from the layout chain and the page is merged from outermost layout to the page. Later values overwrite earlier ones, and plain-object values are shallow-merged one level deep (for example `openGraph`). Arrays are replaced. `title` is resolved separately (below).

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
4. If nothing defines a title, the manifest entry has no `title`.

The manifest entry's `title` field is set only when the resolved title is a string.

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
| --- | --- |
| `html` | `Record<string, string>` of literal attributes |
| `body` | `Record<string, string>` of literal attributes |
| `head` | `HeadNode[]`: a typed tree of `element`, `text`, and `raw` nodes |

- `head` is parsed from the JSX into plain data. JSX attribute names are mapped to HTML names (`className` to `class`, `httpEquiv` to `http-equiv`, `charSet` to `charset`, and so on). An attribute with no value becomes an empty-string attribute.
- Attribute values and child expressions are evaluated statically (string, number, and boolean results are stringified; module-scope `const` references work). Anything else is dropped, with a one-time warning per file (`BINI_R004`).
- `dangerouslySetInnerHTML={{ __html: <static value> }}` becomes a `raw` child, which is how JSON-LD script bodies are supported (for example `JSON.stringify(jsonLd)` with a module-scope `jsonLd`). The dev server escapes `<` inside a `<script>` raw child as `\u003c`; bini-ssg writes raw children verbatim.
- `head` is the part of `document` that both dev and build apply: the dev server and bini-ssg each serialize the same `HeadNode[]` tree, then insert it just before `</head>`. Neither removes tags that already exist in `index.html`, so a `<title>` there and one in `document.head` both end up in the page. The serializers differ in small ways, listed in [the dev vs bini-ssg table](#build-time-pre-rendering-bini-ssg).
- [bini-ssg](https://www.npmjs.com/package/bini-ssg) applies `document` at build time: `html` and `body` attributes are set on the pre-rendered `<html>` and `<body>` elements (overwriting existing values, including `class`), and `head` is serialized and appended to `<head>`.
- In development, only `head` is applied (by the [dev server rendering](#dev-server-rendering) middleware, appended just before `</head>`); `html` and `body` attributes have no effect.
- One `document` is stored per route: the page's own export if it has one, otherwise the nearest layout that has one. Documents are not merged across the chain.

### Example: head tags in dev and build

`document.head` is the way to get head tags in both `vite dev` and the pre-rendered build. This root layout sets the title, description, theme color, icons, Open Graph and Twitter tags, and JSON-LD, and also shows a layout that renders its `children` and a `modal` slot:

```tsx
// src/app/layout.tsx
import React from 'react'
import './globals.css'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Bini.js',
  alternateName: 'Bini',
  url: 'https://bini.js.org/',
}

export const document = {
  head: (
    <>
      <title>My Bini App</title>
      <meta name="description" content="Modern React application built with Bini.js" />
      <meta name="keywords" content="Bini.js, React, Vite" />
      <meta name="theme-color" content="#00CFFF" />

      <link rel="manifest" href="/site.webmanifest" />
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

      <meta property="og:site_name" content="My Bini App" />
      <meta property="og:title" content="My Bini App" />
      <meta property="og:description" content="Modern React application built with Bini.js" />
      <meta property="og:image" content="/og-image.png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="My Bini App" />
      <meta name="twitter:creator" content="@binidu01" />
      <meta name="twitter:image" content="/og-image.png" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  ),
}

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal?: React.ReactNode
}) {
  return (
    <React.Fragment>
      {children}
      {modal}
    </React.Fragment>
  )
}
```

Every value here is static (string literals and the module-scope `jsonLd` constant), so the whole head is extracted. A dynamic attribute or child would be dropped with a `BINI_R004` warning.

---

## Prerender Export

```ts
export const prerender = 'strict'   // or 'fallback' or false
```

A literal `prerender` export (`'strict'`, `'fallback'`, or `false`) on a page is recorded in the manifest as `prerender` (type `PrerenderMode`). bini-router does not act on it itself, and the export is not stripped from the bundle.

[bini-ssg](https://www.npmjs.com/package/bini-ssg) reads it when pre-rendering:

- `false` skips the route: it is not seeded, not reached by link crawling, and (for dynamic patterns) gets no shell page. The root route `/` is always rendered regardless.
- `'strict'` and `'fallback'` are accepted and currently behave the same as leaving the export out.

---

## Auto-imports

Auto-imports are provided by [`unplugin-auto-import`](https://github.com/unplugin/unplugin-auto-import), configured by `biniroute()` with these presets. It uses the plugin's default include and exclude rules for script files (not `.mdx` / `.md`) and, in TypeScript projects only, writes the type declarations to `src/auto-imports.d.ts`. JavaScript projects get no declaration file. The check uses `process.cwd()` when `biniroute()` is called.

**From `react`:** the `unplugin-auto-import` `react` preset (hooks such as `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, `useContext`, `createContext`, `useReducer`, `useId`, `useTransition`, `useDeferredValue`, and the other React exports in that preset).

**From `react-router-dom`:**

```text
Link  NavLink  useNavigate  useParams  useLocation  useSearchParams  Outlet
useLoaderData  useActionData  useNavigation  useFetcher  useFetchers
useMatches  useRouteLoaderData  useRouteError  useRevalidator  useSubmit
Await  useAsyncValue  useAsyncError  Form  redirect  isRouteErrorResponse
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

Names that are not in these presets (for example `useBlocker`, `defer`, or `getEnv`) must be imported explicitly. Manual imports always work alongside auto-imports.

---

## Environment Variables

bini-router itself does not read environment variables. It pairs with [bini-env](https://www.npmjs.com/package/bini-env):

- **Client code:** use `import.meta.env.BINI_*` (the prefix is set by bini-env)
- **API routes:** import `getEnv` or `requireEnv` from `bini-env`
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
import { getEnv, requireEnv } from 'bini-env'

const SMTP_USER = requireEnv('SMTP_USER')  // throws if missing
const DEBUG = getEnv('DEBUG_MODE')         // undefined if missing
```

---

## API Routes

Place API files (`.ts` or `.js`) in `src/app/api/`. The same handlers run in `vite dev` and `vite preview`. API serving is a dev and preview feature by design; production APIs are handled by your deployment target (see [bini-deploy](https://www.npmjs.com/package/bini-deploy)). A file can use any one of three styles.

### Per-method exports

```ts
// src/app/api/posts/[id].ts
export function GET(req: Request, { params, searchParams }) {
  return Response.json({ id: params.id, q: searchParams.get('q') })
}

export async function DELETE(req: Request, { params }) {
  return Response.json({ id: params.id, deleted: true })
}
```

Supported exports: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. If a file exports any of them, only those methods are allowed; other supported methods receive a `405` JSON response with an `Allow` header. A `HEAD` request falls back to the `GET` handler when there is no `HEAD` export.

### Default function

```ts
// src/app/api/hello.ts
export default function handler(req: Request, { params, searchParams }) {
  return Response.json({ message: 'hello', method: req.method })
}
```

A default-exported function receives `(request, { params, searchParams })` and handles every method.

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
| --- | --- |
| `api/users.ts` | `/api/users` |
| `api/posts/index.ts` or `api/posts/route.ts` | `/api/posts` |
| `api/posts/[id].ts` | `/api/posts/:id` |
| `api/[...catch].ts` | `/api/*` catch-all |
| `api/[[...catch]].ts` | `/api/**` optional catch-all |
| `api/(internal)/health.ts` | `/api/health` |

- Route groups, dynamic directories (`[id]/`), and catch-all directories (`[...x]/`) work inside the API directory.
- API routes are tried static first, then dynamic, then catch-alls.
- Files and directories starting with `_` or `.` are ignored. Only `.ts` and `.js` files are considered.
- API file and directory names are not validated against the page naming rules.

### Development and preview behavior

- In development, handlers are loaded through Vite's `ssrLoadModule`, so edits apply immediately.
- In preview, handlers are imported on demand and cached by path, modification time, and size. The cache holds at most 500 entries and evicts the oldest first. Files over 10 MB are ignored.
- Requests are accepted at `/api/*` and, when Vite's `base` is set, at `<base>/api/*`. The prefix is stripped before dispatch.
- The middleware is always registered and checks for the API directory at request time (kept up to date by the watcher), so creating `api/` after startup works without a restart.
- Unmatched requests, and methods outside the supported list, receive a `404` JSON response.
- Handler load failures and thrown exceptions return a generic `500` JSON response and are logged.
- Multiple `Set-Cookie` headers are preserved.
- Route parameters are URI-decoded; values containing `/`, `\`, `..`, or a null byte cause the match to fail.
- The `Request` passed to handlers is built from the incoming method, URL (on `http://localhost`), and headers. Request bodies are not forwarded in the current version.

---

## Base Path

Sub-path deployments (for example `https://example.com/my-app/`) are driven by Vite's `base` option. bini-router reads the resolved `base` (including values from CLI flags such as `--base`) and derives the router basename from it.

```ts
// vite.config.ts
export default defineConfig({
  base: '/my-app/',
  plugins: [react(), biniroute()],
})
```

| What | Behavior |
| --- | --- |
| Router basename | Passed to `createBrowserRouter` and exported from `virtual:bini-app` as `basename` |
| API routes | Served at `/api/*` and `<base>/api/*` |
| Dev server rendering | The base is stripped from the request path before the route manifest lookup; `render(url)` still receives the URL with the base |
| Vite's script and asset tags | Handled by Vite itself |

Relative bases (`./`, `.`, or an empty string) resolve to a basename of `/`. For an absolute URL base, the URL's pathname is used. A trailing slash is removed. There is no separate `basename` option. `deriveBase(configBase, command)` is exported for tooling.

### Pre-rendering

The generated app exports `routes` and `basename`, which is what a server render needs; see the `render` function in [main.tsx](#maintsx). `createStaticRouter` and `StaticRouterProvider` come from `react-router-dom` in v7 and from `react-router-dom/server` in v6. With a non-root basename the request path must include it.

For apps with no data exports you can also render `AppRoutes` inside a `StaticRouter`. Pass the `basename` prop, and give it locations that include the basename.

See [bini-ssg](https://www.npmjs.com/package/bini-ssg) for the full entry (streaming render, lazy-route preloading before hydration, shell pages).

---

## Server Rendering

bini-router itself does not run a production server and does not write HTML files; it provides the pieces that server rendering is built from:

1. The generated route module (`virtual:bini-app`) is safe to import on the server and preloads each route's lazy modules, so a server render finds the page component already loaded.
2. In `vite dev`, the plugin renders every HTML navigation by calling your `render(url)` export and assembling the page around the result.
3. The route manifest (`document`, `metadata`, `css`, `prerender`, and more) is exposed for [bini-ssg](https://www.npmjs.com/package/bini-ssg), which does the build-time pre-rendering.

### How the route module supports server rendering

- **Nothing browser-only runs at import time.** `routes` is a plain array built with `createRoutesFromElements`. The browser router is created only when `getRouter()` is first called (which `App` does when it renders), so importing `routes`, `basename`, or `AppRoutes` on the server does not create a `createBrowserRouter`.
- **Every page route has a `lazy` function.** For pages without data exports it only preloads modules; for pages with data exports it preloads modules and then resolves the data exports (`loader`, `action`, and so on) from the page module. The root layout's data exports are attached directly because the root layout is imported eagerly.
- **What a route preloads:** the page component, its non-root layouts, and the `loading.*` and `error.*` components in scope for the page and each layout. Templates are imported eagerly, so they need no preload. Parallel-slot pages and intercepting pages that share the route's path are preloaded together with it.
- **Preloaded components render without suspending.** Each lazy component wrapper renders the real component directly once its module has loaded, and only falls back to `React.lazy` while the module is still loading.
- **Not part of the route preload:** `not-found.*`, `global-error.*`, and slot `default.*` components load on demand when first rendered.
- **A failed preload is reported.** If a lazy module fails to import, the wrapper resets so a later attempt can retry, flags the page as crashed for the [dev recovery script](#dev-crash-recovery), reports the error to the overlay event, and rethrows.
- **Helpers:**
  - `preloadRoute(pathname)` strips the basename and preloads every route entry whose pattern matches the path. Hovering or focusing a same-origin link (not `target="_blank"`) calls it automatically.
  - `routerReady()` resolves once `getRouter()`'s router reports that it is initialized. Lazy routes make the browser router initialize asynchronously, so await it before relying on route state.
  - `rootOptions` supplies the `createRoot` / `hydrateRoot` error callbacks. In development, caught and uncaught errors are forwarded to the overlay event (uncaught ones also mark the page as crashed), as are recoverable "Switched to client rendering" hydration fallbacks (which also mark the page as crashed); other recoverable errors are logged with `console.warn`. Outside development the callbacks do nothing.

### Dev server rendering

The middleware is registered only when `src/app` exists and only by `vite dev` (`vite preview` serves the built files, and its app module is a stub). A request is treated as an HTML navigation when it is a `GET` or `HEAD` that accepts `text/html`, and its path does not start with `/@`, `/src/`, `/node_modules/`, `/api/`, or `/__`, and has no file extension.

For each one, bini-router:

1. Reads `index.html` from the project root and runs it through Vite's `transformIndexHtml`.
2. Loads your `src/main.*` file (the first of `main.tsx`, `main.ts`, `main.jsx`, `main.js`) through `ssrLoadModule` and awaits its exported `render(url)`, passing the request URL (path and query string, with the base). If `render` is not a function, the request fails with an error naming the file.
3. Strips Vite's base from the path and looks up the route's manifest entry (dynamic patterns included), falling back to the `/` entry. The manifest is cached and rebuilt after the next change to a page, layout, or route folder.
4. Builds the head additions:
   - When the entry's `document.head` has nodes, they are serialized and used as is. Head tags rendered inside the app markup are left where they are.
   - Otherwise every `<title>`, `<meta>`, and `<link>` tag found in the rendered markup is removed from it and hoisted into `<head>`.
5. Collects the CSS imported by `main`, the route's layouts, and its page by walking Vite's module graph (skipping `node_modules`), and inlines each stylesheet as `<style type="text/css" data-vite-dev-id="...">`. Stylesheets requested with a `direct`, `inline`, `raw`, `url`, `worker`, or `sharedworker` query are skipped, and a stylesheet that fails to transform is skipped without failing the request. The head additions and the CSS are inserted just before `</head>`.
6. Places the rendered markup into the template's `<div id="root">...</div>` (or before `</body>`, or at the end when neither exists) and responds with status `200`, `Content-Type: text/html`, and `Cache-Control: no-cache`. The status is `200` even for URLs that match no route, because the not-found page is rendered by the app. Errors thrown while rendering are passed to Vite's error handling; when [bini-overlay](https://www.npmjs.com/package/bini-overlay) is installed, it replaces Vite's error page for HTML navigations with its own page (status `500`) and shows the error in its overlay.

What dev rendering does not do:

- It does not apply the `metadata` export: no tags are generated from it in development. Use `document.head` for head tags that must appear in dev as well; bini-ssg applies `metadata` at build time.
- It does not apply `document.html` or `document.body` attributes.
- It does not hydrate. With the `main.tsx` example above, `createRoot(...).render(<App />)` replaces the server markup on the client. If you call `hydrateRoot` yourself, pass `rootOptions` to get the dev overlay behavior described above.

### Dev crash recovery

In development bini-router also injects a module script at the start of `<head>` (through `transformIndexHtml`). It marks the page as crashed when:

- a `<script type="module">` fails to load;
- an error is thrown before the app has mounted, or an error message matches a module-load failure (`does not provide an export named`, `Failed to fetch dynamically imported module`, `error loading dynamically imported module`, `Importing a module script failed`);
- an unhandled promise rejection carries one of those messages;
- Vite reports an error while `#root` is empty;
- a lazy route module fails to import, or React reports an uncaught error (through the generated helpers).

When Vite then announces its next update (`vite:beforeUpdate`) and the page is marked as crashed, the page reloads itself. In development the app marks itself as mounted from an effect in the root route.

### Build-time pre-rendering (bini-ssg)

[bini-ssg](https://www.npmjs.com/package/bini-ssg) calls the same `render(url)` export that the dev server uses, once per route, and reads this package's `generateRouteManifest()` (on `src/app`) for everything else. It is a Vite plugin (`biniSSG()`, build only):

- **Inputs.** The client build's `<outDir>/index.html` is the template (it must contain `id="root"`), and the SSR build is loaded from `<outDir>/.bini/server/main.js`, which must export `render()`. The SSR build is a second build (`vite build --ssr src/main.tsx`), and pre-rendering runs when that build finishes. The client build also writes `.bini/css-map.json`, which maps source modules to their hashed CSS files.
- **Routes.** Every static route in the manifest is rendered unless its `prerender` export is `false`; `/` is always rendered. Internal `<a href>` links found in each rendered page are then crawled and rendered too (external links, `mailto:`, `tel:`, and asset-like paths are skipped, as are linked routes with `prerender = false`). Routes are rendered one at a time.
- **Dynamic routes.** A dynamic or catch-all pattern that no rendered route matched gets a shell page written at its parent path (for `/blog/:slug`, that is `/blog/`), marked with `window.__BINI_SHELL__=true`. Patterns with `prerender = false` get none.
- **404.** `404.html` is generated from a `/404` page when one was rendered, otherwise from a render of an unmatched probe URL (a shell when that render fails).
- **Output.** Each route is written to `<outDir>/<route>/index.html` and minified with `html-minifier-terser`. Unsafe route segments (`..`, path separators, and similar) are rejected. A route whose `render()` fails or returns an empty string is not written and fails the build.
- **Head, per page.** In this order: the title and `metadata` tags from the manifest, the `document.html` and `document.body` attributes, route CSS as `<link rel="stylesheet">` tags, head tags found in the rendered markup, then `document.head` inserted before `</head>`. Tags rendered inside the app (`<title>`, `<meta>`, `<link>`, and `application/ld+json` scripts) are hoisted into `<head>`; when two share a key (title, meta name/property/http-equiv/charset/id, link rel and href, or the start of a JSON-LD body), the later one wins.

How the dev server and bini-ssg differ in the head:

| | `vite dev` (this package) | bini-ssg (build) |
| --- | --- | --- |
| `document.head` | Inserted before `</head>` | Inserted before `</head>` |
| `metadata` | Not applied | Applied (see [Metadata](#metadata)) |
| `document.html` / `document.body` attributes | Not applied | Applied |
| Head tags rendered inside the app | Hoisted (`title`, `meta`, `link`) only when the route has no `document.head` | Always hoisted (`title`, `meta`, `link`, JSON-LD scripts), de-duplicated by key |
| CSS | Inlined as `<style>` tags | Linked as `<link rel="stylesheet">` with hashed URLs |
| Void elements in `document.head` | Self-closed (`<meta ... />`) | Written without a slash (`<meta ...>`) |
| `<` inside a `<script>` raw child | Escaped as `\u003c` | Written verbatim |
| Text and attribute escaping | `&` and `<` (text); `&`, `"`, and `<` (attributes) | `&`, `<`, and `>` (text); `&`, `"`, `<`, and `>` (attributes) |

---

## Configuration Reference

```ts
biniroute({
  cors: false,
  trustProxy: false,
  bodySizeLimit: 1024 * 1024,
})
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `cors` | `boolean \| { origin?: string; methods?: string[]; headers?: string[] }` | `false` | Accepted by the options type. Not applied by the dev/preview API handler in the current version |
| `trustProxy` | `boolean` | `false` | Accepted by the options type. Not applied by the dev/preview API handler in the current version |
| `bodySizeLimit` | `number` | n/a | Declared on the options type. Not read in the current version |

Everything else is fixed by convention: the app directory is `src/app`, the API directory is `src/app/api`, the basename follows Vite's `base`, auto-imports use fixed presets, and MDX options are built in. Route conflicts and invalid route files are always reported as errors (there is no `strictMode` option); see [Diagnostics](#diagnostics).

The `BINI_DEBUG_HMR` environment variable, when set, logs every `hotUpdate` the plugin sees.

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

TypeScript projects need an ambient declaration (see [Troubleshooting](#troubleshooting)). The module is invalidated when the generated route tree changes.

### From other tools: generateRouteManifest()

```ts
import { generateRouteManifest } from 'bini-router'

const manifest = generateRouteManifest('src/app')
// Optional: generateRouteManifest(appDir, apiDir)

console.log(manifest.static)    // ['/', '/about']
console.log(manifest.dynamic)   // ['/blog/:slug']
console.log(manifest.all)       // static and dynamic combined
console.log(manifest.metadata)  // per-route entries
```

A plain synchronous function with no Vite dependency at call time. It uses the same scanning, deduplication, and title resolution as the router, and it always re-reads the files from disk. It does not throw on conflicts or missing default exports: conflicting files are resolved by the deduplication rules and invalid pages are left out. Returned paths are raw scanned paths, not prefixed with Vite's `base`.

Each `RouteManifestEntry` contains:

| Field | Description |
| --- | --- |
| `title` | Resolved title, when a string |
| `meta` | Merged `metadata` along the layout chain |
| `document` | Extracted `document` export, or `null` |
| `css` | Absolute paths of relative CSS-like imports (`.css`, `.scss`, `.sass`, `.less`, `.styl`) from the page, its layouts, and the pages of any parallel slots in the page's directory |
| `layouts` | Absolute layout file paths, outermost first |
| `filePath` | Absolute page file path |
| `dynamic` | Whether the route has dynamic or catch-all segments |
| `catchallKind` | `'required'`, `'optional'`, or `null` |
| `catchallParamName` | Name of the catch-all parameter |
| `slotName` | Set for routes that live in a `@slot` folder |
| `loader`, `action`, `shouldRevalidate`, `errorBoundary`, `hydrateFallback`, `handle` | Whether the page exports each data member |
| `prerender` | The page's `prerender` export |
| `parallel` | `RouteSlotInfo[]` (`{ slotName, filePath }`) for the parallel slots rendered at this path |
| `intercepts` | `RouteInterceptInfo[]` (`{ from, level, filePath, slotName }`) for the interceptors targeting this path. `level` is `'same'`, `'up'`, or `'root'` |

`parallel` and `intercepts` are present only when non-empty. Only the main route tree is listed: intercepting routes have no entries of their own, and a slot route appears as an entry only when no main route exists at the same path.

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

Pattern syntax: `:name` for dynamic segments, `*` for a catch-all, and `**` for an optional catch-all. Pass `{ enforceNonEmptyCatchAll, catchallParamName }` as a third argument to refine catch-all behavior. Decoded segments containing `/`, `\`, `..`, or a null byte fail to match.

### Other helpers

- `getMetadataForRoute(manifest, pathname)` returns the manifest entry for a pathname (exact match first, then dynamic patterns), or `null`.
- `getCssForRoute(manifest, pathname)` returns that entry's `css` array, or `null`.
- `generateBuildManifest(appDir, apiDir?)` returns `{ routes, appDir, apiDir }`, where each API route is `{ routePath, filePath, allowedMethods, catchallParamName? }`. `routePath` is relative to `/api`. `allowedMethods` lists all supported methods; handler modules are not inspected. Intended for deployment tooling such as bini-deploy.

---

## HMR and File Watcher

During development bini-router watches the app directory and regenerates the app module automatically. No restart is needed when adding or removing routes.

| Event | Behavior |
| --- | --- |
| New page or special file | Regenerates after a 300 ms debounce |
| Deleted page or special file | Regenerates after a 60 ms debounce |
| Changed `layout`, `template`, `loading`, `error`, `not-found`, `global-error`, or `default` file | Regenerates after a 60 ms debounce |
| Changed page file | Regenerates only if its default-export or data-export signature changed |
| Any page-file change, add, or delete, or folder change | Clears the cached route manifest, so the next dev-rendered page picks up edited `document` exports and route changes |
| New folder | Watched immediately; regenerates if a `page.*` file appears within 300 ms |
| Deleted folder | Regenerates |
| Route regeneration | Invalidates `virtual:bini-routes` and the app module, and triggers a full reload only when the generated output changed |
| File outside the project root or inside `node_modules` changes | Triggers a full reload of the client |
| File inside `src/` changes | The plugin's `hotUpdate` hook returns no modules for the `ssr` environment, so updates propagate through the client environment |
| API file added or removed | Clears caches and triggers a full reload |
| API file changed | Clears that module's cache entry; the next request uses the new handler |
| API directory created after startup | Detected and watched automatically |

Regeneration is guarded by an `isGenerating` flag, so overlapping regenerations are dropped. In development, generation errors (conflicts, missing default exports) are logged and the previous output is kept; in builds they are thrown.

---

## Diagnostics

Problems are reported through Vite's logger with a `BINI_*` code, the file location, and a code frame where one can be computed. Each distinct message is reported once. In development, errors are logged. In `vite build`, errors are collected and thrown together as a single `BINI_AGGREGATE` error that lists every message.

| Code | Severity | Meaning |
| --- | --- | --- |
| `BINI_R001` | error | A `page.*` file has no default export |
| `BINI_R004` | warn | A dynamic `document.head` attribute or child was dropped |
| `BINI_R005` | warn | A file over 10 MB was not parsed |
| `BINI_R007` | error | Route conflict |
| `BINI_R008` | error | Invalid route, group, slot, or intercept name (names that use special syntax, such as `[...]`, `(...)`, or `@...`, but are malformed) |
| `BINI_R010` | warn | Circular layout chain |
| `BINI_R011` | warn | Maximum directory depth reached |
| `BINI_R012` | warn | Loader or action ignored in a parallel slot or intercepting page |
| `BINI_R013` | warn | Slot has no receiving layout |

`BINI_R002`, `BINI_R003`, `BINI_R006`, `BINI_R009`, and `BINI_R014` are reserved and not currently emitted. Names that do not use special syntax but are not valid segments (for example a flat file `foo.bar.tsx`) are skipped silently.

---

## Programmatic API

Three packages in the Bini ecosystem build on this API:

| Package | Uses from bini-router |
| --- | --- |
| [bini-ssg](https://www.npmjs.com/package/bini-ssg) | `generateRouteManifest()`, `getMetadataForRoute()`, `getCssForRoute()`, and the `RouteManifest`, `RouteManifestEntry`, `PrerenderMode`, and `HeadNode` types. It reads `title`, `meta`, `document`, `css`, and `prerender` from manifest entries |
| [bini-overlay](https://www.npmjs.com/package/bini-overlay) | `generateRouteManifest()` and `matchManifestRoute()` for its dev-only route endpoints (it strips Vite's `base` before matching), the `layouts`, `filePath`, `parallel`, and `intercepts` fields of manifest entries for its Route Info panel, and the `__bini_error__` event dispatched by the generated app module |
| [bini-native](https://www.npmjs.com/package/bini-native) | `getSourceFacts()`, `scanSourceFacts()`, `isClientSourceFile()`, and the `SourceFacts` type, to detect native-feature usage in client source (see [Source Facts API](#source-facts-api)) |

### biniroute(options?): Plugin[]

The Vite plugin factory. Returns the router plugin, the MDX plugin, and the auto-import plugin.

### generateRouteManifest(appDir, apiDir?): RouteManifest

Scans `appDir` and returns the route tree. See [Route Manifest](#route-manifest).

- Dynamic segments use `:name` (`/users/:id`).
- Catch-all segments use `*` (`/docs/*`); use `catchallKind` to tell required from optional.
- Static segments are bare (`/about`).
- Paths are never prefixed with Vite's `base`. Strip `base` before matching browser URLs.
- `apiDir` defaults to `<appDir>/api`.

### generateBuildManifest(appDir, apiDir?): BuildManifest

Returns the scanned API routes for deployment tooling.

### matchManifestRoute(manifest, pathname): RouteMatchResult

Matches a base-stripped pathname against a manifest. Returns `{ type, routePath?, params? }`.

### matchRoute(pattern, pathname, options?): Record<string, string> | null

Low-level matcher using `:name`, `*`, and `**`.

### getMetadataForRoute(manifest, pathname) / getCssForRoute(manifest, pathname)

Look up a manifest entry, or just its CSS list, for a pathname.

### getSourceFacts(filePath) / scanSourceFacts(projectRoot) / isSourceFile(name) / isClientSourceFile(projectRoot, file)

Static source analysis for tooling. See [Source Facts API](#source-facts-api).

### deriveBase(configBase, command)

Returns `{ raw, assetBase, routerBasename, apiPrefix, runtimeBasename }` for a Vite `base` value and command (`'serve'` or `'build'`).

### isAllowedHost(host, allowedHosts)

Host check helper. `localhost`, `*.localhost`, IPv4 addresses, and bracketed IPv6 addresses are always allowed. Otherwise the host must match an entry of `allowedHosts` (`'*'` allows any host; an entry starting with `.` also matches subdomains). `allowedHosts: true` allows everything.

### report(severity, code, file?, detail?)

Records a diagnostic through the plugin's logger. See [Diagnostics](#diagnostics).

### shouldBailMdx(id)

Returns `true` for module ids whose query string includes `raw`, `url`, `inline`, `worker`, or `sharedworker`, which the MDX transform leaves alone.

### Stability

The exports listed under [Exports](#exports) are the public surface. Internal helpers (route scanning, metadata parsing, the transform pipeline, head serialization) are not exported and may change between minor versions.

---

## Source Facts API

A small static-analysis API used by [bini-native](https://www.npmjs.com/package/bini-native). It parses client source files with Oxc and returns a `SourceFacts` summary.

```ts
import { getSourceFacts, scanSourceFacts } from 'bini-router'

const facts = getSourceFacts('/abs/path/src/app/page.tsx')
const all = scanSourceFacts(process.cwd())   // Map<absolute file path, SourceFacts>
```

```ts
interface SourceFacts {
  imports: Set<string>                 // static module specifiers from import, export-from, import(), and require()
  refs: Set<string>                    // identifiers and member chains that are referenced ("window", "navigator.share")
  calls: Map<string, string[]>         // call chain -> static string first arguments
  callArgKeys: Map<string, Set<string>> // call chain -> keys of an object-literal first argument ("*" when not static)
  news: Set<string>                    // constructor chains used with `new`
  jsxAttrs: Set<string>                // "Tag:attr" and "Tag:attr=value" for JSX attributes
  props: Set<string>                   // "key=value" for static scalar object properties and member assignments
}
```

- Names declared at module scope (imports, variables, functions, classes, and top-level `var`s) shadow matching entries in `refs`, `calls`, `callArgKeys`, and `news`.
- Type-only syntax (interfaces, type aliases, type annotations) is skipped.
- A region delimited by the `@bini-native:polyfills` and `End Bini Native: Runtime Polyfills` comments is ignored, so generated polyfill code does not count as source usage.
- `getSourceFacts` returns `null` when the file cannot be read or parsed (or exceeds 10 MB), empty facts for an empty file or an `.mdx` / `.md` file, and caches results per parsed file.
- `isSourceFile(name)` is `true` for `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, and `.cts` files, excluding `.d.ts` declaration files.
- `isClientSourceFile(projectRoot, file)` is `true` for source files under `src/` that are not inside the API directory, not inside dot-directories, and not inside `node_modules`, `dist`, `build`, `target`, `src-tauri`, or `gen`.
- `scanSourceFacts(projectRoot)` walks `src/` (skipping the same directories and the API directory) and returns facts for every parseable source file.

### How bini-native uses it

bini-native scans the project once with `scanSourceFacts()` and then decides which native features (Tauri plugins, polyfills) to wire up from the facts alone:

- **Names are recorded as written.** `refs`, `calls`, and `news` hold chains exactly as they appear, so `window.open`, `globalThis.open`, and `open` are separate entries. bini-native checks the bare name and the `window.`, `globalThis.`, and `self.` forms.
- **Examples of lookups:** `imports` for `@tauri-apps/plugin-*` packages (including subpaths), `refs` for `navigator.geolocation` or `navigator.clipboard.writeText`, `calls` for `navigator.share` or `fetch` with a string argument starting with `http(s)://`, `news` for `Notification`, and `jsxAttrs` for `a:target=_blank`.
- **Edits are re-indexed.** On a file change it calls `getSourceFacts()` for the changed file and skips the file when the result is `null` (a file that does not parse). Results are cached and refreshed when the file's modification time or size changes.
- **Generated code is ignored.** bini-native writes a polyfill block into your `src/main.*` between the `@bini-native:polyfills` and `End Bini Native: Runtime Polyfills` comments. Facts skip that region, so the generated code never counts as feature usage.
- **Scope.** It filters changed files with `isClientSourceFile()`, so API routes, `src-tauri`, build output, and files outside `src/` are never analyzed.

---

## Exports

| Export | Kind | Purpose |
| --- | --- | --- |
| `biniroute(options?)` | function | Vite plugin array (routing, MDX, auto-imports) |
| `generateRouteManifest(appDir, apiDir?)` | function | Scan the filesystem and return the route manifest |
| `generateBuildManifest(appDir, apiDir?)` | function | Scan API routes and return the build manifest |
| `getMetadataForRoute(manifest, pathname)` | function | Find the manifest entry for a pathname |
| `getCssForRoute(manifest, pathname)` | function | Find the CSS list for a pathname |
| `matchRoute(pattern, pathname, options?)` | function | Match one pattern against a pathname |
| `matchManifestRoute(manifest, pathname)` | function | Resolve a pathname against a manifest |
| `getSourceFacts(filePath)` | function | Static facts for one source file |
| `scanSourceFacts(projectRoot)` | function | Static facts for every client source file |
| `isSourceFile(name)` / `isClientSourceFile(projectRoot, file)` | function | Source-file predicates |
| `deriveBase(configBase, command)` | function | Derive basename and API prefix from Vite's `base` |
| `isAllowedHost(host, allowedHosts)` | function | Host allow-list check |
| `shouldBailMdx(id)` | function | Whether an id's query opts out of the MDX transform |
| `report(severity, code, file?, detail?)` | function | Report a diagnostic |
| `BiniPluginOptions` | type | Options accepted by `biniroute()` |
| `BuildManifest` | type | Shape returned by `generateBuildManifest()` |
| `RouteManifest` | type | Shape returned by `generateRouteManifest()` |
| `RouteManifestEntry` | type | A single manifest entry |
| `RouteMetadata` | type | Metadata portion of a manifest entry (`meta`, `document`, `title`, `css`) |
| `RouteDocument` | type | Shape of the extracted `document` export |
| `RouteSlotInfo` | type | A parallel slot entry (`slotName`, `filePath`) |
| `RouteInterceptInfo` | type | An interceptor entry (`from`, `level`, `filePath`, `slotName`) |
| `RouteMatchResult` | type | Shape returned by `matchManifestRoute()` |
| `HeadNode` | type | Parsed `document.head` node (`element` / `text` / `raw`) |
| `PrerenderMode` | type | `'fallback' \| 'strict' \| false` |
| `SourceFacts` | type | Shape returned by `getSourceFacts()` |
| `Severity` | type | `'error' \| 'warn'` |
| `Plugin` / `ViteDevServer` | type | Re-exported from `vite` |

---

## Route Naming Rules

Route segments and parameters are validated at scan time:

- Static segment names (folder names and flat-file base names) must match `/^[a-zA-Z0-9_-]+$/` and be at most 100 characters. A flat file such as `foo.bar.tsx` is therefore skipped.
- Parameter names inside brackets must match `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- Route group names must match `/^[a-zA-Z0-9_-]+$/`
- Parallel-route slot names (after the `@`) must match `/^[a-zA-Z][a-zA-Z0-9_-]*$/`
- Intercepting prefixes must be exactly `(.)`, `(..)`, or `(...)`, followed by a valid segment name
- Names that use special syntax (`[...]`, `(...)`, `@...`) but are malformed are reported as `BINI_R008` errors; other invalid names are skipped without a message
- Source files larger than 10 MB are ignored
- Decoded URL parameter values containing `/`, `\`, `..`, or a null byte fail to match

---

## Differences from Next.js

bini-router borrows the App Router's conventions, but it is built on React Router's data router and has no React Server Components.

| | Next.js App Router | bini-router |
| --- | --- | --- |
| Server components | Yes | No. Components run in the browser and are server-rendered to HTML |
| Data fetching | Server-side | Client-side, through React Router `loader` / `action` exports |
| `middleware.ts` | Yes | No |
| SSR / SSG | Built in | Server-render-ready route module. The dev server renders HTML through your main file's `render(url)`; build-time pre-rendering is done by [bini-ssg](https://www.npmjs.com/package/bini-ssg), which reads the route manifest. bini-router itself ships no production server |
| API routes | Production (Node or edge) | Dev and preview; use [bini-deploy](https://www.npmjs.com/package/bini-deploy) for production |
| Optional catch-all `[[...slug]]` | Yes | Yes |
| Route groups `(name)` | Yes | Yes |
| Parallel routes `@slot` | Yes | Yes. Slots are passed to the sibling layout as named props and matched against the current URL; `default.*` is read from the slot folder only |
| Intercepting routes | Yes | Yes. Based on the previous in-app location, with real-page fallback for direct visits |
| File-based routing | Folders with `page.tsx` only | Both `page.tsx` folders and flat files (`about.tsx`, `[id].tsx`) |
| `template.tsx` | Remounts on navigation | A wrapper between the layout chain and the page |
| `loading` / `error` / `not-found` | Nearest-wins | Nearest-wins |
| `global-error` | Yes | Yes |
| Metadata | Full head management | `metadata` is statically extracted to the manifest and applied to the HTML by bini-ssg at build time. `document.head` is applied in both dev and build |

---

## Troubleshooting

**`virtual:bini-app` or `virtual:bini-routes` is not resolving in TypeScript.**
Add ambient module declarations, for example in `vite-env.d.ts`:

```ts
declare module 'virtual:bini-app' {
  const App: () => import('react').ReactElement
  export default App
  export const basename: string
  export const routes: import('react-router-dom').RouteObject[]
  export function AppRoutes(): import('react').ReactElement | null
  export function getRouter(): ReturnType<typeof import('react-router-dom').createBrowserRouter>
  export const rootOptions: import('react-dom/client').RootOptions
  export function preloadRoute(pathname: string): Promise<unknown>
  export function routerReady(): Promise<void>
  export function resetNavState(): void
  export function reportBiniError(error: unknown, componentStack?: string, kind?: 'caught' | 'uncaught'): void
}

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

**The dev server fails with "src/main.* does not export render(url)".**
In development, HTML navigations are rendered through your `src/main.*` file. Export a `render(url)` function (see [main.tsx](#maintsx)) and guard client-only code such as `document.getElementById` with `typeof document !== 'undefined'`.

**The dev server renders a page without my `<title>` or meta tags.**
Dev rendering applies `document.head` only. When the route has no `document.head`, `<title>`, `<meta>`, and `<link>` tags rendered inside the app are hoisted into `<head>`. Tags generated from the `metadata` export are added by [bini-ssg](https://www.npmjs.com/package/bini-ssg) at build time, not in development. Declare them in `document.head` to get them in both.

**A route is not being generated.**
Check that the file has a default export, parses without errors, is not empty, is not under a `_` or `.` prefixed path, and is not inside the API directory. Run `generateRouteManifest('src/app')` in a Node script to see what the router sees.

**A route conflict or missing default export is failing my build.**
`BINI_R007` (conflict) and `BINI_R001` (missing default export) are errors and fail `vite build`. Delete or fix the offending files. In development they are logged and the router keeps working with the resolved routes.

**A slot's content isn't rendering.**
The slot needs a `layout.*` in the same directory as the `@slot` folder, and that layout must read the slot as a prop named after the folder (`@sidebar` becomes `sidebar`). If no slot route matches the URL, only the `default.*` inside the slot folder renders.

**An intercepting route never shows up.**
Interceptors only apply when the previous in-app location matches the route that contains the interceptor. Direct visits, reloads, and links from other pages show the real page. Make sure a real page exists at the target path.

**My `loader` on a slot or intercepting page does nothing.**
Data exports are only wired for main-tree pages and the root layout. Move the loader to the real page and read it with `useRouteLoaderData`.

**My `metadata` is missing from the manifest.**
Every value in the `metadata` object must be statically evaluable (see [Static analysis](#static-analysis)). One dynamic value drops the whole export from the manifest.

**The tab title or other `metadata` doesn't change.**
bini-router does not apply `metadata` at runtime or in the dev server. Titles and meta tags from `metadata` are written into the HTML by [bini-ssg](https://www.npmjs.com/package/bini-ssg) during `vite build`; inspect the built HTML in `dist/`. To get a title and meta tags in development as well, declare them in `document.head`.

**My `document` isn't appearing in the page.**
`document.head` is injected in development by the dev server renderer and at build time by bini-ssg. `document.html` and `document.body` attributes are applied only by bini-ssg during `vite build`. If a value inside `head` is dynamic, it is dropped with a `BINI_R004` warning.

**The page does not recover after a broken edit in development.**
The injected recovery script reloads the page on the next Vite update after a module-load failure or a crash before mount. If the app mounted and then crashed inside React, use the nearest `error.*` fallback or `reset`; boundaries also reset on HMR updates.

**Auto-imports are not working in an `.mdx` file.**
Auto-imports apply to script files only. Import what you need explicitly in MDX and Markdown files.

**An API route returns 405.**
If the file exports any of `GET`, `POST`, and so on, only those methods are allowed. Add the missing method export, or use a default export to handle every method.

**An `.mdx` page fails with "Missing @mdx-js/rollup".**
Install it with `npm i -D @mdx-js/rollup`.

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
