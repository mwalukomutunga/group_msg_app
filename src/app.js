const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');

const configureDependencies = require('./config/dependencies');
const container = configureDependencies();

const env = container.get('env');
const database = container.get('database');
const { specs, swaggerUi } = require('./config/swagger');

const { globalErrorHandler, notFoundHandler, requestId } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const groupRoutes = require('./routes/group');
const messageRoutes = require('./routes/message');

const app = express();

// Trust proxy for Elastic Beanstalk load balancer
app.set('trust proxy', 1);
if (!env.isTest()) {
  env.printSummary();
}

app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false,
}));

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

let databaseStatus = 'disconnected';

if (!env.isTest()) {
  database.connect()
    .then(() => {
      databaseStatus = 'connected';
      logger.info('✅ Application initialization complete');
    })
    .catch((error) => {
      databaseStatus = 'error';
      logger.error('❌ Failed to initialize database:', { message: error.message });
    });
} else {
  databaseStatus = 'connected';
}
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

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

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/messages', messageRoutes);

app.use('*', notFoundHandler);
app.use(globalErrorHandler);

const { initializeSocketServer } = require('./realtime/socket');
const PORT = env.get('PORT');

const server = http.createServer(app);

let io;
if (!env.isTest()) {
  io = initializeSocketServer(server);
}

if (!env.isTest()) {
  server.listen(PORT, () => {
    logger.info(`🚀 Group Messaging Backend server running on port ${PORT}`);
    logger.info(`📍 Environment: ${env.get('NODE_ENV')}`);
    logger.info(`🔗 Health check available at: http://localhost:${PORT}/health`);
    logger.info(`📚 API Documentation available at: http://localhost:${PORT}/api-docs`);
    logger.info('🔌 Real-time messaging enabled: WebSocket server active');
  });

  // Graceful shutdown handlers
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

module.exports = { app, server, io };
