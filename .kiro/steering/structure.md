# Project Structure

## Monorepo Layout

```
/
├── frontend/          # React SPA
├── backend/           # Lambda functions
├── infrastructure/    # AWS CDK stack
└── package.json       # Workspace root
```

## Frontend Structure

```
frontend/
├── src/
│   ├── components/    # Reusable UI components
│   ├── contexts/      # React contexts (AuthContext)
│   ├── pages/         # Route components (Login, Feed, Profile, etc.)
│   ├── services/      # API client (api.ts)
│   ├── types/         # TypeScript type definitions
│   ├── App.tsx        # Main app with routing
│   └── main.tsx       # Entry point
├── index.html         # HTML template
├── vite.config.ts     # Vite configuration
└── playwright.config.ts # E2E test config
```

### Frontend Conventions

- **Routing**: React Router with protected routes via `ProtectedRoute` component
- **Auth**: `AuthContext` provides authentication state and user info
- **API**: Centralized API client in `services/api.ts`
- **Styling**: Component-level CSS, design tokens in CSS variables
- **Types**: Shared types in `types/` directory

## Backend Structure

```
backend/
├── src/
│   ├── common/
│   │   └── middleware.js    # Auth middleware (withAuth)
│   └── functions/
│       ├── auth/            # Login, register
│       ├── posts/           # Post CRUD, likes
│       ├── users/           # Profile, follow/unfollow
│       └── monitoring/      # Custom metrics
├── scripts/                 # Deployment scripts
└── dist/                    # Build output (gitignored)
```

### Backend Conventions

- **Handler Pattern**: Each Lambda is a single file with exported `handler` function
- **Middleware**: `withAuth` wrapper validates JWT and adds user info to event
- **AWS SDK**: Use v3 with modular imports (DynamoDBDocumentClient, PutCommand, etc.)
- **Error Handling**: Try-catch with proper HTTP status codes and CORS headers
- **Environment Variables**: Table names and config passed via CDK
- **Response Format**: Always include CORS headers and JSON body

## Infrastructure Structure

```
infrastructure/
├── lib/
│   └── app-stack.ts    # Main CDK stack definition
├── bin/                # CDK app entry point
└── cdk.json            # CDK configuration
```

### Infrastructure Conventions

- **Single Stack**: All resources in `AppStack`
- **Resource Naming**: PascalCase with descriptive suffixes (UsersTable, LoginFunction)
- **Lambda Packaging**: Functions packaged as individual zips in `backend/dist/lambda-packages/`
- **Permissions**: Grant least-privilege IAM permissions per function
- **Outputs**: Export frontend config values as CloudFormation outputs
- **Removal Policy**: DESTROY for dev (change for production)

## Key Patterns

### Lambda Function Pattern
```javascript
const handler = async (event) => {
  try {
    // Parse body, validate input
    // DynamoDB operations
    // Return success response with CORS
  } catch (error) {
    // Return error response with CORS
  }
};

exports.handler = withAuth(handler); // Wrap with auth if needed
```

### API Client Pattern
```typescript
// frontend/src/services/api.ts
// Centralized fetch wrapper with auth headers
// Base URL from environment variable
```

### Protected Route Pattern
```typescript
// Check auth state, redirect to login if not authenticated
// Wrap authenticated pages with Layout component
```

## DynamoDB Tables

- **UsersTable**: User profiles (PK: id, GSI: username)
- **PostsTable**: Posts (PK: id, GSI: userId-createdAt)
- **LikesTable**: Post likes (PK: userId, SK: postId, GSI: postId)
- **FollowsTable**: User follows (PK: followerId, SK: followeeId, GSI: followeeId)
- **CommentsTable**: Post comments (PK: id, GSI: postId-createdAt)

## Deployment Flow

1. Build backend → creates dist/ with JS files
2. Package Lambdas → creates individual zips
3. Deploy infrastructure → CDK creates/updates AWS resources
4. Build frontend → Vite creates optimized bundle
5. Deploy frontend → sync to S3, invalidate CloudFront
