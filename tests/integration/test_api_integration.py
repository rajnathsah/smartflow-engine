"""Integration tests for API endpoints."""

import pytest
import requests
import time
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from backend.app import app


@pytest.fixture
def client():
    """Create test client."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestApiIntegration:
    """Integration tests for API endpoints."""

    def test_health_endpoint_available(self, client):
        """Test that health endpoint is available."""
        response = client.get('/health')
        assert response.status_code == 200

    def test_full_api_workflow(self, client):
        """Test a complete API workflow."""
        # Check health
        health_response = client.get('/health')
        assert health_response.status_code == 200

        # Check API status
        status_response = client.get('/api/v1/status')
        assert status_response.status_code == 200
        data = status_response.get_json()
        assert data['status'] == 'running'
