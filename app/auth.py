"""Supabase Auth — optional JWT verification middleware for FastAPI."""

import jwt
import logging
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse

from app.config import settings

logger = logging.getLogger(__name__)

# Paths that don't require authentication
PUBLIC_PATHS = {"/login", "/health", "/docs", "/openapi.json", "/redoc"}
PUBLIC_PREFIXES = ("/static",)


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
            # Redirect browser requests to login, reject API requests
            if "text/html" in request.headers.get("accept", ""):
                return RedirectResponse("/login")
            raise HTTPException(status_code=401, detail="Not authenticated")

        try:
            if not self.jwks_client:
                raise HTTPException(status_code=500, detail="Auth not configured correctly")
            
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
            if "text/html" in request.headers.get("accept", ""):
                return RedirectResponse("/login")
            raise HTTPException(status_code=401, detail="Token expired")
            
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid JWT: %s", e)
            if "text/html" in request.headers.get("accept", ""):
                return RedirectResponse("/login")
            raise HTTPException(status_code=401, detail="Invalid token")
            
        except Exception as e:
            logger.error("JWT Verification Error: %s", e)
            raise HTTPException(status_code=401, detail="Authentication failed")

        return await call_next(request)
