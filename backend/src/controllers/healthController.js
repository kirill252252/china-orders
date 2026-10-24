import { healthCheck as pgHealth } from '../config/db.js';
import { healthCheck as redisHealth } from '../config/redis.js';
import { config } from '../config/index.js';

export async function healthCheck(req, res) {
  const start = Date.now();
  let pgOk = false;
  let redisOk = false;
  let pgError = null;
  let redisError = null;

  try {
    pgOk = await pgHealth();
  } catch (e) {
    pgError = e.message;
  }

  try {
    redisOk = await redisHealth();
  } catch (e) {
    redisError = e.message;
  }

  const duration = Date.now() - start;
  const healthy = pgOk && redisOk;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      version: '1.0.0',
      checks: {
        postgres: { status: pgOk ? 'up' : 'down', error: pgError },
        redis: { status: redisOk ? 'up' : 'down', error: redisError },
      },
      responseTimeMs: duration,
    },
  });
}