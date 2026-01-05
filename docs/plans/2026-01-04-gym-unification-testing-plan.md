# Gym Unification Testing Plan

This document outlines the testing checklist for the gym unification feature and AWS permissions for developers.

## Pre-Deployment

Before testing, ensure the new handlers are deployed:

- [ ] Add `adminMatches` and `masterGyms` handlers to `template.yaml`
- [ ] Run `sam build && sam deploy`
- [ ] Verify deployment succeeded (check CloudFormation outputs)

## Pre-Sync Verification

Verify the database is clean for gym entities before running sync.

```bash
# Check for existing source gyms (should be 0 or minimal)
aws dynamodb scan \
  --table-name bjj-tournament-tracker-dev \
  --filter-expression "begins_with(PK, :pk)" \
  --expression-attribute-values '{":pk": {"S": "SRCGYM#"}}' \
  --select COUNT

# Check for existing master gyms (should be 0)
aws dynamodb scan \
  --table-name bjj-tournament-tracker-dev \
  --filter-expression "begins_with(PK, :pk)" \
  --expression-attribute-values '{":pk": {"S": "MASTERGYM#"}}' \
  --select COUNT

# Check for existing pending matches (should be 0)
aws dynamodb scan \
  --table-name bjj-tournament-tracker-dev \
  --filter-expression "begins_with(PK, :pk)" \
  --expression-attribute-values '{":pk": {"S": "PENDINGMATCH#"}}' \
  --select COUNT

# Check gym sync metadata (shows last sync info)
aws dynamodb get-item \
  --table-name bjj-tournament-tracker-dev \
  --key '{"PK": {"S": "GYMSYNC#IBJJF"}, "SK": {"S": "META"}}'
```

**Checklist:**
- [ ] Confirm 0 SRCGYM records (or note existing count)
- [ ] Confirm 0 MASTERGYM records
- [ ] Confirm 0 PENDINGMATCH records
- [ ] Note GYMSYNC#IBJJF metadata (if exists)

## Trigger Gym Sync

Manually invoke the Lambda to run the sync.

```bash
# Invoke gym sync function
aws lambda invoke \
  --function-name bjj-tournament-tracker-gym-sync-dev \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json

# Check the response
cat response.json

# View CloudWatch logs for details (last 5 minutes)
aws logs tail /aws/lambda/bjj-tournament-tracker-gym-sync-dev \
  --since 5m --follow
```

**Expected Response:**
```json
{
  "statusCode": 200,
  "body": "{\"message\":\"Gym sync completed\",\"created\":5234,\"updated\":0,\"autoLinked\":12,\"pendingCreated\":47}"
}
```

**Checklist:**
- [ ] Invoke `bjj-tournament-tracker-gym-sync-dev` Lambda
- [ ] Monitor CloudWatch logs for progress
- [ ] Wait for completion (1-2 minutes)

## Post-Sync Verification

Verify the data was created correctly.

```bash
# Count IBJJF source gyms
aws dynamodb scan \
  --table-name bjj-tournament-tracker-dev \
  --filter-expression "begins_with(PK, :pk)" \
  --expression-attribute-values '{":pk": {"S": "SRCGYM#IBJJF#"}}' \
  --select COUNT

# Sample a few source gyms to inspect structure
aws dynamodb scan \
  --table-name bjj-tournament-tracker-dev \
  --filter-expression "begins_with(PK, :pk)" \
  --expression-attribute-values '{":pk": {"S": "SRCGYM#IBJJF#"}}' \
  --limit 3

# Count master gyms created
aws dynamodb scan \
  --table-name bjj-tournament-tracker-dev \
  --filter-expression "begins_with(PK, :pk)" \
  --expression-attribute-values '{":pk": {"S": "MASTERGYM#"}}' \
  --select COUNT

# View master gyms with their canonical names
aws dynamodb query \
  --table-name bjj-tournament-tracker-dev \
  --index-name GSI1 \
  --key-condition-expression "GSI1PK = :pk" \
  --expression-attribute-values '{":pk": {"S": "MASTERGYMS"}}' \
  --limit 10

# Count pending matches
aws dynamodb query \
  --table-name bjj-tournament-tracker-dev \
  --index-name GSI1 \
  --key-condition-expression "GSI1PK = :pk AND begins_with(GSI1SK, :status)" \
  --expression-attribute-values '{":pk": {"S": "PENDINGMATCHES"}, ":status": {"S": "pending#"}}' \
  --select COUNT

# View pending matches with confidence scores
aws dynamodb query \
  --table-name bjj-tournament-tracker-dev \
  --index-name GSI1 \
  --key-condition-expression "GSI1PK = :pk AND begins_with(GSI1SK, :status)" \
  --expression-attribute-values '{":pk": {"S": "PENDINGMATCHES"}, ":status": {"S": "pending#"}}' \
  --limit 5
```

**Checklist:**
- [ ] Source gyms created (expect 5000+)
- [ ] Master gyms created (auto-linked ≥90%)
- [ ] Pending matches created (70-89% confidence)
- [ ] GYMSYNC#IBJJF updated with new timestamp

## API Endpoint Testing

Test the endpoints via API Gateway.

```bash
# Get your API URL
aws cloudformation describe-stacks \
  --stack-name bjj-tournament-tracker \
  --query 'Stacks[0].Outputs[?OutputKey==`TournamentsApiUrl`].OutputValue' \
  --output text
```

### Get Access Token

```bash
aws cognito-idp initiate-auth \
  --client-id {USER_POOL_CLIENT_ID} \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME={email},PASSWORD={password} \
  --query 'AuthenticationResult.AccessToken' \
  --output text
```

### Admin Endpoints (requires auth)

```bash
# List pending matches
curl -X GET "{API_URL}/admin/pending-matches?status=pending" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"

# Approve a match (creates master gym, links both source gyms)
curl -X POST "{API_URL}/admin/pending-matches/{matchId}/approve" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"

# Reject a match
curl -X POST "{API_URL}/admin/pending-matches/{matchId}/reject" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

### Public Endpoints

```bash
# Search for master gyms by name prefix
curl -X GET "{API_URL}/master-gyms/search?q=gracie"

# Get specific master gym by ID
curl -X GET "{API_URL}/master-gyms/{masterGymId}"
```

**Checklist:**
- [ ] `GET /admin/pending-matches` returns matches
- [ ] `POST /admin/pending-matches/{id}/approve` creates master gym
- [ ] `POST /admin/pending-matches/{id}/reject` marks as rejected
- [ ] `GET /master-gyms/search?q=gracie` returns master gyms

## AWS Permissions for Developers

IAM policy for developers to test against AWS resources.

### Policy Document

Save as `developer-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/bjj-tournament-tracker-*",
        "arn:aws:dynamodb:*:*:table/bjj-tournament-tracker-*/index/*"
      ]
    },
    {
      "Sid": "LambdaInvoke",
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:*:*:function:bjj-tournament-tracker-*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:GetLogEvents",
        "logs:FilterLogEvents",
        "logs:Tail"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/bjj-tournament-tracker-*:*"
    },
    {
      "Sid": "CloudFormationRead",
      "Effect": "Allow",
      "Action": [
        "cloudformation:DescribeStacks",
        "cloudformation:ListStacks"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CognitoAuth",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:InitiateAuth",
        "cognito-idp:DescribeUserPool",
        "cognito-idp:DescribeUserPoolClient"
      ],
      "Resource": "arn:aws:cognito-idp:*:*:userpool/*"
    }
  ]
}
```

### Setup Commands

```bash
# Create policy
aws iam create-policy \
  --policy-name BJJTournamentTrackerDeveloper \
  --policy-document file://developer-policy.json

# Create group and attach
aws iam create-group --group-name bjj-developers
aws iam attach-group-policy \
  --group-name bjj-developers \
  --policy-arn arn:aws:iam::{ACCOUNT_ID}:policy/BJJTournamentTrackerDeveloper

# Add a developer
aws iam add-user-to-group --user-name {username} --group-name bjj-developers
```

**Checklist:**
- [ ] Create `BJJTournamentTrackerDeveloper` IAM policy
- [ ] Create `bjj-developers` IAM group
- [ ] Attach policy to group
- [ ] Add developers to group
