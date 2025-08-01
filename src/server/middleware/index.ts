import type { SessionUser } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { civitaiTokenCookieName } from '~/libs/auth';
import { apiCacheMiddleware } from '~/server/middleware/api-cache.middleware';
import { apiRegionBlockMiddleware } from '~/server/middleware/api-region-block.middleware';
import type { Middleware } from '~/server/middleware/middleware-utils';
import { redirectsMiddleware } from '~/server/middleware/redirects.middleware';
import { regionBlockMiddleware } from '~/server/middleware/region-block.middleware';
import { routeGuardsMiddleware } from '~/server/middleware/route-guards.middleware';

// NOTE: order matters! Region blocking should come first
const middlewares: Middleware[] = [
  regionBlockMiddleware,
  apiRegionBlockMiddleware,
  routeGuardsMiddleware,
  apiCacheMiddleware,
  redirectsMiddleware,
];

export const middlewareMatcher = middlewares.flatMap((middleware) => middleware.matcher);

export async function runMiddlewares(request: NextRequest) {
  let user: SessionUser | null = null;
  let hasToken = true;
  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url));

  for (const middleware of middlewares) {
    if (middleware.shouldRun && !middleware.shouldRun(request)) continue;
    if (middleware.useSession && !user && hasToken) {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: civitaiTokenCookieName,
      });
      if (!token) hasToken = false;
      user = token?.user as SessionUser;
    }

    const response = await middleware.handler({
      request,
      user,
      redirect,
    });
    if (response) return response;
  }

  return NextResponse.next();
}
