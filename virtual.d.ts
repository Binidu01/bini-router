declare module 'virtual:bini-app' {
  const App: import('react').ComponentType
  export default App
  export const basename: string
  export const routes: import('react-router-dom').RouteObject[]
  export function AppRoutes(): import('react').ReactElement | null
  export function getRouter(): ReturnType<typeof import('react-router-dom').createBrowserRouter>
  export function preloadRoute(pathname: string): Promise<unknown>
  export function routerReady(): Promise<void>
  export function resetNavState(): void
  export function reportBiniError(
    error: unknown,
    componentStack: string | null | undefined,
    kind: 'caught' | 'uncaught',
  ): void
  export const rootOptions: {
    onCaughtError: (error: unknown, info: { componentStack?: string | null }) => void
    onUncaughtError: (error: unknown, info: { componentStack?: string | null }) => void
    onRecoverableError: (error: unknown, info: { componentStack?: string | null }) => void
  }
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
  const manifest: { static: string[]; dynamic: string[]; all: string[]; metadata: Record<string, RouteInfo> }
  export default manifest
}