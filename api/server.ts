// Must stay first: patches axios before any client is constructed.
import '../src/utils/demoGuard';
// Next, before anything wraps the console or builds a client: the log contract.
import '../src/utils/logContract';
import { onsellLogMiddleware } from '../src/utils/onsellLog';
// Second, for the same reason: the feedback trace patches axios and console.
import '../src/utils/feedbackTrace';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from 'dotenv';

import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import rmaRouter from './routes/rma';
import awbRouter from './routes/awb';
import categoriesRouter from './routes/categories';
import invoicesRouter from './routes/invoices';
import configRouter from './routes/config';
import { errorHandler, recordMountPath } from './middleware/errorHandler';
import { requireInternalApiKey } from './middleware/internalAuth';
import { feedbackTraceMiddleware, handlerManifest, traceRecordHandler } from '../src/utils/feedbackTrace';

/** The name node_api's trace shows for this service's spans. */
const SERVICE = 'emag';

config();

const app: Application = express();
// First middleware: every request is a server span, credentials fingerprinted.
app.use(onsellLogMiddleware());
const PORT = process.env.API_PORT || 8002;

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : undefined;

app.use(cors(ALLOWED_ORIGINS ? { origin: ALLOWED_ORIGINS } : undefined));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const startTime = Date.now();
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'emag-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    dependencies: {
      emag_marketplace: 'external',
    },
  });
});

const getVersionInfo = () => ({
  service: 'emag-api',
  gitSha:
    process.env.GIT_SHA ??
    process.env.COMMIT_SHA ??
    process.env.SOURCE_VERSION ??
    process.env.HEROKU_SLUG_COMMIT ??
    null,
  buildTime: process.env.BUILD_TIME ?? process.env.BUILD_DATE ?? null,
  environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? null,
  imageTag: process.env.IMAGE_TAG ?? process.env.DOCKER_IMAGE_TAG ?? null,
});

app.get('/version', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getVersionInfo());
});

app.get('/health/version', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getVersionInfo());
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'eMAG API',
    version: '1.0.0',
    description: 'RESTful API wrapper for eMAG Marketplace integration',
    endpoints: {
      products: '/api/products',
      orders: '/api/orders',
      rma: '/api/rma',
      awb: '/api/awb',
      categories: '/api/categories',
      invoices: '/api/invoices',
      config: '/api/config',
    },
  });
});

/** The handler manifest: each mount's router file, put on the server span as `code.filepath`. */
const ROUTE_FILES: Record<string, string> = {
  '/api/config': 'api/routes/config.ts',
  '/api/products': 'api/routes/products.ts',
  '/api/orders': 'api/routes/orders.ts',
  '/api/rma': 'api/routes/rma.ts',
  '/api/awb': 'api/routes/awb.ts',
  '/api/categories': 'api/routes/categories.ts',
  '/api/invoices': 'api/routes/invoices.ts',
};

app.get('/internal/trace/handlers', requireInternalApiKey, (_req: Request, res: Response) => {
  res.json({ service: SERVICE, handlers: handlerManifest(app, ROUTE_FILES) });
});
app.get('/internal/trace/:traceId', requireInternalApiKey, traceRecordHandler(SERVICE));

app.use('/api', requireInternalApiKey);
app.use('/api', feedbackTraceMiddleware(SERVICE, ROUTE_FILES));
app.use('/api/config', recordMountPath, configRouter);
app.use('/api/products', recordMountPath, productsRouter);
app.use('/api/orders', recordMountPath, ordersRouter);
app.use('/api/rma', recordMountPath, rmaRouter);
app.use('/api/awb', recordMountPath, awbRouter);
app.use('/api/categories', recordMountPath, categoriesRouter);
app.use('/api/invoices', recordMountPath, invoicesRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`[EMAG] Server running on port ${PORT} (platform: ${process.env.EMAG_PLATFORM || 'ro'})`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[EMAG] Port ${PORT} is already in use`);
  } else {
    console.error('[EMAG] Server error:', err);
  }
  process.exit(1);
});

export default app;
