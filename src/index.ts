import fs from 'fs';
import path from 'path';
import type { Plugin, ViteDevServer } from 'vite';
import { loadEnv } from 'bini-env';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_FILES      = ['page.tsx', 'page.jsx', 'page.ts', 'page.js'] as const;
const LAYOUT_FILES    = ['layout.tsx', 'layout.jsx', 'layout.ts', 'layout.js'] as const;
const SUPPORTED_EXTS  = ['.tsx', '.jsx', '.ts', '.js'] as const;
const NOT_FOUND_FILES = SUPPORTED_EXTS.map(e => `not-found${e}`);
const LOADING_FILES   = SUPPORTED_EXTS.map(e => `loading${e}`);
const SPECIAL_BASES   = new Set(['page', 'layout', 'not-found', 'loading', 'error']);
const API_EXTS        = ['.ts', '.js'] as const;
const DEBOUNCE_MS     = 60;
const EVENT_DEDUP_MS  = 500;
const EVENT_TTL_MS    = 2000;

// ─── Metadata Types ───────────────────────────────────────────────────────────

export interface IconEntry {
  url   : string;
  type ?: string;
  sizes?: string;
}

export interface MetaTags {
  title        ?: string;
  description  ?: string;
  viewport     ?: string;
  themeColor   ?: string;
  keywords     ?: string;
  author       ?: string;
  charset      ?: string;
  robots       ?: string;
  canonical    ?: string;
  manifest     ?: string;
  openGraph    ?: Partial<OGMeta>;
  twitter      ?: Partial<TwitterMeta>;
  icons        ?: {
    icon     ?: IconEntry[];
    shortcut ?: IconEntry[];
    apple    ?: IconEntry[];
  };
}

interface OGMeta {
  title       : string;
  description : string;
  url         : string;
  image       : string;
  type        : string;
}

interface TwitterMeta {
  card        : string;
  title       : string;
  description : string;
  creator     : string;
  image       : string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteNode {
  routePath : string;
  filePath  : string;
  layouts   : string[];
  dynamic   : boolean;
}

interface LayoutChainGroup {
  layouts : string[];
  routes  : RouteNode[];
}

interface ApiRoute {
  routePath : string;
  filePath  : string;
}

export interface BiniPluginOptions {
  /** Directory for page files. Default: src/app */
  appDir?: string;
  /** Directory for API routes. Default: src/app/api */
  apiDir?: string;
  /** Enable CORS headers in the dev-server API middleware. Default: true */
  cors?: boolean;
  /**
   * Target deployment platform. bini-router generates a production entry
   * file on every build — users only write code in src/app/api/.
   *
   * 'netlify'    → netlify/edge-functions/api.ts  (Deno runtime, always .ts)
   * 'cloudflare' → worker.ts / worker.js
   * 'node'       → server/index.ts / server/index.js
   * 'deno'       → server/index.ts / server/index.js
   * 'bun'        → server/index.ts / server/index.js
   * 'aws'        → handler.ts / handler.js
   * 'vercel'     → api/index.ts / api/index.js          ⚠️  must be committed to repo
   *
   * Default: undefined (no entry generated)
   */
  platform?: 'netlify' | 'cloudflare' | 'node' | 'deno' | 'bun' | 'aws' | 'vercel';
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function norm(p: string): string {
  return p.replace(/\\/g, '/');
}

function isInDir(file: string, dir: string): boolean {
  const nFile = norm(file);
  const nDir  = norm(dir).replace(/\/$/, '');
  return nFile.startsWith(nDir + '/') || nFile === nDir;
}

function readTsconfigAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  try {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) return aliases;
    const raw = fs.readFileSync(tsconfigPath, 'utf8')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const tsconfig  = JSON.parse(raw);
    const paths     = tsconfig?.compilerOptions?.paths ?? {};
    const baseUrl   = tsconfig?.compilerOptions?.baseUrl ?? '.';
    for (const [alias, targets] of Object.entries(paths) as [string, string[]][]) {
      const cleanAlias  = alias.replace(/\/\*$/, '');
      const cleanTarget = (targets[0] ?? '').replace(/\/\*$/, '');
      aliases[cleanAlias] = path.resolve(process.cwd(), baseUrl, cleanTarget);
    }
  } catch { /* tsconfig unreadable — fall back to relative paths */ }
  return aliases;
}

function toImportPath(filePath: string, aliases: Record<string, string>): string {
  for (const [alias, target] of Object.entries(aliases)) {
    if (norm(filePath).startsWith(norm(target) + '/')) {
      const rest = norm(filePath).slice(norm(target).length + 1).replace(/\.(tsx|ts|jsx|js)$/, '');
      return `${alias}/${rest}`;
    }
  }
  return './' + norm(path.relative(path.join(process.cwd(), 'src'), filePath))
    .replace(/\.(tsx|ts|jsx|js)$/, '');
}

function hasDefaultExport(filePath: string): boolean {
  try { return fs.readFileSync(filePath, 'utf8').includes('export default'); }
  catch { return false; }
}

function isHtmlShellLayout(filePath: string): boolean {
  try { return /<html[\s>]/i.test(fs.readFileSync(filePath, 'utf8')); }
  catch { return false; }
}

function isUsableLayout(filePath: string): boolean {
  return hasDefaultExport(filePath) && !isHtmlShellLayout(filePath);
}

function findFile(dir: string, candidates: readonly string[]): string | null {
  return candidates.find(f => fs.existsSync(path.join(dir, f))) ?? null;
}

// ─── TypeScript detection ─────────────────────────────────────────────────────

function isTypeScriptProject(): boolean {
  const cwd = process.cwd();

  if (
    fs.existsSync(path.join(cwd, 'src/main.tsx')) ||
    fs.existsSync(path.join(cwd, 'src/main.ts'))
  ) return true;

  if (
    fs.existsSync(path.join(cwd, 'src/main.jsx')) ||
    fs.existsSync(path.join(cwd, 'src/main.js'))
  ) return false;

  const appDir = path.join(cwd, 'src/app');
  if (fs.existsSync(appDir)) {
    const hasTsFile = (dir: string): boolean => {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return false; }
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (hasTsFile(path.join(dir, entry.name))) return true;
        } else {
          const ext = path.extname(entry.name);
          if (ext === '.tsx' || ext === '.ts') return true;
        }
      }
      return false;
    };
    if (hasTsFile(appDir)) return true;
  }

  return false;
}

function getAppFile(): string {
  const ts  = path.join(process.cwd(), 'src/App.tsx');
  const jsx = path.join(process.cwd(), 'src/App.jsx');
  if (fs.existsSync(ts)) return ts;
  return isTypeScriptProject() ? ts : jsx;
}

// ─── Layout Resolution ────────────────────────────────────────────────────────

function resolveLayoutChain(pageDir: string, appDir: string): string[] {
  const chain: string[] = [];
  let current = pageDir;
  while (true) {
    const layout = findFile(current, LAYOUT_FILES);
    if (layout) chain.unshift(path.join(current, layout));
    if (path.resolve(current) === path.resolve(appDir)) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return chain;
}

// ─── Route Scanner ────────────────────────────────────────────────────────────

function scanRoutes(dir: string, appDir: string, baseRoute = ''): RouteNode[] {
  const routes: RouteNode[] = [];
  if (!fs.existsSync(dir)) return routes;

  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return routes; }

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const ext  = path.extname(entry.name);
    const base = path.basename(entry.name, ext);
    if (!(SUPPORTED_EXTS as readonly string[]).includes(ext)) continue;
    if (SPECIAL_BASES.has(base)) continue;
    routes.push({
      routePath : `${baseRoute}/${base}`,
      filePath  : path.join(dir, entry.name),
      layouts   : resolveLayoutChain(dir, appDir),
      dynamic   : false,
    });
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'api') continue;

    const fullPath  = path.join(dir, entry.name);
    const isDynamic = entry.name.startsWith('[') && entry.name.endsWith(']');
    const segment   = isDynamic ? `:${entry.name.slice(1, -1)}` : entry.name;
    const routePath = `${baseRoute}/${segment}`;

    const pageFile = findFile(fullPath, PAGE_FILES);
    if (pageFile) {
      routes.push({
        routePath,
        filePath : path.join(fullPath, pageFile),
        layouts  : resolveLayoutChain(fullPath, appDir),
        dynamic  : isDynamic,
      });
    }
    routes.push(...scanRoutes(fullPath, appDir, routePath));
  }

  return routes;
}

function deduplicateRoutes(routes: RouteNode[]): RouteNode[] {
  const seen = new Set<string>();
  return routes.filter(r => {
    if (seen.has(r.routePath)) return false;
    seen.add(r.routePath);
    return true;
  });
}

// ─── Per-layout title extractor ──────────────────────────────────────────────

function parseLayoutTitle(layoutFile: string): string | null {
  let src = '';
  try { src = fs.readFileSync(layoutFile, 'utf8'); }
  catch { return null; }

  const startIdx = src.indexOf('export const metadata');
  if (startIdx === -1) return null;
  const braceStart = src.indexOf('{', startIdx);
  if (braceStart === -1) return null;

  let depth = 0, end = braceStart;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = src.slice(braceStart, end + 1);
  const match = /['"]?title['"]?\s*:\s*['"`]([^'"`]+)['"`]/.exec(block);
  return match ? match[1] : null;
}

// ─── Route Tree Renderer ──────────────────────────────────────────────────────

function renderChain(
  layouts       : string[],
  routesInChain : RouteNode[],
  layoutNames   : Map<string, string>,
  pageNames     : Map<string, string>,
  layoutTitles  : Map<string, string>,
  indent        : number,
  fallback      : string,
): string {
  const pad = ' '.repeat(indent);
  if (layouts.length === 0) {
    return routesInChain.map(r =>
      `${pad}<Route path="${r.routePath}" element={<Suspense fallback={<${fallback} />}><ErrorBoundary><${pageNames.get(r.filePath)} /></ErrorBoundary></Suspense>} />`
    ).join('\n');
  }
  const [head, ...tail] = layouts;
  const title       = layoutTitles.get(head);
  const titleSetter = title ? `<TitleSetter title=${JSON.stringify(title)} />` : '';
  const inner       = renderChain(tail, routesInChain, layoutNames, pageNames, layoutTitles, indent + 2, fallback);
  const name        = layoutNames.get(head);
  return [
    `${pad}<Route element={<>${titleSetter}<Suspense fallback={<${fallback} />}><ErrorBoundary><${name}><Outlet /></${name}></ErrorBoundary></Suspense></>}>`,
    inner,
    `${pad}</Route>`,
  ].join('\n');
}

// ─── App Generator ────────────────────────────────────────────────────────────

function generateApp(appDir: string): string {
  const aliases = readTsconfigAliases();
  const routes  = scanRoutes(appDir, appDir);
  const ts      = isTypeScriptProject();

  const rootPage = findFile(appDir, PAGE_FILES);
  if (rootPage) {
    routes.unshift({
      routePath : '/',
      filePath  : path.join(appDir, rootPage),
      layouts   : resolveLayoutChain(appDir, appDir),
      dynamic   : false,
    });
  }

  const routesFiltered = routes.map(r => ({
    ...r,
    layouts: r.layouts.filter(l => isUsableLayout(l)),
  }));

  const validRoutes = deduplicateRoutes(
    routesFiltered.filter(r => hasDefaultExport(r.filePath))
  );

  validRoutes.sort((a, b) => {
    if (a.dynamic !== b.dynamic) return a.dynamic ? 1 : -1;
    return a.routePath.length - b.routePath.length;
  });

  const notFoundFile = NOT_FOUND_FILES.find(f => fs.existsSync(path.join(appDir, f)));
  const notFound     = notFoundFile && hasDefaultExport(path.join(appDir, notFoundFile))
    ? notFoundFile
    : undefined;

  const loadingFile = LOADING_FILES.find(f => fs.existsSync(path.join(appDir, f)));
  const loading     = loadingFile && hasDefaultExport(path.join(appDir, loadingFile))
    ? loadingFile
    : undefined;

  const allLayouts = new Set<string>();
  for (const r of validRoutes) r.layouts.forEach(l => {
    if (isUsableLayout(l)) allLayouts.add(l);
  });

  const layoutNames  = new Map<string, string>();
  const pageNames    = new Map<string, string>();
  const layoutTitles = new Map<string, string>();
  let li = 0, pi = 0;
  for (const l of allLayouts) {
    layoutNames.set(l, `Layout${li++}`);
    const title = parseLayoutTitle(l);
    if (title) layoutTitles.set(l, title);
  }
  for (const r of validRoutes) {
    if (!pageNames.has(r.filePath)) pageNames.set(r.filePath, `Page${pi++}`);
  }

  const lazyImports: string[] = [];
  for (const [fp, name] of layoutNames)
    lazyImports.push(`const ${name} = React.lazy(() => import('${toImportPath(fp, aliases)}'));`);
  if (notFound)
    lazyImports.push(`const NotFound = React.lazy(() => import('${toImportPath(path.join(appDir, notFound), aliases)}'));`);
  if (loading)
    lazyImports.push(`const Loading = React.lazy(() => import('${toImportPath(path.join(appDir, loading), aliases)}'));`);
  const emittedPages = new Set<string>();
  for (const r of validRoutes) {
    if (emittedPages.has(r.filePath)) continue;
    emittedPages.add(r.filePath);
    const name = pageNames.get(r.filePath);
    if (!name) continue;
    lazyImports.push(`const ${name} = React.lazy(() => import('${toImportPath(r.filePath, aliases)}'));`);
  }

  const chainMap = new Map<string, LayoutChainGroup>();
  for (const r of validRoutes) {
    const key = r.layouts.join('|');
    if (!chainMap.has(key)) chainMap.set(key, { layouts: r.layouts, routes: [] });
    chainMap.get(key)!.routes.push(r);
  }

  const routeLines: string[] = [];
  const fallbackComponent = loading ? 'Loading' : 'Spinner';

  for (const [, { layouts, routes: cr }] of chainMap)
    routeLines.push(renderChain(layouts, cr, layoutNames, pageNames, layoutTitles, 8, fallbackComponent));

  const catchAll = notFound
    ? `        <Route path="*" element={<Suspense fallback={<${fallbackComponent} />}><NotFound /></Suspense>} />`
    : `        <Route path="*" element={<Default404 />} />`;

  const errorBoundaryClass = ts
    ? `class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  override render() {
    if (this.state.error) return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', padding: '2rem' }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <h2 style={{ color: '#e74c3c', marginBottom: '1rem' }}>Something went wrong</h2>
          <pre style={{ background: '#fef2f2', padding: '1rem', borderRadius: '0.5rem', textAlign: 'left', fontSize: '0.8rem', color: '#e74c3c', overflow: 'auto' }}>{this.state.error.toString()}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#00CFFF', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            Try again
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}`
    : `class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', padding: '2rem' }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <h2 style={{ color: '#e74c3c', marginBottom: '1rem' }}>Something went wrong</h2>
          <pre style={{ background: '#fef2f2', padding: '1rem', borderRadius: '0.5rem', textAlign: 'left', fontSize: '0.8rem', color: '#e74c3c', overflow: 'auto' }}>{this.state.error.toString()}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#00CFFF', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            Try again
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}`;

  const titleSetterFn = ts
    ? `function TitleSetter({ title }: { title: string }) {
  React.useEffect(() => { document.title = title; }, [title]);
  return null;
}`
    : `function TitleSetter({ title }) {
  React.useEffect(() => { document.title = title; }, [title]);
  return null;
}`;


  // Spinner is only generated when user has no custom loading.tsx
  const spinnerFn = !loading
    ? `function Spinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTop: '3px solid #00CFFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{\`@keyframes spin{to{transform:rotate(360deg)}}\`}</style>
    </div>
  );
}`
    : '';

  return `// ⚠️  Auto-generated by bini-router — do not edit.
import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import './app/globals.css';

${lazyImports.join('\n')}

// ─── Error Boundary ───────────────────────────────────────────────────────────
${errorBoundaryClass}

${spinnerFn}

${titleSetterFn}

${notFound ? '' : `function Default404() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#00CFFF,#0077FF)', color: 'white', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '5rem', fontWeight: 800, margin: 0 }}>404</h1>
        <p style={{ fontSize: '1.25rem', margin: '0.5rem 0 2rem' }}>Page not found</p>
        <a href="/" style={{ padding: '0.65rem 1.5rem', background: 'white', color: '#00CFFF', textDecoration: 'none', borderRadius: '0.5rem', fontWeight: 600 }}>← Back to Home</a>
      </div>
    </div>
  );
}`}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL ?? '/'}>
      <Routes>
${routeLines.join('\n')}
${catchAll}
      </Routes>
    </BrowserRouter>
  );
}
`;
}

// ─── Metadata Parser ──────────────────────────────────────────────────────────

function parseAppMetadata(appDir: string): MetaTags {
  const layout = findFile(appDir, LAYOUT_FILES);
  if (!layout) return {};
  let src = '';
  try { src = fs.readFileSync(path.join(appDir, layout), 'utf8'); }
  catch { return {}; }

  const startIdx = src.indexOf('export const metadata');
  if (startIdx === -1) return {};
  const braceStart = src.indexOf('{', startIdx);
  if (braceStart === -1) return {};

  let depth = 0, end = braceStart;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = src.slice(braceStart, end + 1);

  function extractBlock(source: string, key: string): string | undefined {
    const re    = new RegExp(`['"]?${key}['"]?\\s*:\\s*\\{`);
    const match = re.exec(source);
    if (!match) return undefined;
    let d = 0, i = match.index + match[0].length - 1;
    const start = i;
    for (; i < source.length; i++) {
      if (source[i] === '{') d++;
      else if (source[i] === '}') { d--; if (d === 0) return source.slice(start, i + 1); }
    }
    return undefined;
  }

  function extractArray(source: string, key: string): string | undefined {
    const re    = new RegExp(`['"]?${key}['"]?\\s*:\\s*\\[`);
    const match = re.exec(source);
    if (!match) return undefined;
    let d = 0, i = match.index + match[0].length - 1;
    const start = i;
    for (; i < source.length; i++) {
      if (source[i] === '[') d++;
      else if (source[i] === ']') { d--; if (d === 0) return source.slice(start, i + 1); }
    }
    return undefined;
  }

  function str(source: string, key: string): string | undefined {
    return source.match(
      new RegExp(`['"]?${key}['"]?\\s*:\\s*['"\`]([^'"\`\n]+)['"\`]`)
    )?.[1];
  }

  function firstArrayStr(source: string, key: string): string | undefined {
    const arr = extractArray(source, key);
    if (!arr) return undefined;
    return arr.match(/url\s*:\s*['"]([^'"]+)['"]/)?.[1]
      ?? arr.match(/['"]([^'"]+)['"]/)?.[1];
  }

  function allArrayStrs(source: string, key: string): string[] {
    const arr = extractArray(source, key);
    if (!arr) return [];
    return [...arr.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
  }

  const meta: MetaTags = {};

  if (str(block, 'title'))       meta.title       = str(block, 'title');
  if (str(block, 'description')) meta.description = str(block, 'description');
  if (str(block, 'viewport'))    meta.viewport    = str(block, 'viewport');
  if (str(block, 'themeColor'))  meta.themeColor  = str(block, 'themeColor');
  if (str(block, 'charset'))     meta.charset     = str(block, 'charset');
  if (str(block, 'robots'))      meta.robots      = str(block, 'robots');
  if (str(block, 'canonical'))   meta.canonical   = str(block, 'canonical');
  if (str(block, 'manifest'))    meta.manifest    = str(block, 'manifest');

  const kwStr = str(block, 'keywords');
  if (kwStr) {
    meta.keywords = kwStr;
  } else {
    const kwArr = allArrayStrs(block, 'keywords');
    if (kwArr.length) meta.keywords = kwArr.join(', ');
  }

  const authorStr = str(block, 'author');
  if (authorStr) {
    meta.author = authorStr;
  } else {
    const authorsArr = extractArray(block, 'authors');
    if (authorsArr) {
      const name = authorsArr.match(/name\s*:\s*['"]([^'"]+)['"]/)?.[1];
      if (name) meta.author = name;
    }
  }

  if (!meta.canonical) {
    const base = block.match(/metadataBase\s*:\s*new\s+URL\s*\(\s*['"]([^'"]+)['"]/)?.[1];
    if (base) meta.canonical = base;
  }

  const ogBlock = extractBlock(block, 'openGraph');
  if (ogBlock) {
    meta.openGraph = {
      title       : str(ogBlock, 'title'),
      description : str(ogBlock, 'description'),
      url         : str(ogBlock, 'url'),
      type        : str(ogBlock, 'type'),
      image       : firstArrayStr(ogBlock, 'images') ?? str(ogBlock, 'image'),
    };
  }

  const twBlock = extractBlock(block, 'twitter');
  if (twBlock) {
    meta.twitter = {
      card        : str(twBlock, 'card'),
      title       : str(twBlock, 'title'),
      description : str(twBlock, 'description'),
      creator     : str(twBlock, 'creator'),
      image       : firstArrayStr(twBlock, 'images') ?? str(twBlock, 'image'),
    };
  }

  const iconsBlock = extractBlock(block, 'icons');
  if (iconsBlock) {
    meta.icons = {
      icon    : collectIconEntries(iconsBlock, 'icon'),
      shortcut: collectIconEntries(iconsBlock, 'shortcut'),
      apple   : collectIconEntries(iconsBlock, 'apple'),
    };
  }

  return meta;
}

function collectIconEntries(source: string, key: string): IconEntry[] {
  const arr = extractArrayRaw(source, key);
  if (!arr) return [];
  const entries: IconEntry[] = [];
  const objRe = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(arr)) !== null) {
    const obj = m[1];
    const url = obj.match(/url\s*:\s*['"]([^'"]+)['"]/)?.[1];
    if (!url) continue;
    entries.push({
      url,
      type : obj.match(/type\s*:\s*['"]([^'"]+)['"]/)?.[1],
      sizes: obj.match(/sizes\s*:\s*['"]([^'"]+)['"]/)?.[1],
    });
  }
  if (!entries.length) {
    return [...arr.matchAll(/['"]([^'"]+)['"]/g)].map(x => ({ url: x[1] }));
  }
  return entries;
}

function extractArrayRaw(source: string, key: string): string | undefined {
  const re    = new RegExp(`['"]?${key}['"]?\\s*:\\s*\\[`);
  const match = re.exec(source);
  if (!match) return undefined;
  let d = 0, i = match.index + match[0].length - 1;
  const start = i;
  for (; i < source.length; i++) {
    if (source[i] === '[') d++;
    else if (source[i] === ']') { d--; if (d === 0) return source.slice(start, i + 1); }
  }
  return undefined;
}

// ─── API Route Scanner ────────────────────────────────────────────────────────

function scanApiRoutes(dir: string, baseRoute = ''): ApiRoute[] {
  const routes: ApiRoute[] = [];
  if (!fs.existsSync(dir)) return routes;

  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return routes; }

  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const isCatchAll = entry.name.startsWith('[...') && entry.name.endsWith(']');
      const isDynamic  = entry.name.startsWith('[') && entry.name.endsWith(']');
      const segment    = isCatchAll ? '*' : isDynamic ? `:${entry.name.slice(1, -1)}` : entry.name;
      routes.push(...scanApiRoutes(fullPath, `${baseRoute}/${segment}`));
      continue;
    }

    const ext  = path.extname(entry.name);
    const base = path.basename(entry.name, ext);
    if (!(API_EXTS as readonly string[]).includes(ext)) continue;

    const isCatchAll = base.startsWith('[...') && base.endsWith(']');
    const isDynamic  = base.startsWith('[') && base.endsWith(']');
    const routePath  = isCatchAll
      ? `${baseRoute}/*`
      : base === 'index'
        ? baseRoute || '/'
        : isDynamic
          ? `${baseRoute}/:${base.slice(1, -1)}`
          : `${baseRoute}/${base}`;

    routes.push({ routePath, filePath: fullPath });
  }

  return routes;
}

// ─── Hono dev/preview server ──────────────────────────────────────────────────

function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const patParts = pattern.split('/').filter(Boolean);
  const urlParts = pathname.split('/').filter(Boolean);

  const isCatchAll = patParts[patParts.length - 1] === '*';
  if (isCatchAll) {
    const prefix = patParts.slice(0, -1);
    if (urlParts.length < prefix.length) return null;
    for (let i = 0; i < prefix.length; i++) {
      if (prefix[i].startsWith(':')) continue;
      if (prefix[i] !== urlParts[i]) return null;
    }
    return { '*': urlParts.slice(prefix.length).join('/') };
  }

  if (patParts.length !== urlParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patParts.length; i++) {
    if (patParts[i].startsWith(':')) {
      params[patParts[i].slice(1)] = decodeURIComponent(urlParts[i]);
    } else if (patParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

const moduleCache = new Map<string, { mtime: number; handler: unknown }>();

async function importHandler(filePath: string): Promise<unknown> {
  const { pathToFileURL } = await import('url');
  let mtime = 0;
  try { mtime = fs.statSync(filePath).mtimeMs; } catch { /* file vanished */ }

  const cached = moduleCache.get(filePath);
  if (cached && cached.mtime === mtime) return cached.handler;

  const mod     = await import(pathToFileURL(filePath).href + '?t=' + mtime);
  const handler = mod.default ?? null;
  moduleCache.set(filePath, { mtime, handler });
  return handler;
}

async function handleApiRequest(
  req        : any,
  res        : any,
  next       : any,
  apiDir     : string,
  enableCors : boolean,
  getCache   : () => { routes: ApiRoute[] } | null,
  setCache   : (v: { routes: ApiRoute[] }) => void,
) {
  try {
    if (enableCors && req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.end();
      return;
    }

    let cache = getCache();
    if (!cache) {
      cache = { routes: scanApiRoutes(apiDir, '/api') };
      setCache(cache);
    }

    const host     = req.headers.host ?? 'localhost';
    const url      = `http://${host}${req.url}`;
    const pathname = new URL(url).pathname;

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const method = (req.method as string).toUpperCase();

    const webReq = new Request(url, {
      method,
      headers: req.headers as HeadersInit,
      body   : !['GET', 'HEAD'].includes(method) && body?.length ? body : undefined,
    });

    for (const route of cache.routes) {
      const handler = await importHandler(route.filePath);
      if (!handler) continue;

      let webRes: Response;
      try {
        if (typeof (handler as any).fetch === 'function') {
          webRes = await (handler as any).fetch(webReq.clone());
          if (webRes.status === 404) continue;
        } else if (typeof handler === 'function') {
          const params = matchRoute(route.routePath, pathname);
          if (params === null) continue;

          const existingHeaders: Record<string, string> = {};
          webReq.headers.forEach((v, k) => { existingHeaders[k] = v; });
          const reqWithParams = new Request(webReq.clone(), {
            headers: { ...existingHeaders, 'x-bini-params': JSON.stringify(params) },
          });

          webRes = await (handler as (...args: any[]) => Promise<Response>)(reqWithParams);
        } else {
          continue;
        }
      } catch {
        continue;
      }

      const finalHeaders: Record<string, string> = {};
      webRes.headers.forEach((v, k) => { finalHeaders[k] = v; });
      if (enableCors) {
        finalHeaders['access-control-allow-origin']  = '*';
        finalHeaders['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
        finalHeaders['access-control-allow-headers'] = 'Content-Type,Authorization';
      }

      res.statusCode = webRes.status;
      for (const [k, v] of Object.entries(finalHeaders)) res.setHeader(k, v);
      res.end(Buffer.from(await webRes.arrayBuffer()));
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `No API handler found for ${req.url}` }));
  } catch (e: any) {
    next(e);
  }
}

// ─── Production Entry Generator ───────────────────────────────────────────────

type Platform = 'netlify' | 'cloudflare' | 'node' | 'deno' | 'bun' | 'aws' | 'vercel';

interface AdapterConfig {
  pkg            ?: string;
  importLine     ?: string;
  exportLine      : string;
  outFile         : (cwd: string, ts: boolean) => string;
  stripsApiPrefix : boolean;
  denoRuntime    ?: boolean;
}

const ADAPTERS: Record<Platform, AdapterConfig> = {
  netlify: {
    importLine     : `import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts';\nimport { handle } from 'https://deno.land/x/hono@v4.3.11/adapter/netlify/index.ts';`,
    exportLine     : `export default handle(app);`,
    outFile        : (cwd) => path.join(cwd, 'netlify', 'edge-functions', 'api.ts'),
    stripsApiPrefix: false,
    denoRuntime    : true,
  },
  cloudflare: {
    exportLine     : `export default app;`,
    outFile        : (cwd, ts) => path.join(cwd, ts ? 'worker.ts' : 'worker.js'),
    stripsApiPrefix: false,
  },
  node: {
    importLine     : `import { serve } from '@hono/node-server';\nimport { serveStatic } from '@hono/node-server/serve-static';`,
    exportLine     : `app.use('/*', serveStatic({ root: './dist' }));\n\nserve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (info) => {\n  console.log(\`Server running on http://localhost:\${info.port}\`);\n});`,
    outFile        : (cwd, ts) => path.join(cwd, 'server', ts ? 'index.ts' : 'index.js'),
    stripsApiPrefix: false,
  },
  deno: {
    importLine     : `import { serve } from 'hono/deno';`,
    exportLine     : `serve({ fetch: app.fetch });`,
    outFile        : (cwd, ts) => path.join(cwd, 'server', ts ? 'index.ts' : 'index.js'),
    stripsApiPrefix: false,
  },
  bun: {
    exportLine     : `export default app;`,
    outFile        : (cwd, ts) => path.join(cwd, 'server', ts ? 'index.ts' : 'index.js'),
    stripsApiPrefix: false,
  },
  aws: {
    importLine     : `import { handle } from 'hono/aws-lambda';`,
    exportLine     : `export const handler = handle(app);`,
    outFile        : (cwd, ts) => path.join(cwd, ts ? 'handler.ts' : 'handler.js'),
    stripsApiPrefix: false,
  },

  // Vercel Edge Functions — Hono works natively via the Web standard fetch API
  // No adapter package needed — Vercel runs Hono directly.
  // ⚠️  Vercel reads api/ BEFORE the build step — you must commit this file to your repo.
  vercel: {
    // No adapter package needed — Vercel Edge Functions support Web standard fetch natively
    exportLine     : `export const config = { runtime: 'edge' };\nexport default app.fetch;`,
    outFile        : (cwd, ts) => path.join(cwd, 'api', ts ? 'index.ts' : 'index.js'),
    stripsApiPrefix: false,
  },
};

function checkAdapter(platform: Platform): void {
  const adapter = ADAPTERS[platform];
  if (!adapter.pkg) return;
  try {
    require.resolve(adapter.pkg, { paths: [process.cwd()] });
  } catch {
    console.error(`
[bini-router] ✗ Missing required package for platform '${platform}'.
  Run: npm install ${adapter.pkg}
`);
    process.exit(1);
  }
}

function resolveEntryImportPath(
  filePath   : string,
  outFile    : string,
  denoRuntime: boolean,
): string {
  const rel = norm(path.relative(path.dirname(outFile), filePath));
  if (denoRuntime) {
    const withTs = rel.replace(/\.tsx$/, '.ts');
    return withTs.startsWith('.') ? withTs : `./${withTs}`;
  }
  const stripped = rel.replace(/\.(ts|tsx|js|jsx)$/, '');
  return stripped.startsWith('.') ? stripped : `./${stripped}`;
}

function buildRouteImports(
  routes     : ApiRoute[],
  outFile    : string,
  enableCors : boolean,
  platform   : Platform,
): { imports: string[]; mountings: string[]; corsLine: string | null; corsImport: string | null } {
  const imports   : string[] = [];
  const mountings : string[] = [];
  const adapter    = ADAPTERS[platform];
  const { stripsApiPrefix, denoRuntime = false } = adapter;
  const isNetlify  = platform === 'netlify';

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const imp   = resolveEntryImportPath(route.filePath, outFile, denoRuntime);
    const name  = `_route${i}`;

    let src = '';
    try { src = fs.readFileSync(route.filePath, 'utf8'); } catch { /* skip */ }
    const isHonoApp = src.includes("from 'hono'") || src.includes('from "hono"');

    imports.push(`import ${name} from '${imp}';`);

    if (isHonoApp) {
      mountings.push(`app.route('/', ${name});`);
    } else {
      const mountPath = stripsApiPrefix ? route.routePath : `/api${route.routePath}`;
      mountings.push(`app.all('${mountPath}', async (c) => { const r = await ${name}(c.req.raw); return r instanceof Response ? r : c.json(r); });`);
    }
  }

  const corsPattern = stripsApiPrefix ? '/*' : '/api/*';
  const corsLine    = enableCors
    ? isNetlify
      ? `app.use('${corsPattern}', async (c, next) => { await next(); c.res.headers.set('Access-Control-Allow-Origin', '*'); c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS'); c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization'); if (c.req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.res.headers }); });`
      : `app.use('${corsPattern}', cors({ origin: '*', allowMethods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowHeaders: ['Content-Type','Authorization'] }));`
    : null;

  const corsImport = enableCors && !isNetlify ? `import { cors } from 'hono/cors';` : null;

  return { imports, mountings, corsLine, corsImport };
}

function buildProductionEntry(srcApiDir: string, platform: Platform, enableCors: boolean): void {
  if (!fs.existsSync(srcApiDir)) return;

  const routes = scanApiRoutes(srcApiDir);
  const cwd    = process.cwd();
  const ts     = isTypeScriptProject();

  checkAdapter(platform);

  const adapter = ADAPTERS[platform];
  const outFile = adapter.outFile(cwd, ts);

  const { imports, mountings, corsLine, corsImport } = buildRouteImports(routes, outFile, enableCors, platform);

  const isNetlify = platform === 'netlify';
  const lines = [
    `// ⚠️  Auto-generated by bini-router on every build — do not edit.`,
    `// Add routes by creating files in src/app/api/ only.`,
    ...(isNetlify ? [] : [`import { Hono } from 'hono';`]),
    ...(adapter.importLine ? adapter.importLine.split('\n') : []),
    ...(corsImport ? [corsImport] : []),
    ...imports,
    ``,
    `const app = new Hono();`,
    ...(corsLine ? [corsLine] : []),
    ...mountings,
    ``,
    ...adapter.exportLine.split('\n'),
  ];

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
  console.log(`[bini-router] ✓ Generated ${norm(path.relative(cwd, outFile))}`);

  if (platform === 'vercel') {
    console.log(`
[bini-router] ⚠️  Vercel platform detected.
  Vercel reads your api/ directory BEFORE the build step runs.
  You must commit the generated file to your repository:

    git add ${norm(path.relative(cwd, outFile))}
    git commit -m "chore: update vercel api entry"
    git push

  Without this step, Vercel will not find your API routes.
`);
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export function biniroute(options: BiniPluginOptions = {}): Plugin {
  const { cors: enableCors = true, platform } = options;

  const getAppDir = () => path.join(process.cwd(), options.appDir ?? 'src/app');
  const getApiDir = () => path.join(process.cwd(), options.apiDir ?? 'src/app/api');

  let debounceTimer    : ReturnType<typeof setTimeout> | null = null;
  let lastGeneratedCode = '';
  let honoCache        : { routes: ApiRoute[] } | null = null;
  const eventLog        = new Map<string, number>();

  function shouldProcess(file: string, event: string): boolean {
    const key = `${file}:${event}`;
    const now = Date.now();
    if (now - (eventLog.get(key) ?? 0) < EVENT_DEDUP_MS) return false;
    eventLog.set(key, now);
    for (const [k, v] of eventLog) if (now - v > EVENT_TTL_MS) eventLog.delete(k);
    return true;
  }

  function isPageFile(f: string): boolean {
    const nf   = norm(f);
    const base = path.basename(f, path.extname(f));
    const ext  = path.extname(f);
    if (!(SUPPORTED_EXTS as readonly string[]).includes(ext)) return false;
    if (!isInDir(nf, norm(getAppDir()))) return false;
    if (isInDir(nf, norm(getApiDir()))) return false;
    if (base.startsWith('_')) return false;
    return true;
  }

  function isApiFile(f: string): boolean {
    const nf = norm(f);
    return isInDir(nf, norm(getApiDir())) &&
      (API_EXTS as readonly string[]).includes(path.extname(f));
  }

  function applyApp(): string | null {
    const dir = getAppDir();
    if (!fs.existsSync(dir)) return null;
    const code = generateApp(dir);
    if (code === lastGeneratedCode) return null;
    fs.writeFileSync(getAppFile(), code, 'utf8');
    lastGeneratedCode = code;
    return code;
  }

  function scheduleRegen(server: ViteDevServer, delay = DEBOUNCE_MS) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (applyApp() !== null) {
        server.ws.send({ type: 'full-reload', path: '*' });
      }
    }, delay);
  }

  function addSpaFallback(server: { middlewares: any }) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = req.url as string;
      if (url.startsWith('/api') || url.includes('.')) return next();
      req.url = '/index.html';
      next();
    });
  }

  return {
    name   : 'bini-router',
    enforce: 'pre',

    transform(code, id) {
      const nid = norm(id);

      // Only process files inside src/app/ — skip api routes and generated App.tsx
      if (!isInDir(nid, norm(getAppDir()))) return;
      if (isInDir(nid, norm(getApiDir()))) return;

      const ext = path.extname(id);
      if (!(SUPPORTED_EXTS as readonly string[]).includes(ext)) return;

      // Skip the generated App.tsx itself
      if (norm(id) === norm(getAppFile())) return;

      let result = code;

      // ── 1. Strip export const metadata ──────────────────────────────────────
      if (result.includes('export const metadata')) {
        let idx = result.indexOf('export const metadata');
        while (idx !== -1) {
          const braceIdx = result.indexOf('{', idx);
          if (braceIdx === -1) break;

          let depth = 0, end = braceIdx;
          for (let i = braceIdx; i < result.length; i++) {
            if (result[i] === '{')      depth++;
            else if (result[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
          }

          let tail = end + 1;
          while (tail < result.length && (result[tail] === ' ' || result[tail] === '\t')) tail++;
          if (tail < result.length && result[tail] === ';') tail++;
          while (tail < result.length && (result[tail] === '\n' || result[tail] === '\r')) tail++;

          result = result.slice(0, idx) + result.slice(tail);
          idx    = result.indexOf('export const metadata', idx);
        }
      }

      // ── 2. Auto-import injection ─────────────────────────────────────────────
      // Check what the file already imports so we don't duplicate
      const alreadyImportsRouter = result.includes("from 'react-router-dom'") || result.includes('from "react-router-dom"');
      const alreadyImportsReact  = result.includes("from 'react'") || result.includes('from "react"');
      const alreadyImportsEnv    = result.includes("from 'bini-env'") || result.includes('from "bini-env"');

      // Exports to auto-inject per package
      const ROUTER_EXPORTS = ['Link', 'NavLink', 'useNavigate', 'useParams', 'useLocation', 'useSearchParams', 'Outlet'];
      const REACT_EXPORTS  = ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'createContext', 'useReducer', 'useId', 'useTransition', 'useDeferredValue'];
      const ENV_EXPORTS    = ['getEnv', 'requireEnv'];

      const usedRouter = !alreadyImportsRouter
        ? ROUTER_EXPORTS.filter(name => new RegExp(`\\b${name}\\b`).test(result))
        : [];
      const usedReact = !alreadyImportsReact
        ? REACT_EXPORTS.filter(name => new RegExp(`\\b${name}\\b`).test(result))
        : [];
      const usedEnv = !alreadyImportsEnv
        ? ENV_EXPORTS.filter(name => new RegExp(`\\b${name}\\b`).test(result))
        : [];

      const injected: string[] = [];
      if (usedRouter.length) injected.push(`import { ${usedRouter.join(', ')} } from 'react-router-dom';`);
      if (usedReact.length)  injected.push(`import { ${usedReact.join(', ')} } from 'react';`);
      if (usedEnv.length)    injected.push(`import { ${usedEnv.join(', ')} } from 'bini-env';`);

      if (injected.length > 0) {
        result = injected.join('\n') + '\n' + result;
      }

      // Return only if we actually changed something
      if (result === code) return;

      return { code: result, map: null, moduleType: 'js' as const };
    },

    config()     { applyApp(); },
    buildStart() { applyApp(); },

    closeBundle() {
      if (platform) buildProductionEntry(getApiDir(), platform, enableCors);
    },

    buildEnd() {
      honoCache = null;
      moduleCache.clear();
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    },

    async configureServer(server) {
      const appDir = getAppDir();
      const apiDir = getApiDir();

      if (!fs.existsSync(appDir)) return;

      // Auto-load .env for all API routes via bini-env — no manual dotenv needed
      server.httpServer?.once('listening', () => {
        void loadEnv(process.cwd());
      });
      // Middleware mode fallback (httpServer is null in some setups)
      if (!server.httpServer) {
        void loadEnv(process.cwd());
      }

      server.watcher.add(appDir);

      server.watcher.on('add',    f => isPageFile(f) && shouldProcess(f, 'add')    && scheduleRegen(server, 300));
      server.watcher.on('unlink', f => isPageFile(f) && shouldProcess(f, 'unlink') && scheduleRegen(server));
      server.watcher.on('change', f => isPageFile(f) && shouldProcess(f, 'change') && scheduleRegen(server));

      server.watcher.on('change', f => {
        const base      = path.basename(f, path.extname(f));
        const inAppRoot = path.resolve(path.dirname(f)) === path.resolve(appDir);
        if (!inAppRoot || base !== 'layout') return;
        server.moduleGraph.invalidateAll();
        server.ws.send({ type: 'full-reload', path: '*' });
      });

      server.watcher.on('addDir', d => {
        const nd = norm(d);
        if (!isInDir(nd, norm(appDir)) || d.includes('node_modules') || isInDir(nd, norm(apiDir))) return;
        server.watcher.add(d);
        setTimeout(() => PAGE_FILES.some(f => fs.existsSync(path.join(d, f))) && scheduleRegen(server), 300);
      });

      server.watcher.on('unlinkDir', d => {
        const nd = norm(d);
        if (isInDir(nd, norm(appDir)) && !d.includes('node_modules') && !isInDir(nd, norm(apiDir)))
          scheduleRegen(server);
      });

      if (fs.existsSync(apiDir)) {
        server.watcher.add(apiDir);

        const resetApi = (f?: string) => {
          honoCache = null;
          if (f) moduleCache.delete(f);
          server.ws.send({ type: 'full-reload', path: '*' });
        };

        server.watcher.on('add',    f => isApiFile(f) && resetApi(f));
        server.watcher.on('unlink', f => isApiFile(f) && resetApi(f));
        server.watcher.on('change', f => isApiFile(f) && resetApi(f));

        server.middlewares.use((req: any, res: any, next: any) => {
          if (!req.url?.startsWith('/api')) return next();
          handleApiRequest(req, res, next, apiDir, enableCors,
            () => honoCache, (v) => { honoCache = v; });
        });
      }
    },

    async configurePreviewServer(server) {
      // Load .env for API routes in preview mode — same as dev
      server.httpServer?.once('listening', () => {
        void loadEnv(process.cwd());
      });
      if (!server.httpServer) {
        void loadEnv(process.cwd());
      }

      // API routes must come BEFORE the SPA fallback
      const apiDir = getApiDir();
      if (fs.existsSync(apiDir)) {
        server.middlewares.use((req: any, res: any, next: any) => {
          if (!req.url?.startsWith('/api')) return next();
          handleApiRequest(req, res, next, apiDir, enableCors,
            () => honoCache, (v) => { honoCache = v; });
        });
      }

      // SPA fallback after API — non-file, non-api requests → index.html
      addSpaFallback(server);
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const meta = parseAppMetadata(getAppDir());

        if (!meta.title && !meta.description && !meta.canonical && !meta.manifest &&
            !meta.openGraph?.title && !meta.icons?.icon?.length) {
          return html;
        }

        const title = meta.title    ?? 'Bini App';
        const vp    = meta.viewport ?? 'width=device-width, initial-scale=1.0';

        const lines: string[] = [];

        lines.push(`<meta charset="${meta.charset ?? 'UTF-8'}" />`);
        lines.push(`<meta name="viewport" content="${vp}" />`);
        lines.push(`<title>${title}</title>`);
        if (meta.description) lines.push(`<meta name="description" content="${meta.description}" />`);
        if (meta.themeColor)  lines.push(`<meta name="theme-color" content="${meta.themeColor}" />`);
        if (meta.robots)      lines.push(`<meta name="robots" content="${meta.robots}" />`);
        if (meta.keywords)    lines.push(`<meta name="keywords" content="${meta.keywords}" />`);
        if (meta.author)      lines.push(`<meta name="author" content="${meta.author}" />`);
        if (meta.canonical)   lines.push(`<link rel="canonical" href="${meta.canonical}" />`);
        if (meta.manifest)    lines.push(`<link rel="manifest" href="${meta.manifest}" />`);

        for (const entry of meta.icons?.icon ?? []) {
          const type  = entry.type  ? ` type="${entry.type}"`   : '';
          const sizes = entry.sizes ? ` sizes="${entry.sizes}"` : '';
          lines.push(`<link rel="icon" href="${entry.url}"${type}${sizes} />`);
        }
        for (const entry of meta.icons?.shortcut ?? []) {
          lines.push(`<link rel="shortcut icon" href="${entry.url}" />`);
        }
        for (const entry of meta.icons?.apple ?? []) {
          const sizes = entry.sizes ? ` sizes="${entry.sizes}"` : '';
          const type  = entry.type  ? ` type="${entry.type}"`   : '';
          lines.push(`<link rel="apple-touch-icon" href="${entry.url}"${sizes}${type} />`);
        }

        if (meta.openGraph?.title) {
          lines.push(`<meta property="og:type"        content="${meta.openGraph.type ?? 'website'}" />`);
          lines.push(`<meta property="og:title"       content="${meta.openGraph.title}" />`);
          if (meta.openGraph.description) lines.push(`<meta property="og:description" content="${meta.openGraph.description}" />`);
          if (meta.openGraph.url)         lines.push(`<meta property="og:url"         content="${meta.openGraph.url}" />`);
          if (meta.openGraph.image)       lines.push(`<meta property="og:image"       content="${meta.openGraph.image}" />`);
        }

        if (meta.twitter?.title) {
          lines.push(`<meta name="twitter:card"        content="${meta.twitter.card ?? 'summary_large_image'}" />`);
          lines.push(`<meta name="twitter:title"       content="${meta.twitter.title}" />`);
          if (meta.twitter.description) lines.push(`<meta name="twitter:description" content="${meta.twitter.description}" />`);
          if (meta.twitter.creator)     lines.push(`<meta name="twitter:creator"     content="${meta.twitter.creator}" />`);
          if (meta.twitter.image)       lines.push(`<meta name="twitter:image"       content="${meta.twitter.image}" />`);
        }

        const injected = lines.map(l => `    ${l}`).join('\n');
        return html.replace('</head>', `${injected}\n  </head>`);
      },
    },
  };
}