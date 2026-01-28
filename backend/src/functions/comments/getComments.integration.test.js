/**
 * Integration test for pagination flow
 * 
 * This test validates Requirement 3.3: Pagination correctness
 * 
 * The test creates many comments for a post, fetches them with pagination,
 * and verifies that there are no duplicates or omissions across all pages.
 */

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

describe('Integration Test: Pagination Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COMMENTS_TABLE_NAME = 'TestCommentsTable';
  });

  afterEach(() => {
    delete process.env.COMMENTS_TABLE_NAME;
  });

  /**
   * Integration test for complete pagination flow
   * **Validates: Requirement 3.3**
   * 
   * This test simulates a realistic scenario where:
   * 1. A post has many comments (more than can fit in a single page)
   * 2. The client fetches comments page by page using pagination
   * 3. All comments are retrieved exactly once with no duplicates or omissions
   */
  test('should retrieve all comments across multiple pages with no duplicates or omissions', async () => {
    const postId = 'test-post-123';
    const totalComments = 25;
    const pageSize = 5;
    
    // Create test comments with sequential timestamps
    const allComments = Array.from({ length: totalComments }, (_, i) => ({
      id: `comment-${i.toString().padStart(3, '0')}`,
      postId: postId,
      userId: `user-${i}`,
      username: `testuser${i}`,
      text: `This is test comment number ${i}`,
      createdAt: new Date(Date.parse('2024-01-01T00:00:00.000Z') + i * 60000).toISOString(),
    }));

    // Track which page we're on for the mock
    let currentPage = 0;
    
    // Mock DynamoDB to return paginated results
    mockSend.mockImplementation(() => {
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalComments);
      const pageComments = allComments.slice(startIndex, endIndex);
      
      // Determine if there are more pages
      const hasMorePages = endIndex < totalComments;
      const lastEvaluatedKey = hasMorePages ? {
        id: pageComments[pageComments.length - 1].id,
        postId: postId,
        createdAt: pageComments[pageComments.length - 1].createdAt,
      } : undefined;
      
      currentPage++;
      
      return Promise.resolve({
        Items: pageComments,
        LastEvaluatedKey: lastEvaluatedKey,
      });
    });

    // Simulate client fetching all pages
    const retrievedComments = [];
    let lastKey = null;
    let pageCount = 0;
    const maxPages = 10; // Safety limit to prevent infinite loops

    while (pageCount < maxPages) {
      // Build the event
      const event = {
        pathParameters: {
          postId: postId,
        },
        queryStringParameters: {
          limit: String(pageSize),
          ...(lastKey ? { lastKey: encodeURIComponent(JSON.stringify(lastKey)) } : {}),
        },
      };

      // Fetch the page
      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      
      // Add comments from this page
      retrievedComments.push(...body.comments);
      
      // Update lastKey for next iteration
      if (body.lastKey) {
        lastKey = JSON.parse(decodeURIComponent(body.lastKey));
      } else {
        lastKey = null;
      }
      
      pageCount++;
      
      // Break if no more pages
      if (!lastKey) {
        break;
      }
    }

    // Verify we retrieved all comments
    expect(retrievedComments).toHaveLength(totalComments);
    
    // Verify no duplicates
    const retrievedIds = retrievedComments.map(c => c.id);
    const uniqueIds = new Set(retrievedIds);
    expect(uniqueIds.size).toBe(totalComments);
    
    // Verify no omissions - all original comment IDs should be present
    const originalIds = allComments.map(c => c.id);
    originalIds.forEach(id => {
      expect(retrievedIds).toContain(id);
    });
    
    // Verify no extra comments
    retrievedIds.forEach(id => {
      expect(originalIds).toContain(id);
    });
    
    // Verify chronological order is maintained across all pages
    for (let i = 0; i < retrievedComments.length - 1; i++) {
      const currentTimestamp = new Date(retrievedComments[i].createdAt).getTime();
      const nextTimestamp = new Date(retrievedComments[i + 1].createdAt).getTime();
      expect(currentTimestamp).toBeLessThanOrEqual(nextTimestamp);
    }
    
    // Verify we made the expected number of API calls
    const expectedPages = Math.ceil(totalComments / pageSize);
    expect(pageCount).toBe(expectedPages);
    expect(mockSend).toHaveBeenCalledTimes(expectedPages);
  });

  test('should handle pagination with varying page sizes', async () => {
    const postId = 'test-post-456';
    const totalComments = 30;
    const pageSize = 7;
    
    // Create test comments
    const allComments = Array.from({ length: totalComments }, (_, i) => ({
      id: `comment-${i.toString().padStart(3, '0')}`,
      postId: postId,
      userId: `user-${i}`,
      username: `testuser${i}`,
      text: `Comment ${i}`,
      createdAt: new Date(Date.parse('2024-01-01T00:00:00.000Z') + i * 60000).toISOString(),
    }));

    let currentPage = 0;
    
    mockSend.mockImplementation(() => {
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalComments);
      const pageComments = allComments.slice(startIndex, endIndex);
      
      const hasMorePages = endIndex < totalComments;
      const lastEvaluatedKey = hasMorePages ? {
        id: pageComments[pageComments.length - 1].id,
        postId: postId,
        createdAt: pageComments[pageComments.length - 1].createdAt,
      } : undefined;
      
      currentPage++;
      
      return Promise.resolve({
        Items: pageComments,
        LastEvaluatedKey: lastEvaluatedKey,
      });
    });

    // Fetch all pages
    const retrievedComments = [];
    let lastKey = null;
    let pageCount = 0;

    while (pageCount < 10) {
      const event = {
        pathParameters: {
          postId: postId,
        },
        queryStringParameters: {
          limit: String(pageSize),
          ...(lastKey ? { lastKey: encodeURIComponent(JSON.stringify(lastKey)) } : {}),
        },
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      retrievedComments.push(...body.comments);
      
      if (body.lastKey) {
        lastKey = JSON.parse(decodeURIComponent(body.lastKey));
      } else {
        break;
      }
      
      pageCount++;
    }

    // Verify completeness
    expect(retrievedComments).toHaveLength(totalComments);
    
    // Verify no duplicates
    const retrievedIds = retrievedComments.map(c => c.id);
    const uniqueIds = new Set(retrievedIds);
    expect(uniqueIds.size).toBe(totalComments);
  });

  test('should handle edge case where total comments equals page size', async () => {
    const postId = 'test-post-789';
    const totalComments = 10;
    const pageSize = 10;
    
    // Create test comments
    const allComments = Array.from({ length: totalComments }, (_, i) => ({
      id: `comment-${i.toString().padStart(3, '0')}`,
      postId: postId,
      userId: `user-${i}`,
      username: `testuser${i}`,
      text: `Comment ${i}`,
      createdAt: new Date(Date.parse('2024-01-01T00:00:00.000Z') + i * 60000).toISOString(),
    }));

    // Mock DynamoDB to return all comments in one page
    mockSend.mockResolvedValue({
      Items: allComments,
      LastEvaluatedKey: undefined, // No more pages
    });

    const event = {
      pathParameters: {
        postId: postId,
      },
      queryStringParameters: {
        limit: String(pageSize),
      },
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.comments).toHaveLength(totalComments);
    expect(body.lastKey).toBeNull();
    
    // Verify all comments are present
    const retrievedIds = body.comments.map(c => c.id);
    const originalIds = allComments.map(c => c.id);
    expect(retrievedIds).toEqual(originalIds);
  });

  test('should handle pagination with single comment per page', async () => {
    const postId = 'test-post-single';
    const totalComments = 5;
    const pageSize = 1;
    
    // Create test comments
    const allComments = Array.from({ length: totalComments }, (_, i) => ({
      id: `comment-${i}`,
      postId: postId,
      userId: `user-${i}`,
      username: `testuser${i}`,
      text: `Comment ${i}`,
      createdAt: new Date(Date.parse('2024-01-01T00:00:00.000Z') + i * 60000).toISOString(),
    }));

    let currentPage = 0;
    
    mockSend.mockImplementation(() => {
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalComments);
      const pageComments = allComments.slice(startIndex, endIndex);
      
      const hasMorePages = endIndex < totalComments;
      const lastEvaluatedKey = hasMorePages ? {
        id: pageComments[pageComments.length - 1].id,
        postId: postId,
        createdAt: pageComments[pageComments.length - 1].createdAt,
      } : undefined;
      
      currentPage++;
      
      return Promise.resolve({
        Items: pageComments,
        LastEvaluatedKey: lastEvaluatedKey,
      });
    });

    // Fetch all pages
    const retrievedComments = [];
    let lastKey = null;
    let pageCount = 0;

    while (pageCount < 10) {
      const event = {
        pathParameters: {
          postId: postId,
        },
        queryStringParameters: {
          limit: String(pageSize),
          ...(lastKey ? { lastKey: encodeURIComponent(JSON.stringify(lastKey)) } : {}),
        },
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      
      // Each page should have exactly 1 comment (except possibly the last)
      expect(body.comments.length).toBeLessThanOrEqual(1);
      
      retrievedComments.push(...body.comments);
      
      pageCount++;
      
      if (body.lastKey) {
        lastKey = JSON.parse(decodeURIComponent(body.lastKey));
      } else {
        break;
      }
    }

    // Verify all comments retrieved
    expect(retrievedComments).toHaveLength(totalComments);
    expect(pageCount).toBe(totalComments);
    
    // Verify no duplicates
    const retrievedIds = retrievedComments.map(c => c.id);
    const uniqueIds = new Set(retrievedIds);
    expect(uniqueIds.size).toBe(totalComments);
  });

  test('should ensure no comment appears in multiple pages', async () => {
    const postId = 'test-post-overlap';
    const totalComments = 20;
    const pageSize = 4;
    
    // Create test comments
    const allComments = Array.from({ length: totalComments }, (_, i) => ({
      id: `comment-${i.toString().padStart(3, '0')}`,
      postId: postId,
      userId: `user-${i}`,
      username: `testuser${i}`,
      text: `Comment ${i}`,
      createdAt: new Date(Date.parse('2024-01-01T00:00:00.000Z') + i * 60000).toISOString(),
    }));

    let currentPage = 0;
    
    mockSend.mockImplementation(() => {
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalComments);
      const pageComments = allComments.slice(startIndex, endIndex);
      
      const hasMorePages = endIndex < totalComments;
      const lastEvaluatedKey = hasMorePages ? {
        id: pageComments[pageComments.length - 1].id,
        postId: postId,
        createdAt: pageComments[pageComments.length - 1].createdAt,
      } : undefined;
      
      currentPage++;
      
      return Promise.resolve({
        Items: pageComments,
        LastEvaluatedKey: lastEvaluatedKey,
      });
    });

    // Track comments by page
    const commentsByPage = [];
    let lastKey = null;
    let pageCount = 0;

    while (pageCount < 10) {
      const event = {
        pathParameters: {
          postId: postId,
        },
        queryStringParameters: {
          limit: String(pageSize),
          ...(lastKey ? { lastKey: encodeURIComponent(JSON.stringify(lastKey)) } : {}),
        },
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      const pageIds = body.comments.map(c => c.id);
      commentsByPage.push(pageIds);
      
      if (body.lastKey) {
        lastKey = JSON.parse(decodeURIComponent(body.lastKey));
      } else {
        break;
      }
      
      pageCount++;
    }

    // Verify no overlaps between any two pages
    for (let i = 0; i < commentsByPage.length; i++) {
      for (let j = i + 1; j < commentsByPage.length; j++) {
        const page1Ids = new Set(commentsByPage[i]);
        const page2Ids = commentsByPage[j];
        
        // No ID from page j should exist in page i
        page2Ids.forEach(id => {
          expect(page1Ids.has(id)).toBe(false);
        });
      }
    }

    // Verify total count
    const allRetrievedIds = commentsByPage.flat();
    expect(allRetrievedIds).toHaveLength(totalComments);
  });

  test('should handle large number of comments with realistic pagination', async () => {
    const postId = 'test-post-large';
    const totalComments = 100;
    const pageSize = 10;
    
    // Create test comments
    const allComments = Array.from({ length: totalComments }, (_, i) => ({
      id: `comment-${i.toString().padStart(4, '0')}`,
      postId: postId,
      userId: `user-${i}`,
      username: `testuser${i}`,
      text: `This is comment number ${i} with some additional text to make it more realistic`,
      createdAt: new Date(Date.parse('2024-01-01T00:00:00.000Z') + i * 60000).toISOString(),
    }));

    let currentPage = 0;
    
    mockSend.mockImplementation(() => {
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalComments);
      const pageComments = allComments.slice(startIndex, endIndex);
      
      const hasMorePages = endIndex < totalComments;
      const lastEvaluatedKey = hasMorePages ? {
        id: pageComments[pageComments.length - 1].id,
        postId: postId,
        createdAt: pageComments[pageComments.length - 1].createdAt,
      } : undefined;
      
      currentPage++;
      
      return Promise.resolve({
        Items: pageComments,
        LastEvaluatedKey: lastEvaluatedKey,
      });
    });

    // Fetch all pages
    const retrievedComments = [];
    let lastKey = null;
    let pageCount = 0;

    while (pageCount < 20) {
      const event = {
        pathParameters: {
          postId: postId,
        },
        queryStringParameters: {
          limit: String(pageSize),
          ...(lastKey ? { lastKey: encodeURIComponent(JSON.stringify(lastKey)) } : {}),
        },
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      retrievedComments.push(...body.comments);
      
      pageCount++;
      
      if (body.lastKey) {
        lastKey = JSON.parse(decodeURIComponent(body.lastKey));
      } else {
        break;
      }
    }

    // Verify completeness
    expect(retrievedComments).toHaveLength(totalComments);
    
    // Verify no duplicates
    const retrievedIds = retrievedComments.map(c => c.id);
    const uniqueIds = new Set(retrievedIds);
    expect(uniqueIds.size).toBe(totalComments);
    
    // Verify chronological order
    for (let i = 0; i < retrievedComments.length - 1; i++) {
      const currentTimestamp = new Date(retrievedComments[i].createdAt).getTime();
      const nextTimestamp = new Date(retrievedComments[i + 1].createdAt).getTime();
      expect(currentTimestamp).toBeLessThanOrEqual(nextTimestamp);
    }
    
    // Verify expected number of pages
    const expectedPages = Math.ceil(totalComments / pageSize);
    expect(pageCount).toBe(expectedPages);
  });
});
