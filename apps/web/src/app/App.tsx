import { Suspense, useSyncExternalStore } from 'react';
import { matchRoute, routes } from './routes';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

export function navigate(path: string) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function App() {
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname);
  const route = matchRoute(pathname);
  if (!route) {
    return (
      <main className="grid h-full place-items-center p-6 text-center">
        <p className="text-card">
          That page doesn’t exist.{' '}
          <a className="underline" href="/">
            Back to the camera.
          </a>
        </p>
      </main>
    );
  }
  const Route = routes[route];
  return (
    <Suspense fallback={null}>
      <Route />
    </Suspense>
  );
}
