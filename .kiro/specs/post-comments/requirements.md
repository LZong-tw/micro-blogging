# Requirements Document: Post Comments

## Introduction

This feature enables users to add comments to posts in their feed, fostering deeper engagement and conversation around shared content. Comments will be displayed beneath posts, showing the author, timestamp, and comment text.

## Glossary

- **User**: An authenticated individual with a Cognito account who can create posts and comments
- **Post**: A short-form content item (280 characters) created by a user
- **Comment**: A text response to a post, created by a user, with a 280 character limit
- **Comment_System**: The backend and frontend components that handle comment creation, retrieval, and display
- **Feed**: The main view where users see posts and their associated comments
- **CommentsTable**: The DynamoDB table storing comment data (PK: id, GSI: postId-createdAt)

## Requirements

### Requirement 1: Comment Creation

**User Story:** As a user, I want to add comments to posts, so that I can engage in conversations and share my thoughts on content.

#### Acceptance Criteria

1. WHEN a user types a comment and submits it, THE Comment_System SHALL create a new comment associated with the post
2. WHEN a user attempts to submit an empty comment, THE Comment_System SHALL prevent the submission and maintain the current state
3. WHEN a user attempts to submit a comment exceeding 280 characters, THE Comment_System SHALL prevent the submission and display a character count warning
4. WHEN a comment is created, THE Comment_System SHALL store the comment with the user ID, post ID, comment text, and timestamp
5. WHEN a comment is successfully created, THE Comment_System SHALL clear the input field and display the new comment immediately

### Requirement 2: Comment Display

**User Story:** As a user, I want to see comments on posts, so that I can read what others have said and follow conversations.

#### Acceptance Criteria

1. WHEN a post is displayed in the feed, THE Comment_System SHALL show all comments associated with that post
2. WHEN displaying comments, THE Comment_System SHALL show the comment author's username, comment text, and relative timestamp
3. WHEN multiple comments exist on a post, THE Comment_System SHALL display them in chronological order (oldest first)
4. WHEN a post has no comments, THE Comment_System SHALL display a message indicating no comments exist
5. WHEN comments are loaded, THE Comment_System SHALL fetch them efficiently using the postId-createdAt GSI

### Requirement 3: Comment Retrieval

**User Story:** As a user, I want comments to load quickly, so that I can see conversations without delays.

#### Acceptance Criteria

1. WHEN a user views a post, THE Comment_System SHALL retrieve comments using the postId-createdAt GSI for efficient querying
2. WHEN retrieving comments, THE Comment_System SHALL return them sorted by creation timestamp in ascending order
3. WHEN a post has many comments, THE Comment_System SHALL support pagination to limit initial load size
4. WHEN comment data is fetched, THE Comment_System SHALL include the commenter's username in the response

### Requirement 4: Authentication and Authorization

**User Story:** As a system, I want to ensure only authenticated users can comment, so that we maintain accountability and prevent spam.

#### Acceptance Criteria

1. WHEN a user attempts to create a comment, THE Comment_System SHALL verify the user is authenticated via JWT token
2. WHEN an unauthenticated user attempts to comment, THE Comment_System SHALL return an authentication error
3. WHEN storing a comment, THE Comment_System SHALL associate it with the authenticated user's ID
4. THE Comment_System SHALL allow any authenticated user to view comments on any post

### Requirement 5: Data Integrity

**User Story:** As a system administrator, I want comment data to be consistent and valid, so that the application remains reliable.

#### Acceptance Criteria

1. WHEN a comment is created, THE Comment_System SHALL generate a unique comment ID
2. WHEN storing a comment, THE Comment_System SHALL validate that the post ID exists
3. WHEN a comment is stored, THE Comment_System SHALL persist it to the CommentsTable immediately
4. WHEN retrieving comments, THE Comment_System SHALL handle missing or malformed data gracefully
5. THE Comment_System SHALL maintain referential integrity between comments, posts, and users

### Requirement 6: User Interface

**User Story:** As a user, I want an intuitive comment interface, so that I can easily read and write comments.

#### Acceptance Criteria

1. WHEN viewing a post, THE Comment_System SHALL display a comment input field below the post
2. WHEN the comment input receives focus, THE Comment_System SHALL provide visual feedback consistent with the app's design
3. WHEN typing a comment, THE Comment_System SHALL display a character counter showing remaining characters
4. WHEN comments are displayed, THE Comment_System SHALL use consistent styling with the rest of the application
5. WHEN the comment section is empty, THE Comment_System SHALL show a prompt encouraging users to add the first comment
