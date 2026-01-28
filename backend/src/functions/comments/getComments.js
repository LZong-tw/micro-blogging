const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize clients
const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

/**
 * Lambda handler for retrieving comments for a specific post
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
const handler = async (event) => {
  try {
    // Get table name from environment
    const commentsTableName = process.env.COMMENTS_TABLE_NAME;
    if (!commentsTableName) {
      throw new Error('COMMENTS_TABLE_NAME environment variable is not set');
    }

    // Extract postId from path parameters
    const postId = event.pathParameters?.postId;
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
          message: 'Post ID is required',
        }),
      };
    }

    // Parse query parameters for pagination
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 50;

    // Safely parse the lastKey for pagination
    let exclusiveStartKey = null;
    try {
      if (queryParams.lastKey) {
        const decodedKey = decodeURIComponent(queryParams.lastKey);
        if (decodedKey) {
          exclusiveStartKey = JSON.parse(decodedKey);
        }
      }
    } catch (error) {
      console.error('Error parsing lastKey:', error);
      exclusiveStartKey = null;
    }

    // Build query parameters for DynamoDB
    const dbQueryParams = {
      TableName: commentsTableName,
      IndexName: 'postId-index',
      KeyConditionExpression: 'postId = :postId',
      ExpressionAttributeValues: {
        ':postId': postId,
      },
      ScanIndexForward: true, // Sort by createdAt ascending (oldest first)
      Limit: limit,
    };

    // Add pagination key if provided
    if (exclusiveStartKey && typeof exclusiveStartKey === 'object' && Object.keys(exclusiveStartKey).length > 0) {
      dbQueryParams.ExclusiveStartKey = exclusiveStartKey;
    }

    // Query CommentsTable using postId-createdAt GSI
    const queryCommand = new QueryCommand(dbQueryParams);
    const result = await ddbDocClient.send(queryCommand);

    const comments = result.Items || [];
    const lastEvaluatedKey = result.LastEvaluatedKey;

    // Encode the lastKey for pagination
    let encodedLastKey = null;
    if (lastEvaluatedKey && Object.keys(lastEvaluatedKey).length > 0) {
      try {
        encodedLastKey = encodeURIComponent(JSON.stringify(lastEvaluatedKey));
      } catch (error) {
        console.error('Error encoding lastEvaluatedKey:', error);
        encodedLastKey = null;
      }
    }

    // Return success response with comments array
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        comments,
        lastKey: encodedLastKey,
      }),
    };
  } catch (error) {
    console.error('Error retrieving comments:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        error: 'InternalServerError',
        message: 'Error retrieving comments',
        details: error.message || 'Unknown error',
      }),
    };
  }
};

// Export the handler
exports.handler = handler;
