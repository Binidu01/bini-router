// <reference types="vite/client" />

import fs from 'fs';
import path from 'path';
import type { Plugin, ViteDevServer } from 'vite';
import mdx from '@mdx-js/rollup';

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIAL_FILE_EXTS = ['.tsx', '.jsx', '.ts', '.js'] as const;
const SUPPORTED_EXTS = [...SPECIAL_FILE_EXTS, '.mdx', '.md'] as const;
const PAGE_FILES = SUPPORTED_EXTS.map(e => `page${e}`);
const LAYOUT_FILES = SPECIAL_FILE_EXTS.map(e => `layout${e}`);
const NOT_FOUND_FILES = SPECIAL_FILE_EXTS.map(e => `not-found${e}`);
const LOADING_FILES = SPECIAL_FILE_EXTS.map(e => `loading${e}`);
const ERROR_FILES = SPECIAL_FILE_EXTS.map(e => `error${e}`);
const SPECIAL_BASES = new Set(['page', 'layout', 'not-found', 'loading', 'error']);
const API_EXTS = ['.ts', '.js'] as const;
const DEBOUNCE_MS = 60;
const EVENT_DEDUP_MS = 500;
const EVENT_TTL_MS = 2000;
const MAX_DEPTH = 100;

// ─── Security Constants ─────────────────────────────────────────────────────

const ALLOWED_ROUTE_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_PARAM_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MAX_ROUTE_SEGMENT_LENGTH = 100;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_BODY_SIZE_LIMIT = 1024 * 1024;

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

export interface BiniPluginOptions {
  appDir?: string;
  apiDir?: string;
  cors?: boolean | { origin?: string; methods?: string[]; headers?: string[] };
  strictMode?: boolean;
  basePath?: string;
  bodySizeLimit?: number;
  mdx?: Parameters<typeof mdx>[0];
}

// ─── Built-in Default Components ─────────────────────────────────────────────

const DEFAULT_LOADING_COMPONENT = `
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
    root: { margin: 0, padding: 0, minHeight: '100vh', width: '100%' },
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
    spinnerWrapper: { position: 'relative' as const, width: '3rem', height: '3rem' },
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
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      \`}</style>
    </div>
  );
}`;

const DEFAULT_404_COMPONENT = `
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
    root: { margin: 0, padding: 0, minHeight: '100vh', width: '100%' },
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
    wrapper: { maxWidth: '42rem', margin: '0 auto', display: 'flex', flexDirection: 'column' as const, gap: '1.5rem' },
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
    title: { fontSize: '1.5rem', fontWeight: 600, color: isDark ? '#ffffff' : '#000000' },
    message: { color: isDark ? '#a3a3a3' : '#737373', maxWidth: '28rem', margin: '0 auto' },
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
  const keepExt = path.extname(filePath) === '.mdx' || path.extname(filePath) === '.md';

  for (const [alias, target] of Object.entries(aliases)) {
    if (norm(filePath).startsWith(norm(target) + '/')) {
      let rest = norm(filePath).slice(norm(target).length + 1);
      if (!keepExt) rest = rest.replace(/\.(tsx|ts|jsx|js)$/, '');
      return `${alias}/${rest}`;
    }
  }

  let rel = './' + norm(path.relative(path.join(process.cwd(), 'src'), filePath));
  if (!keepExt) rel = rel.replace(/\.(tsx|ts|jsx|js)$/, '');
  return rel;
}

function hasDefaultExport(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) return false;
    if (stats.size === 0) return false;

    const ext = path.extname(filePath);
    if (ext === '.mdx' || ext === '.md') return true;

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

function resolveNearestFile(
  startDir: string,
  appDir: string,
  candidates: readonly string[],
): string | null {
  let current = startDir;
  const visited = new Set<string>();
  let depth = 0;

  while (true) {
    if (visited.has(current) || depth > MAX_DEPTH) break;
    visited.add(current);
    depth++;

    const found = findFile(current, candidates);
    if (found) {
      const fullPath = path.join(current, found);
      if (hasDefaultExport(fullPath)) return fullPath;
    }

    if (path.resolve(current) === path.resolve(appDir)) break;

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

function resolveLoadingComponentName(
  dir: string,
  appDir: string,
  aliases: Record<string, string>,
  loadingFileToName: Map<string, string>,
  lazyImports: string[],
  importedModules: Set<string>,
): string {
  const nearest = resolveNearestFile(dir, appDir, LOADING_FILES);
  if (!nearest) return 'Spinner';

  const existing = loadingFileToName.get(nearest);
  if (existing) return existing;

  const name = `Loading${loadingFileToName.size}`;
  loadingFileToName.set(nearest, name);

  const importPath = toImportPath(nearest, aliases);
  if (!importedModules.has(importPath)) {
    lazyImports.push(`const ${name} = React.lazy(() => import('${importPath}'));`);
    importedModules.add(importPath);
  }

  return name;
}

function resolveErrorComponentName(
  dir: string,
  appDir: string,
  aliases: Record<string, string>,
  errorFileToName: Map<string, string>,
  lazyImports: string[],
  importedModules: Set<string>,
): string | null {
  const nearest = resolveNearestFile(dir, appDir, ERROR_FILES);
  if (!nearest) return null;

  const existing = errorFileToName.get(nearest);
  if (existing) return existing;

  const name = `ErrorFallback${errorFileToName.size}`;
  errorFileToName.set(nearest, name);

  const importPath = toImportPath(nearest, aliases);
  if (!importedModules.has(importPath)) {
    lazyImports.push(`const ${name} = React.lazy(() => import('${importPath}'));`);
    importedModules.add(importPath);
  }

  return name;
}

interface NotFoundBoundary {
  dirRoutePath: string;
  filePath: string;
  layouts: string[];
}

function collectNotFoundBoundaries(
  dir: string,
  appDir: string,
  baseRoute = '',
  basePath: string = '',
  depth = 0,
  out: NotFoundBoundary[] = [],
): NotFoundBoundary[] {
  if (depth > MAX_DEPTH) return out;
  if (!fs.existsSync(dir)) return out;

  const nfFile = findFile(dir, NOT_FOUND_FILES);
  if (nfFile) {
    const fullPath = path.join(dir, nfFile);
    if (hasDefaultExport(fullPath)) {
      out.push({
        dirRoutePath: normalizeRoutePath(baseRoute || '/', basePath),
        filePath: fullPath,
        layouts: resolveLayoutChain(dir, appDir).filter(l => isUsableLayout(l)),
      });
    }
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'api') continue;

    const fullPath = path.join(dir, entry.name);
    const isCatchAll = entry.name.startsWith('[...') && entry.name.endsWith(']');
    const isDynamic = entry.name.startsWith('[') && entry.name.endsWith(']');

    let segment: string;
    if (isCatchAll) {
      segment = '*';
    } else if (isDynamic) {
      const paramName = entry.name.slice(1, -1);
      if (!isValidParamName(paramName)) continue;
      segment = `:${paramName}`;
    } else {
      if (!isValidRouteSegment(entry.name)) continue;
      segment = entry.name;
    }

    collectNotFoundBoundaries(fullPath, appDir, `${baseRoute}/${segment}`, basePath, depth + 1, out);
  }

  return out;
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

function extensionPriority(filePath: string): number {
  const ext = path.extname(filePath);
  const idx = (SUPPORTED_EXTS as readonly string[]).indexOf(ext);
  return idx === -1 ? SUPPORTED_EXTS.length : idx;
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
      } else if (
        route.layouts.length === existing.layouts.length &&
        extensionPriority(route.filePath) < extensionPriority(existing.filePath)
      ) {
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
  layoutLoadingNames: Map<string, string>,
  pageLoadingNames: Map<string, string>,
  layoutErrorNames: Map<string, string>,
  pageErrorNames: Map<string, string>,
  indent: number,
): string {
  const pad = ' '.repeat(indent);
  
  if (layouts.length === 0) {
    return routesInChain.map(r => {
      const pageName = pageNames.get(r.filePath);
      if (!pageName) {
        throw new Error(`Page name not found for ${r.filePath}`);
      }
      const fallback = pageLoadingNames.get(r.filePath) ?? 'Spinner';
      const errorName = pageErrorNames.get(r.filePath);
      const errorProp = errorName ? ` fallback={${errorName}}` : '';
      return `${pad}<Route path="${r.routePath}" element={<Suspense fallback={<${fallback} />}><ErrorBoundary${errorProp}><${pageName} /></ErrorBoundary></Suspense>} />`;
    }).join('\n');
  }
  
  const [head, ...tail] = layouts;
  const title = layoutTitles.get(head);
  const titleSetter = title ? `<TitleSetter title={${JSON.stringify(title)}} />` : '';
  const inner = renderChain(tail, routesInChain, layoutNames, pageNames, layoutTitles, layoutLoadingNames, pageLoadingNames, layoutErrorNames, pageErrorNames, indent + 2);
  const name = layoutNames.get(head);
  
  if (!name) {
    throw new Error(`Layout name not found for ${head}`);
  }
  
  const fallback = layoutLoadingNames.get(head) ?? 'Spinner';
  const errorName = layoutErrorNames.get(head);
  const errorProp = errorName ? ` fallback={${errorName}}` : '';

  return [
    `${pad}<Route element={<>${titleSetter}<Suspense fallback={<${fallback} />}><ErrorBoundary${errorProp}><${name}><Outlet /></${name}></ErrorBoundary></Suspense></>}>`,
    inner,
    `${pad}</Route>`,
  ].join('\n');
}

function renderComponentWithLayouts(
  componentName: string,
  layouts: string[],
  layoutNames: Map<string, string>,
  layoutTitles: Map<string, string>,
  ownFallback: string,
  ownErrorName: string | null,
  indent: number,
): string {
  const pad = ' '.repeat(indent);
  
  if (layouts.length === 0) {
    const errorProp = ownErrorName ? ` fallback={${ownErrorName}}` : '';
    return `${pad}<Suspense fallback={<${ownFallback} />}><ErrorBoundary${errorProp}>${componentName}</ErrorBoundary></Suspense>`;
  }
  
  const [head, ...tail] = layouts;
  const title = layoutTitles.get(head);
  const titleSetter = title ? `<TitleSetter title={${JSON.stringify(title)}} />` : '';
  const name = layoutNames.get(head);
  const inner = renderComponentWithLayouts(componentName, tail, layoutNames, layoutTitles, ownFallback, ownErrorName, indent + 2);
  
  if (!name) return inner;
  
  return `${pad}<>${titleSetter}<${name}>${inner}</${name}></>`;
}

function generateErrorBoundary(ts: boolean): string {
  return ts ? `
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error; reset: () => void }> },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error; reset: () => void }> }) {
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
      const reset = () => this.setState({ error: null });
      if (this.props.fallback) {
        const Fallback = this.props.fallback;
        return <Fallback error={this.state.error} reset={reset} />;
      }
      if (import.meta.env.DEV) return null;
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', padding: '2rem' }}>
          <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <h2 style={{ color: '#e74c3c', marginBottom: '1rem' }}>Something went wrong</h2>
            <pre style={{ background: '#fef2f2', padding: '1rem', borderRadius: '0.5rem', textAlign: 'left', fontSize: '0.8rem', color: '#e74c3c', overflow: 'auto' }}>{this.state.error.toString()}</pre>
            <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#00CFFF', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
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
      const reset = () => this.setState({ error: null });
      if (this.props.fallback) {
        const Fallback = this.props.fallback;
        return <Fallback error={this.state.error} reset={reset} />;
      }
      if (import.meta.env.DEV) return null;
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', padding: '2rem' }}>
          <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <h2 style={{ color: '#e74c3c', marginBottom: '1rem' }}>Something went wrong</h2>
            <pre style={{ background: '#fef2f2', padding: '1rem', borderRadius: '0.5rem', textAlign: 'left', fontSize: '0.8rem', color: '#e74c3c', overflow: 'auto' }}>{this.state.error.toString()}</pre>
            <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#00CFFF', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
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
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = title;
    }
  }, [title]);
  return null;
}` : `
function TitleSetter({ title }) {
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = title;
    }
  }, [title]);
  return null;
}`;
}

// ─── Route Manifest API ──────────────────────────────────────────────────────

export interface RouteManifest {
  static: string[];
  dynamic: string[];
  all: string[];
  metadata: {
    [routePath: string]: {
      title?: string;
      layouts: string[];
      filePath: string;
      dynamic: boolean;
    };
  };
}

export function generateRouteManifest(appDir: string, basePath: string = ''): RouteManifest {
  let routes = scanRoutes(appDir, appDir, '', basePath);
  
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

  const validRoutes = deduplicateRoutes(
    routes.filter(r => hasDefaultExport(r.filePath))
  );

  const staticRoutes: string[] = [];
  const dynamicRoutes: string[] = [];
  const metadata: RouteManifest['metadata'] = {};

  for (const route of validRoutes) {
    const isDynamic = route.dynamic || route.routePath.includes(':') || route.routePath.includes('*');
    
    if (isDynamic) {
      dynamicRoutes.push(route.routePath);
    } else {
      staticRoutes.push(route.routePath);
    }

    const title = route.layouts.map(l => parseLayoutTitle(l)).filter(Boolean)[0] || undefined;
    
    metadata[route.routePath] = {
      title,
      layouts: route.layouts,
      filePath: route.filePath,
      dynamic: isDynamic,
    };
  }

  return {
    static: [...new Set(staticRoutes)],
    dynamic: [...new Set(dynamicRoutes)],
    all: [...new Set([...staticRoutes, ...dynamicRoutes])],
    metadata,
  };
}

function getRouteManifestModule(appDir: string, basePath: string): string {
  const manifest = generateRouteManifest(appDir, basePath);
  return `
    export const staticRoutes = ${JSON.stringify(manifest.static)};
    export const dynamicRoutes = ${JSON.stringify(manifest.dynamic)};
    export const allRoutes = ${JSON.stringify(manifest.all)};
    export const routeMetadata = ${JSON.stringify(manifest.metadata)};
    export default {
      static: ${JSON.stringify(manifest.static)},
      dynamic: ${JSON.stringify(manifest.dynamic)},
      all: ${JSON.stringify(manifest.all)},
      metadata: ${JSON.stringify(manifest.metadata)},
    };
  `;
}

// ─── Generate App ────────────────────────────────────────────────────────────

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

  const loadingFileToName = new Map<string, string>();
  const layoutLoadingNames = new Map<string, string>();
  const pageLoadingNames = new Map<string, string>();

  const errorFileToName = new Map<string, string>();
  const layoutErrorNames = new Map<string, string>();
  const pageErrorNames = new Map<string, string>();

  for (const l of allLayouts) {
    layoutLoadingNames.set(
      l,
      resolveLoadingComponentName(path.dirname(l), appDir, aliases, loadingFileToName, lazyImports, importedModules),
    );
    const errName = resolveErrorComponentName(path.dirname(l), appDir, aliases, errorFileToName, lazyImports, importedModules);
    if (errName) layoutErrorNames.set(l, errName);
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
    pageLoadingNames.set(
      r.filePath,
      resolveLoadingComponentName(path.dirname(r.filePath), appDir, aliases, loadingFileToName, lazyImports, importedModules),
    );
    const errName = resolveErrorComponentName(path.dirname(r.filePath), appDir, aliases, errorFileToName, lazyImports, importedModules);
    if (errName) pageErrorNames.set(r.filePath, errName);
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
  for (const [, { layouts, routes: cr }] of chainMap) {
    routeLines.push(renderChain(layouts, cr, layoutNames, pageNames, layoutTitles, layoutLoadingNames, pageLoadingNames, layoutErrorNames, pageErrorNames, 8));
  }

  const notFoundBoundaries = collectNotFoundBoundaries(appDir, appDir, '', basePath);
  const rootEffectivePath = basePath || '/';

  const notFoundNames = new Map<string, string>();
  let nfi = 0;
  for (const b of notFoundBoundaries) {
    if (notFoundNames.has(b.filePath)) continue;
    const importPath = toImportPath(b.filePath, aliases);
    const name = `NotFound${nfi++}`;
    if (!importedModules.has(importPath)) {
      lazyImports.push(`const ${name} = React.lazy(() => import('${importPath}'));`);
      importedModules.add(importPath);
    }
    notFoundNames.set(b.filePath, name);
  }

  const hasRootCustomNotFound = notFoundBoundaries.some(b => b.dirRoutePath === rootEffectivePath);

  const notFoundRouteLines: string[] = [];
  const notFoundFallbackNames: string[] = [];

  for (const b of notFoundBoundaries) {
    const name = notFoundNames.get(b.filePath);
    if (!name) continue;
    const ownFallback = resolveLoadingComponentName(
      path.dirname(b.filePath), appDir, aliases, loadingFileToName, lazyImports, importedModules,
    );
    notFoundFallbackNames.push(ownFallback);
    const ownErrorName = resolveErrorComponentName(
      path.dirname(b.filePath), appDir, aliases, errorFileToName, lazyImports, importedModules,
    );
    const wrapped = renderComponentWithLayouts(`<${name} />`, b.layouts, layoutNames, layoutTitles, ownFallback, ownErrorName, 10);
    const routePath = b.dirRoutePath === rootEffectivePath ? '*' : `${b.dirRoutePath}/*`;
    notFoundRouteLines.push(`        <Route path="${routePath}" element={${wrapped}} />`);
  }

  if (!hasRootCustomNotFound) {
    notFoundRouteLines.push(`        <Route path="*" element={<Default404 />} />`);
  }

  const usesDefaultSpinner =
    Array.from(layoutLoadingNames.values()).includes('Spinner') ||
    Array.from(pageLoadingNames.values()).includes('Spinner') ||
    notFoundFallbackNames.includes('Spinner');

  const errorBoundaryClass = generateErrorBoundary(ts);
  const titleSetterFn = generateTitleSetter(ts);
  const spinnerFn = usesDefaultSpinner ? DEFAULT_LOADING_COMPONENT : '';

  const basenameValue = basePath || (import.meta as any).env?.BASE_URL || '/';

  return `// @ts-nocheck
// oxlint-disable
// oxfmt-ignore
// ⚠️  Auto-generated by bini-router — do not edit.

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';

${lazyImports.join('\n')}

// ─── Error Boundary ───────────────────────────────────────────────────────────
${errorBoundaryClass}

${spinnerFn}

${titleSetterFn}

${!hasRootCustomNotFound ? DEFAULT_404_COMPONENT : ''}

export function AppRoutes() {
  return (
    <Routes>
${routeLines.join('\n')}
${notFoundRouteLines.join('\n')}
    </Routes>
  );
}

export const basename = ${JSON.stringify(basenameValue)};

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <AppRoutes />
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

// ─── API Server ─────────────────────────────────────────────────────────────────

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
  corsConfig: boolean | { origin?: string; methods?: string[]; headers?: string[] },
  getCache: () => { routes: ApiRoute[] } | null,
  setCache: (v: { routes: ApiRoute[] }) => void,
  bodySizeLimit: number = DEFAULT_BODY_SIZE_LIMIT,
): Promise<void> {
  try {
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    if (!allowedMethods.includes(req.method)) {
      res.statusCode = 405;
      res.setHeader('Allow', allowedMethods.join(', '));
      res.end();
      return;
    }
    
    if (corsConfig) {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        
        const corsOptions = typeof corsConfig === 'boolean' 
          ? { origin: '*', methods: allowedMethods, headers: 'Content-Type, Authorization, X-Requested-With' }
          : { origin: corsConfig.origin || '*', methods: corsConfig.methods || allowedMethods, headers: corsConfig.headers || 'Content-Type, Authorization, X-Requested-With' };
        
        res.setHeader('Access-Control-Allow-Origin', corsOptions.origin);
        res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', corsOptions.headers);
        if (corsOptions.origin !== '*') {
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        res.setHeader('Access-Control-Max-Age', '86400');
        res.end();
        return;
      }
    }

    let cache = getCache();
    if (!cache) {
      const rawRoutes = scanApiRoutes(apiDir, '');
      cache = { 
        routes: rawRoutes.map(route => ({
          ...route,
          routePath: route.routePath.replace(/^\/api/, '') || '/'
        }))
      };
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
    let totalSize = 0;
    
    for await (const chunk of req) {
      if (chunk instanceof Buffer) {
        totalSize += chunk.length;
        if (totalSize > bodySizeLimit) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
            error: 'Payload Too Large', 
            message: `Request body exceeds ${bodySizeLimit} bytes limit` 
          }));
          return;
        }
        chunks.push(chunk);
      }
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

        if (corsConfig) {
          const headers = new Headers(webRes.headers);
          const corsOptions = typeof corsConfig === 'boolean' 
            ? { origin: '*', methods: allowedMethods }
            : { origin: corsConfig.origin || '*', methods: corsConfig.methods || allowedMethods };
          
          headers.set('Access-Control-Allow-Origin', corsOptions.origin);
          headers.set('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
          if (corsOptions.origin !== '*') {
            headers.set('Access-Control-Allow-Credentials', 'true');
          }
          
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

export function biniroute(options: BiniPluginOptions = {}): Plugin[] {
  const { 
    cors: corsConfig = false,
    strictMode = true,
    basePath = '',
    bodySizeLimit = DEFAULT_BODY_SIZE_LIMIT
  } = options;

  const getAppDir = (): string => path.join(process.cwd(), options.appDir ?? 'src/app');
  const getApiDir = (): string => path.join(process.cwd(), options.apiDir ?? 'src/app/api');

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastGeneratedCode = '';
  let honoCache: { routes: ApiRoute[] } | null = null;
  const eventLog = new Map<string, number>();
  let isGenerating = false;

  // ─── Build mode detection ──────────────────────────────────────────────
  let isBuild = false;

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
        const mod = server.moduleGraph.getModuleById('\0virtual:bini-routes');
        if (mod) server.moduleGraph.invalidateModule(mod);
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

  const routerPlugin: Plugin = {
    name: 'bini-router',
    enforce: 'pre',

    // ─── CONFIG: Detect build mode ──────────────────────────────────────────
    config(_, env) {
      isBuild = env.command === 'build';
      applyApp();
    },

    transform: {
      filter: {
        id: { include: /\.(tsx|jsx|ts|js|mdx|md)$/ },
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

    buildStart(): void {
      applyApp();
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
          req.url = req.url.replace(/^\/api/, '') || '/';
          handleApiRequest(req, res, next, apiDir, corsConfig,
            () => honoCache, (v) => { honoCache = v; }, bodySizeLimit);
        });
      }
    },

    async configurePreviewServer(server): Promise<void> {
      const apiDir = getApiDir();
      if (fs.existsSync(apiDir)) {
        server.middlewares.use((req: any, res: any, next: any) => {
          if (!req.url?.startsWith('/api')) return next();
          req.url = req.url.replace(/^\/api/, '') || '/';
          handleApiRequest(req, res, next, apiDir, corsConfig,
            () => honoCache, (v) => { honoCache = v; }, bodySizeLimit);
        });
      }

      addSpaFallback(server);
    },

    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        try {
          // ─── INJECT CSS LINK FOR PRODUCTION BUILDS ────────────────────
          // ctx.bundle contains all bundled files, including CSS
          if (isBuild && ctx.bundle) {
            const cssFiles: string[] = [];
            for (const [fileName] of Object.entries(ctx.bundle)) {
              if (fileName.endsWith('.css')) {
                cssFiles.push(fileName);
              }
            }
            
            if (cssFiles.length > 0) {
              const cssLinks = cssFiles.map(f => 
                `<link rel="stylesheet" href="/${f}">`
              ).join('\n    ');
              
              if (!html.includes('rel="stylesheet"')) {
                html = html.replace('</head>', `${cssLinks}\n  </head>`);
              }
            }
          }
          // ─── END CSS INJECTION ────────────────────────────────────────

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

    resolveId(id) {
      if (id === 'virtual:bini-routes' || id === '\0virtual:bini-routes') {
        return '\0virtual:bini-routes';
      }
      return null;
    },

    load(id) {
      if (id === '\0virtual:bini-routes') {
        const appDir = getAppDir();
        return getRouteManifestModule(appDir, basePath);
      }
      return null;
    },
  };

  const mdxPlugin = mdx({
    jsxImportSource: 'react',
    mdExtensions: [],
    mdxExtensions: ['.mdx', '.md'],
    ...options.mdx,
  }) as unknown as Plugin;

  return [routerPlugin, mdxPlugin];
}

export type { Plugin, ViteDevServer } from 'vite';