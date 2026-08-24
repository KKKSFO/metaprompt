import { onRequestPost } from "./functions/api/optimize.js";

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
    if (
      url.pathname === "/worker.js" ||
      url.pathname === "/wrangler.toml" ||
      url.pathname.startsWith("/functions/") ||
      url.pathname.startsWith("/.freebuff/")
    ) {
      return new Response("Not Found", { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
