import type { Env } from "./types";

export interface AppConfig {
  geminiApiKey: string | null;
  geminiModel: string;
  allowedOrigins: string[];
  maxRequestBytes: number;
  maxImageBase64Chars: number;
  debugRawModelOutput: boolean;
}

const DEFAULT_MODEL = "gemini-3-flash-preview";
const DEFAULT_MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_BASE64_CHARS = 5_500_000;
const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === "true";
}

function parseOrigins(value: string | undefined): string[] {
  const configured =
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
  return Array.from(new Set([...configured, ...LOCAL_DEV_ORIGINS]));
}

export function getConfig(env: Env): AppConfig {
  return {
    geminiApiKey: env.GEMINI_API_KEY?.trim() || null,
    geminiModel: env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    maxRequestBytes: parsePositiveInt(env.MAX_REQUEST_BYTES, DEFAULT_MAX_REQUEST_BYTES),
    maxImageBase64Chars: parsePositiveInt(
      env.MAX_IMAGE_BASE64_CHARS,
      DEFAULT_MAX_IMAGE_BASE64_CHARS
    ),
    debugRawModelOutput: parseBoolean(env.DEBUG_RAW_MODEL_OUTPUT),
  };
}

export function isAllowedOrigin(origin: string | null, config: AppConfig): boolean {
  if (!origin) return false;
  return config.allowedOrigins.includes(origin);
}
