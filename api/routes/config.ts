/**
 * Config Routes
 *
 * Reports where this process takes its credentials from, and tests a credential
 * set without storing it. It deliberately cannot be *told* which eMAG account
 * to act as: credentials travel on every request as X-Emag-* headers (see
 * `getClientForRequest`), because a process that stores one account's keys
 * serves them to every caller — every account on a tenant, and every tenant in
 * a shared process.
 *
 * The credential-push endpoints that used to write process.env were removed for
 * that reason.
 */

import { Router, Request, Response } from 'express';
import { Emag, Platform, isValidPlatform } from '../../src';

const router = Router();

/**
 * GET /api/config
 * Never reports a username: in a shared process that would name another
 * merchant's account.
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      mode: 'per-request',
      credentialSource: 'request headers',
    },
  });
});

/**
 * POST /api/config/test
 * Verify a credential set without storing it. The keys come from the body, are
 * used for exactly one call, and are then discarded.
 */
router.post('/test', async (req: Request, res: Response) => {
  const { username, password, platform } = req.body;

  if (!username || !password) {
    res.status(400).json({
      success: false,
      error: 'Missing required credentials (username, password)',
    });
    return;
  }

  const p = platform || 'ro';
  if (!isValidPlatform(p)) {
    res.status(400).json({
      success: false,
      error: 'Invalid platform. Must be one of: ro, bg, hu, fd_ro, fd_bg',
    });
    return;
  }

  try {
    const testClient = new Emag(username, password, p as Platform);
    const result = await testClient.getCategories({ currentPage: 1, itemsPerPage: 1 });

    res.json({
      success: !result.isError,
      message: result.isError ? 'Connection failed' : 'Connection successful',
      data: {
        isError: result.isError,
        messages: result.messages,
        categoriesFound: result.results?.length || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Connection test failed',
    });
  }
});

export default router;
