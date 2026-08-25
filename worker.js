import { onRequestPost } from "./functions/api/optimize.js";

const BLOCKED_PREFIXES = ["/functions/", "/.freebuff/", "/__optimize-cache/"];
const BLOCKED_PATHS = new Set(["/worker.js", "/wrangler.toml"]);

const IMMUTABLE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".otf",
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/optimize") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }

      return onRequestPost({
        request,
        env,
        waitUntil: promise => ctx.waitUntil(promise),
      });
    }

    /* Do not expose deployment source/config files as public assets. */
    if (BLOCKED_PATHS.has(url.pathname) || BLOCKED_PREFIXES.some(p => url.pathname.startsWith(p))) {
      return new Response("Not Found", { status: 404 });
    }

    const assetResponse = await env.ASSETS.fetch(request);

    /* Immutable assets get long-lived browser caching; HTML stays revalidated. */
    if (assetResponse.status === 200) {
      const extension = url.pathname.slice(url.pathname.lastIndexOf(".")).toLowerCase();
      const cached = new Response(assetResponse.body, assetResponse);
      if (IMMUTABLE_EXTENSIONS.has(extension)) {
        cached.headers.set("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        cached.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
      }
      cached.headers.set("X-Content-Type-Options", "nosniff");
      return cached;
    }

    return assetResponse;
  },
};
