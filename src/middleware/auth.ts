import type { MiddlewareHandler } from 'hono';
import {
  unstable_formatRouterRequest as formatRouterRequest,
  unstable_parseRouterRequest as parseRouterRequest,
} from 'waku/router/server';
import { getSessionForHeaders } from '../features/auth/guard';

const PROTECTED_PREFIXES = [
  '/library',
  '/search',
  '/series',
  '/settings',
  '/import',
  '/admin',
];

const isProtectedPath = (path: string) =>
  path === '/' ||
  PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

const authMiddleware = (): MiddlewareHandler => async (c, next) => {
  // Middleware runs before the router, so it sees both document and RSC requests.
  const route = parseRouterRequest(c.req.raw);
  if (route?.type === 'route' && isProtectedPath(route.path)) {
    const session = await getSessionForHeaders(c.req.raw.headers);
    if (!session) {
      const callbackUrl = route.query
        ? `${route.path}?${route.query}`
        : route.path;
      const location = formatRouterRequest(
        c.req.raw,
        '/login',
        new URLSearchParams({ callbackUrl }).toString(),
      );
      if (location) {
        return c.redirect(location.pathname + location.search, 303);
      }
    }
  }
  await next();
};

export default authMiddleware;
