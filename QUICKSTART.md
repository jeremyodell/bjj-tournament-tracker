# Quickstart

## Prerequisites

- Node.js 20+
- Docker (running)

## First Time

```bash
# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Start DynamoDB, create table, seed data
cd backend
docker compose up -d
npm run db:create
npm run db:seed:mock
cd ..
```

## Daily Development

```bash
# Start everything
./dev.sh start

# Check status
./dev.sh status

# Stop everything
./dev.sh stop
```

## URLs

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:3000  |
| Backend  | http://localhost:3001  |
| DynamoDB | http://localhost:8000  |

## dev.sh Commands

```
./dev.sh start          # Start frontend + backend
./dev.sh stop           # Stop everything
./dev.sh restart        # Restart both
./dev.sh status         # Show what's running
./dev.sh logs backend   # Tail backend logs
./dev.sh logs frontend  # Tail frontend logs
```

## Troubleshooting

**No tournaments?**
```bash
cd backend && npm run db:seed:mock
```

**Port in use?**
```bash
./dev.sh stop
# or manually: pkill -f "next dev" && pkill -f "tsx src/dev-server"
```

**DynamoDB issues?**
```bash
cd backend && docker compose down && docker compose up -d
```
