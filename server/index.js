const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config({ path: require('path').join(__dirname, '.env.local') });

// Database connection
const connectDB = require("./config/database");
const { dbService } = require("./config/database");
const RealTimeService = require("./services/RealTimeService");
const HealthCheckService = require("./services/HealthCheckService");
const DatabaseRecoveryManager = require("./services/DatabaseRecoveryManager");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const neighbourhoodRoutes = require("./routes/neighbourhoods");
const chatRoutes = require("./routes/chat");
const noticeRoutes = require("./routes/notices");
const reportRoutes = require("./routes/reports");
const statisticsRoutes = require("./routes/statistics");
const uploadRoutes = require("./routes/upload");
const friendRoutes = require("./routes/friends");
const privateChatRoutes = require("./routes/privateChat");
const settingsRoutes = require("./routes/settings");
const adminRoutes = require("./routes/admin");
const moderationRoutes = require("./routes/moderation");
const healthRoutes = require("./routes/health");
const databaseMetricsRoutes = require("./routes/database-metrics");
const rateLimitStatusRoutes = require("./routes/rate-limit-status");
const searchRoutes = require("./routes/search");
const notificationRoutes = require("./routes/notifications");
const termsRoutes = require("./routes/terms");
const legalRoutes = require("./routes/legal");
const { authenticateToken } = require("./middleware/auth");
const { requireActiveUser } = require("./middleware/adminAuth");
const { setupSocketHandlers } = require("./socket/handlers");
const { 
  globalErrorHandler, 
  timeoutHandler, 
  databaseErrorHandler,
  notFoundHandler 
} = require("./middleware/errorHandling");

// Initialize services
let dbConnection = null;
let healthCheckService = null;
let recoveryManager = null;

// Create Express app and HTTP server
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Access-Control-Allow-Origin",
    ],
  },
});

app.use(
  "/uploads",
  express.static("uploads", {
    setHeaders: (res, path, stat) => {
      res.set("Access-Control-Allow-Origin", "http://localhost:3000"); // or '*'
      res.set("Access-Control-Allow-Methods", "GET");
    },
  })
);


// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting configuration - DISABLED FOR DEVELOPMENT
// const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS || (15 * 60 * 1000)); // 15 minutes
// const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || (process.env.NODE_ENV === 'development' ? 1000 : 100));
// const ADMIN_RATE_LIMIT_MAX = parseInt(process.env.ADMIN_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'development' ? 5000 : 1000));

// General rate limiting - DISABLED
// const limiter = rateLimit({
//   windowMs: RATE_LIMIT_WINDOW,
//   max: RATE_LIMIT_MAX,
//   message: {
//     error: 'Too many requests from this IP, please try again later.',
//     retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// Higher rate limit for admin endpoints - DISABLED
// const adminLimiter = rateLimit({
//   windowMs: RATE_LIMIT_WINDOW,
//   max: ADMIN_RATE_LIMIT_MAX,
//   message: {
//     error: 'Too many admin requests from this IP, please try again later.',
//     retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   keyGenerator: (req) => {
//     // Use user ID if available for more granular limiting
//     return req.user?.id || req.ip;
//   }
// });

// app.use(limiter); // DISABLED

// CORS
app.use(
  cors({
    origin: [
      process.env.CLIENT_URL || "http://localhost:3000",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Access-Control-Allow-Origin",
    ],
    exposedHeaders: ["Authorization"],
    optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  })
);

// Additional CORS headers for preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files (uploads)
app.use("/uploads", express.static("uploads"));

// Global middleware
app.use(timeoutHandler(15000)); // 15 second timeout
app.use(databaseErrorHandler);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", authenticateToken, requireActiveUser, userRoutes);
app.use("/api/neighbourhoods", authenticateToken, requireActiveUser, neighbourhoodRoutes);
app.use("/api/chat", authenticateToken, requireActiveUser, chatRoutes);
app.use("/api/notices", authenticateToken, requireActiveUser, noticeRoutes);
app.use("/api/reports", authenticateToken, requireActiveUser, reportRoutes);
app.use("/api/statistics", authenticateToken, requireActiveUser, statisticsRoutes);
app.use("/api/upload", authenticateToken, requireActiveUser, uploadRoutes);
app.use("/api/friends", authenticateToken, requireActiveUser, friendRoutes);
app.use("/api/private-chat", authenticateToken, requireActiveUser, privateChatRoutes);
app.use("/api/settings", authenticateToken, requireActiveUser, settingsRoutes);
app.use("/api/search", authenticateToken, requireActiveUser, searchRoutes);
app.use("/api/notifications", authenticateToken, requireActiveUser, notificationRoutes);
app.use("/api/terms", termsRoutes);
app.use("/api/legal", legalRoutes);
app.use("/api/legal", legalRoutes);
app.use("/api/admin", adminRoutes); // adminLimiter disabled for development
app.use("/api/moderation", moderationRoutes);

// Health check routes
app.use("/api/health", healthRoutes);

// Database metrics routes (adminLimiter disabled for development)
app.use("/api/database-metrics", databaseMetricsRoutes);

// Rate limit status routes (adminLimiter disabled for development)
app.use("/api/rate-limit", rateLimitStatusRoutes);

// Change streams status endpoint
app.get("/api/health/change-streams", authenticateToken, (req, res) => {
  const realTimeService = req.app.get('realTimeService');
  
  if (!realTimeService) {
    return res.status(503).json({ 
      status: 'unavailable',
      message: 'Real-time service not initialized'
    });
  }
  
  const status = realTimeService.getStatus();
  res.json({
    status: 'available',
    initialized: status.initialized,
    activeStreams: status.changeStreams.activeStreams,
    collections: status.changeStreams.collections
  });
});

// Make io instance available to routes
app.set('io', io);

// Socket.io setup
setupSocketHandlers(io);

/**
 * Initialize all services in the correct order with proper error handling
 * This function implements a robust startup sequence with retry logic
 */
async function initializeServices() {
  console.log('Starting server initialization...');
  
  try {
    // Step 1: Connect to MongoDB with retry logic
    console.log('Connecting to MongoDB...');
    dbConnection = await connectDB();
    console.log('MongoDB connection established successfully');
    
    // Make database service available to routes
    app.set('dbService', dbService);
    
    // Step 2: Initialize health check service
    console.log('Initializing health check service...');
    healthCheckService = new HealthCheckService(dbService, {
      checkIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000'),
      unhealthyThreshold: parseInt(process.env.HEALTH_UNHEALTHY_THRESHOLD || '3'),
      alertThreshold: parseInt(process.env.HEALTH_ALERT_THRESHOLD || '5'),
      latencyThresholdMs: parseInt(process.env.HEALTH_LATENCY_THRESHOLD_MS || '500'),
      criticalLatencyMs: parseInt(process.env.HEALTH_CRITICAL_LATENCY_MS || '2000'),
      maxErrorRate: parseFloat(process.env.HEALTH_MAX_ERROR_RATE || '0.1'),
      enableAlerts: process.env.HEALTH_ENABLE_ALERTS !== 'false'
    });
    
    // Start health checks
    healthCheckService.start();
    console.log('Health check service initialized successfully');
    
    // Make health check service available to routes
    app.set('healthCheckService', healthCheckService);
    
    // Step 3: Initialize recovery manager
    console.log('Initializing database recovery manager...');
    recoveryManager = new DatabaseRecoveryManager(dbService, healthCheckService, {
      circuitBreakerFailureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
      circuitBreakerResetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
      maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS || '3'),
      recoveryBackoffMs: parseInt(process.env.RECOVERY_BACKOFF_MS || '5000'),
      enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
      enableGracefulDegradation: process.env.ENABLE_GRACEFUL_DEGRADATION !== 'false'
    });
    
    // Make recovery manager available to routes
    app.set('recoveryManager', recoveryManager);
    console.log('Database recovery manager initialized successfully');
    
    // Step 4: Initialize real-time service with MongoDB change streams
    console.log('Initializing real-time service...');
    const realTimeService = new RealTimeService(io, {
      collections: ['messages', 'reports', 'notices', 'chatgroups', 'privatechats'],
      maxRetries: parseInt(process.env.CHANGE_STREAM_MAX_RETRIES || '10'),
      initialDelayMs: parseInt(process.env.CHANGE_STREAM_INITIAL_DELAY_MS || '1000'),
      maxDelayMs: parseInt(process.env.CHANGE_STREAM_MAX_DELAY_MS || '60000')
    });
    
    await realTimeService.initialize();
    console.log('Real-time service initialized successfully');
    
    // Make real-time service available to routes
    app.set('realTimeService', realTimeService);
    
    console.log('All services initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize services:', error);
    
    // Attempt to clean up any partially initialized services
    await cleanupServices();
    
    // Return false to indicate initialization failure
    return false;
  }
}

/**
 * Clean up services during shutdown or failed initialization
 */
async function cleanupServices() {
  console.log('Cleaning up services...');
  
  // Clean up health check service
  if (healthCheckService) {
    try {
      healthCheckService.stop();
      console.log('Health check service stopped');
    } catch (error) {
      console.error('Error stopping health check service:', error);
    }
  }
  
  // Clean up database connection
  if (dbService && dbService.isConnected) {
    try {
      await dbService.disconnect();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
  
  // Clean up real-time service
  const realTimeService = app.get('realTimeService');
  if (realTimeService) {
    try {
      await realTimeService.close();
      console.log('Real-time service closed');
    } catch (error) {
      console.error('Error closing real-time service:', error);
    }
  }
}

/**
 * Handle graceful shutdown
 */
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  
  // Clean up all services
  await cleanupServices();
  
  // Close server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// 404 handler for undefined routes
app.use("*", notFoundHandler);

// Global error handling middleware (must be last)
app.use(globalErrorHandler);

const PORT = process.env.PORT || 5001;

// Start the server with proper initialization
(async () => {
  try {
    // Initialize all services
    const initialized = await initializeServices();
    
    if (!initialized) {
      console.error('Failed to initialize services. Server will not start.');
      process.exit(1);
    }
    
    // Start the HTTP server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error('Fatal error during server startup:', error);
    process.exit(1);
  }
})();
