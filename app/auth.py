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
    
    If SUPABASE_JWT_SECRET is not set, authentication is disabled (dev mode).
    """

    async def dispatch(self, request: Request, call_next):
        # Skip auth if not configured (local dev)
        if not settings.supabase_jwt_secret:
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
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
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

        return await call_next(request)
