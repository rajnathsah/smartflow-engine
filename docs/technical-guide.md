# Technical Guide - SmartFlow Engine

## Table of Contents

1. [Architecture](#architecture)
2. [Frontend Setup](#frontend-setup)
3. [Backend Setup](#backend-setup)
4. [Docker & Deployment](#docker--deployment)
5. [Testing](#testing)
6. [Development Workflow](#development-workflow)

## Architecture

SmartFlow Engine follows a monorepo structure with clear separation of concerns:

```
smartflow-engine/
├── frontend/          # React UI application
├── backend/           # Python Flask API
├── docker/            # Docker configuration
├── tests/             # Test suites
└── docs/              # Documentation
```

### Architecture Diagram

```
┌──────────────────────────────┐
│   Client/User   │
└��─────────────┬──────────────┘
         │ HTTP/HTTPS
         ▼
┌──────────────────────────────┐
│   React UI      │
│   (Frontend)    │
└──────────────┬──────────────┘
         │ REST API
         ▼
┌──────────────────────────────┐
│  Flask Backend  │
│   (API Server)  │
└──────────────┬──────────────┘
         │
         ▼
    (Databases/
   External Services)
```

## Frontend Setup

### Prerequisites

- Node.js v16 or higher
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development Server

```bash
npm start
```

The application will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Testing

```bash
npm test
```

### Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── index.js
│   ├── index.css
│   ├── App.js
│   └── App.css
├── package.json
└── README.md
```

## Backend Setup

### Prerequisites

- Python 3.9 or higher
- pip or poetry

### Installation

```bash
cd backend
python -m venv venv

# On Linux/Mac
source venv/bin/activate

# On Windows
venv\\Scripts\\activate

pip install -r requirements.txt
```

### Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your-secret-key
LOG_LEVEL=INFO
```

### Development Server

```bash
python app.py
```

The API will be available at `http://localhost:5000`

### API Endpoints

#### Health Check

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "SmartFlow Engine API"
}
```

#### API Status

```
GET /api/v1/status
```

Response:
```json
{
  "version": "0.1.0",
  "name": "SmartFlow Engine",
  "status": "running"
}
```

### Project Structure

```
backend/
├── app.py              # Main application
├── config.py           # Configuration
├── requirements.txt    # Dependencies
├── .env.example        # Environment template
└── routes/             # API routes (to be created)
```

## Docker & Deployment

### Building Images

#### Backend Image

```bash
docker build -f docker/Dockerfile.backend -t smartflow-backend:latest .
```

#### Frontend Image

```bash
docker build -f docker/Dockerfile.frontend -t smartflow-frontend:latest .
```

### Using Docker Compose

#### Start Services

```bash
docker-compose -f docker/docker-compose.yml up
```

#### Start in Background

```bash
docker-compose -f docker/docker-compose.yml up -d
```

#### Stop Services

```bash
docker-compose -f docker/docker-compose.yml down
```

#### View Logs

```bash
docker-compose -f docker/docker-compose.yml logs -f
```

### Environment Variables for Docker

Create a `.env` file in the docker directory:

```env
FLASK_ENV=production
REACT_APP_API_URL=http://backend:5000
```

## Testing

### Backend Unit Tests

```bash
cd tests/unit
pytest backend/
```

### Backend Test Coverage

```bash
pytest backend/ --cov=backend --cov-report=html
```

### Integration Tests

```bash
cd tests/integration
pytest
```

### Frontend Tests

```bash
cd frontend
npm test
```

### Running All Tests

```bash
# Backend
pytest tests/

# Frontend
cd frontend && npm test
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Update code in `frontend/` or `backend/`
- Write tests for new functionality
- Update documentation if needed

### 3. Test Your Changes

```bash
# Backend
cd backend
pytest ../tests/unit/backend/

# Frontend
cd frontend
npm test
```

### 4. Commit and Push

```bash
git add .
git commit -m "feat: description of changes"
git push origin feature/your-feature-name
```

### 5. Create Pull Request

- Open a PR on GitHub
- Ensure all tests pass
- Get code review
- Merge to main branch

### Git Commit Conventions

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Test-related
- `chore:` - Maintenance
- `refactor:` - Code refactoring

## Troubleshooting

### Backend Issues

#### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>
```

#### Virtual Environment Issues

```bash
# Recreate virtual environment
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend Issues

#### Dependency Issues

```bash
rm -rf node_modules package-lock.json
npm install
```

#### Port Already in Use

```bash
# Kill process on port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Docker Issues

#### Clear Docker Cache

```bash
docker system prune -a
```

#### Rebuild Images

```bash
docker-compose -f docker/docker-compose.yml up --build
```

## Additional Resources

- [Flask Documentation](https://flask.palletsprojects.com/)
- [React Documentation](https://react.dev/)
- [Docker Documentation](https://docs.docker.com/)
- [pytest Documentation](https://docs.pytest.org/)
