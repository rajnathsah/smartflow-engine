import os
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.workers.extractors import extract_records_generator

class MockAPIHandler(BaseHTTPRequestHandler):
    """HTTP handler mocking API responses for test verification."""

    def log_message(self, format, *args):
        """Mutes internal logging to keep execution output readable."""
        pass

    def do_GET(self):
        """Serves mock endpoints for pagination and limit boundary checks."""
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        
        parsed_url = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_url.query)
        
        if "/short-page" in parsed_url.path:
            page_num = query_params.get("page", ["1"])[0]
            if page_num == "1":
                data = [{"id": i} for i in range(10)]
            else:
                data = [{"id": i} for i in range(10, 13)]
            self.wfile.write(json.dumps(data).encode())
            
        elif "/duplicate" in parsed_url.path:
            data = [{"id": i} for i in range(5)]
            self.wfile.write(json.dumps(data).encode())
            
        elif "/infinite" in parsed_url.path:
            page_num = query_params.get("page", ["1"])[0]
            data = [{"id": f"page-{page_num}-item-{i}"} for i in range(10)]
            self.wfile.write(json.dumps(data).encode())

def run_mock_server(server):
    """Starts the HTTP server instance.

    Args:
        server: The server instance.
    """
    server.serve_forever()

def run_tests():
    """Runs test assertions against mock server response flows."""
    server = HTTPServer(("127.0.0.1", 0), MockAPIHandler)
    port = server.server_port
    server_thread = threading.Thread(target=run_mock_server, args=(server,), daemon=True)
    server_thread.start()
    
    base_url = f"http://127.0.0.1:{port}"
    print(f"Mock server running on {base_url}")
    
    print("\n--- 1. Testing Short-Page Break ---")
    gen = extract_records_generator(
        endpoint_url=f"{base_url}/short-page",
        auth_config={"authType": "none"},
        pagination_config={"type": "page", "limit": 10, "page_param": "page", "limit_param": "limit"}
    )
    pages = list(gen)
    print(f"Total pages received: {len(pages)}")
    print(f"Page 1 records: {len(pages[0])}")
    print(f"Page 2 records: {len(pages[1])}")
    assert len(pages) == 2
    assert len(pages[0]) == 10
    assert len(pages[1]) == 3
    print("Short-page break verified successfully.")
    
    print("\n--- 2. Testing Duplicate Data Break ---")
    gen = extract_records_generator(
        endpoint_url=f"{base_url}/duplicate",
        auth_config={"authType": "none"},
        pagination_config={"type": "page", "limit": 10, "page_param": "page", "limit_param": "limit"}
    )
    pages = list(gen)
    print(f"Total pages received (expected 1): {len(pages)}")
    assert len(pages) == 1
    assert len(pages[0]) == 5
    print("Duplicate data break verified successfully.")
    
    print("\n--- 3. Testing Hard Cap (500 pages) ---")
    gen = extract_records_generator(
        endpoint_url=f"{base_url}/infinite",
        auth_config={"authType": "none"},
        pagination_config={"type": "page", "limit": 10, "page_param": "page", "limit_param": "limit"}
    )
    pages = list(gen)
    print(f"Total pages received (expected 500): {len(pages)}")
    assert len(pages) == 500
    print("Hard cap page break verified successfully.")
    
    server.shutdown()
    print("\n--- ALL CIRCUIT BREAKER TESTS PASSED! ---")

if __name__ == "__main__":
    run_tests()
