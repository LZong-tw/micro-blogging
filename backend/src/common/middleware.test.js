// Mock AWS SDK before importing the middleware
const mockCognitoSend = jest.fn();
const mockDynamoDBSend = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(),
  GetUserCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockDynamoDBSend,
    })),
  },
  QueryCommand: jest.fn(),
}));

const { withAuth } = require('./middleware');

describe('withAuth Middleware - Authentication Edge Cases', () => {
  const mockUserId = 'user-123';
  const mockUsername = 'testuser';
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USERS_TABLE = 'TestUsersTable';
  });

  afterEach(() => {
    delete process.env.USERS_TABLE;
  });

  // Mock handler function
  const mockHandler = jest.fn(async (event) => ({
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  }));

  test('should return 401 when Authorization header is missing', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const event = {
      headers: {},
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
    
    const body = JSON.parse(response.body);
    expect(body.message).toContain('Missing authorization token');
  });

  test('should return 401 when authorization header is missing (lowercase)', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const event = {
      headers: {},
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('should return 401 when Authorization header is empty string', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const event = {
      headers: {
        Authorization: '',
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('should return 401 when token is malformed (not a JWT)', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const event = {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
    
    const body = JSON.parse(response.body);
    expect(body.message).toContain('Authentication failed');
  });

  test('should return 401 when token has invalid structure', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const event = {
      headers: {
        Authorization: 'Bearer abc.def', // Only 2 parts instead of 3
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('should return 401 when token payload is not valid JSON', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    // Create a token with invalid base64 payload
    const invalidToken = 'header.!!!invalid!!!.signature';
    
    const event = {
      headers: {
        Authorization: `Bearer ${invalidToken}`,
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('should return 401 when user is not found in database', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    // Create a valid JWT structure with username
    const payload = JSON.stringify({
      'cognito:username': 'nonexistent',
    });
    const encodedPayload = Buffer.from(payload).toString('base64');
    const token = `header.${encodedPayload}.signature`;
    
    // Mock DynamoDB to return no users
    mockDynamoDBSend.mockResolvedValue({
      Items: [],
    });
    
    const event = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
    
    const body = JSON.parse(response.body);
    expect(body.message).toContain('Authentication failed');
  });

  test('should return 401 when USERS_TABLE environment variable is not set', async () => {
    delete process.env.USERS_TABLE;
    
    const wrappedHandler = withAuth(mockHandler);
    
    const payload = JSON.stringify({
      'cognito:username': mockUsername,
    });
    const encodedPayload = Buffer.from(payload).toString('base64');
    const token = `header.${encodedPayload}.signature`;
    
    const event = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('should handle DynamoDB query errors', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const payload = JSON.stringify({
      'cognito:username': mockUsername,
    });
    const encodedPayload = Buffer.from(payload).toString('base64');
    const token = `header.${encodedPayload}.signature`;
    
    // Mock DynamoDB to throw an error
    mockDynamoDBSend.mockRejectedValue(new Error('DynamoDB error'));
    
    const event = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('should successfully authenticate with valid token', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const payload = JSON.stringify({
      'cognito:username': mockUsername,
    });
    const encodedPayload = Buffer.from(payload).toString('base64');
    const token = `header.${encodedPayload}.signature`;
    
    // Mock DynamoDB to return a user
    mockDynamoDBSend.mockResolvedValue({
      Items: [
        {
          id: mockUserId,
          username: mockUsername,
        },
      ],
    });
    
    const event = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(200);
    expect(mockHandler).toHaveBeenCalledTimes(1);
    
    // Verify that the handler received the enhanced event with user info
    const calledEvent = mockHandler.mock.calls[0][0];
    expect(calledEvent.user).toBeDefined();
    expect(calledEvent.user.id).toBe(mockUserId);
    expect(calledEvent.user.username).toBe(mockUsername);
  });

  test('should handle token without Bearer prefix', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const payload = JSON.stringify({
      'cognito:username': mockUsername,
    });
    const encodedPayload = Buffer.from(payload).toString('base64');
    const token = `header.${encodedPayload}.signature`;
    
    mockDynamoDBSend.mockResolvedValue({
      Items: [
        {
          id: mockUserId,
          username: mockUsername,
        },
      ],
    });
    
    const event = {
      headers: {
        Authorization: token, // No "Bearer " prefix
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(200);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  test('should include CORS headers in 401 responses', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const event = {
      headers: {},
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(response.headers).toHaveProperty('Access-Control-Allow-Credentials', true);
    expect(response.headers).toHaveProperty('Content-Type', 'application/json');
  });

  test('should handle token with username field instead of cognito:username', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const payload = JSON.stringify({
      username: mockUsername, // Using 'username' instead of 'cognito:username'
    });
    const encodedPayload = Buffer.from(payload).toString('base64');
    const token = `header.${encodedPayload}.signature`;
    
    mockDynamoDBSend.mockResolvedValue({
      Items: [
        {
          id: mockUserId,
          username: mockUsername,
        },
      ],
    });
    
    const event = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(200);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  test('should return 401 when token has no username field', async () => {
    const wrappedHandler = withAuth(mockHandler);
    
    const payload = JSON.stringify({
      sub: 'some-sub-id',
      // No username or cognito:username field
    });
    const encodedPayload = Buffer.from(payload).toString('base64');
    const token = `header.${encodedPayload}.signature`;
    
    const event = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await wrappedHandler(event);

    expect(response.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});
