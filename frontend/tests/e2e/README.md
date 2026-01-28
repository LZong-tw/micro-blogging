# E2E Tests for Post Comments Feature

## Prerequisites

Before running E2E tests, ensure:

1. **Backend is deployed** - The API endpoints must be accessible
2. **Frontend dev server is running** - Tests run against `http://localhost:5173`
3. **Test user exists** - Create a test user with credentials:
   - Email: `testuser@example.com`
   - Password: `TestPassword123!`
   - Username: `testuser`

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run specific test file
```bash
npx playwright test comments.spec.ts
```

## Test Coverage

The `comments.spec.ts` file includes tests for:

### Comment Creation Flow
- User can create a comment on a post
- Comment appears immediately (optimistic UI)
- Comment persists after page refresh

### Comment Validation
- Empty comments are rejected
- Whitespace-only comments are rejected
- Comments over 280 characters are rejected
- Exactly 280 characters is allowed
- Real-time character counter updates
- Submit button is disabled for invalid input

### Comment Display
- All comments for a post are displayed
- Comments are shown in chronological order
- Username is displayed for each comment
- Timestamp is displayed for each comment
- Empty state is shown when no comments exist
- Special characters are handled correctly
- Long usernames don't break layout

## Notes

- Tests use the actual API, not mocks
- Some tests create data that may need cleanup
- Tests assume at least one post exists in the feed
- Adjust test user credentials in the test file if needed
