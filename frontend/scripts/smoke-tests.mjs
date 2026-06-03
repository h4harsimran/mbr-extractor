import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const outdir = join(process.cwd(), "node_modules", ".tmp", "smoke-tests");
await mkdir(outdir, { recursive: true });
const outfile = join(outdir, "frontend-smoke.mjs");
await esbuild.build({
  entryPoints: ["scripts/smoke-entry.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  logLevel: "silent",
});
await import(pathToFileURL(outfile).href);
