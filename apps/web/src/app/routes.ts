import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type RoutePath = '/' | '/bench' | '/about' | '/settings';

/** Each route is its own chunk so the camera screen stays inside the initial-JS budget. */
export const routes: Record<RoutePath, LazyExoticComponent<ComponentType>> = {
  '/': lazy(() => import('./CameraRoute')),
  '/bench': lazy(() => import('./BenchRoute')),
  '/about': lazy(() => import('./AboutRoute')),
  '/settings': lazy(() => import('./SettingsRoute')),
};

export function matchRoute(pathname: string): RoutePath | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return path in routes ? (path as RoutePath) : null;
}
