import time
import logging
import json
from typing import Generator, List, Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)

def get_auth_headers(
    auth_type: str, 
    auth_token: str, 
    custom_headers: Optional[Dict[str, str]] = None
) -> Dict[str, str]:
    """Constructs HTTP request headers based on authentication configuration.

    Args:
        auth_type: Authentication strategy name (bearer, basic, apikey).
        auth_token: Secret credentials token.
        custom_headers: Dynamic headers to merge.

    Returns:
        dict: Configured headers payload dictionary.
    """
    headers = {}
    auth_type_lower = auth_type.strip().lower()
    
    if auth_type_lower == "bearer" and auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    elif auth_type_lower == "basic" and auth_token:
        headers["Authorization"] = f"Basic {auth_token}"
    elif auth_type_lower == "apikey" and auth_token:
        headers["X-API-Key"] = auth_token
        
    if custom_headers:
        for key, val in custom_headers.items():
            headers[str(key)] = str(val)
            
    return headers

def resolve_data_path(data: Any, path: Optional[str]) -> Any:
    """Drills down into nested dictionaries or lists using a dot-notation path.

    Args:
        data: Parent dynamic data object.
        path: Path string (e.g. $.results, results.items).

    Returns:
        Any: Matching nested element value.
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
    """Generates continuous streams of records from API endpoint.

    Args:
        endpoint_url: Target URL.
        auth_config: Credentials config.
        pagination_config: Pagination strategy parameters.
        custom_headers: Extra custom headers.
        data_path: Target nested property path.

    Yields:
        list: Page records array.

    Raises:
        ConnectionError: Request failure or authorization errors.
    """
    auth_type = auth_config.get("authType", "bearer")
    auth_token = auth_config.get("authToken", "")
    headers = get_auth_headers(auth_type, auth_token, custom_headers)
    logger.info(
        f"Extractor auth resolved: type={auth_type!r}"
    )

    limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
    raw_pag_type = str(pagination_config.get("type") or "").strip().lower()
    pag_type = raw_pag_type if raw_pag_type in ("page", "offset", "cursor") else "none"
    limit = int(pagination_config.get("limit", 100))
    limit_param = pagination_config.get("limit_param", "limit")
    offset_param = pagination_config.get("offset_param", "offset")
    page_param = pagination_config.get("page_param", "page")
    
    page = 1
    offset = 0
    next_url = endpoint_url
    has_fetched = False
    prev_records_sig = None
    pages_fetched = 0
    
    with httpx.Client(limits=limits, timeout=30.0) as client:
        while True:
            params = {}
            url = endpoint_url

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

                    if response.status_code in (401, 403):
                        raise ConnectionError(
                            f"HTTP {response.status_code} {'Unauthorized' if response.status_code == 401 else 'Forbidden'} "
                            f"for url '{url}'. Check that authType and authToken are correct. "
                            f"Response: {response.text[:300]}"
                        )

                    if response.status_code == 429:
                        retry_after = response.headers.get("Retry-After")
                        sleep_time = float(retry_after) if (retry_after and retry_after.isdigit()) else backoff
                        logger.warning(f"Rate limited (HTTP 429). Sleeping for {sleep_time}s before retrying.")
                        time.sleep(sleep_time)
                        retries -= 1
                        backoff *= 2
                        continue

                    if response.status_code == 404 and has_fetched:
                        logger.info("Received HTTP 404 on pagination boundary. Concluding extraction stream.")
                        response = None
                        break

                    response.raise_for_status()
                    break
                except ConnectionError:
                    raise
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
            target_data = resolve_data_path(data, data_path)
            records = None
            if isinstance(target_data, list):
                records = target_data
            elif isinstance(target_data, dict):
                for key in ("data", "records", "results", "items"):
                    if key in target_data and isinstance(target_data[key], list):
                        records = target_data[key]
                        break
                if records is None:
                    for val in target_data.values():
                        if isinstance(val, list):
                            records = val
                            break
                            
            if not records:
                logger.info("Empty records set yielded. Concluding extraction stream.")
                break
                
            records_sig = json.dumps(records[:5], sort_keys=True)
            if prev_records_sig and prev_records_sig == records_sig:
                break
            prev_records_sig = records_sig
            
            pages_fetched += 1
            if pages_fetched > 500:
                logger.warning("Hard safety limit of MAX_PAGES reached. Terminating to prevent infinite loop.")
                break
                
            yield records
            has_fetched = True

            if pag_type == "none":
                break

            if len(records) < limit:
                break
            
            if pag_type == "page":
                page += 1
            elif pag_type == "offset":
                offset += len(records)
                if len(records) < limit:
                    break
            elif pag_type == "cursor":
                next_url = None
                if "next" in data and isinstance(data["next"], str):
                    next_url = data["next"]
                elif "next_page" in data and isinstance(data["next_page"], str):
                    next_url = data["next_page"]
                
                if not next_url and "link" in response.headers:
                    links = response.headers["link"].split(",")
                    for link in links:
                        if 'rel="next"' in link:
                            next_url = link.split(";")[0].strip("< >")
                            break
                            
                if not next_url:
                    break
