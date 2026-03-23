"""Supabase Auth — optional JWT verification middleware for FastAPI."""

import jwt
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, RedirectResponse

from app.config import settings

logger = logging.getLogger(__name__)

# Paths that don't require authentication
PUBLIC_PATHS = {"/login", "/health", "/docs", "/openapi.json", "/redoc"}
PUBLIC_PREFIXES = ("/static",)


def _browser_prefers_html(request: Request) -> bool:
    """Detect full-document navigations vs fetch/XHR (case-insensitive Accept, Fetch Metadata)."""
    accept = (request.headers.get("accept") or "").lower()
    if "text/html" in accept:
        return True
    dest = (request.headers.get("sec-fetch-dest") or "").lower()
    if dest in ("document", "iframe"):
        return True
    return False


class AuthMiddleware(BaseHTTPMiddleware):
    """Verify Supabase JWT from cookie or Authorization header.
    
    Automatically fetches public keys (JWKS) from Supabase to support
    modern RS256/ES256 tokens, falling back to graceful errors if unconfigured.
    """

    def __init__(self, app):
        super().__init__(app)
        # Initialize the JWKS client once when the app starts.
        # This caches the public keys so we don't make a network request on every API call.
        self.jwks_client = None
        if getattr(settings, "supabase_url", None):
            jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
            self.jwks_client = jwt.PyJWKClient(jwks_url)

    async def dispatch(self, request: Request, call_next):
        # Skip auth if not configured (local dev)
        if not settings.supabase_url:
            return await call_next(request)

        path = request.url.path

        # Allow public paths
        if path in PUBLIC_PATHS or any(path.startswith(p) for p in PUBLIC_PREFIXES):
            return await call_next(request)

        # Try cookie first, then Authorization header
        token = request.cookies.get("access_token")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]

        if not token:
            # Redirect browser navigations; return JSON for fetch/XHR (do not raise HTTPException
            # from middleware — Starlette/FastAPI may not convert it cleanly to a response).
            if _browser_prefers_html(request):
                return RedirectResponse("/login")
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)

        try:
            if not self.jwks_client:
                return JSONResponse(
                    {"detail": "Auth not configured correctly"},
                    status_code=500,
                )
            
            # 1. Get the specific public key used to sign this token
            signing_key = self.jwks_client.get_signing_key_from_jwt(token)

            # 2. Decode the token using the dynamic public key and allow modern algorithms
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["HS256", "RS256", "ES256"], 
                audience="authenticated",
            )
            
            # Attach user info to request state
            request.state.user_id = payload.get("sub")
            request.state.user_email = payload.get("email", "")
            
        except jwt.ExpiredSignatureError:
            if _browser_prefers_html(request):
                return RedirectResponse("/login")
            return JSONResponse({"detail": "Token expired"}, status_code=401)

        except jwt.InvalidTokenError as e:
            logger.warning("Invalid JWT: %s", e)
            if _browser_prefers_html(request):
                return RedirectResponse("/login")
            return JSONResponse({"detail": "Invalid token"}, status_code=401)

        except Exception as e:
            logger.error("JWT Verification Error: %s", e)
            if _browser_prefers_html(request):
                return RedirectResponse("/login")
            return JSONResponse({"detail": "Authentication failed"}, status_code=401)

        return await call_next(request)
