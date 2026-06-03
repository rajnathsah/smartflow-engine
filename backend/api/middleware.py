import time
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError
from backend.config import settings
from backend.utils.logging import logger, tenant_uuid_context

class GlobalMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method
        PUBLIC_PATHS = {
            "/",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/google",
            "/api/v1/auth/reset-password",
        }
        tenant_id = None
        authorization = request.headers.get("Authorization")
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ", 1)[1]
            try:
                payload = jwt.decode(
                    token,
                    settings.JWT_SECRET_KEY,
                    algorithms=[settings.JWT_ALGORITHM]
                )
                tenant_id = payload.get("tenant_id") or payload.get("tenant_uuid")
            except JWTError:
                pass
        request.state.tenant_id = tenant_id
        is_public = path in PUBLIC_PATHS or method == "OPTIONS"
        if not is_public and not tenant_id:
            return JSONResponse(
                status_code=401,
                content={"detail": "Could not validate credentials"}
            )
        token_ctx = None
        if tenant_id:
            token_ctx = tenant_uuid_context.set(tenant_id)
        start_time = time.time()
        logger.info("request_started", method=method, path=path)
        try:
            response = await call_next(request)
            duration = time.time() - start_time
            logger.info("request_finished", method=method, path=path, status_code=response.status_code, duration=f"{duration:.4f}s")
            return response
        except Exception as e:
            duration = time.time() - start_time
            logger.error("request_failed", method=method, path=path, error=str(e), duration=f"{duration:.4f}s", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal Server Error"}
            )
        finally:
            if token_ctx:
                tenant_uuid_context.reset(token_ctx)
