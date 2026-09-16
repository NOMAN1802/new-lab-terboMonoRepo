import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import httpStatus from 'http-status';
import config from './app/config';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import routes from './app/routes';

const app: Application = express();

// Behind the shared host's reverse proxy — needed for correct client IPs,
// which the rate limiters below key on.
app.set('trust proxy', 1);

app.use(helmet());

// Parsers
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Strip $-prefixed and dotted keys so query/body objects cannot smuggle
// Mongo operators into a filter.
app.use(mongoSanitize());

const allowedOrigins = config.client_url
  ? config.client_url.split(',').map((url: string) => url.trim())
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Broad limit for the API surface.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again shortly.',
    },
  })
);

// Tight limit on credential endpoints to blunt brute-force attempts.
app.use(
  ['/api/v1/auth/login', '/api/v1/auth/refresh-token'],
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many login attempts. Please try again in 15 minutes.',
    },
  })
);

/**
 * The patient QR surface is unauthenticated, so it is an enumeration target in
 * a way the staff API is not. The broad 500/15min limit above is shared with
 * genuine reception traffic and far too loose here.
 *
 * The verify endpoint gets its own tighter budget on top: the per-invoice
 * lockout in the service stops someone grinding one invoice, and this stops
 * them spreading the same effort across many.
 */
app.use(
  '/api/v1/public/reports/:token/verify',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many attempts. Please try again in 15 minutes.',
    },
  })
);

app.use(
  '/api/v1/public',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again shortly.',
    },
  })
);

app.use('/api/v1', routes);

app.get('/', (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: '🔬 New Lab Diagnostic & Consultation Centre API',
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
