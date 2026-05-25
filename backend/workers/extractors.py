import time
import logging
from typing import Generator, List, Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)


def get_auth_headers(
    auth_type: str, 
    auth_token: str, 
    custom_headers: Optional[Dict[str, str]] = None
) -> Dict[str, str]:
    """
    Constructs the HTTP request headers by injecting the auth token
    and merging any user-specified custom query headers.
    """
    headers = {}
    
    # 1. Inject authorization tokens based on authentication configuration type
    auth_type_lower = auth_type.strip().lower()
    
    if auth_type_lower == "bearer" and auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    elif auth_type_lower == "basic" and auth_token:
        headers["Authorization"] = f"Basic {auth_token}"
    elif auth_type_lower == "apikey" and auth_token:
        headers["X-API-Key"] = auth_token
        
    # 2. Merge custom headers payload (e.g., custom Tenant tags or Client details)
    if custom_headers:
        for key, val in custom_headers.items():
            headers[str(key)] = str(val)
            
    return headers


def resolve_data_path(data: Any, path: Optional[str]) -> Any:
    """
    Drills down into a nested dictionary/list structure based on a dot-notation path.
    Supports formats like 'results', '$.results', '$.data.items', and numeric list indices.
    """
    if not path:
        return data
        
    path = path.strip()
    if path.startswith("$."):
        path = path[2:]
    elif path.startswith("$"):
        path = path[1:]
        
    if not path:
        return data
        
    parts = path.split(".")
    current = data
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list):
            if part.isdigit():
                idx = int(part)
                if 0 <= idx < len(current):
                    current = current[idx]
                else:
                    return None
            else:
                return None
        else:
            return None
    return current


def extract_records_generator(
    endpoint_url: str,
    auth_config: Dict[str, Any],
    pagination_config: Dict[str, Any],
    custom_headers: Optional[Dict[str, str]] = None,
    data_path: Optional[str] = None
) -> Generator[List[Dict[str, Any]], None, None]:
    """
    Python generator that streams records page-by-page from a REST API endpoint.
    Maintains a pooled HTTPX client, handles common pagination protocols,
    and applies exponential backoff sleeps when encountering HTTP 429 (Too Many Requests).
    """
    auth_type = auth_config.get("authType", "bearer")
    auth_token = auth_config.get("authToken", "")
    headers = get_auth_headers(auth_type, auth_token, custom_headers)
    
    # Set up HTTP connection pool parameters to recycle sockets efficiently
    limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
    
    # Parse pagination strategy settings
    pag_type = pagination_config.get("type", "page").lower()  # page, offset, cursor
    limit = int(pagination_config.get("limit", 100))
    limit_param = pagination_config.get("limit_param", "limit")
    offset_param = pagination_config.get("offset_param", "offset")
    page_param = pagination_config.get("page_param", "page")
    
    page = 1
    offset = 0
    next_url = endpoint_url
    has_fetched = False
    
    with httpx.Client(limits=limits, timeout=30.0) as client:
        while True:
            params = {}
            url = endpoint_url
            
            # Dynamically compile pagination arguments
            if pag_type == "page":
                params[page_param] = page
                params[limit_param] = limit
            elif pag_type == "offset":
                params[offset_param] = offset
                params[limit_param] = limit
            elif pag_type == "cursor":
                url = next_url
                if not url:
                    break
            
            retries = 3
            backoff = 2.0
            response = None
            
            while retries > 0:
                try:
                    response = client.get(url, headers=headers, params=params)
                    
                    # Handle rate limiting specifically
                    if response.status_code == 429:
                        retry_after = response.headers.get("Retry-After")
                        sleep_time = float(retry_after) if (retry_after and retry_after.isdigit()) else backoff
                        logger.warning(f"Rate limited (HTTP 429). Sleeping for {sleep_time}s before retrying.")
                        time.sleep(sleep_time)
                        retries -= 1
                        backoff *= 2
                        continue
                        
                    # Handle pagination boundary (HTTP 404)
                    if response.status_code == 404 and has_fetched:
                        logger.info("Received HTTP 404 on pagination boundary. Concluding extraction stream.")
                        response = None
                        break
                        
                    response.raise_for_status()
                    break
                except httpx.HTTPError as e:
                    retries -= 1
                    if retries == 0:
                        raise ConnectionError(f"HTTP extraction request failed after retries: {str(e)}") from e
                    logger.warning(f"Connection error occurred: {str(e)}. Retrying in {backoff}s...")
                    time.sleep(backoff)
                    backoff *= 2
                    
            if not response:
                break
                
            data = response.json()
            
            # Drill down to nested node if path is specified
            target_data = resolve_data_path(data, data_path)
            
            # Extract list records array from potential wrapping objects in response
            records = None
            if isinstance(target_data, list):
                records = target_data
            elif isinstance(target_data, dict):
                # Try common object wrapper attributes
                for key in ("data", "records", "results", "items"):
                    if key in target_data and isinstance(target_data[key], list):
                        records = target_data[key]
                        break
                # Fallback: check if any value in the target dictionary is a list
                if records is None:
                    for val in target_data.values():
                        if isinstance(val, list):
                            records = val
                            break
                            
            if not records:
                logger.info("Empty records set yielded. Concluding extraction stream.")
                break
                
            yield records
            has_fetched = True
            
            # Shift cursors / offsets for subsequent page dial
            if pag_type == "page":
                page += 1
            elif pag_type == "offset":
                offset += len(records)
                if len(records) < limit:
                    break  # Final page reached
            elif pag_type == "cursor":
                next_url = None
                # Check inside JSON payload for next cursor strings
                if "next" in data and isinstance(data["next"], str):
                    next_url = data["next"]
                elif "next_page" in data and isinstance(data["next_page"], str):
                    next_url = data["next_page"]
                
                # Check HTTP Link headers
                if not next_url and "link" in response.headers:
                    links = response.headers["link"].split(",")
                    for link in links:
                        if 'rel="next"' in link:
                            next_url = link.split(";")[0].strip("< >")
                            break
                            
                if not next_url:
                    break  # No cursor returned, extraction concluded
