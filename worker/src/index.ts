// ── Hono app entry point ───────────────────────────────────────────

import { Hono } from "hono";
import extractRouter from "./routes/extract";
import buildScopeRouter from "./routes/build-scope";
import { getConfig, isAllowedOrigin } from "./config";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Resource-Policy": "same-site",
};

app.use("*", async (c, next) => {
  const config = getConfig(c.env);
  const origin = c.req.header("Origin") ?? null;
  const allowed = isAllowedOrigin(origin, config);

  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => c.header(key, value));
  c.header("Vary", "Origin");

  if (allowed && origin) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    c.header("Access-Control-Max-Age", "86400");
  }

  if (c.req.method === "OPTIONS") {
    return c.body(null, allowed ? 204 : 403);
  }

  await next();
});

app.get("/api/health", (c) => c.json({ status: "ok", service: "mbr-extractor-api" }));
app.route("/api", extractRouter);
app.route("/api", buildScopeRouter);

export default app;
