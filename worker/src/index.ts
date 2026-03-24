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
    origin: (origin) => {
      // Localhost or requests with missing origins (some tools) default to local port.
      if (!origin) return "http://localhost:5173";
      // Allow local development and exact Pages production domain explicitly
      if (origin === "https://mbr-extractor-frontend.pages.dev" || origin.startsWith("http://localhost:")) {
        return origin;
      }
      return "http://localhost:5173"; // Default fallback
    },
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
