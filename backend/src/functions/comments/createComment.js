const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { withAuth } = require('../../common/middleware');

// Initialize clients
const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

/**
 * Lambda handler for creating a new comment on a post
 * @param {Object} event - API Gateway event with user info added by auth middleware
 * @returns {Object} - API Gateway response
 */
const handler = async (event) => {
  try {
    // Validate request body exists
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ 
          error: 'ValidationError',
          message: 'Missing request body' 
        }),
      };
    }

    const { postId, text } = JSON.parse(event.body);
    
    // Validate required fields
    if (!postId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ 
          error: 'ValidationError',
          message: 'Post ID is required' 
        }),
      };
    }

    if (!text) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ 
          error: 'ValidationError',
          message: 'Comment text is required' 
        }),
      };
    }

    // Validate text is not just whitespace
    if (text.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ 
          error: 'ValidationError',
          message: 'Comment text cannot be empty or contain only whitespace' 
        }),
      };
    }
    
    // Validate character limit (280 characters)
    const MAX_TEXT_LENGTH = 280;
    if (text.length > MAX_TEXT_LENGTH) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ 
          error: 'ValidationError',
          message: `Comment text cannot exceed ${MAX_TEXT_LENGTH} characters` 
        }),
      };
    }
    
    // Get table name from environment
    const commentsTableName = process.env.COMMENTS_TABLE_NAME;
    if (!commentsTableName) {
      throw new Error('COMMENTS_TABLE_NAME environment variable is not set');
    }

    // Generate unique comment ID
    const commentId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create comment object with all required fields
    const comment = {
      id: commentId,
      postId: postId,
      userId: event.user.id,
      username: event.user.username,
      text: text.trim(), // Store trimmed text
      createdAt: timestamp,
    };

    // Store comment in DynamoDB
    const putCommand = new PutCommand({
      TableName: commentsTableName,
      Item: comment,
    });
    
    await ddbDocClient.send(putCommand);

    // Return success response with comment data
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(comment),
    };
  } catch (error) {
    console.error('Error creating comment:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        error: 'InternalServerError',
        message: 'Error creating comment',
        details: error.message || 'Unknown error',
      }),
    };
  }
};

// Export the handler wrapped with authentication middleware
exports.handler = withAuth(handler);
// Export unwrapped handler for testing
exports.handlerWithoutAuth = handler;
