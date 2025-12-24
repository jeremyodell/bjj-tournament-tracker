# Session Goal: Set Up CI/CD Pipeline

## Context

BJJ Tournament Tracker project. Backend is ready for AWS deployment with SAM template.

## Source of Truth

- `docs/plans/2025-12-24-implementation-plan.md` - Overall plan
- `docs/plans/2025-12-24-bjj-tournament-tracker-design.md` - Architecture
- `backend/template.yaml` - SAM template (already created)
- `backend/samconfig.toml` - SAM configuration

## Current State

| Component | Status |
|-----------|--------|
| Backend API | ✅ Complete - Express server, handlers, services |
| SAM Template | ✅ Complete - Lambda, API Gateway, DynamoDB |
| Unit Tests | ✅ 47 passing |
| Integration Tests | ✅ 15 passing (DynamoDB Local) |
| Frontend | ✅ Basic UI complete |
| CI/CD | ❌ Not started |

## What Needs to Be Done

### 1. GitHub Actions Workflow

Create `.github/workflows/deploy.yml` that:

**On push to main:**
- Run unit tests (`npm test`)
- Run integration tests (`npm run test:integration`) with DynamoDB Local in Docker
- Build with SAM (`sam build`)
- Deploy to AWS (`sam deploy --no-confirm-changeset`)

**On pull request:**
- Run tests only (no deploy)

### 2. AWS Setup Required

Before CI/CD works, you need:
- AWS account with IAM user for GitHub Actions
- S3 bucket for SAM artifacts (or use `--resolve-s3`)
- GitHub repository secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION` (us-east-1)

### 3. Environment Strategy

| Branch | Deploys To | SAM Config |
|--------|------------|------------|
| main | dev | `--parameter-overrides Stage=dev` |
| (manual) | prod | `sam deploy --config-env prod` |

## Key Files

```
backend/
├── template.yaml          # SAM template
├── samconfig.toml         # SAM deploy config
├── package.json           # Has test scripts
└── jest.integration.config.js

.github/
└── workflows/
    └── deploy.yml         # TO CREATE
```

## Quick Commands

```bash
# Local testing
cd backend
docker compose up -d          # DynamoDB Local
npm test                      # Unit tests
npm run test:integration      # Integration tests

# SAM commands
sam build                     # Build Lambda
sam local start-api           # Local API testing
sam deploy --guided           # First-time deploy
sam deploy                    # Subsequent deploys
```

## Notes

- Fetchers use Puppeteer - Lambda needs a layer or different approach for production
- Consider: Skip sync function in CI, or use mock fetchers
- DynamoDB table is created by SAM on first deploy

## Autonomy Mode

Work autonomously:
- Create the GitHub Actions workflow
- Add any necessary scripts
- Update BACKLOG.md when complete
- Commit with descriptive message
