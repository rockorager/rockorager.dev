import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(({ url, redirect }, next) => {
  const path = url.pathname;
  if (path === "/posts" || path === "/posts/") return redirect(`/blog/${url.search}`, 301);
  if (path.startsWith("/posts/") && !path.endsWith("/index.xml")) {
    return redirect(path.replace(/^\/posts\//, "/blog/") + url.search, 301);
  }
  // Keep the site's canonical trailing-slash page URLs, not the CMS API paths.
  if (/^\/(blog|misc)(\/[^/.]+)?$/.test(path)) return redirect(`${path}/${url.search}`, 301);
  return next();
});
