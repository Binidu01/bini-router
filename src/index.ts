/// <reference types="vite/client" />

import fs from 'fs';
import path from 'path';
import type { Plugin, ViteDevServer } from 'vite';
import { loadEnv } from 'bini-env';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_FILES = ['page.tsx', 'page.jsx', 'page.ts', 'page.js'] as const;
const LAYOUT_FILES = ['layout.tsx', 'layout.jsx', 'layout.ts', 'layout.js'] as const;
const SUPPORTED_EXTS = ['.tsx', '.jsx', '.ts', '.js'] as const;
const NOT_FOUND_FILES = SUPPORTED_EXTS.map(e => `not-found${e}`);
const LOADING_FILES = SUPPORTED_EXTS.map(e => `loading${e}`);
const SPECIAL_BASES = new Set(['page', 'layout', 'not-found', 'loading', 'error']);
const API_EXTS = ['.ts', '.js'] as const;
const DEBOUNCE_MS = 60;
const EVENT_DEDUP_MS = 500;
const EVENT_TTL_MS = 2000;
const MAX_DEPTH = 100;

// ─── Security Constants ───────────────────────────────────────────────────────

const ALLOWED_ROUTE_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_PARAM_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MAX_ROUTE_SEGMENT_LENGTH = 100;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Metadata Types ───────────────────────────────────────────────────────────

export interface IconEntry {
  url: string;
  type?: string;
  sizes?: string;
}

export interface MetaTags {
  title?: string;
  description?: string;
  viewport?: string;
  themeColor?: string;
  keywords?: string;
  author?: string;
  charset?: string;
  robots?: string;
  canonical?: string;
  manifest?: string;
  openGraph?: Partial<OGMeta>;
  twitter?: Partial<TwitterMeta>;
  icons?: {
    icon?: IconEntry[];
    shortcut?: IconEntry[];
    apple?: IconEntry[];
  };
}

interface OGMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  type: string;
}

interface TwitterMeta {
  card: string;
  title: string;
  description: string;
  creator: string;
  image: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteNode {
  routePath: string;
  filePath: string;
  layouts: string[];
  dynamic: boolean;
}

interface LayoutChainGroup {
  layouts: string[];
  routes: RouteNode[];
}

interface ApiRoute {
  routePath: string;
  filePath: string;
}

interface RouteConflict {
  path: string;
  files: string[];
}

export type Platform = 'netlify' | 'cloudflare' | 'deno' | 'vercel' | 'node';

export interface BiniPluginOptions {
  appDir?: string;
  apiDir?: string;
  cors?: boolean;
  platform?: Platform;
  strictMode?: boolean;
  basePath?: string;
}

// ─── Type Guard ───────────────────────────────────────────────────────────────

function isNonNodePlatform(platform: Platform): platform is Exclude<Platform, 'node'> {
  return platform !== 'node';
}

// ─── Built-in Default Components (injected only when needed) ─────────────────

const DEFAULT_LOADING_COMPONENT = `
// Built-in Bini Router Loading Component
// Override by creating src/app/loading.tsx
function Spinner() {
  const [isDark, setIsDark] = React.useState(false);
  
  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(isDarkMode);
    
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);
  
  const styles = {
    root: {
      margin: 0,
      padding: 0,
      minHeight: '100vh',
      width: '100%',
    },
    container: {
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#000000' : '#ffffff',
      margin: 0,
      padding: 0,
    },
    spinnerWrapper: {
      position: 'relative' as const,
      width: '3rem',
      height: '3rem',
    },
    outerRing: {
      position: 'absolute' as const,
      inset: 0,
      borderRadius: '9999px',
      border: '4px solid',
      borderColor: isDark ? '#262626' : '#e5e5e5',
    },
    spinningRing: {
      position: 'absolute' as const,
      inset: 0,
      borderRadius: '9999px',
      border: '4px solid',
      borderTopColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: '#06b6d4',
      animation: 'spin 0.8s linear infinite',
    },
  };
  
  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <div style={styles.spinnerWrapper}>
          <div style={styles.outerRing} />
          <div style={styles.spinningRing} />
        </div>
      </div>
      <style>{\`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      \`}</style>
    </div>
  );
}`;

const DEFAULT_404_COMPONENT = `
// Built-in Bini Router 404 Page
// Override by creating src/app/not-found.tsx
function Default404() {
  const [isDark, setIsDark] = React.useState(false);
  
  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(isDarkMode);
    
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);
  
  const styles = {
    root: {
      margin: 0,
      padding: 0,
      minHeight: '100vh',
      width: '100%',
    },
    container: {
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center' as const,
      padding: '2rem',
      backgroundColor: isDark ? '#000000' : '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      margin: 0,
    },
    wrapper: {
      maxWidth: '42rem',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '1.5rem',
    },
    number: {
      fontSize: '8rem',
      fontWeight: 'bold',
      lineHeight: 1,
      letterSpacing: '-0.025em',
      background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: isDark ? '#ffffff' : '#000000',
    },
    message: {
      color: isDark ? '#a3a3a3' : '#737373',
      maxWidth: '28rem',
      margin: '0 auto',
    },
    button: {
      display: 'inline-block',
      padding: '0.75rem 2rem',
      borderRadius: '0.5rem',
      background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      color: 'white',
      textDecoration: 'none',
      fontSize: '0.875rem',
      fontWeight: 500,
      transition: 'opacity 0.2s',
      cursor: 'pointer',
      border: 'none',
    }
  };
  
  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <div style={styles.wrapper}>
          <div style={styles.number}>404</div>
          <h1 style={styles.title}>Page not found</h1>
          <p style={styles.message}>
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div>
            <a href="/" style={styles.button}>
              ← Back to home
            </a>
          </div>
        </div>
      </div>
      <style>{\`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        a { text-decoration: none; }
      \`}</style>
    </div>
  );
}`;

// ─── Custom Error Classes ─────────────────────────────────────────────────────

class RouteConflictError extends Error {
  constructor(public conflicts: RouteConflict[]) {
    super(`Route conflicts detected:\n${conflicts.map(c => `  ${c.path}: ${c.files.join(', ')}`).join('\n')}`);
    this.name = 'RouteConflictError';
  }
}

class CircularLayoutError extends Error {
  constructor(public chain: string[]) {
    super(`Circular layout dependency detected: ${chain.join(' -> ')}`);
    this.name = 'CircularLayoutError';
  }
}

// ─── Vite Logger Helpers ─────────────────────────────────────────────────────

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function viteLog(filePath: string): void {
  const time = new Date().toLocaleTimeString();
  const relativePath = toPosixPath(path.relative(process.cwd(), filePath));
  console.log(`\x1b[90m${time}\x1b[0m \x1b[36m[vite]\x1b[0m \x1b[90m(client)\x1b[0m \x1b[32mhmr update\x1b[0m \x1b[90m${relativePath}\x1b[0m`);
}

function viteErrorLog(message: string): void {
  const time = new Date().toLocaleTimeString();
  console.error(`\x1b[90m${time}\x1b[0m \x1b[31m[vite]\x1b[0m \x1b[31m${message}\x1b[0m`);
}

function viteWarnLog(message: string): void {
  const time = new Date().toLocaleTimeString();
  console.warn(`\x1b[90m${time}\x1b[0m \x1b[33m[vite]\x1b[0m \x1b[33m${message}\x1b[0m`);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function norm(p: string): string {
  return p.replace(/\\/g, '/');
}

function isInDir(file: string, dir: string): boolean {
  const nFile = norm(file);
  const nDir = norm(dir).replace(/\/$/, '');
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
    
    const tsconfig = JSON.parse(raw);
    const paths = tsconfig?.compilerOptions?.paths ?? {};
    const baseUrl = tsconfig?.compilerOptions?.baseUrl ?? '.';
    
    for (const [alias, targets] of Object.entries(paths) as [string, string[]][]) {
      const cleanAlias = alias.replace(/\/\*$/, '');
      const cleanTarget = (targets[0] ?? '').replace(/\/\*$/, '');
      aliases[cleanAlias] = path.resolve(process.cwd(), baseUrl, cleanTarget);
    }
  } catch (error) {
    viteWarnLog('Failed to read tsconfig.json');
  }
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
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) return false;
    
    const content = fs.readFileSync(filePath, 'utf8');
    return /export\s+default\s+/.test(content) || /export\s*{\s*\w+\s+as\s+default\s*}/.test(content);
  } catch {
    return false;
  }
}

function isHtmlShellLayout(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) return false;
    
    const content = fs.readFileSync(filePath, 'utf8');
    return /<html[\s>]/i.test(content);
  } catch {
    return false;
  }
}

function isUsableLayout(filePath: string): boolean {
  return hasDefaultExport(filePath) && !isHtmlShellLayout(filePath);
}

function findFile(dir: string, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    const fullPath = path.join(dir, candidate);
    if (fs.existsSync(fullPath)) return candidate;
  }
  return null;
}

function isTypeScriptProject(): boolean {
  const cwd = process.cwd();

  const mainEntries = ['src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/main.js'];
  for (const entry of mainEntries) {
    if (fs.existsSync(path.join(cwd, entry))) {
      return entry.includes('.ts');
    }
  }

  if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) return true;

  const appDir = path.join(cwd, 'src/app');
  if (fs.existsSync(appDir)) {
    const hasTsFile = (dir: string, depth = 0): boolean => {
      if (depth > 5) return false;
      
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return false;
      }
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (hasTsFile(path.join(dir, entry.name), depth + 1)) return true;
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
  const tsPath = path.join(process.cwd(), 'src/App.tsx');
  const jsxPath = path.join(process.cwd(), 'src/App.jsx');
  
  if (fs.existsSync(tsPath)) return tsPath;
  if (fs.existsSync(jsxPath)) return jsxPath;
  
  return isTypeScriptProject() ? tsPath : jsxPath;
}

function resolveLayoutChain(pageDir: string, appDir: string): string[] {
  const chain: string[] = [];
  let current = pageDir;
  const visited = new Set<string>();
  
  while (true) {
    if (visited.has(current)) {
      throw new CircularLayoutError([...visited, current]);
    }
    visited.add(current);
    
    const layout = findFile(current, LAYOUT_FILES);
    if (layout) chain.unshift(path.join(current, layout));
    
    if (path.resolve(current) === path.resolve(appDir)) break;
    
    const parent = path.dirname(current);
    if (parent === current || chain.length > MAX_DEPTH) break;
    current = parent;
  }
  
  return chain;
}

function isValidRouteSegment(segment: string): boolean {
  if (!segment || segment.length === 0) return false;
  if (segment.length > MAX_ROUTE_SEGMENT_LENGTH) return false;
  if (segment.includes('..') || segment.includes('//')) return false;
  return ALLOWED_ROUTE_PATTERN.test(segment);
}

function isValidParamName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.length > MAX_ROUTE_SEGMENT_LENGTH) return false;
  return ALLOWED_PARAM_PATTERN.test(name);
}

function normalizeRoutePath(routePath: string, basePath: string = ''): string {
  let normalized = routePath.replace(/\/+/g, '/');
  if (normalized === '') return basePath || '/';
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  if (normalized.endsWith('/') && normalized !== '/') normalized = normalized.slice(0, -1);
  
  if (basePath && basePath !== '/') {
    const cleanBasePath = basePath.replace(/\/$/, '');
    normalized = cleanBasePath + normalized;
  }
  
  return normalized;
}

function scanRoutes(dir: string, appDir: string, baseRoute = '', basePath: string = '', depth = 0): RouteNode[] {
  if (depth > MAX_DEPTH) {
    viteWarnLog(`Maximum directory depth reached at ${dir}`);
    return [];
  }
  
  const routes: RouteNode[] = [];
  if (!fs.existsSync(dir)) return routes;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    viteErrorLog(`Failed to read directory ${dir}`);
    return routes;
  }

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    
    const ext = path.extname(entry.name);
    const base = path.basename(entry.name, ext);
    
    if (!(SUPPORTED_EXTS as readonly string[]).includes(ext)) continue;
    if (SPECIAL_BASES.has(base)) continue;
    
    if (!isValidRouteSegment(base)) {
      viteWarnLog(`Invalid route segment name: ${base} in ${dir}`);
      continue;
    }
    
    if (base.length > MAX_ROUTE_SEGMENT_LENGTH) {
      viteWarnLog(`Route segment too long: ${base}`);
      continue;
    }
    
    const rawPath = `${baseRoute}/${base}`;
    const routePath = normalizeRoutePath(rawPath, basePath);
    
    routes.push({
      routePath,
      filePath: path.join(dir, entry.name),
      layouts: resolveLayoutChain(dir, appDir),
      dynamic: false,
    });
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'api') continue;

    const fullPath = path.join(dir, entry.name);
    const isDynamic = entry.name.startsWith('[') && entry.name.endsWith(']');
    const isCatchAll = entry.name.startsWith('[...') && entry.name.endsWith(']');
    
    let segment: string;
    if (isCatchAll) {
      segment = '*';
    } else if (isDynamic) {
      const paramName = entry.name.slice(1, -1);
      if (!isValidParamName(paramName)) {
        viteWarnLog(`Invalid parameter name: ${paramName} in ${dir}`);
        continue;
      }
      segment = `:${paramName}`;
    } else {
      if (!isValidRouteSegment(entry.name)) {
        viteWarnLog(`Invalid directory name: ${entry.name} in ${dir}`);
        continue;
      }
      segment = entry.name;
    }
    
    const rawPath = `${baseRoute}/${segment}`;
    const routePath = normalizeRoutePath(rawPath, basePath);
    const pageFile = findFile(fullPath, PAGE_FILES);
    
    if (pageFile) {
      const fullFilePath = path.join(fullPath, pageFile);
      routes.push({
        routePath,
        filePath: fullFilePath,
        layouts: resolveLayoutChain(fullPath, appDir),
        dynamic: isDynamic || isCatchAll,
      });
    }
    
    routes.push(...scanRoutes(fullPath, appDir, rawPath, basePath, depth + 1));
  }

  return routes;
}

function detectRouteConflicts(routes: RouteNode[]): RouteConflict[] {
  const routeMap = new Map<string, string[]>();
  
  for (const route of routes) {
    const existing = routeMap.get(route.routePath) || [];
    existing.push(route.filePath);
    routeMap.set(route.routePath, existing);
  }
  
  const conflicts: RouteConflict[] = [];
  for (const [path, files] of routeMap) {
    if (files.length > 1) {
      conflicts.push({ path, files });
    }
  }
  
  return conflicts;
}

function deduplicateRoutes(routes: RouteNode[]): RouteNode[] {
  const seen = new Map<string, RouteNode>();
  
  for (const route of routes) {
    const existing = seen.get(route.routePath);
    if (!existing) {
      seen.set(route.routePath, route);
    } else if (existing.filePath !== route.filePath) {
      if (route.layouts.length > existing.layouts.length) {
        seen.set(route.routePath, route);
      }
    }
  }
  
  return Array.from(seen.values());
}

function parseLayoutTitle(layoutFile: string): string | null {
  try {
    const stats = fs.statSync(layoutFile);
    if (stats.size > MAX_FILE_SIZE) return null;
    
    const src = fs.readFileSync(layoutFile, 'utf8');
    const metadataRegex = /export\s+const\s+metadata\s*=\s*({[\s\S]*?})(?=\n\s*export|\n\s*$)/;
    const match = src.match(metadataRegex);
    if (!match) return null;
    
    try {
      const titleRegex = /['"]?title['"]?\s*:\s*['"`]([^'"`]+)['"`]/;
      const titleMatch = match[1].match(titleRegex);
      return titleMatch ? titleMatch[1] : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function renderChain(
  layouts: string[],
  routesInChain: RouteNode[],
  layoutNames: Map<string, string>,
  pageNames: Map<string, string>,
  layoutTitles: Map<string, string>,
  indent: number,
  fallback: string,
): string {
  const pad = ' '.repeat(indent);
  
  if (layouts.length === 0) {
    return routesInChain.map(r => {
      const pageName = pageNames.get(r.filePath);
      if (!pageName) {
        throw new Error(`Page name not found for ${r.filePath}`);
      }
      return `${pad}<Route path="${r.routePath}" element={<Suspense fallback={<${fallback} />}><ErrorBoundary><${pageName} /></ErrorBoundary></Suspense>} />`;
    }).join('\n');
  }
  
  const [head, ...tail] = layouts;
  const title = layoutTitles.get(head);
  const titleSetter = title ? `<TitleSetter title={${JSON.stringify(title)}} />` : '';
  const inner = renderChain(tail, routesInChain, layoutNames, pageNames, layoutTitles, indent + 2, fallback);
  const name = layoutNames.get(head);
  
  if (!name) {
    throw new Error(`Layout name not found for ${head}`);
  }
  
  return [
    `${pad}<Route element={<>${titleSetter}<Suspense fallback={<${fallback} />}><ErrorBoundary><${name}><Outlet /></${name}></ErrorBoundary></Suspense></>}>`,
    inner,
    `${pad}</Route>`,
  ].join('\n');
}

function renderComponentWithLayouts(
  componentName: string,
  layouts: string[],
  layoutNames: Map<string, string>,
  layoutTitles: Map<string, string>,
  indent: number,
  fallback: string,
): string {
  const pad = ' '.repeat(indent);
  
  if (layouts.length === 0) {
    return `${pad}<Suspense fallback={<${fallback} />}><ErrorBoundary>${componentName}</ErrorBoundary></Suspense>`;
  }
  
  const [head, ...tail] = layouts;
  const title = layoutTitles.get(head);
  const titleSetter = title ? `<TitleSetter title={${JSON.stringify(title)}} />` : '';
  const name = layoutNames.get(head);
  const inner = renderComponentWithLayouts(componentName, tail, layoutNames, layoutTitles, indent + 2, fallback);
  
  if (!name) return inner;
  
  return `${pad}<>${titleSetter}<${name}>${inner}</${name}></>`;
}

function generateErrorBoundary(ts: boolean): string {
  return ts ? `
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      window.dispatchEvent(new CustomEvent('__bini_error__', {
        detail: { name: error.name, message: error.message, stack: error.stack, componentStack: errorInfo.componentStack, _type: 'runtime' }
      }));
    }
  }
  override render() {
    if (this.state.error) {
      if (import.meta.env.DEV) return null;
      return (
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
    }
    return this.props.children;
  }
}` : `
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      window.dispatchEvent(new CustomEvent('__bini_error__', {
        detail: { name: error.name, message: error.message, stack: error.stack, componentStack: errorInfo.componentStack, _type: 'runtime' }
      }));
    }
  }
  render() {
    if (this.state.error) {
      if (import.meta.env.DEV) return null;
      return (
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
    }
    return this.props.children;
  }
}`;
}

function generateTitleSetter(ts: boolean): string {
  return ts ? `
function TitleSetter({ title }: { title: string }) {
  React.useEffect(() => { document.title = title; }, [title]);
  return null;
}` : `
function TitleSetter({ title }) {
  React.useEffect(() => { document.title = title; }, [title]);
  return null;
}`;
}

function generateApp(appDir: string, basePath: string = '', strictMode = false): string {
  const aliases = readTsconfigAliases();
  let routes = scanRoutes(appDir, appDir, '', basePath);
  const ts = isTypeScriptProject();

  const rootPage = findFile(appDir, PAGE_FILES);
  if (rootPage) {
    const rootRoutePath = normalizeRoutePath('/', basePath);
    routes.unshift({
      routePath: rootRoutePath,
      filePath: path.join(appDir, rootPage),
      layouts: resolveLayoutChain(appDir, appDir),
      dynamic: false,
    });
  }

  const routesFiltered = routes.map(r => ({
    ...r,
    layouts: r.layouts.filter(l => isUsableLayout(l)),
  }));

  let validRoutes = deduplicateRoutes(
    routesFiltered.filter(r => hasDefaultExport(r.filePath))
  );

  const conflicts = detectRouteConflicts(validRoutes);
  if (conflicts.length > 0) {
    if (strictMode) {
      throw new RouteConflictError(conflicts);
    } else {
      viteWarnLog(`Route conflicts detected: ${JSON.stringify(conflicts)}`);
      validRoutes = deduplicateRoutes(validRoutes);
    }
  }

  validRoutes.sort((a, b) => {
    if (a.dynamic !== b.dynamic) return a.dynamic ? 1 : -1;
    if (a.routePath.includes('*') !== b.routePath.includes('*')) {
      return a.routePath.includes('*') ? 1 : -1;
    }
    return a.routePath.length - b.routePath.length;
  });

  const notFoundFile = NOT_FOUND_FILES.find(f => fs.existsSync(path.join(appDir, f)));
  const hasCustomNotFound = notFoundFile && hasDefaultExport(path.join(appDir, notFoundFile));
  
  const loadingFile = LOADING_FILES.find(f => fs.existsSync(path.join(appDir, f)));
  const hasCustomLoading = loadingFile && hasDefaultExport(path.join(appDir, loadingFile));

  const allLayouts = new Set<string>();
  for (const r of validRoutes) {
    r.layouts.forEach(l => {
      if (isUsableLayout(l)) allLayouts.add(l);
    });
  }

  const layoutNames = new Map<string, string>();
  const pageNames = new Map<string, string>();
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
  const importedModules = new Set<string>();
  
  for (const [fp, name] of layoutNames) {
    const importPath = toImportPath(fp, aliases);
    if (!importedModules.has(importPath)) {
      lazyImports.push(`const ${name} = React.lazy(() => import('${importPath}'));`);
      importedModules.add(importPath);
    }
  }
  
  const rootLayoutChain = resolveLayoutChain(appDir, appDir).filter(l => isUsableLayout(l));
  
  if (hasCustomNotFound && notFoundFile) {
    const importPath = toImportPath(path.join(appDir, notFoundFile), aliases);
    if (!importedModules.has(importPath)) {
      lazyImports.push(`const NotFound = React.lazy(() => import('${importPath}'));`);
      importedModules.add(importPath);
    }
  }
  
  if (hasCustomLoading && loadingFile) {
    const importPath = toImportPath(path.join(appDir, loadingFile), aliases);
    if (!importedModules.has(importPath)) {
      lazyImports.push(`const Loading = React.lazy(() => import('${importPath}'));`);
      importedModules.add(importPath);
    }
  }
  
  const emittedPages = new Set<string>();
  for (const r of validRoutes) {
    if (emittedPages.has(r.filePath)) continue;
    emittedPages.add(r.filePath);
    const name = pageNames.get(r.filePath);
    if (!name) continue;
    const importPath = toImportPath(r.filePath, aliases);
    if (!importedModules.has(importPath)) {
      lazyImports.push(`const ${name} = React.lazy(() => import('${importPath}'));`);
      importedModules.add(importPath);
    }
  }

  const chainMap = new Map<string, LayoutChainGroup>();
  for (const r of validRoutes) {
    const key = r.layouts.join('|');
    if (!chainMap.has(key)) {
      chainMap.set(key, { layouts: r.layouts, routes: [] });
    }
    const group = chainMap.get(key);
    if (group) {
      group.routes.push(r);
    }
  }

  const routeLines: string[] = [];
  const fallbackComponent = hasCustomLoading ? 'Loading' : 'Spinner';

  for (const [, { layouts, routes: cr }] of chainMap) {
    routeLines.push(renderChain(layouts, cr, layoutNames, pageNames, layoutTitles, 8, fallbackComponent));
  }

  let catchAllRoute: string;
  if (hasCustomNotFound) {
    const wrappedNotFound = renderComponentWithLayouts(
      '<NotFound />',
      rootLayoutChain,
      layoutNames,
      layoutTitles,
      10,
      fallbackComponent
    );
    catchAllRoute = `        <Route path="*" element={${wrappedNotFound}} />`;
  } else {
    catchAllRoute = `        <Route path="*" element={<Default404 />} />`;
  }

  const errorBoundaryClass = generateErrorBoundary(ts);
  const titleSetterFn = generateTitleSetter(ts);
  const spinnerFn = !hasCustomLoading ? DEFAULT_LOADING_COMPONENT : '';

  const basenameValue = basePath || (import.meta as any).env?.BASE_URL || '/';

  return `// ⚠️  Auto-generated by bini-router — do not edit.

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';

${lazyImports.join('\n')}

// ─── Error Boundary ───────────────────────────────────────────────────────────
${errorBoundaryClass}

${spinnerFn}

${titleSetterFn}

${!hasCustomNotFound ? DEFAULT_404_COMPONENT : ''}

export default function App() {
  return (
    <BrowserRouter basename={${JSON.stringify(basenameValue)}}>
      <Routes>
${routeLines.join('\n')}
${catchAllRoute}
      </Routes>
    </BrowserRouter>
  );
}
`;
}

// ─── Metadata Parser ─────────────────────────────────────────────────────────

function parseAppMetadata(appDir: string): MetaTags {
  const layout = findFile(appDir, LAYOUT_FILES);
  if (!layout) return {};
  
  try {
    const layoutPath = path.join(appDir, layout);
    const stats = fs.statSync(layoutPath);
    if (stats.size > MAX_FILE_SIZE) return {};
    
    const src = fs.readFileSync(layoutPath, 'utf8');
    const metadataRegex = /export\s+const\s+metadata\s*=\s*({[\s\S]*?})(?=\n\s*export|\n\s*$)/;
    const match = src.match(metadataRegex);
    if (!match) return {};
    
    const metadataStr = match[1];
    return parseMetadataString(metadataStr);
  } catch (error) {
    viteErrorLog(`Failed to parse metadata: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function parseMetadataString(metadataStr: string): MetaTags {
  const meta: MetaTags = {};
  
  const stringFields = ['title', 'description', 'viewport', 'themeColor', 'charset', 'robots', 'canonical', 'manifest'];
  for (const field of stringFields) {
    const value = extractStringValue(metadataStr, field);
    if (value) (meta as any)[field] = escapeHtml(value);
  }
  
  const keywords = extractKeywords(metadataStr);
  if (keywords) meta.keywords = escapeHtml(keywords);
  
  const author = extractAuthor(metadataStr);
  if (author) meta.author = escapeHtml(author);
  
  const openGraph = extractOpenGraph(metadataStr);
  if (openGraph && Object.keys(openGraph).length > 0) meta.openGraph = openGraph;
  
  const twitter = extractTwitter(metadataStr);
  if (twitter && Object.keys(twitter).length > 0) meta.twitter = twitter;
  
  const icons = extractIcons(metadataStr);
  if (icons && Object.keys(icons).length > 0) meta.icons = icons;
  
  return meta;
}

function extractStringValue(str: string, key: string): string | undefined {
  const regex = new RegExp(`['"]?${key}['"]?\\s*:\\s*['"\`]([^'"\`]+)['"\`]`);
  const match = str.match(regex);
  return match?.[1];
}

function extractKeywords(str: string): string | undefined {
  let keywords = extractStringValue(str, 'keywords');
  if (keywords) return keywords;
  
  const arrayRegex = /['"]?keywords['"]?\s*:\s*\[([^\]]+)\]/;
  const match = str.match(arrayRegex);
  if (match) {
    const items = match[1].split(',').map(item => 
      item.trim().replace(/^['"`]|['"`]$/g, '')
    );
    return items.join(', ');
  }
  
  return undefined;
}

function extractAuthor(str: string): string | undefined {
  let author = extractStringValue(str, 'author');
  if (author) return author;
  
  const authorsRegex = /['"]?authors['"]?\s*:\s*\[\s*\{([^}]+)\}\s*\]/;
  const match = str.match(authorsRegex);
  if (match) {
    const nameMatch = match[1].match(/name\s*:\s*['"]([^'"]+)['"]/);
    if (nameMatch) return nameMatch[1];
  }
  
  return undefined;
}

function extractOpenGraph(str: string): Partial<OGMeta> {
  const ogRegex = /['"]?openGraph['"]?\s*:\s*\{([\s\S]*?)\}(?=\s*[,}])/;
  const match = str.match(ogRegex);
  if (!match) return {};
  
  const ogStr = match[1];
  return {
    title: extractStringValue(ogStr, 'title'),
    description: extractStringValue(ogStr, 'description'),
    url: extractStringValue(ogStr, 'url'),
    type: extractStringValue(ogStr, 'type'),
    image: extractImageUrl(ogStr),
  };
}

function extractTwitter(str: string): Partial<TwitterMeta> {
  const twRegex = /['"]?twitter['"]?\s*:\s*\{([\s\S]*?)\}(?=\s*[,}])/;
  const match = str.match(twRegex);
  if (!match) return {};
  
  const twStr = match[1];
  return {
    card: extractStringValue(twStr, 'card'),
    title: extractStringValue(twStr, 'title'),
    description: extractStringValue(twStr, 'description'),
    creator: extractStringValue(twStr, 'creator'),
    image: extractImageUrl(twStr),
  };
}

function extractImageUrl(str: string): string | undefined {
  const imagesRegex = /['"]?images['"]?\s*:\s*\[\s*\{([^}]+)\}\s*\]/;
  const imagesMatch = str.match(imagesRegex);
  if (imagesMatch) {
    const urlMatch = imagesMatch[1].match(/url\s*:\s*['"]([^'"]+)['"]/);
    if (urlMatch) return urlMatch[1];
  }
  
  return extractStringValue(str, 'image');
}

function extractIcons(str: string): MetaTags['icons'] {
  const iconsRegex = /['"]?icons['"]?\s*:\s*\{([\s\S]*?)\}(?=\s*[,}])/;
  const match = str.match(iconsRegex);
  if (!match) return {};
  
  const icons: MetaTags['icons'] = {};
  const iconsStr = match[1];
  
  const iconTypes = ['icon', 'shortcut', 'apple'];
  for (const type of iconTypes) {
    const iconsList = extractIconArray(iconsStr, type);
    if (iconsList.length > 0) {
      (icons as any)[type] = iconsList;
    }
  }
  
  return icons;
}

function extractIconArray(str: string, type: string): IconEntry[] {
  const arrayRegex = new RegExp(`['"]?${type}['"]?\\s*:\\s*\\[([^\\]]+)\\]`);
  const match = str.match(arrayRegex);
  if (!match) return [];
  
  const icons: IconEntry[] = [];
  const items = match[1].split('},').map(item => item.trim());
  
  for (const item of items) {
    const urlMatch = item.match(/url\s*:\s*['"]([^'"]+)['"]/);
    if (urlMatch) {
      const icon: IconEntry = { url: escapeHtml(urlMatch[1]) };
      const typeMatch = item.match(/type\s*:\s*['"]([^'"]+)['"]/);
      if (typeMatch) icon.type = escapeHtml(typeMatch[1]);
      const sizesMatch = item.match(/sizes\s*:\s*['"]([^'"]+)['"]/);
      if (sizesMatch) icon.sizes = escapeHtml(sizesMatch[1]);
      icons.push(icon);
    }
  }
  
  return icons;
}

// ─── API Route Scanner ───────────────────────────────────────────────────────

function scanApiRoutes(dir: string, baseRoute = '', basePath: string = '', depth = 0): ApiRoute[] {
  if (depth > MAX_DEPTH) {
    viteWarnLog(`Maximum API directory depth reached at ${dir}`);
    return [];
  }
  
  const routes: ApiRoute[] = [];
  if (!fs.existsSync(dir)) return routes;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    viteErrorLog(`Failed to read API directory ${dir}`);
    return routes;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const isCatchAll = entry.name.startsWith('[...') && entry.name.endsWith(']');
      const isDynamic = entry.name.startsWith('[') && entry.name.endsWith(']');
      
      let segment: string;
      if (isCatchAll) {
        segment = '*';
      } else if (isDynamic) {
        const paramName = entry.name.slice(1, -1);
        if (!isValidParamName(paramName)) {
          viteWarnLog(`Invalid API parameter name: ${paramName}`);
          continue;
        }
        segment = `:${paramName}`;
      } else {
        if (!isValidRouteSegment(entry.name)) {
          viteWarnLog(`Invalid API directory name: ${entry.name}`);
          continue;
        }
        segment = entry.name;
      }
      
      routes.push(...scanApiRoutes(fullPath, `${baseRoute}/${segment}`, basePath, depth + 1));
      continue;
    }

    const ext = path.extname(entry.name);
    const base = path.basename(entry.name, ext);
    if (!(API_EXTS as readonly string[]).includes(ext)) continue;

    const isCatchAll = base.startsWith('[...') && base.endsWith(']');
    const isDynamic = base.startsWith('[') && base.endsWith(']');
    
    let rawRoutePath: string;
    if (isCatchAll) {
      rawRoutePath = `${baseRoute}/*`;
    } else if (base === 'index') {
      rawRoutePath = baseRoute || '/';
    } else if (isDynamic) {
      const paramName = base.slice(1, -1);
      if (!isValidParamName(paramName)) {
        viteWarnLog(`Invalid API parameter name: ${paramName}`);
        continue;
      }
      rawRoutePath = `${baseRoute}/:${paramName}`;
    } else {
      if (!isValidRouteSegment(base)) {
        viteWarnLog(`Invalid API route name: ${base}`);
        continue;
      }
      rawRoutePath = `${baseRoute}/${base}`;
    }

    const routePath = normalizeRoutePath(rawRoutePath, basePath);
    routes.push({ routePath, filePath: fullPath });
  }

  return routes;
}

// ─── Hono dev/preview server ─────────────────────────────────────────────────

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
      const value = decodeURIComponent(urlParts[i]);
      if (value.includes('..') || value.includes('//')) return null;
      params[patParts[i].slice(1)] = value;
    } else if (patParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

interface CachedModule {
  mtime: number;
  handler: unknown;
  error?: Error;
}

const moduleCache = new Map<string, CachedModule>();

async function importHandler(filePath: string): Promise<unknown> {
  const { pathToFileURL } = await import('url');
  let mtime = 0;
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) return null;
    mtime = stats.mtimeMs;
  } catch {
    return null;
  }

  const cached = moduleCache.get(filePath);
  if (cached && cached.mtime === mtime) {
    if (cached.error) throw cached.error;
    return cached.handler;
  }

  try {
    const mod = await import(pathToFileURL(filePath).href + '?t=' + mtime);
    const handler = mod.default ?? null;
    moduleCache.set(filePath, { mtime, handler });
    return handler;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    moduleCache.set(filePath, { mtime, handler: null, error: err });
    throw err;
  }
}

async function handleApiRequest(
  req: any,
  res: any,
  next: any,
  apiDir: string,
  enableCors: boolean,
  getCache: () => { routes: ApiRoute[] } | null,
  setCache: (v: { routes: ApiRoute[] }) => void,
): Promise<void> {
  try {
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    if (!allowedMethods.includes(req.method)) {
      res.statusCode = 405;
      res.setHeader('Allow', allowedMethods.join(', '));
      res.end();
      return;
    }
    
    if (enableCors && req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.end();
      return;
    }

    let cache = getCache();
    if (!cache) {
      // FIX: Scan routes WITHOUT /api prefix because dev/preview middleware strips it
      cache = { routes: scanApiRoutes(apiDir, '') };
      setCache(cache);
    }

    const host = req.headers.host ?? 'localhost';
    const protocol = req.headers['x-forwarded-proto'] ?? 'http';
    const url = `${protocol}://${host}${req.url}`;
    
    if (!url) {
      res.statusCode = 400;
      res.end('Invalid URL');
      return;
    }
    
    const pathname = new URL(url).pathname;

    if (pathname.includes('..') || pathname.includes('//')) {
      res.statusCode = 400;
      res.end('Invalid path');
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const method = req.method;

    const webReq = new Request(url, {
      method,
      headers: req.headers as HeadersInit,
      body: !['GET', 'HEAD'].includes(method) && body?.length ? body : undefined,
    });

    for (const route of cache.routes) {
      const params = matchRoute(route.routePath, pathname);
      if (params === null) continue;

      let handler;
      try {
        handler = await importHandler(route.filePath);
      } catch (error) {
        viteErrorLog(`Failed to load API handler ${route.filePath}`);
        continue;
      }

      if (!handler) continue;

      try {
        let webRes: Response;
        
        if (typeof (handler as any).fetch === 'function') {
          webRes = await (handler as any).fetch(webReq.clone());
          if (webRes.status === 404) continue;
        } else if (typeof handler === 'function') {
          const existingHeaders: Record<string, string> = {};
          webReq.headers.forEach((v, k) => {
            existingHeaders[k] = v;
          });
          
          const reqWithParams = new Request(webReq.clone(), {
            headers: {
              ...existingHeaders,
              'x-bini-params': JSON.stringify(params),
            },
          });

          webRes = await (handler as (...args: any[]) => Promise<Response>)(reqWithParams);
        } else {
          continue;
        }

        if (enableCors) {
          const headers = new Headers(webRes.headers);
          headers.set('Access-Control-Allow-Origin', '*');
          headers.set('Access-Control-Allow-Methods', allowedMethods.join(', '));
          headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          webRes = new Response(webRes.body, { ...webRes, headers });
        }

        res.statusCode = webRes.status;
        const headersObj: Record<string, string> = {};
        webRes.headers.forEach((value, key) => {
          headersObj[key] = value;
        });
        for (const [k, v] of Object.entries(headersObj)) {
          res.setHeader(k, v);
        }
        
        const buffer = Buffer.from(await webRes.arrayBuffer());
        res.end(buffer);
        return;
      } catch (error) {
        viteErrorLog(`Error executing API handler ${route.filePath}`);
      }
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Not Found',
      message: `No API handler found for ${req.url}`,
    }));
  } catch (error) {
    viteErrorLog(`API request error: ${error instanceof Error ? error.message : String(error)}`);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}

// ─── Production Entry Generator ─────────────────────────────────────────────

interface AdapterConfig {
  pkg?: string;
  importLine?: string;
  exportLine: string;
  outFile: (cwd: string, ts: boolean) => string;
  stripsApiPrefix: boolean;
  usesDenoRuntime: boolean;
  spaFallback?: boolean;
}

const ADAPTERS: Record<Exclude<Platform, 'node'>, AdapterConfig> = {
  netlify: {
    pkg: 'hono',
    importLine: `import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts';\nimport { handle } from 'https://deno.land/x/hono@v4.3.11/adapter/netlify/index.ts';`,
    exportLine: `export default handle(app);`,
    outFile: (cwd, ts) => path.join(cwd, 'netlify', 'edge-functions', ts ? 'api.ts' : 'api.js'),
    stripsApiPrefix: false,
    usesDenoRuntime: true,
  },
  cloudflare: {
    exportLine: `export default app;`,
    outFile: (cwd, ts) => path.join(cwd, ts ? 'worker.ts' : 'worker.js'),
    stripsApiPrefix: false,
    usesDenoRuntime: false,
    spaFallback: true,
  },
  deno: {
    pkg: 'hono',
    importLine: `import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts';`,
    exportLine: `Deno.serve({ port: Number(Deno.env.get('PORT') ?? 3000) }, app.fetch);`,
    outFile: (cwd, ts) => path.join(cwd, 'server', ts ? 'index.ts' : 'index.js'),
    stripsApiPrefix: false,
    usesDenoRuntime: true,
  },
  vercel: {
    exportLine: `export const config = { runtime: 'edge' };\nexport default app.fetch;`,
    outFile: (cwd, ts) => path.join(cwd, 'api', ts ? 'index.ts' : 'index.js'),
    stripsApiPrefix: false,
    usesDenoRuntime: false,
  },
};

function checkAdapter(platform: Exclude<Platform, 'node'>): void {
  if (platform === 'deno' || platform === 'netlify') {
    return;
  }
  
  const adapter = ADAPTERS[platform];
  if (!adapter.pkg) return;
  
  try {
    require.resolve(adapter.pkg, { paths: [process.cwd()] });
  } catch {
    throw new Error(
      `[bini-router] Missing required package for platform '${platform}'.\n` +
      `  Run: npm install ${adapter.pkg}`
    );
  }
}

function resolveEntryImportPath(
  filePath: string,
  outFile: string,
  usesDenoRuntime: boolean,
): string {
  const rel = norm(path.relative(path.dirname(outFile), filePath));
  if (usesDenoRuntime) {
    const withTs = rel.replace(/\.tsx$/, '.ts');
    return withTs.startsWith('.') ? withTs : `./${withTs}`;
  }
  const stripped = rel.replace(/\.(ts|tsx|js|jsx)$/, '');
  return stripped.startsWith('.') ? stripped : `./${stripped}`;
}

function buildRouteImports(
  routes: ApiRoute[],
  outFile: string,
  enableCors: boolean,
  platform: Exclude<Platform, 'node'>,
): { imports: string[]; mountings: string[]; corsLine: string | null; corsImport: string | null } {
  const imports: string[] = [];
  const mountings: string[] = [];
  const adapter = ADAPTERS[platform];
  const { stripsApiPrefix, usesDenoRuntime = false } = adapter;
  const isNetlify = platform === 'netlify';
  const importedModules = new Set<string>();

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    if (!route) continue;
    
    const imp = resolveEntryImportPath(route.filePath, outFile, usesDenoRuntime);
    
    if (importedModules.has(imp)) continue;
    importedModules.add(imp);
    
    const name = `_route${i}`;
    imports.push(`import ${name} from '${imp}';`);

    let src = '';
    try {
      const stats = fs.statSync(route.filePath);
      if (stats.size <= MAX_FILE_SIZE) {
        src = fs.readFileSync(route.filePath, 'utf8');
      }
    } catch {
      // Skip if file can't be read
    }
    
    const isHonoApp = src.includes("from 'hono'") || src.includes('from "hono"');

    if (isHonoApp) {
      mountings.push(`app.route('/api', ${name});`);
    } else {
      const mountPath = `/api${route.routePath ?? '/'}`;
      mountings.push(`app.all('${mountPath}', async (c) => { 
    try {
      const r = await ${name}(c.req.raw);
      return r instanceof Response ? r : c.json(r);
    } catch (error) {
      console.error(\`API Error on \${c.req.path}:\`, error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  });`);
    }
  }

  const corsPattern = '/api/*';
  let corsLine: string | null = null;
  let corsImport: string | null = null;
  
  if (enableCors) {
    if (isNetlify) {
      corsLine = `app.use('${corsPattern}', async (c, next) => { 
    await next(); 
    c.res.headers.set('Access-Control-Allow-Origin', '*'); 
    c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS'); 
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization'); 
    if (c.req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.res.headers }); 
  });`;
    } else {
      corsLine = `app.use('${corsPattern}', cors({ origin: '*', allowMethods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowHeaders: ['Content-Type','Authorization'] }));`;
      corsImport = `import { cors } from 'hono/cors';`;
    }
  }

  return { imports, mountings, corsLine, corsImport };
}

function buildProductionEntry(srcApiDir: string, platform: Exclude<Platform, 'node'>, enableCors: boolean, basePath: string = ''): void {
  if (!fs.existsSync(srcApiDir)) return;

  const routes = scanApiRoutes(srcApiDir, '/api', basePath);
  if (routes.length === 0) {
    viteWarnLog('No API routes found, skipping production entry generation');
    return;
  }

  const cwd = process.cwd();
  const ts = isTypeScriptProject();

  try {
    checkAdapter(platform);
  } catch (error) {
    viteErrorLog(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const adapter = ADAPTERS[platform];
  const outFile = adapter.outFile(cwd, ts);

  const { imports, mountings, corsLine, corsImport } = buildRouteImports(routes, outFile, enableCors, platform);

  const isNetlify = platform === 'netlify';
  const isCloudflare = platform === 'cloudflare';
  const usesDenoRuntime = adapter.usesDenoRuntime;
  
  let lines: string[] = [
    `// ⚠️  Auto-generated by bini-router on every build — do not edit.`,
    `// Add routes by creating files in src/app/api/ only.`,
    `// Generated at: ${new Date().toISOString()}`,
    ``,
  ];
  
  if (usesDenoRuntime) {
    if (adapter.importLine) {
      lines.push(...adapter.importLine.split('\n'));
    } else {
      lines.push(`import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts';`);
    }
    
    if (corsImport && !isNetlify) {
      lines.push(`import { cors } from 'https://deno.land/x/hono@v4.3.11/middleware.ts';`);
    }
    
    for (const imp of imports) {
      let denoImp = imp;
      if (imp.includes("from './") && !imp.includes('.ts') && !imp.includes('.js')) {
        denoImp = imp.replace(/from '\.\/([^']+)'/, `from './$1.ts'`);
      }
      lines.push(denoImp);
    }
  } else {
    lines.push(`import { Hono } from 'hono';`);
    if (adapter.importLine) {
      lines.push(...adapter.importLine.split('\n'));
    }
    if (corsImport) {
      lines.push(corsImport);
    }
    lines.push(...imports);
  }
  
  lines.push(``);
  lines.push(`const app = new Hono();`);
  
  if (corsLine) {
    lines.push(corsLine);
  }
  
  // Add API routes FIRST
  lines.push(...mountings);
  lines.push(``);
  
  // Add static file serving for Deno (AFTER API routes)
  if (platform === 'deno') {
    lines.push(...[
      `// Serve static files from dist (must come AFTER API routes)`,
      `app.get('/*', async (c) => {`,
      `  // Skip API routes - let them be handled first`,
      `  if (c.req.path.startsWith('/api/')) {`,
      `    return c.text('API route not found', 404);`,
      `  }`,
      `  `,
      `  const filePath = c.req.path === '/' ? '/index.html' : c.req.path;`,
      `  `,
      `  try {`,
      `    const file = await Deno.readFile(\`./dist\${filePath}\`);`,
      `    const ext = filePath.split('.').pop();`,
      `    const contentType = `,
      `      ext === 'html' ? 'text/html' :`,
      `      ext === 'css' ? 'text/css' :`,
      `      ext === 'js' ? 'application/javascript' :`,
      `      ext === 'json' ? 'application/json' :`,
      `      ext === 'png' ? 'image/png' :`,
      `      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :`,
      `      'text/plain';`,
      `    `,
      `    return new Response(file, {`,
      `      headers: { 'Content-Type': contentType }`,
      `    });`,
      `  } catch {`,
      `    // SPA fallback`,
      `    try {`,
      `      const indexHtml = await Deno.readFile('./dist/index.html');`,
      `      return new Response(indexHtml, {`,
      `        headers: { 'Content-Type': 'text/html' }`,
      `      });`,
      `    } catch {`,
      `      return c.text('File not found', 404);`,
      `    }`,
      `  }`,
      `});`,
      ``,
    ]);
  }
  
  if (isCloudflare && adapter.spaFallback) {
    lines.push(...[
      `// SPA fallback - serves index.html for all non-API, non-asset requests`,
      `app.get('*', async (c) => {`,
      `  const request = c.req.raw;`,
      `  const env = c.env;`,
      `  `,
      `  const assetResponse = await env.ASSETS.fetch(request);`,
      `  if (assetResponse.status === 200) {`,
      `    return assetResponse;`,
      `  }`,
      `  `,
      `  const indexHtml = await env.ASSETS.fetch(new URL('/index.html', request.url));`,
      `  return indexHtml;`,
      `});`,
      ``,
    ]);
  }
  
  lines.push(...adapter.exportLine.split('\n'));

  try {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
    console.log(`\x1b[90m${new Date().toLocaleTimeString()}\x1b[0m \x1b[36m[vite]\x1b[0m \x1b[32m✓ Generated\x1b[0m \x1b[90m${toPosixPath(path.relative(cwd, outFile))}\x1b[0m`);

    if (platform === 'vercel') {
      const serverFile = path.relative(cwd, outFile);
      console.log(`\n\x1b[90m${new Date().toLocaleTimeString()}\x1b[0m \x1b[33m[vite]\x1b[0m \x1b[33m⚠️  Vercel platform detected.\x1b[0m`);
      console.log(`  Vercel reads your api/ directory BEFORE the build step runs.\n  You must commit the generated file to your repository:\n\n    git add ${toPosixPath(serverFile)}\n    git commit -m "chore: update vercel api entry"\n    git push\n\n  Without this step, Vercel will not find your API routes.\n`);
    }
    
    if (platform === 'deno') {
      const serverFile = path.relative(cwd, outFile);
      console.log(`\n\x1b[90m${new Date().toLocaleTimeString()}\x1b[0m \x1b[33m[vite]\x1b[0m \x1b[33m⚠️  Deno Deploy platform detected.\x1b[0m`);
      console.log(`  Deno Deploy reads your server/ directory BEFORE the build step runs.\n  You must commit the generated file to your repository:\n\n    git add ${toPosixPath(serverFile)}\n    git commit -m "chore: update deno server entry"\n    git push\n\n  Without this step, Deno Deploy will not find your API routes.\n`);
      console.log(`  In Deno Console, set:\n    - Entrypoint: ${toPosixPath(serverFile)}\n    - Build Command: vite build\n    - Runtime: Dynamic App\n`);
    }
    
    if (platform === 'netlify') {
      const functionFile = path.relative(cwd, outFile);
      console.log(`\n\x1b[90m${new Date().toLocaleTimeString()}\x1b[0m \x1b[36m[vite]\x1b[0m \x1b[32m✓ Netlify function generated successfully\x1b[0m \x1b[90m${toPosixPath(functionFile)}\x1b[0m`);
      console.log(`  The function is ready for deployment to Netlify Edge Functions.\n  Make sure your netlify.toml has:\n\n    [functions]\n      directory = "netlify/edge-functions"\n\n`);
    }
    
    if (platform === 'cloudflare') {
      const workerFile = path.relative(cwd, outFile);
      console.log(`\n\x1b[90m${new Date().toLocaleTimeString()}\x1b[0m \x1b[36m[vite]\x1b[0m \x1b[32m✓ Cloudflare Worker generated successfully\x1b[0m \x1b[90m${toPosixPath(workerFile)}\x1b[0m`);
      console.log(`  The worker includes SPA fallback for React Router.\n  Make sure your wrangler.toml has the ASSETS binding configured.\n`);
    }
    
  } catch (error) {
    viteErrorLog(`Failed to write production entry file: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function stripMetadataExports(code: string): string {
  let result = code;
  let idx = result.indexOf('export const metadata');
  
  while (idx !== -1) {
    const braceIdx = result.indexOf('{', idx);
    if (braceIdx === -1) break;

    let depth = 0;
    let end = braceIdx;
    
    for (let i = braceIdx; i < result.length; i++) {
      if (result[i] === '{') {
        depth++;
      } else if (result[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    let tail = end + 1;
    while (tail < result.length && (result[tail] === ' ' || result[tail] === '\t')) tail++;
    if (tail < result.length && result[tail] === ';') tail++;
    while (tail < result.length && (result[tail] === '\n' || result[tail] === '\r')) tail++;

    result = result.slice(0, idx) + result.slice(tail);
    idx = result.indexOf('export const metadata', idx);
  }
  
  return result;
}

function injectAutoImports(result: string, originalCode: string): string {
  const alreadyImportsRouter = result.includes("from 'react-router-dom'") || result.includes('from "react-router-dom"');
  const alreadyImportsReact = result.includes("from 'react'") || result.includes('from "react"');
  const alreadyImportsEnv = result.includes("from 'bini-env'") || result.includes('from "bini-env"');

  const ROUTER_EXPORTS = ['Link', 'NavLink', 'useNavigate', 'useParams', 'useLocation', 'useSearchParams', 'Outlet'];
  const REACT_EXPORTS = ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'createContext', 'useReducer', 'useId', 'useTransition', 'useDeferredValue'];
  const ENV_EXPORTS = ['getEnv', 'requireEnv'];

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
  if (usedReact.length) injected.push(`import { ${usedReact.join(', ')} } from 'react';`);
  if (usedEnv.length) injected.push(`import { ${usedEnv.join(', ')} } from 'bini-env';`);

  if (injected.length > 0) {
    return injected.join('\n') + '\n' + result;
  }
  
  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export function biniroute(options: BiniPluginOptions = {}): Plugin {
  const { 
    cors: enableCors = true, 
    platform, 
    strictMode = true,
    basePath = ''
  } = options;

  const getAppDir = (): string => path.join(process.cwd(), options.appDir ?? 'src/app');
  const getApiDir = (): string => path.join(process.cwd(), options.apiDir ?? 'src/app/api');

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastGeneratedCode = '';
  let honoCache: { routes: ApiRoute[] } | null = null;
  const eventLog = new Map<string, number>();
  let resolvedCommand: 'build' | 'serve' = 'serve';
  let isGenerating = false;

  function shouldProcess(file: string, event: string): boolean {
    const key = `${file}:${event}`;
    const now = Date.now();
    if (now - (eventLog.get(key) ?? 0) < EVENT_DEDUP_MS) return false;
    eventLog.set(key, now);
    
    for (const [k, v] of eventLog) {
      if (now - v > EVENT_TTL_MS) eventLog.delete(k);
    }
    return true;
  }

  function isPageFile(f: string): boolean {
    const nf = norm(f);
    const base = path.basename(f, path.extname(f));
    const ext = path.extname(f);
    
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
    if (isGenerating) return null;
    isGenerating = true;
    
    try {
      const dir = getAppDir();
      if (!fs.existsSync(dir)) return null;
      
      const code = generateApp(dir, basePath, strictMode);
      if (code === lastGeneratedCode) return null;
      
      const appFile = getAppFile();
      fs.mkdirSync(path.dirname(appFile), { recursive: true });
      fs.writeFileSync(appFile, code, 'utf8');
      lastGeneratedCode = code;
      
      return code;
    } catch (error) {
      viteErrorLog(`Failed to generate app: ${error instanceof Error ? error.message : String(error)}`);
      if (strictMode && error instanceof RouteConflictError) {
        throw error;
      }
      return null;
    } finally {
      isGenerating = false;
    }
  }

  function scheduleRegen(server: ViteDevServer, delay = DEBOUNCE_MS): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (applyApp() !== null) {
        server.ws.send({ type: 'full-reload', path: '*' });
      }
    }, delay);
  }

  function addSpaFallback(server: { middlewares: any }): void {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = req.url as string;
      if (url.startsWith('/api') || url.includes('.') || url === '/index.html') {
        return next();
      }
      req.url = '/index.html';
      next();
    });
  }

  return {
    name: 'bini-router',
    enforce: 'pre',

    configResolved(config): void {
      resolvedCommand = config.command;
    },

    transform: {
      filter: {
        id: { include: /\.(tsx|jsx|ts|js)$/ },
      },
      handler(code, id) {
        const nid = norm(id);
        const appDir = getAppDir();
        const apiDir = getApiDir();

        if (!isInDir(nid, norm(appDir))) return;
        if (isInDir(nid, norm(apiDir))) return;
        if (norm(id) === norm(getAppFile())) return;

        let result = code;

        if (result.includes('export const metadata')) {
          result = stripMetadataExports(result);
        }

        result = injectAutoImports(result, code);

        if (result === code) return;

        return { code: result, map: null, moduleType: 'js' as const };
      },
    },

    config(): void {
      applyApp();
    },
    
    buildStart(): void {
      applyApp();
    },

    closeBundle(): void {
      if (platform && isNonNodePlatform(platform) && resolvedCommand === 'build') {
        try {
          buildProductionEntry(getApiDir(), platform, enableCors, basePath);
        } catch (error) {
          viteErrorLog(`Failed to build production entry: ${error instanceof Error ? error.message : String(error)}`);
          if (strictMode) throw error;
        }
      }
    },

    buildEnd(): void {
      honoCache = null;
      moduleCache.clear();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },

    async configureServer(server): Promise<void> {
      const appDir = getAppDir();
      const apiDir = getApiDir();

      if (!fs.existsSync(appDir)) return;

      try {
        await loadEnv(process.cwd());
      } catch (error) {
        viteWarnLog('Failed to load environment variables');
      }

      server.watcher.add(appDir);

      const watcherEvents = ['add', 'unlink', 'change'] as const;
      for (const event of watcherEvents) {
        server.watcher.on(event, (f) => {
          try {
            if (isPageFile(f) && shouldProcess(f, event)) {
              scheduleRegen(server, event === 'add' ? 300 : DEBOUNCE_MS);
            }
          } catch (error) {
            viteErrorLog(`Error handling file ${event}: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      }

      server.watcher.on('change', (f) => {
        try {
          const base = path.basename(f, path.extname(f));
          const inAppRoot = path.resolve(path.dirname(f)) === path.resolve(appDir);
          if (inAppRoot && base === 'layout') {
            server.moduleGraph.invalidateAll();
            server.ws.send({ type: 'full-reload', path: '*' });
          }
        } catch (error) {
          viteErrorLog(`Error handling layout change: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

      server.watcher.on('addDir', (d) => {
        try {
          const nd = norm(d);
          if (!isInDir(nd, norm(appDir)) || d.includes('node_modules') || isInDir(nd, norm(apiDir))) return;
          server.watcher.add(d);
          setTimeout(() => {
            if (PAGE_FILES.some(f => fs.existsSync(path.join(d, f)))) {
              scheduleRegen(server, 300);
            }
          }, 300);
        } catch (error) {
          viteErrorLog(`Error handling directory add: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

      server.watcher.on('unlinkDir', (d) => {
        try {
          const nd = norm(d);
          if (isInDir(nd, norm(appDir)) && !d.includes('node_modules') && !isInDir(nd, norm(apiDir))) {
            scheduleRegen(server);
          }
        } catch (error) {
          viteErrorLog(`Error handling directory unlink: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

      if (fs.existsSync(apiDir)) {
        server.watcher.add(apiDir);

        const resetApi = (f?: string): void => {
          honoCache = null;
          if (f) moduleCache.delete(f);
          server.ws.send({ type: 'full-reload', path: '*' });
        };

        server.watcher.on('add', (f) => {
          if (isApiFile(f)) {
            viteLog(f);
            resetApi(f);
          }
        });

        server.watcher.on('unlink', (f) => {
          if (isApiFile(f)) {
            viteLog(f);
            resetApi(f);
          }
        });

        server.watcher.on('change', (f) => {
          if (isApiFile(f)) {
            viteLog(f);
            resetApi(f);
          }
        });

        server.middlewares.use((req: any, res: any, next: any) => {
          if (!req.url?.startsWith('/api')) return next();
          handleApiRequest(req, res, next, apiDir, enableCors,
            () => honoCache, (v) => { honoCache = v; });
        });
      }
    },

    async configurePreviewServer(server): Promise<void> {
      try {
        await loadEnv(process.cwd());
      } catch (error) {
        viteWarnLog('Failed to load environment variables');
      }

      const apiDir = getApiDir();
      if (fs.existsSync(apiDir)) {
        server.middlewares.use((req: any, res: any, next: any) => {
          if (!req.url?.startsWith('/api')) return next();
          handleApiRequest(req, res, next, apiDir, enableCors,
            () => honoCache, (v) => { honoCache = v; });
        });
      }

      addSpaFallback(server);
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html): string {
        try {
          const meta = parseAppMetadata(getAppDir());

          if (!meta.title && !meta.description && !meta.canonical && !meta.manifest &&
              !meta.openGraph?.title && !meta.icons?.icon?.length) {
            return html;
          }

          const title = meta.title ?? 'Bini App';
          const vp = meta.viewport ?? 'width=device-width, initial-scale=1.0';

          const lines: string[] = [];

          lines.push(`<meta charset="${meta.charset ?? 'UTF-8'}">`);
          lines.push(`<meta name="viewport" content="${vp}">`);
          lines.push(`<title>${escapeHtml(title)}</title>`);
          
          if (meta.description) lines.push(`<meta name="description" content="${escapeHtml(meta.description)}">`);
          if (meta.themeColor) lines.push(`<meta name="theme-color" content="${escapeHtml(meta.themeColor)}">`);
          if (meta.robots) lines.push(`<meta name="robots" content="${escapeHtml(meta.robots)}">`);
          if (meta.keywords) lines.push(`<meta name="keywords" content="${escapeHtml(meta.keywords)}">`);
          if (meta.author) lines.push(`<meta name="author" content="${escapeHtml(meta.author)}">`);
          if (meta.canonical) lines.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}">`);
          if (meta.manifest) lines.push(`<link rel="manifest" href="${escapeHtml(meta.manifest)}">`);

          for (const entry of meta.icons?.icon ?? []) {
            const type = entry.type ? ` type="${escapeHtml(entry.type)}"` : '';
            const sizes = entry.sizes ? ` sizes="${escapeHtml(entry.sizes)}"` : '';
            lines.push(`<link rel="icon" href="${escapeHtml(entry.url)}"${type}${sizes}>`);
          }
          
          for (const entry of meta.icons?.shortcut ?? []) {
            lines.push(`<link rel="shortcut icon" href="${escapeHtml(entry.url)}">`);
          }
          
          for (const entry of meta.icons?.apple ?? []) {
            const sizes = entry.sizes ? ` sizes="${escapeHtml(entry.sizes)}"` : '';
            const type = entry.type ? ` type="${escapeHtml(entry.type)}"` : '';
            lines.push(`<link rel="apple-touch-icon" href="${escapeHtml(entry.url)}"${sizes}${type}>`);
          }

          if (meta.openGraph?.title) {
            lines.push(`<meta property="og:type" content="${escapeHtml(meta.openGraph.type ?? 'website')}">`);
            lines.push(`<meta property="og:title" content="${escapeHtml(meta.openGraph.title)}">`);
            if (meta.openGraph.description) {
              lines.push(`<meta property="og:description" content="${escapeHtml(meta.openGraph.description)}">`);
            }
            if (meta.openGraph.url) lines.push(`<meta property="og:url" content="${escapeHtml(meta.openGraph.url)}">`);
            if (meta.openGraph.image) lines.push(`<meta property="og:image" content="${escapeHtml(meta.openGraph.image)}">`);
          }

          if (meta.twitter?.title) {
            lines.push(`<meta name="twitter:card" content="${escapeHtml(meta.twitter.card ?? 'summary_large_image')}">`);
            lines.push(`<meta name="twitter:title" content="${escapeHtml(meta.twitter.title)}">`);
            if (meta.twitter.description) {
              lines.push(`<meta name="twitter:description" content="${escapeHtml(meta.twitter.description)}">`);
            }
            if (meta.twitter.creator) lines.push(`<meta name="twitter:creator" content="${escapeHtml(meta.twitter.creator)}">`);
            if (meta.twitter.image) lines.push(`<meta name="twitter:image" content="${escapeHtml(meta.twitter.image)}">`);
          }

          const injected = lines.map(l => `    ${l}`).join('\n');
          return html.replace('</head>', `${injected}\n  </head>`);
        } catch (error) {
          viteErrorLog(`Error transforming index.html: ${error instanceof Error ? error.message : String(error)}`);
          return html;
        }
      },
    },
  };
}

// Re-export types for external use
export type { Plugin, ViteDevServer } from 'vite';