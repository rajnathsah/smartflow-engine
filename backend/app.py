"""Main application entry point for SmartFlow Engine backend."""

from flask import Flask, jsonify
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'Synq.to API'
    }), 200


@app.route('/api/v1/status', methods=['GET'])
def api_status():
    """API status endpoint."""
    return jsonify({
        'version': '0.1.0',
        'name': 'Synq.to',
        'status': 'running'
    }), 200


if __name__ == '__main__':
    logger.info('Starting Synq.to API Backend')
    app.run(host='0.0.0.0', port=5000, debug=True)
