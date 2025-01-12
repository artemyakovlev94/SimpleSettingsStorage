import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import createError from 'http-errors';

dotenv.config();

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const max = parseInt(process.env.RATE_LIMIT_MAX, 10) || 100;

const limiter = rateLimit({
  keyGenerator: (req) => req.ip,
  windowMs,
  max,
  handler: (req, res, next) => {
    next(createError(429, "Превышен лимит запросов, повторите попытку позже."));
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default limiter;
