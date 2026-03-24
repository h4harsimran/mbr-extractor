// ── Hono app entry point ───────────────────────────────────────────

import { Hono } from "hono";
import { cors } from "hono/cors";
import extractRouter from "./routes/extract";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

// ── CORS — allow frontend origin ───────────────────────────────────
app.use(
  "/api/*",
  cors({
    origin: "*", // Tighten in production to your Pages domain
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  })
);

// ── Health check ───────────────────────────────────────────────────
app.get("/api/health", (c) => {
  return c.json({ status: "ok", service: "mbr-extractor-api" });
});

// ── Extraction routes ──────────────────────────────────────────────
app.route("/api", extractRouter);

export default app;
