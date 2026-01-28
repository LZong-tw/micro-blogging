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
  v4: jest.fn(),
}));

const { handlerWithoutAuth } = require('./createComment');
const { v4: uuidv4 } = require('uuid');

describe('createComment Lambda function', () => {
  const mockUserId = 'user-123';
  const mockUsername = 'testuser';
  const mockPostId = 'post-456';
  const mockCommentId = 'comment-789';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock uuid
    uuidv4.mockReturnValue(mockCommentId);
    
    // Set environment variable
    process.env.COMMENTS_TABLE_NAME = 'TestCommentsTable';
    
    // Mock successful DynamoDB response
    mockSend.mockResolvedValue({});
  });

  afterEach(() => {
    delete process.env.COMMENTS_TABLE_NAME;
  });

  test('should create a comment successfully with valid input', async () => {
    const event = {
      headers: {},
      body: JSON.stringify({
        postId: mockPostId,
        text: 'This is a test comment',
      }),
      user: {
        id: mockUserId,
        username: mockUsername,
      },
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(201);
    expect(mockSend).toHaveBeenCalledTimes(1);
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.id).toBe(mockCommentId);
    expect(responseBody.postId).toBe(mockPostId);
    expect(responseBody.userId).toBe(mockUserId);
    expect(responseBody.username).toBe(mockUsername);
    expect(responseBody.text).toBe('This is a test comment');
    expect(responseBody.createdAt).toBeDefined();
  });

  test('should reject empty comment text', async () => {
    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: '',
      }),
      user: {
        id: mockUserId,
        username: mockUsername,
      },
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('ValidationError');
    expect(responseBody.message).toContain('required');
  });

  test('should reject whitespace-only comment text', async () => {
    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: '   \t\n  ',
      }),
      user: {
        id: mockUserId,
        username: mockUsername,
      },
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('ValidationError');
    expect(responseBody.message).toContain('whitespace');
  });

  test('should reject comment text exceeding 280 characters', async () => {
    const longText = 'a'.repeat(281);
    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: longText,
      }),
      user: {
        id: mockUserId,
        username: mockUsername,
      },
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('ValidationError');
    expect(responseBody.message).toContain('280 characters');
  });

  test('should accept comment text with exactly 280 characters', async () => {
    const maxText = 'a'.repeat(280);
    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: maxText,
      }),
      user: {
        id: mockUserId,
        username: mockUsername,
      },
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(201);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should reject missing postId', async () => {
    const event = {
      body: JSON.stringify({
        text: 'This is a test comment',
      }),
      user: {
        id: mockUserId,
        username: mockUsername,
      },
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('ValidationError');
    expect(responseBody.message).toContain('Post ID');
  });

  test('should reject missing request body', async () => {
    const event = {
      user: {
        id: mockUserId,
        username: mockUsername,
      },
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('ValidationError');
  });

  test('should trim whitespace from comment text before storing', async () => {
    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: '  This is a test comment  ',
      }),
      user: {
        id: mockUserId,
        username: mockUsername,
      },
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(201);
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.text).toBe('This is a test comment');
  });

  test('should include CORS headers in response', async () => {
    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: 'This is a test comment',
      }),
      user: {
        id: mockUserId,
        username: mockUsername,
      },
    };

    const response = await handlerWithoutAuth(event);

    expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(response.headers).toHaveProperty('Access-Control-Allow-Credentials', true);
    expect(response.headers).toHaveProperty('Content-Type', 'application/json');
  });

  test('should handle DynamoDB errors gracefully', async () => {
    mockSend.mockRejectedValue(new Error('DynamoDB error'));

    const event = {
      body: JSON.stringify({
        postId: mockPostId,
        text: 'This is a test comment',
      }),
      user: {
        id: mockUserId,
        username: mockUsername,
      },
    };

    const response = await handlerWithoutAuth(event);

    expect(response.statusCode).toBe(500);
    
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('InternalServerError');
  });

  // Edge case tests for Requirements 4.2, 5.2, 5.4
  describe('Edge Cases', () => {
    test('should reject request with malformed JSON body', async () => {
      const event = {
        body: 'invalid-json{',
        user: {
          id: mockUserId,
          username: mockUsername,
        },
      };

      const response = await handlerWithoutAuth(event);

      expect(response.statusCode).toBe(500);
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should reject request with null text field', async () => {
      const event = {
        body: JSON.stringify({
          postId: mockPostId,
          text: null,
        }),
        user: {
          id: mockUserId,
          username: mockUsername,
        },
      };

      const response = await handlerWithoutAuth(event);

      expect(response.statusCode).toBe(400);
      expect(mockSend).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe('ValidationError');
    });

    test('should reject request with undefined text field', async () => {
      const event = {
        body: JSON.stringify({
          postId: mockPostId,
        }),
        user: {
          id: mockUserId,
          username: mockUsername,
        },
      };

      const response = await handlerWithoutAuth(event);

      expect(response.statusCode).toBe(400);
      expect(mockSend).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe('ValidationError');
    });

    test('should reject request with empty string postId', async () => {
      const event = {
        body: JSON.stringify({
          postId: '',
          text: 'This is a test comment',
        }),
        user: {
          id: mockUserId,
          username: mockUsername,
        },
      };

      const response = await handlerWithoutAuth(event);

      expect(response.statusCode).toBe(400);
      expect(mockSend).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe('ValidationError');
    });

    test('should reject request with null postId', async () => {
      const event = {
        body: JSON.stringify({
          postId: null,
          text: 'This is a test comment',
        }),
        user: {
          id: mockUserId,
          username: mockUsername,
        },
      };

      const response = await handlerWithoutAuth(event);

      expect(response.statusCode).toBe(400);
      expect(mockSend).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe('ValidationError');
    });

    test('should handle text with special characters', async () => {
      const specialText = 'Test with special chars: @#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const event = {
        body: JSON.stringify({
          postId: mockPostId,
          text: specialText,
        }),
        user: {
          id: mockUserId,
          username: mockUsername,
        },
      };

      const response = await handlerWithoutAuth(event);

      expect(response.statusCode).toBe(201);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.text).toBe(specialText);
    });

    test('should handle text with unicode characters', async () => {
      const unicodeText = 'Test with unicode: 你好 🎉 émojis';
      const event = {
        body: JSON.stringify({
          postId: mockPostId,
          text: unicodeText,
        }),
        user: {
          id: mockUserId,
          username: mockUsername,
        },
      };

      const response = await handlerWithoutAuth(event);

      expect(response.statusCode).toBe(201);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.text).toBe(unicodeText);
    });

    test('should handle text with newlines and tabs', async () => {
      const textWithWhitespace = 'Line 1\nLine 2\tTabbed';
      const event = {
        body: JSON.stringify({
          postId: mockPostId,
          text: textWithWhitespace,
        }),
        user: {
          id: mockUserId,
          username: mockUsername,
        },
      };

      const response = await handlerWithoutAuth(event);

      expect(response.statusCode).toBe(201);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.text).toBe(textWithWhitespace);
    });
  });
});
