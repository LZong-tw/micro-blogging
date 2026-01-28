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
  QueryCommand: jest.fn(),
}));

const { handler } = require('./getComments');

describe('getComments Lambda Function', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    process.env.COMMENTS_TABLE_NAME = 'test-comments-table';
    
    // Mock successful DynamoDB response by default
    mockSend.mockResolvedValue({
      Items: [],
      LastEvaluatedKey: undefined,
    });
  });

  afterEach(() => {
    delete process.env.COMMENTS_TABLE_NAME;
  });

  test('should retrieve comments for a post successfully', async () => {
    const mockComments = [
      {
        id: 'comment-1',
        postId: 'post-123',
        userId: 'user-1',
        username: 'testuser1',
        text: 'First comment',
        createdAt: '2024-01-01T10:00:00.000Z',
      },
      {
        id: 'comment-2',
        postId: 'post-123',
        userId: 'user-2',
        username: 'testuser2',
        text: 'Second comment',
        createdAt: '2024-01-01T11:00:00.000Z',
      },
    ];

    mockSend.mockResolvedValue({
      Items: mockComments,
      LastEvaluatedKey: undefined,
    });

    const event = {
      pathParameters: {
        postId: 'post-123',
      },
      queryStringParameters: {},
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.comments).toHaveLength(2);
    expect(body.comments[0].id).toBe('comment-1');
    expect(body.comments[1].id).toBe('comment-2');
    expect(body.lastKey).toBeNull();
  });

  test('should return empty array when post has no comments', async () => {
    mockSend.mockResolvedValue({
      Items: [],
      LastEvaluatedKey: undefined,
    });

    const event = {
      pathParameters: {
        postId: 'post-with-no-comments',
      },
      queryStringParameters: {},
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.comments).toHaveLength(0);
    expect(body.lastKey).toBeNull();
  });

  test('should return 400 when postId is missing', async () => {
    const event = {
      pathParameters: {},
      queryStringParameters: {},
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.error).toBe('ValidationError');
    expect(body.message).toBe('Post ID is required');
  });

  test('should support pagination with limit parameter', async () => {
    const mockComments = [
      {
        id: 'comment-1',
        postId: 'post-123',
        userId: 'user-1',
        username: 'testuser1',
        text: 'First comment',
        createdAt: '2024-01-01T10:00:00.000Z',
      },
    ];

    const mockLastKey = {
      id: 'comment-1',
      postId: 'post-123',
      createdAt: '2024-01-01T10:00:00.000Z',
    };

    mockSend.mockResolvedValue({
      Items: mockComments,
      LastEvaluatedKey: mockLastKey,
    });

    const event = {
      pathParameters: {
        postId: 'post-123',
      },
      queryStringParameters: {
        limit: '1',
      },
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.comments).toHaveLength(1);
    expect(body.lastKey).toBeTruthy();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should use lastKey for pagination', async () => {
    const mockComments = [
      {
        id: 'comment-2',
        postId: 'post-123',
        userId: 'user-2',
        username: 'testuser2',
        text: 'Second comment',
        createdAt: '2024-01-01T11:00:00.000Z',
      },
    ];

    mockSend.mockResolvedValue({
      Items: mockComments,
      LastEvaluatedKey: undefined,
    });

    const lastKey = encodeURIComponent(JSON.stringify({
      id: 'comment-1',
      postId: 'post-123',
      createdAt: '2024-01-01T10:00:00.000Z',
    }));

    const event = {
      pathParameters: {
        postId: 'post-123',
      },
      queryStringParameters: {
        lastKey,
      },
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.comments).toHaveLength(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should sort comments by createdAt ascending', async () => {
    const mockComments = [
      {
        id: 'comment-1',
        postId: 'post-123',
        userId: 'user-1',
        username: 'testuser1',
        text: 'First comment',
        createdAt: '2024-01-01T10:00:00.000Z',
      },
      {
        id: 'comment-2',
        postId: 'post-123',
        userId: 'user-2',
        username: 'testuser2',
        text: 'Second comment',
        createdAt: '2024-01-01T11:00:00.000Z',
      },
    ];

    mockSend.mockResolvedValue({
      Items: mockComments,
      LastEvaluatedKey: undefined,
    });

    const event = {
      pathParameters: {
        postId: 'post-123',
      },
      queryStringParameters: {},
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should handle malformed lastKey gracefully', async () => {
    const mockComments = [
      {
        id: 'comment-1',
        postId: 'post-123',
        userId: 'user-1',
        username: 'testuser1',
        text: 'First comment',
        createdAt: '2024-01-01T10:00:00.000Z',
      },
    ];

    mockSend.mockResolvedValue({
      Items: mockComments,
      LastEvaluatedKey: undefined,
    });

    const event = {
      pathParameters: {
        postId: 'post-123',
      },
      queryStringParameters: {
        lastKey: 'invalid-json',
      },
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.comments).toHaveLength(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should return 500 on DynamoDB error', async () => {
    mockSend.mockRejectedValue(new Error('DynamoDB error'));

    const event = {
      pathParameters: {
        postId: 'post-123',
      },
      queryStringParameters: {},
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(500);
    expect(body.error).toBe('InternalServerError');
    expect(body.message).toBe('Error retrieving comments');
  });

  test('should use default limit of 50 when not specified', async () => {
    mockSend.mockResolvedValue({
      Items: [],
      LastEvaluatedKey: undefined,
    });

    const event = {
      pathParameters: {
        postId: 'post-123',
      },
      queryStringParameters: {},
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should query using postId-createdAt-index GSI', async () => {
    mockSend.mockResolvedValue({
      Items: [],
      LastEvaluatedKey: undefined,
    });

    const event = {
      pathParameters: {
        postId: 'post-123',
      },
      queryStringParameters: {},
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should include CORS headers in response', async () => {
    mockSend.mockResolvedValue({
      Items: [],
      LastEvaluatedKey: undefined,
    });

    const event = {
      pathParameters: {
        postId: 'post-123',
      },
      queryStringParameters: {},
    };

    const response = await handler(event);

    expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(response.headers).toHaveProperty('Access-Control-Allow-Credentials', true);
    expect(response.headers).toHaveProperty('Content-Type', 'application/json');
  });

  // Edge case tests for Requirements 4.2, 5.2, 5.4
  describe('Edge Cases', () => {
    test('should return empty array for non-existent post ID', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const event = {
        pathParameters: {
          postId: 'non-existent-post-id',
        },
        queryStringParameters: {},
      };

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.comments).toHaveLength(0);
      expect(body.lastKey).toBeNull();
    });

    test('should handle null pathParameters', async () => {
      const event = {
        pathParameters: null,
        queryStringParameters: {},
      };

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toBe('Post ID is required');
    });

    test('should handle undefined pathParameters', async () => {
      const event = {
        queryStringParameters: {},
      };

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toBe('Post ID is required');
    });

    test('should handle empty string postId', async () => {
      const event = {
        pathParameters: {
          postId: '',
        },
        queryStringParameters: {},
      };

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toBe('Post ID is required');
    });

    test('should handle null queryStringParameters', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const event = {
        pathParameters: {
          postId: 'post-123',
        },
        queryStringParameters: null,
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('should handle invalid limit parameter', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const event = {
        pathParameters: {
          postId: 'post-123',
        },
        queryStringParameters: {
          limit: 'not-a-number',
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('should handle negative limit parameter', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const event = {
        pathParameters: {
          postId: 'post-123',
        },
        queryStringParameters: {
          limit: '-10',
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('should handle zero limit parameter', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const event = {
        pathParameters: {
          postId: 'post-123',
        },
        queryStringParameters: {
          limit: '0',
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('should handle malformed lastKey with special characters', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const event = {
        pathParameters: {
          postId: 'post-123',
        },
        queryStringParameters: {
          lastKey: '!@#$%^&*()',
        },
      };

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.comments).toHaveLength(0);
    });

    test('should handle empty lastKey string', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const event = {
        pathParameters: {
          postId: 'post-123',
        },
        queryStringParameters: {
          lastKey: '',
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('should handle DynamoDB returning null Items', async () => {
      mockSend.mockResolvedValue({
        Items: null,
        LastEvaluatedKey: undefined,
      });

      const event = {
        pathParameters: {
          postId: 'post-123',
        },
        queryStringParameters: {},
      };

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.comments).toHaveLength(0);
    });

    test('should handle DynamoDB returning undefined Items', async () => {
      mockSend.mockResolvedValue({
        LastEvaluatedKey: undefined,
      });

      const event = {
        pathParameters: {
          postId: 'post-123',
        },
        queryStringParameters: {},
      };

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.comments).toHaveLength(0);
    });
  });
});
