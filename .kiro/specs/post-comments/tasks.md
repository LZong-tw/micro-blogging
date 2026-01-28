# Implementation Plan: Post Comments

## Overview

This implementation plan breaks down the post comments feature into discrete coding tasks. The approach follows an incremental pattern: backend API → frontend components → integration → testing. Each task builds on previous work, ensuring no orphaned code.

## Tasks

- [x] 1. Set up backend Lambda functions for comment operations
  - [x] 1.1 Create `createComment` Lambda function
    - Implement handler in `backend/src/functions/comments/createComment.js`
    - Use `withAuth` middleware for authentication
    - Validate input (text length 1-280, required fields)
    - Generate unique comment ID with uuid
    - Store comment in CommentsTable with all required fields
    - Return comment data with CORS headers
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.3, 5.1, 5.3_
  
  - [x] 1.2 Write property test for comment creation validation
    - **Property 2: Whitespace comments are invalid**
    - **Property 3: Character limit validation**
    - **Validates: Requirements 1.2, 1.3**
  
  - [x] 1.3 Write property test for comment data integrity
    - **Property 1: Comment creation stores all required fields**
    - **Property 10: Comment ownership**
    - **Validates: Requirements 1.1, 1.4, 4.3**
  
  - [x] 1.4 Create `getComments` Lambda function
    - Implement handler in `backend/src/functions/comments/getComments.js`
    - Extract postId from path parameters
    - Query CommentsTable using postId-createdAt GSI
    - Sort results by createdAt ascending
    - Support pagination with limit and lastKey
    - Return comments array with CORS headers
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 3.3, 4.4_
  
  - [x] 1.5 Write property test for comment retrieval
    - **Property 5: Complete comment retrieval**
    - **Property 7: Chronological ordering**
    - **Validates: Requirements 2.1, 2.3, 3.2**
  
  - [x] 1.6 Write unit tests for edge cases
    - Test empty comments list
    - Test unauthenticated requests
    - Test non-existent post ID
    - Test malformed input data
    - _Requirements: 4.2, 5.2, 5.4_

- [x] 2. Update infrastructure to deploy comment Lambda functions
  - [x] 2.1 Add Lambda function definitions to CDK stack
    - Define CreateCommentFunction in `infrastructure/lib/app-stack.ts`
    - Define GetCommentsFunction in `infrastructure/lib/app-stack.ts`
    - Package functions from `backend/dist/lambda-packages/`
    - Pass COMMENTS_TABLE_NAME and USERS_TABLE_NAME as environment variables
    - _Requirements: 1.1, 2.1_
  
  - [x] 2.2 Add API Gateway routes for comment endpoints
    - Add POST /posts/{postId}/comments → CreateCommentFunction
    - Add GET /posts/{postId}/comments → GetCommentsFunction
    - Configure CORS for both routes
    - _Requirements: 1.1, 2.1_
  
  - [x] 2.3 Grant IAM permissions to Lambda functions
    - Grant CreateCommentFunction: dynamodb:PutItem on CommentsTable
    - Grant CreateCommentFunction: dynamodb:GetItem on UsersTable (for username lookup)
    - Grant GetCommentsFunction: dynamodb:Query on CommentsTable GSI
    - _Requirements: 1.4, 2.1, 4.3_

- [x] 3. Checkpoint - Deploy and test backend
  - Deploy infrastructure with `yarn deploy:infra`
  - Test createComment endpoint with curl/Postman
  - Test getComments endpoint with curl/Postman
  - Verify authentication works correctly
  - Ensure all tests pass, ask the user if questions arise

- [x] 4. Extend frontend API client for comment operations
  - [x] 4.1 Add Comment type definition
    - Create Comment interface in `frontend/src/types/index.ts`
    - Include id, postId, userId, username, text, createdAt fields
    - _Requirements: 1.4, 2.2_
  
  - [x] 4.2 Add comment API methods to api.ts
    - Implement `getComments(postId, limit?, lastKey?)` method
    - Implement `createComment(postId, text)` method
    - Include authentication headers
    - Handle errors and return typed responses
    - _Requirements: 1.1, 2.1, 4.1_

- [x] 5. Create frontend comment components
  - [x] 5.1 Create CommentItem component
    - Create `frontend/src/components/CommentItem.tsx`
    - Display username (bold), comment text, and relative timestamp
    - Style consistently with existing post design
    - Use CSS for layout and spacing
    - _Requirements: 2.2, 6.4_
  
  - [x] 5.2 Create CommentInput component
    - Create `frontend/src/components/CommentInput.tsx`
    - Implement text input with character counter (280 max)
    - Show remaining characters as user types
    - Validate input before submission (no empty/whitespace)
    - Call createComment API on submit
    - Clear input on success, show errors on failure
    - Disable submit button while submitting
    - _Requirements: 1.2, 1.3, 1.5, 6.1, 6.3_
  
  - [x] 5.3 Write property test for character counter
    - **Property 14: Character counter accuracy**
    - **Validates: Requirements 6.3**
  
  - [x] 5.4 Create CommentSection component
    - Create `frontend/src/components/CommentSection.tsx`
    - Accept postId as prop
    - Fetch comments on mount using getComments API
    - Display loading state while fetching
    - Render list of CommentItem components
    - Show empty state message when no comments exist
    - Render CommentInput component
    - Handle new comment creation with optimistic UI update
    - Display error messages when operations fail
    - _Requirements: 2.1, 2.3, 2.4, 6.1, 6.5_
  
  - [x] 5.5 Write unit tests for CommentSection
    - Test loading state display
    - Test empty state message
    - Test error handling
    - Test optimistic UI updates
    - _Requirements: 2.4, 6.5_

- [x] 6. Integrate CommentSection into Feed
  - [x] 6.1 Add CommentSection to post display in Feed.tsx
    - Import CommentSection component
    - Render CommentSection below each post
    - Pass postId prop to CommentSection
    - Ensure styling integrates with existing feed layout
    - _Requirements: 2.1, 6.1_
  
  - [x] 6.2 Update Post type to include comment count (optional)
    - Add optional commentCount field to Post interface
    - Display comment count in post UI if available
    - _Requirements: 2.1_

- [x] 7. Checkpoint - Test end-to-end functionality
  - Start frontend dev server with `yarn start:frontend`
  - Verify comments load for existing posts
  - Create new comments and verify they appear
  - Test character counter updates in real-time
  - Test validation errors for empty/long comments
  - Verify comments persist across page refreshes
  - Ensure all tests pass, ask the user if questions arise

- [x] 8. Add property-based tests for pagination
  - [x] 8.1 Write property test for pagination correctness
    - **Property 8: Pagination correctness**
    - **Validates: Requirements 3.3**
  
  - [x] 8.2 Write integration test for pagination flow
    - Create many comments for a post
    - Fetch with pagination
    - Verify no duplicates or omissions
    - _Requirements: 3.3_

- [x] 9. Add E2E tests with Playwright
  - [x] 9.1 Write E2E test for comment creation flow
    - User logs in
    - User navigates to feed
    - User types comment and submits
    - Verify comment appears in list
    - _Requirements: 1.1, 1.5, 2.1_
  
  - [x] 9.2 Write E2E test for comment validation
    - User attempts to submit empty comment
    - Verify error message appears
    - User attempts to submit 281 character comment
    - Verify validation error appears
    - _Requirements: 1.2, 1.3_
  
  - [ ] 9.3 Write E2E test for comment display
    - User views post with multiple comments
    - Verify all comments are visible
    - Verify comments are in chronological order
    - Verify usernames and timestamps are displayed
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 10. Final checkpoint and polish
  - Run all unit tests: `yarn workspace backend test`
  - Run all E2E tests: `yarn workspace frontend test:e2e`
  - Run linting: `yarn workspace frontend lint`
  - Test on mobile viewport for responsive design
  - Verify CORS headers on all API responses
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Backend uses existing patterns: withAuth middleware, DynamoDB DocumentClient, CORS headers
- Frontend uses existing patterns: centralized API client, React components, CSS styling
- Infrastructure follows existing CDK patterns: Lambda functions, API Gateway routes, IAM permissions
