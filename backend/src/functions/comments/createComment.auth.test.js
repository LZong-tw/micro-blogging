// Mock AWS SDK before importing the handler
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
  PutCommand: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-comment-id'),
}));

const { handlerWithoutAuth } = require('./createComment');

describe('createComment Lambda function - Authentication Edge Cases (Requirement 4.2)', () => {
  const mockPostId = 'post-456';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variable
    process.env.COMMENTS_TABLE_NAME = 'TestCommentsTable';
    
    // Mock successful DynamoDB response
    mockSend.mockResolvedValue({});
  });

  afterEach(() => {
    delete process.env.COMMENTS_TABLE_NAME;
  });

  // Note: In production, the withAuth middleware ensures that event.user is always present
  // and contains valid id and username fields. These tests verify behavior when the
  // middleware is bypassed or fails to add user info.

  test('should return 500 when user object is missing from event', async () => {
    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: 'This is a test comment',
      }),
      // No user object - simulating unauthenticated request that bypassed middleware
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(500);
    expect(mockSend).not.toHaveBeenCalled();
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('InternalServerError');
  });

  test('should return 500 when user object is null', async () => {
    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: 'This is a test comment',
      }),
      user: null,
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(500);
    expect(mockSend).not.toHaveBeenCalled();
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('InternalServerError');
  });

  test('should create comment with undefined user.id (edge case - relies on middleware)', async () => {
    // Note: This is an edge case that should never happen in production because
    // withAuth middleware always provides user.id. However, the handler doesn't
    // explicitly validate this, relying on the middleware contract.
    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: 'This is a test comment',
      }),
      user: {
        // Missing id - edge case
        username: 'testuser',
      },
    };

    const response = await handlerWithoutAuth(event);

    // Handler proceeds with undefined userId (stored in DynamoDB)
    expect(response.statusCode).toBe(201);
    expect(mockSend).toHaveBeenCalledTimes(1);
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.userId).toBeUndefined();
    expect(responseBody.username).toBe('testuser');
  });

  test('should create comment with undefined user.username (edge case - relies on middleware)', async () => {
    // Note: This is an edge case that should never happen in production because
    // withAuth middleware always provides user.username. However, the handler doesn't
    // explicitly validate this, relying on the middleware contract.
    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: 'This is a test comment',
      }),
      user: {
        id: 'user-123',
        // Missing username - edge case
      },
    };

    const response = await handlerWithoutAuth(event);

    // Handler proceeds with undefined username (stored in DynamoDB)
    expect(response.statusCode).toBe(201);
    expect(mockSend).toHaveBeenCalledTimes(1);
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.userId).toBe('user-123');
    expect(responseBody.username).toBeUndefined();
  });
});
