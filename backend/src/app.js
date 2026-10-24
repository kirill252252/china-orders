import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './utils/errors.js';
import healthRoutes from './routes/healthRoutes.js';
import { redis } from './config/redis.js';
import authRoutes from './modules/auth/auth.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import managerRoutes from './modules/manager/manager.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import addressesRoutes from './modules/addresses/addresses.routes.js';
import calcRoutes from './modules/calc/calc.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: config.CORS_ORIGINS,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.set('X-Request-ID', req.headers['x-request-id'] || crypto.randomUUID());
  next();
});

app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/manager', managerRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/addresses', addressesRoutes);
app.use('/api/v1/calc', calcRoutes);
app.use('/api/v1/profile', profileRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export async function startServer() {
  await redis.connect();
  console.log('🔴 Redis connected');

  const server = app.listen(config.PORT, () => {
    console.log(`🚀 Server running on port ${config.PORT} (${config.NODE_ENV})`);
    console.log(`📍 Health: http://localhost:${config.PORT}/api/v1/health`);
  });

  const shutdown = async (signal) => {
    console.log(`\n📴 ${signal} received, shutting down...`);
    server.close(async () => {
      await redis.quit();
      console.log('🔴 Redis disconnected');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

startServer().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});