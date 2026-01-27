# Technology Stack

## Build System

Yarn workspaces monorepo with three packages: frontend, backend, infrastructure

## Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Testing**: Playwright for E2E tests
- **Linting**: ESLint with TypeScript rules
- **Styling**: Plain CSS with CSS variables

## Backend

- **Runtime**: Node.js 22.x (Lambda)
- **Language**: JavaScript (CommonJS)
- **AWS SDK**: v3 (modular imports)
- **Key Libraries**: uuid for ID generation
- **Testing**: Jest

## Infrastructure

- **IaC**: AWS CDK v2 with TypeScript
- **Services**: Lambda, API Gateway, DynamoDB, Cognito, S3, CloudFront
- **Deployment**: CDK deploy

## Common Commands

### Development
```bash
# Start frontend dev server
yarn start:frontend

# Start backend locally (if configured)
yarn start:backend
```

### Building
```bash
# Build frontend
yarn build:frontend

# Build backend (copies JS files to dist, removes TS)
yarn build:backend

# Build infrastructure
yarn workspace infrastructure build
```

### Testing
```bash
# Frontend E2E tests
yarn workspace frontend test:e2e
yarn workspace frontend test:e2e:ui

# Frontend linting
yarn workspace frontend lint
```

### Deployment
```bash
# Deploy infrastructure only
yarn deploy:infra

# Deploy frontend only
yarn deploy:frontend

# Full deployment (backend + infra + frontend + CDN invalidation)
yarn deploy
```

### Infrastructure
```bash
# CDK commands
yarn workspace infrastructure cdk diff
yarn workspace infrastructure cdk deploy
```

## Environment Variables

Frontend requires `.env` file with:
- `VITE_API_URL`: API Gateway endpoint
- `VITE_USER_POOL_ID`: Cognito User Pool ID
- `VITE_USER_POOL_CLIENT_ID`: Cognito Client ID
- `VITE_IDENTITY_POOL_ID`: Cognito Identity Pool ID

These are output by CDK deployment.
