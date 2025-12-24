# Lambda Testing Strategy

This document describes how Lambda functions are developed and tested in this project.

## Architecture Overview

The backend is written as AWS Lambda handlers but can run in multiple environments:

```
┌─────────────────────────────────────────────────────────────┐
│                     Lambda Handler Code                      │
│              backend/src/handlers/*.ts                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│   │  Local Dev  │   │  SAM Local  │   │  AWS Lambda │       │
│   │  (Express)  │   │  (Docker)   │   │  (Prod)     │       │
│   └─────────────┘   └─────────────┘   └─────────────┘       │
│         │                 │                 │                │
│    Fast iteration    Lambda-accurate    Production          │
│    Hot reload        Cold starts         Real AWS           │
│    No Docker         Timeouts            API Gateway        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Handler Structure

All Lambda handlers follow this pattern:

```typescript
// backend/src/handlers/tournaments.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Handler logic
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'response' }),
  };
};
```

## Testing Approaches

### 1. Express Wrapper (Current - Local Dev)

**Location:** `backend/src/dev-server.ts`

The Express server converts HTTP requests to Lambda event format and invokes handlers directly.

```bash
cd backend
npm run dev
```

**Pros:**
- Fast startup (~2 seconds)
- Hot reload with tsx
- No Docker required (beyond DynamoDB)
- Standard Node.js debugging

**Cons:**
- No cold start simulation
- No timeout enforcement
- No memory limits

**Best for:** Daily development, rapid iteration

### 2. Unit Tests

**Location:** `backend/src/handlers/__tests__/*.test.ts`

Test handlers in isolation with mocked events and dependencies.

```typescript
import { handler } from '../tournaments';
import { mockAPIGatewayEvent, mockContext } from '../../test/utils';

describe('tournaments handler', () => {
  it('returns tournaments list', async () => {
    const event = mockAPIGatewayEvent({ httpMethod: 'GET', path: '/tournaments' });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveProperty('tournaments');
  });
});
```

**Pros:**
- Fast execution
- Isolated testing
- Easy to mock dependencies

**Cons:**
- Doesn't test Lambda runtime behavior

**Best for:** TDD, CI/CD pipelines, testing business logic

### 3. AWS SAM Local

**Location:** `backend/template.yaml` (SAM template)

SAM CLI runs Lambda functions in Docker containers that match the AWS runtime.

```bash
# Start API locally
sam local start-api --docker-network host

# Invoke single function
sam local invoke TournamentsFunction --event events/get-tournaments.json
```

**Pros:**
- Accurate Lambda runtime
- Cold start simulation
- Timeout enforcement
- Memory limits

**Cons:**
- Slower startup (10-30 seconds)
- Requires Docker
- Requires SAM CLI installation

**Best for:** Testing Lambda-specific behavior, pre-deployment validation

### 4. AWS Deployment

Deploy to actual AWS Lambda for integration testing.

```bash
sam deploy --guided
```

**Pros:**
- Real AWS environment
- Tests API Gateway integration
- Tests IAM permissions

**Cons:**
- Requires AWS account
- Costs money (minimal for dev)
- Slower feedback loop

**Best for:** Staging, integration tests, production

## Comparison Matrix

| Feature | Express | Unit Tests | SAM Local | AWS |
|---------|---------|------------|-----------|-----|
| Startup time | ~2s | <1s | 10-30s | N/A |
| Hot reload | ✅ | ✅ | ❌ | ❌ |
| Cold starts | ❌ | ❌ | ✅ | ✅ |
| Timeouts | ❌ | ❌ | ✅ | ✅ |
| Memory limits | ❌ | ❌ | ✅ | ✅ |
| API Gateway | Simulated | ❌ | ✅ | ✅ |
| Real DynamoDB | Local | Mocked | Local | ✅ |
| CI/CD friendly | ✅ | ✅ | ✅ | ✅ |

## Recommended Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Workflow                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. Write Code                                              │
│      └── Use Express wrapper (npm run dev)                   │
│          └── Fast iteration, hot reload                      │
│                                                              │
│   2. Write Tests                                             │
│      └── Unit tests for handlers                             │
│          └── TDD approach, mocked dependencies               │
│                                                              │
│   3. Pre-Deployment Check                                    │
│      └── SAM Local (optional)                                │
│          └── Verify Lambda-specific behavior                 │
│                                                              │
│   4. Deploy                                                  │
│      └── SAM deploy to AWS                                   │
│          └── Staging environment first                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
backend/
├── src/
│   ├── handlers/
│   │   ├── tournaments.ts      # Lambda handler
│   │   ├── __tests__/
│   │   │   └── tournaments.test.ts
│   │   └── middleware/
│   │       └── errorHandler.ts
│   ├── dev-server.ts           # Express wrapper
│   └── test/
│       └── utils.ts            # Test utilities
├── template.yaml               # SAM template (TODO)
├── events/                     # Sample events (TODO)
│   ├── get-tournaments.json
│   └── get-tournament-by-id.json
└── samconfig.toml              # SAM config (TODO)
```

---

## Backlog

See [BACKLOG.md](./BACKLOG.md#lambda--testing) for planned work related to Lambda testing.
