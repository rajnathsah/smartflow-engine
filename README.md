# SmartFlow Engine

Intelligent integration platform with React UI, Python backend, and containerized deployment.

## Project Structure

This is a monorepo containing:

- **frontend/** - React-based user interface
- **backend/** - Python backend services
- **docker/** - Docker and Docker Compose configuration
- **tests/** - Unit and integration tests
- **docs/** - Technical and functional documentation

## Quick Start

### Prerequisites

- Node.js (v16+)
- Python (v3.9+)
- Docker and Docker Compose
- Git

### Development Setup

#### Frontend

```bash
cd frontend
npm install
npm start
```

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt
python app.py
```

#### Using Docker Compose

```bash
docker-compose -f docker/docker-compose.yml up
```

## Testing

### Run All Tests

```bash
# Unit Tests
cd tests/unit
pytest  # Backend
npm test  # Frontend

# Integration Tests
cd tests/integration
pytest
```

## Documentation

See [docs/](docs/) for:
- [Technical Guide](docs/technical-guide.md)
- [Functional Guide](docs/functional-guide.md)
- [Requirements Document](docs/requirements.md)

## License

MIT
