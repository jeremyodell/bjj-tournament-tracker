# Local Development Environment

This guide explains how to set up and run the BJJ Tournament Tracker locally for development.

## Prerequisites

- **Node.js 18+** - JavaScript runtime
- **Docker** - For running DynamoDB Local
- **npm** - Package manager (comes with Node.js)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOCAL DEVELOPMENT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐         ┌──────────────────┐                │
│   │   Frontend   │────────▶│  Backend Server  │                │
│   │  Next.js     │  :3000  │  Express + Lambda│  :3001         │
│   │              │         │  handlers        │                │
│   └──────────────┘         └────────┬─────────┘                │
│                                     │                           │
│                                     ▼                           │
│                            ┌──────────────────┐                │
│                            │  DynamoDB Local  │  :8000         │
│                            │  (Docker)        │                │
│                            └──────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### First Time Setup

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Start DynamoDB, create table, and seed data
npm run dev:setup

# 3. In a new terminal, start the backend server
npm run dev

# 4. In another terminal, start the frontend
cd frontend
npm install
npm run dev

# 5. Open http://localhost:3000
```

### Daily Development

```bash
# Terminal 1 - Backend (starts DynamoDB automatically)
cd backend
npm run dev:start

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Backend Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Express dev server (requires DynamoDB running) |
| `npm run dev:start` | Start DynamoDB + Express dev server |
| `npm run dev:setup` | First-time setup: DynamoDB + table + seed data |
| `npm run db:create` | Create DynamoDB table |
| `npm run db:seed` | Fetch tournaments from IBJJF/JJWL and populate DB |
| `npm run db:reset` | Delete all data and re-seed |

## API Endpoints (Local)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | http://localhost:3001/health | Health check |
| GET | http://localhost:3001/api/tournaments | List tournaments |
| GET | http://localhost:3001/api/tournaments/:id | Get single tournament |

### Query Parameters for `/api/tournaments`

| Parameter | Type | Description |
|-----------|------|-------------|
| `org` | `IBJJF` \| `JJWL` | Filter by organization |
| `startAfter` | `YYYY-MM-DD` | Tournaments starting after date |
| `startBefore` | `YYYY-MM-DD` | Tournaments starting before date |
| `city` | string | Filter by city (partial match) |
| `gi` | `true` \| `false` | Filter GI tournaments |
| `nogi` | `true` \| `false` | Filter NOGI tournaments |
| `kids` | `true` \| `false` | Filter kids tournaments |
| `search` | string | Search in tournament name |
| `cursor` | string | Pagination cursor |

**Example:**
```bash
curl "http://localhost:3001/api/tournaments?org=IBJJF&gi=true&limit=10"
```

## DynamoDB Local

### Accessing the Database

DynamoDB Local runs on `http://localhost:8000`. You can use the AWS CLI to interact with it:

```bash
# Configure AWS CLI for local
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
export AWS_DEFAULT_REGION=local

# List tables
aws dynamodb list-tables --endpoint-url http://localhost:8000

# Scan tournaments
aws dynamodb scan \
  --table-name bjj-tournament-tracker \
  --endpoint-url http://localhost:8000 \
  --max-items 5

# Query tournaments by GSI
aws dynamodb query \
  --table-name bjj-tournament-tracker \
  --index-name GSI1 \
  --key-condition-expression "GSI1PK = :pk" \
  --expression-attribute-values '{":pk": {"S": "TOURNAMENTS"}}' \
  --endpoint-url http://localhost:8000 \
  --max-items 5
```

### DynamoDB Admin UI (Optional)

For a visual interface, you can use [dynamodb-admin](https://www.npmjs.com/package/dynamodb-admin):

```bash
# Install globally
npm install -g dynamodb-admin

# Run (in a new terminal)
DYNAMO_ENDPOINT=http://localhost:8000 dynamodb-admin

# Open http://localhost:8001
```

## Environment Variables

The backend automatically configures these for local development:

| Variable | Local Value | Description |
|----------|-------------|-------------|
| `DYNAMODB_ENDPOINT` | `http://localhost:8000` | DynamoDB Local endpoint |
| `DYNAMODB_TABLE` | `bjj-tournament-tracker` | Table name |
| `AWS_REGION` | `local` | AWS region (dummy for local) |
| `PORT` | `3001` | Backend server port |

For the frontend, create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Troubleshooting

### DynamoDB Connection Issues

```bash
# Check if DynamoDB is running
docker ps | grep dynamodb

# Restart DynamoDB
cd backend
docker compose down
docker compose up -d

# Check DynamoDB logs
docker logs bjj-dynamodb-local
```

### "Table does not exist" Error

```bash
cd backend
npm run db:create
```

### No Tournaments Showing

```bash
# Re-seed the database
cd backend
npm run db:seed

# Or reset everything
npm run db:reset
```

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill it
kill -9 <PID>

# Or use a different port
PORT=3002 npm run dev
```

### Docker Issues

```bash
# Reset Docker volumes
cd backend
docker compose down -v
docker compose up -d
```

## Best Practices

### 1. Keep Local Data Fresh

The seed script fetches real tournaments from IBJJF and JJWL. Run it periodically:

```bash
npm run db:seed
```

### 2. Use Consistent Ports

- Frontend: `3000`
- Backend: `3001`
- DynamoDB: `8000`

### 3. Test Both Online and Offline

The frontend should handle API errors gracefully. Test with:

```bash
# Stop backend, refresh frontend
cd backend && docker compose down
# Frontend should show error state
```

### 4. Clear Cache When Needed

TanStack Query caches data. To force refresh in the browser:
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Or open DevTools → Application → Clear site data

### 5. Match Production Behavior

The dev server wraps Lambda handlers in Express, so your code runs the same locally as it will on AWS. However:

- **Cold starts**: Lambda has cold starts; local doesn't
- **Timeouts**: Lambda has 30s timeout; local doesn't
- **Memory**: Lambda has memory limits; local doesn't

## vs. AWS SAM Local

We use a simple Express wrapper instead of AWS SAM Local because:

| Feature | Express Wrapper | SAM Local |
|---------|-----------------|-----------|
| Startup time | ~2 seconds | ~10-30 seconds |
| Dependencies | Just Express | Docker + SAM CLI |
| Debugging | Standard Node.js | Requires SAM debugging |
| Hot reload | Works with tsx | Requires rebuild |
| Complexity | Simple | More complex |

For most development, the Express wrapper is sufficient. Use SAM Local when you need to test:
- API Gateway request/response mapping
- Lambda-specific features (layers, extensions)
- Exact timeout/memory behavior
