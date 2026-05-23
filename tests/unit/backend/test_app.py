"""Unit tests for backend application."""

import pytest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../..'))

from backend.app import app


@pytest.fixture
def client():
    """Create test client."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_health_check(client):
    """Test health check endpoint."""
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'
    assert 'service' in data


def test_api_status(client):
    """Test API status endpoint."""
    response = client.get('/api/v1/status')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'running'
    assert 'version' in data
