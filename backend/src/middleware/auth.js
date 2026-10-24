import { verifyAccess } from '../utils/tokens.js';
import { AppError } from '../utils/errors.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Access token required');
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyAccess(token);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Access token expired');
    }
    throw AppError.unauthorized('Invalid access token');
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }
    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden('Insufficient permissions');
    }
    next();
  };
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyAccess(token);
    req.user = payload;
  } catch {
    // ignore invalid token
  }
  next();
}