import type { ComponentType, ReactElement } from 'react';
import type { RouteObject, createBrowserRouter } from 'react-router-dom';

declare module 'virtual:bini-app' {
  const App: ComponentType;
  export default App;
  export const basename: string;
  export const routes: RouteObject[];
  export function AppRoutes(): ReactElement | null;
  export function getRouter(): ReturnType<typeof createBrowserRouter>;
  export function preloadRoute(pathname: string): Promise<unknown>;
  export function routerReady(): Promise<void>;
  export function resetNavState(): void;

  /**
   * Report a runtime error to the bini-overlay error channel.
   *
   * - Dev only; no-op when `import.meta.env.DEV` is false or `window` is undefined.
   * - Deduped per error object via an internal `WeakSet`.
   * - `kind === 'caught'` skips `Error` objects with `status === 404`.
   */
  export function reportBiniError(
    error: unknown,
    componentStack: string | null | undefined,
    kind: 'caught' | 'uncaught' | 'recoverable',
  ): void;

  /**
   * React 19 root callbacks. Pass to `createRoot(el, rootOptions)` and
   * `hydrateRoot(el, tree, rootOptions)` so every boundary-reported error
   * reaches `reportBiniError`.
   */
  export const rootOptions: {
    onCaughtError: (
      error: unknown,
      info: { componentStack?: string | null },
    ) => void;
    onUncaughtError: (
      error: unknown,
      info: { componentStack?: string | null },
    ) => void;
    onRecoverableError: (
      error: unknown,
      info: { componentStack?: string | null },
    ) => void;
  };
}

declare module 'virtual:bini-routes' {
  export const staticRoutes: string[];
  export const dynamicRoutes: string[];
  export const allRoutes: string[];
  export const routeMetadata: Record<string, {
    title?: string;
    dynamic: boolean;
    catchallParamName?: string;
    loader?: boolean;
    action?: boolean;
    shouldRevalidate?: boolean;
    errorBoundary?: boolean;
    hydrateFallback?: boolean;
    handle?: boolean;
  }>;
  const manifest: { static: string[]; dynamic: string[]; all: string[]; metadata: Record<string, unknown> };
  export default manifest;
}