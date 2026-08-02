import asyncio
import json
import socket
import ipaddress
import httpx
from urllib.parse import urlparse
from sqlalchemy import text
from sqlalchemy.schema import CreateSchema
from sqlalchemy.sql import quoted_name
from typing import Dict, Any

def _is_public_ip(ip_str: str) -> bool:
    ip_obj = ipaddress.ip_address(ip_str)
    return not (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
        or ip_obj.is_unspecified
    )

def _validate_outbound_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)

    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https URLs are allowed.")

    if not parsed.hostname:
        raise ValueError("URL must include a valid hostname.")

    host = parsed.hostname

    try:
        # If host is an IP literal, validate it directly.
        ipaddress.ip_address(host)
        if not _is_public_ip(host):
            raise ValueError("URL resolves to a non-public IP address.")
    except ValueError:
        # Not an IP literal (or failed literal parse) - resolve DNS and validate all answers.
        try:
            addr_info = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
        except socket.gaierror:
            raise ValueError("Hostname could not be resolved.")

        if not addr_info:
            raise ValueError("Hostname could not be resolved.")

        for entry in addr_info:
            resolved_ip = entry[4][0]
            if not _is_public_ip(resolved_ip):
                raise ValueError("URL resolves to a non-public IP address.")

    return raw_url

async def test_db_connection(config: Dict[str, Any]) -> Dict[str, Any]:
    """Attempts to connect to a REST API url or database using config parameters with a strict timeout."""
    # Determine connection type
    is_source = "sourceUrl" in config
    
    if is_source:
        # Test REST API source connection
        url = config.get("sourceUrl", "")
        try:
            validated_url = _validate_outbound_url(url)
        except ValueError as url_exc:
            return {
                "success": False,
                "message": f"Invalid source URL: {str(url_exc)}"
            }

        auth_type = config.get("sourceAuthType", "none")
        token = config.get("sourceToken", "")
        headers_list = config.get("sourceHeaders", [])
        
        # Resolve decrypted token
        from backend.database.factory import get_decrypted_password
        token_decrypted = get_decrypted_password(token)
        
        headers = {}
        if auth_type == "bearer" and token_decrypted:
            headers["Authorization"] = f"Bearer {token_decrypted}"
        elif auth_type == "apikey" and token_decrypted:
            headers["X-API-Key"] = token_decrypted
            
        for h in headers_list:
            if isinstance(h, dict) and h.get("key"):
                headers[h["key"]] = h.get("value", "")
        
        try:
            async with httpx.AsyncClient(timeout=4.5) as client:
                response = await client.get(validated_url, headers=headers)
                return {
                    "success": True,
                    "message": f"Connection verified. HTTP Status {response.status_code}"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"REST API host unreachable: {str(e)}"
            }
    else:
        # Test Database destination connection
        dialect = config.get("targetDbDialect") or config.get("targetDb") or "postgresql"
        host = config.get("targetDbHost") or config.get("host", "127.0.0.1")
        port = config.get("targetDbPort") or config.get("port")
        db_name = config.get("targetDbName") or config.get("database", "")
        user = config.get("targetDbUser") or config.get("username", "")
        password = config.get("targetDbPassword") or config.get("password", "")
        
        if not port:
            if dialect == "postgresql":
                port = 5432
            elif dialect == "mysql":
                port = 3306
        
        from backend.database.factory import get_decrypted_password
        from backend.workers.connections import get_etl_connection
        
        password_decrypted = get_decrypted_password(password)
        
        target_config = {
            "targetDb": dialect,
            "host": host,
            "port": int(port) if port else None,
            "database": db_name,
            "username": user,
        }
        
        try:
            handler = get_etl_connection(dialect)
            connection_uri = handler.get_connection_uri(target_config, password_decrypted)
            engine = handler.create_engine(connection_uri)
            
            async def check_ping():
                async with engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
            
            try:
                await asyncio.wait_for(check_ping(), timeout=4.5)
                await engine.dispose()
            except Exception as conn_exc:
                await engine.dispose()
                err_msg = str(conn_exc)
                is_missing_db = "3D000" in err_msg or "does not exist" in err_msg
                
                if is_missing_db and dialect in ("postgresql", "postgres"):
                    # Database does not exist! Try to silently auto-heal / create it
                    temp_config = {**target_config, "database": "postgres"}
                    temp_uri = handler.get_connection_uri(temp_config, password_decrypted)
                    temp_engine = handler.create_engine(temp_uri).execution_options(isolation_level="AUTOCOMMIT")
                    
                    try:
                        async with temp_engine.connect() as conn:
                            import re
                            safe_db_name = re.sub(r'[^a-zA-Z0-9_]', '', db_name)
                            if not safe_db_name:
                                raise ValueError("Invalid database name")
                            await conn.execute(CreateSchema(quoted_name(safe_db_name, True)))
                        await temp_engine.dispose()
                        
                        # Reconnect to newly created database
                        engine = handler.create_engine(connection_uri)
                        await asyncio.wait_for(check_ping(), timeout=4.5)
                        await engine.dispose()
                    except Exception as fallback_exc:
                        await temp_engine.dispose()
                        return {
                            "success": False,
                            "message": f"Database connection failed: silent fallback creation failed: {str(fallback_exc)}"
                        }
                elif is_missing_db and dialect == "mysql":
                    temp_config = {**target_config, "database": "mysql"}
                    temp_uri = handler.get_connection_uri(temp_config, password_decrypted)
                    temp_engine = handler.create_engine(temp_uri).execution_options(isolation_level="AUTOCOMMIT")
                    
                    try:
                        async with temp_engine.connect() as conn:
                            import re
                            safe_db_name = re.sub(r'[^a-zA-Z0-9_]', '', db_name)
                            if not safe_db_name:
                                raise ValueError("Invalid database name")
                            await conn.execute(CreateSchema(quoted_name(safe_db_name, True), if_not_exists=True))
                        await temp_engine.dispose()
                        
                        engine = handler.create_engine(connection_uri)
                        await asyncio.wait_for(check_ping(), timeout=4.5)
                        await engine.dispose()
                    except Exception as fallback_exc:
                        await temp_engine.dispose()
                        return {
                            "success": False,
                            "message": f"Database connection failed: silent fallback creation failed: {str(fallback_exc)}"
                        }
                else:
                    return {
                        "success": False,
                        "message": f"Database connection failed: {err_msg}"
                    }
            
            return {
                "success": True,
                "message": "Database connection successful"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Database connection test error: {str(e)}"
            }
