# Architecture Documentation

This directory contains auto-generated architecture diagrams for the BJJ Tournament Tracker.

## Quick Links

- **[View Interactive Diagrams](latest/embed.html)** - Open in browser for an interactive view
- [System Overview](latest/overview.svg) - High-level architecture
- [Data Flow](latest/data-flow.svg) - How data moves through the system
- [Infrastructure](latest/infrastructure.svg) - AWS resources and deployment
- [Database Schema](latest/database-schema.svg) - DynamoDB single-table design

## Embedding in README

Add this to your main README.md:

```markdown
## Architecture

![System Overview](docs/architecture/latest/overview.png)

For more details, see the [Architecture Documentation](docs/architecture/README.md).
```

## Diagram Descriptions

### System Overview
Shows all major components:
- **Frontend**: Next.js 15 deployed on Vercel
- **API Layer**: API Gateway with REST and WebSocket endpoints
- **Compute**: Lambda functions for each domain (tournaments, athletes, wishlist, flights)
- **Authentication**: Cognito with Google OAuth integration
- **Database**: DynamoDB single-table design
- **External Services**: IBJJF, JJWL, Amadeus, Google Maps

### Data Flow
Illustrates how data moves through the system:
1. **Ingestion**: Daily CRON scrapes IBJJF/JJWL, geocodes via Google Maps
2. **Storage**: Normalized data stored in DynamoDB
3. **API Layer**: REST endpoints serve data to frontend
4. **Real-time**: WebSocket pushes flight price updates

### Infrastructure
AWS resource topology:
- Lambda functions (Node.js 20, various memory configs)
- DynamoDB with GSI1 for alternate access patterns
- EventBridge + SQS for event-driven flight price fetching
- Cognito user pool with Google OAuth
- CloudWatch alarms (prod only)

### Database Schema
Single-table DynamoDB design with key patterns:
- `TOURN#{org}#{id}` - Tournaments
- `USER#{id}` + `ATHLETE#{id}` - User athletes
- `USER#{id}` + `WISH#{tournPK}` - User wishlist
- `FLIGHT#{origin}#{dest}` + `DATE#{date}` - Flight prices

## Regenerating Diagrams

Run from project root:
```bash
# Generate all diagrams
npx @mermaid-js/mermaid-cli -i docs/architecture/latest/overview.mmd -o docs/architecture/latest/overview.svg -t dark

# Or use the /arch:generate command in Claude Code
```

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, Tailwind, Zustand, TanStack Query |
| Backend | AWS SAM, Lambda (Node.js 20), API Gateway |
| Database | DynamoDB (single-table design) |
| Auth | AWS Cognito + Google OAuth |
| Hosting | Vercel (frontend), AWS (backend) |
| Data Sources | IBJJF, JJWL, Amadeus, Google Maps |
