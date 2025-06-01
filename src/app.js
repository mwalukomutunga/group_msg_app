const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');

// Configure dependency injection first
const configureDependencies = require('./config/dependencies');
const container = configureDependencies();

// Get dependencies from the container
const env = container.get('env');
const database = container.get('database');
const { specs, swaggerUi } = require('./config/swagger');

const { globalErrorHandler, notFoundHandler, requestId } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const groupRoutes = require('./routes/group');
const messageRoutes = require('./routes/message');

const app = express();

// Print environment summary if not in test
if (!env.isTest()) {
  env.printSummary();
}

// Configure middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
// Configure CORS with support for multiple origins
const corsOrigins = env.get('CORS_ORIGIN');
const corsOptions = {
  origin: corsOrigins === '*' ? '*' : corsOrigins.split(','),
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(requestId);
app.use(express.json({ limit: '10mb' }));

if (!env.isTest()) {
  app.use(morgan('combined'));
}

// Database connection status tracking
let databaseStatus = 'disconnected';

// Add Vercel-specific database connection middleware
if (process.env.VERCEL) {
  app.use(async (req, res, next) => {
    // Connect to database on first request if we're in Vercel and not connected
    if (databaseStatus === 'pending' || databaseStatus === 'disconnected') {
      logger.info('🔄 Connecting to database on first request in Vercel environment');
      try {
        await database.connect();
        databaseStatus = 'connected';
        logger.info('✅ Database connected successfully in Vercel environment');
      } catch (error) {
        databaseStatus = 'error';
        logger.error('❌ Failed to connect to database in Vercel environment:', { message: error.message });
        // Don't fail the request, continue and let the API handle potential DB errors
      }
    }
    next();
  });
}

// Connect to database if not in test mode
if (!env.isTest()) {
  // For Vercel, we need to ensure database connection handling is compatible with serverless
  if (process.env.VERCEL) {
    // In Vercel, connection will be handled lazily on first request
    // This prevents connection issues during cold starts
    logger.info('🔄 Running in Vercel environment, database will connect on first request');
    databaseStatus = 'pending';
  } else {
    // Standard connection for non-serverless environments
    database.connect()
      .then(() => {
        databaseStatus = 'connected';
        logger.info('✅ Application initialization complete');
      })
      .catch((error) => {
        databaseStatus = 'error';
        logger.error('❌ Failed to initialize database:', { message: error.message });
      });
  }
} else {
  databaseStatus = 'connected';
}

// Set up Swagger docs in all environments
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Group Messaging API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    tryItOutEnabled: true,
    onComplete: function() {
      // Fix for Swagger UI Bearer token handling
      const oldAuthorize = this.authActions.authorize;
      this.authActions.authorize = function (credentials) {
        const newAuth = JSON.parse(JSON.stringify(credentials));
        
        // Add Bearer prefix if not already present for our BearerAuth scheme
        if (newAuth.BearerAuth && newAuth.BearerAuth.value && !newAuth.BearerAuth.value.startsWith('Bearer ')) {
          newAuth.BearerAuth.value = `Bearer ${newAuth.BearerAuth.value}`;
        }
        
        return oldAuthorize(newAuth);
      };
    },
  },
}));

// Only redirect root to API docs in development
if (env.isDevelopment()) {
  app.get('/', (req, res) => {
    res.redirect('/api-docs');
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = env.isTest() ? 'test' : (database.isConnected() ? 'connected' : databaseStatus);

  res.status(200).json({
    success: true,
    data: {
      status: dbStatus === 'connected' || dbStatus === 'test' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: env.get('NODE_ENV'),
      database: dbStatus,
    },
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/messages', messageRoutes);

// Error handling
app.use('*', notFoundHandler);
app.use(globalErrorHandler);

// Import Socket.io setup
const { initializeSocketServer } = require('./realtime/socket');

const PORT = env.get('PORT');

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.io and attach to HTTP server only in non-Vercel environments
let io;
if (!env.isTest() && !process.env.VERCEL) {
  io = initializeSocketServer(server);
}

// Only start the server in non-Vercel environments
if (!env.isTest() && !process.env.VERCEL) {
  // Use server.listen instead of app.listen
  server.listen(PORT, () => {
    logger.info(`🚀 Group Messaging Backend server running on port ${PORT}`);
    logger.info(`📍 Environment: ${env.get('NODE_ENV')}`);
    logger.info(`🔗 Health check available at: http://localhost:${PORT}/health`);
    logger.info(`📚 API Documentation available at: http://localhost:${PORT}/api-docs`);
    logger.info('🔌 Real-time messaging enabled: WebSocket server active');
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    server.close(async () => {
      await database.disconnect();
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    server.close(async () => {
      await database.disconnect();
      process.exit(0);
    });
  });
}

// Conditional export based on environment
// For Vercel, export the Express app instance directly
// For local development and testing, export the full object
if (process.env.VERCEL) {
  // Export Express app for Vercel serverless deployment
  module.exports = app;
} else {
  // Export for testing and local development
  module.exports = { app, server, io };
}
