/**
 * Internal API Key Authentication Middleware
 *
 * Validates that incoming requests carry a shared secret in the
 * X-Internal-API-Key header. This is a defense-in-depth measure:
 * the eMAG service should only be reachable via Docker networking,
 * but this middleware ensures even direct access is blocked without the key.
 */

import { Request, Response, NextFunction } from 'express';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

export const requireInternalApiKey = (req: Request, res: Response, next: NextFunction): void => {
  if (!INTERNAL_API_KEY) {
    console.warn('[InternalAuth] INTERNAL_API_KEY not set — rejecting all requests. Set it in the environment.');
    res.status(503).json({
      success: false,
      error: 'Service not configured (missing internal API key)',
    });
    return;
  }

  const provided = req.headers['x-internal-api-key'] as string | undefined;

  if (!provided || provided !== INTERNAL_API_KEY) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized — invalid or missing internal API key',
    });
    return;
  }

  next();
};
