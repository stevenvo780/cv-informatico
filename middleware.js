import { rewrite } from '@vercel/edge';

/**
 * Tip+1: vercel.json rewrites lose to filesystem when public/index.html
 * exists for `/`. Edge Middleware runs BEFORE the filesystem check, so
 * `/?lang=en` can be rewritten to the dual EN static file while the
 * browser URL stays `/?lang=en` (hreflang/sitemap intact; app.js still
 * boots EN from the query).
 *
 * noindex stays on internal `/index-en*` via vercel.json headers only —
 * this rewrite does not attach X-Robots-Tag to `/?lang=en`.
 */
export const config = {
  matcher: '/',
};

export default function middleware(request) {
  const url = new URL(request.url);
  if (url.searchParams.get('lang') !== 'en') {
    return;
  }
  // cleanUrls: true → serve public/index-en.html at /index-en
  url.pathname = '/index-en';
  return rewrite(url);
}
