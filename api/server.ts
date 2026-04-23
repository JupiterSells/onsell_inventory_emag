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
import { errorHandler } from './middleware/errorHandler';

config();

const app: Application = express();
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

app.use('/api/config', configRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/rma', rmaRouter);
app.use('/api/awb', awbRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/invoices', invoicesRouter);

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
