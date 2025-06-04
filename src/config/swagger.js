const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { config } = require('./environment');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Group Messaging API',
    version: '1.0.0',
    description: `
          A comprehensive REST API for group messaging with user authentication, group management, and real-time messaging capabilities.
          
          ## Features
          - JWT-based authentication
          - User registration and management
          - Group creation and management
          - Message sending and retrieval
          - Search functionality
          - Rate limiting for security
          - Real-time messaging with Socket.io
          - Typing indicators and presence detection
          
          ## Authentication
          Most endpoints require JWT authentication. To use protected endpoints:
          1. Register a new account or login with existing credentials
          2. Copy the JWT token from the response
          3. Click the "Authorize" button above
          4. Enter your JWT token directly in the authorization field (do not include "Bearer" prefix)
          5. All subsequent requests will include the authentication header
          
          ## Rate Limiting
          This API implements rate limiting to prevent abuse:
          - Registration: 5 attempts per hour per IP
          - Login: 10 attempts per 15 minutes per IP
          - Message sending: 30 messages per minute per user
          - Search: 20 searches per 5 minutes per user
          
          ## Real-Time API
          This API also provides WebSocket-based real-time communication using Socket.io:
          - Requires the same JWT token for authentication
          - Enables instant message delivery
          - Provides typing indicators and presence detection
          - Supports read receipts and notifications
        `,
  },
  servers: [
    {
      url: `http://localhost:${config.PORT}`,
      description: 'Test server',
    },
    {
      url: 'http://3.86.209.78',
      description: 'Production server',
    },
   
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'Enter your JWT token directly (without Bearer prefix). The system will automatically add the "Bearer" prefix.',
      },
    },
    schemas: {
      // User schemas
      User: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Unique user identifier',
            example: '507f1f77bcf86cd799439011',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'john.doe@example.com',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp',
            example: '2024-01-01T12:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last account update timestamp',
            example: '2024-01-01T12:00:00.000Z',
          },
        },
      },

      // Authentication schemas
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Valid email address',
            example: 'john.doe@example.com',
          },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Password (min 8 chars, must contain uppercase, lowercase, and number)',
            example: 'SecurePassword123',
          },
        },
      },

      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Registered email address',
            example: 'john.doe@example.com',
          },
          password: {
            type: 'string',
            description: 'User password',
            example: 'SecurePassword123',
          },
        },
      },

      AuthResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Login successful',
          },
          data: {
            type: 'object',
            properties: {
              user: {
                $ref: '#/components/schemas/User',
              },
              token: {
                type: 'string',
                description: 'JWT authentication token',
                example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              },
              tokenExpiry: {
                type: 'string',
                description: 'Token expiration time',
                example: '24h',
              },
            },
          },
        },
      },

      // Group schemas
      Group: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Unique group identifier',
            example: '507f1f77bcf86cd799439012',
          },
          name: {
            type: 'string',
            description: 'Group name',
            example: 'Development Team',
          },
          description: {
            type: 'string',
            description: 'Group description',
            example: 'Discussion group for development team members',
          },
          creator: {
            type: 'string',
            description: 'User ID of group creator',
            example: '507f1f77bcf86cd799439011',
          },
          members: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array of member user IDs',
            example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013'],
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T12:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T12:00:00.000Z',
          },
        },
      },

      CreateGroupRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Group name',
            example: 'Development Team',
          },
          description: {
            type: 'string',
            maxLength: 500,
            description: 'Optional group description',
            example: 'Discussion group for development team members',
          },
        },
      },

      // Message schemas
      Message: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Unique message identifier',
            example: '507f1f77bcf86cd799439014',
          },
          content: {
            type: 'string',
            description: 'Message content (encrypted)',
            example: 'Hello everyone!',
          },
          sender: {
            type: 'string',
            description: 'User ID of message sender',
            example: '507f1f77bcf86cd799439011',
          },
          group: {
            type: 'string',
            description: 'Group ID where message was sent',
            example: '507f1f77bcf86cd799439012',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Message creation timestamp',
            example: '2024-01-01T12:00:00.000Z',
          },
          edited: {
            type: 'boolean',
            description: 'Whether message has been edited',
            example: false,
          },
          editedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last edit timestamp',
            example: '2024-01-01T12:30:00.000Z',
          },
        },
      },

      SendMessageRequest: {
        type: 'object',
        required: ['content'],
        properties: {
          content: {
            type: 'string',
            minLength: 1,
            maxLength: 2000,
            description: 'Message content',
            example: 'Hello everyone! How is the project going?',
          },
        },
      },

      // Response schemas
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Operation completed successfully',
          },
          data: {
            type: 'object',
            description: 'Response data (varies by endpoint)',
          },
        },
      },

      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Error description',
          },
          error: {
            type: 'string',
            description: 'Error code',
            example: 'VALIDATION_ERROR',
          },
          errors: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Detailed validation errors (when applicable)',
            example: ['Email is required', 'Password must be at least 8 characters'],
          },
        },
      },

      ValidationError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Validation failed',
          },
          error: {
            type: 'string',
            example: 'VALIDATION_ERROR',
          },
          errors: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: ['Email is required', 'Password must be at least 8 characters'],
          },
        },
      },

      RateLimitError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Too many requests',
          },
          error: {
            type: 'string',
            example: 'RATE_LIMIT_EXCEEDED',
          },
          retryAfter: {
            type: 'string',
            example: '15 minutes',
          },
        },
      },

      // Health check schemas
      HealthResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                example: 'healthy',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: '2024-01-01T12:00:00.000Z',
              },
              version: {
                type: 'string',
                example: '1.0.0',
              },
              environment: {
                type: 'string',
                example: 'development',
              },
              database: {
                type: 'string',
                example: 'connected',
              },
            },
          },
        },
      },

      // Real-time messaging schemas
      WebSocketConnection: {
        type: 'object',
        properties: {
          auth: {
            type: 'object',
            properties: {
              token: {
                type: 'string',
                description: 'JWT token for authentication',
                example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              },
            },
          },
        },
      },

      ConnectionSuccess: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'ID of the authenticated user',
            example: '507f1f77bcf86cd799439011',
          },
          userEmail: {
            type: 'string',
            description: 'Email of the authenticated user',
            example: 'john.doe@example.com',
          },
          socketId: {
            type: 'string',
            description: 'Unique socket connection ID',
            example: 'W5CYwAf7kqGEfYYWAAAB',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Connection timestamp',
            example: '2024-01-01T12:00:00.000Z',
          },
        },
      },

      // Message events
      MessageSend: {
        type: 'object',
        required: ['groupId', 'content'],
        properties: {
          groupId: {
            type: 'string',
            description: 'ID of the group to send message to',
            example: '507f1f77bcf86cd799439012',
          },
          content: {
            type: 'string',
            description: 'Message content',
            example: 'Hello everyone!',
          },
          clientId: {
            type: 'string',
            description: 'Client-generated ID for message tracking',
            example: 'client-msg-123',
          },
          replyTo: {
            type: 'string',
            description: 'ID of message being replied to (optional)',
            example: '507f1f77bcf86cd799439014',
          },
        },
      },

      MessageSent: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Message sent successfully',
          },
          data: {
            type: 'object',
            properties: {
              clientId: {
                type: 'string',
                description: 'Client-generated ID for message tracking',
                example: 'client-msg-123',
              },
              messageId: {
                type: 'string',
                description: 'Server-generated message ID',
                example: '507f1f77bcf86cd799439014',
              },
            },
          },
        },
      },

      MessageReceived: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Unique message identifier',
            example: '507f1f77bcf86cd799439014',
          },
          content: {
            type: 'string',
            description: 'Message content',
            example: 'Hello everyone!',
          },
          sender: {
            type: 'object',
            properties: {
              _id: {
                type: 'string',
                example: '507f1f77bcf86cd799439011',
              },
              email: {
                type: 'string',
                example: 'john.doe@example.com',
              },
            },
          },
          group: {
            type: 'string',
            description: 'Group ID',
            example: '507f1f77bcf86cd799439012',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T12:00:00.000Z',
          },
          replyTo: {
            type: 'string',
            description: 'ID of message being replied to (if applicable)',
            example: '507f1f77bcf86cd799439013',
          },
        },
      },

      // Presence events
      UserPresence: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User ID',
            example: '507f1f77bcf86cd799439011',
          },
          status: {
            type: 'string',
            enum: ['online', 'offline'],
            description: 'User presence status',
            example: 'online',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T12:00:00.000Z',
          },
        },
      },

      UsersOnline: {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array of online user IDs',
            example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013'],
          },
        },
      },

      TypingIndicator: {
        type: 'object',
        required: ['groupId'],
        properties: {
          groupId: {
            type: 'string',
            description: 'Group ID where typing is happening',
            example: '507f1f77bcf86cd799439012',
          },
        },
      },

      UserTyping: {
        type: 'object',
        properties: {
          groupId: {
            type: 'string',
            description: 'Group ID',
            example: '507f1f77bcf86cd799439012',
          },
          userId: {
            type: 'string',
            description: 'User ID of person typing',
            example: '507f1f77bcf86cd799439011',
          },
          userEmail: {
            type: 'string',
            description: 'Email of person typing',
            example: 'john.doe@example.com',
          },
        },
      },

      // Group events
      GroupJoin: {
        type: 'object',
        required: ['groupId'],
        properties: {
          groupId: {
            type: 'string',
            description: 'Group ID to join',
            example: '507f1f77bcf86cd799439012',
          },
        },
      },

      RoomJoined: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['group', 'direct'],
            example: 'group',
          },
          id: {
            type: 'string',
            description: 'Room/group ID',
            example: '507f1f77bcf86cd799439012',
          },
          name: {
            type: 'string',
            description: 'Room/group name',
            example: 'Development Team',
          },
        },
      },

      UserJoined: {
        type: 'object',
        properties: {
          groupId: {
            type: 'string',
            description: 'Group ID',
            example: '507f1f77bcf86cd799439012',
          },
          userId: {
            type: 'string',
            description: 'User ID who joined',
            example: '507f1f77bcf86cd799439011',
          },
          userEmail: {
            type: 'string',
            description: 'Email of user who joined',
            example: 'john.doe@example.com',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T12:00:00.000Z',
          },
        },
      },

      // WebSocket error
      WebSocketError: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Error message',
            example: 'Authentication failed',
          },
          code: {
            type: 'string',
            description: 'Error code',
            example: 'AUTHENTICATION_FAILED',
          },
        },
      },
    },

    // Response examples
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse',
            },
            example: {
              success: false,
              message: 'No token provided',
              error: 'NO_TOKEN_PROVIDED',
            },
          },
        },
      },

      ForbiddenError: {
        description: 'Access denied',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse',
            },
            example: {
              success: false,
              message: 'Access denied',
              error: 'ACCESS_DENIED',
            },
          },
        },
      },

      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse',
            },
            example: {
              success: false,
              message: 'Resource not found',
              error: 'NOT_FOUND',
            },
          },
        },
      },

      ValidationError: {
        description: 'Validation failed',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ValidationError',
            },
          },
        },
      },

      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RateLimitError',
            },
          },
        },
      },
    },
  },

  // Global security requirement (can be overridden per endpoint)
  security: [],

  tags: [
    {
      name: 'Health',
      description: 'System health and status endpoints',
    },
    {
      name: 'Authentication',
      description: 'User registration and authentication endpoints',
    },
    {
      name: 'Users',
      description: 'User management and profile endpoints',
    },
    {
      name: 'Groups',
      description: 'Group creation and management endpoints',
    },
    {
      name: 'Messages',
      description: 'Message sending and retrieval endpoints',
    },
    {
      name: 'Real-Time',
      description: 'WebSocket-based real-time messaging and presence features',
    },
  ],
};

// Add WebSocket connection documentation
swaggerDefinition.paths = {
  ...swaggerDefinition.paths,
  '/ws': {
    get: {
      tags: ['Real-Time'],
      summary: 'WebSocket connection endpoint',
      description: `
        This endpoint represents the Socket.io WebSocket connection.
        
        ## Connection Instructions
        
        1. Obtain a JWT token by registering or logging in through the REST API
        2. Establish a Socket.io connection with the token in the auth object:
        \`\`\`javascript
        const socket = io("https://your-api-domain.com", {
          auth: {
            token: "your-jwt-token"
          }
        });
        \`\`\`
        
        3. Socket.io will handle transport selection (WebSocket with fallback to polling)
        
        ## Available Events
        
        ### System Events
        * \`connect\` - Connection established
        * \`connect:success\` - Authentication successful
        * \`disconnect\` - Connection closed
        * \`connect_error\` - Connection error
        * \`error\` - Application-specific error
        
        ### Message Events
        * \`message:send\` (client → server) - Send new message
        * \`message:sent\` (server → client) - Message sent confirmation
        * \`message:received\` (server → client) - New message received
        * \`message:read\` (client → server) - Mark message as read
        * \`message:read-receipt\` (server → client) - Message read notification
        
        ### Presence Events
        * \`user:presence\` (server → client) - User online/offline status
        * \`users:online\` (server → client) - List of online users
        * \`typing:start\` (client → server) - User started typing
        * \`typing:stop\` (client → server) - User stopped typing
        * \`user:typing\` (server → client) - User typing notification
        
        ### Group Events
        * \`group:join\` (client → server) - Join a group's room
        * \`room:joined\` (server → client) - Room joined confirmation
        * \`group:leave\` (client → server) - Leave a group's room
        * \`user:joined\` (server → client) - User joined notification
        * \`user:left\` (server → client) - User left notification
        
        ## For detailed event formats and examples, see the schemas defined in this documentation.
      `,
      responses: {
        '101': {
          description: 'WebSocket connection established and upgraded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ConnectionSuccess',
              },
            },
          },
        },
        '401': {
          description: 'Authentication failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WebSocketError',
              },
              example: {
                message: 'Authentication failed: Invalid token',
                code: 'AUTHENTICATION_FAILED',
              },
            },
          },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js',
  ],
};

const specs = swaggerJSDoc(options);
module.exports = { specs, swaggerUi };
